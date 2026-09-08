"""Client HTTP vers Medical Monitoring (BFF caissier)."""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import date, datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

DEFAULT_MEDICAL_URL = 'http://fultang-medical-backend:8000'
DEFAULT_GATEWAY_MEDICAL = 'http://api-gateway:8080/medical'
API_PREFIX = '/api/medical-monitoring'

# Grille indicative (FCFA) — à terme : service Infrastructure / tarification
TARIFS_ACTES = {
    'IRM': 150_000,
    'SCANNER': 120_000,
    'RADIO': 25_000,
    'ECHOGRAPHIE': 35_000,
    'NFS': 8_000,
    'GLYCEMIE': 3_000,
    'CONSULTATION': 15_000,
    'HOSPITALISATION': 50_000,
}


def _base_url() -> str:
    return os.getenv('SERVICE_MEDICAL_URL', DEFAULT_MEDICAL_URL).rstrip('/')


def _gateway_medical_url() -> str:
    return os.getenv('MEDICAL_GATEWAY_URL', DEFAULT_GATEWAY_MEDICAL).rstrip('/')


_TARIF_CACHE: dict[str, int] | None = None


def _load_tarif_cache() -> dict[str, int]:
    """Tarifs PrestationDeService + fallback TARIFS_ACTES."""
    global _TARIF_CACHE
    if _TARIF_CACHE is not None:
        return _TARIF_CACHE
    cache = dict(TARIFS_ACTES)
    try:
        from apps.comptabilite.models import PrestationDeService
        for p in PrestationDeService.objects.filter(actif=True):
            key = (p.libelle or p.code or '').upper()
            if key:
                cache[key] = int(p.tarif)
            cache[p.type_prestation.upper()] = int(p.tarif)
    except Exception as exc:
        logger.warning('[MedicalClient] tarifs DB ignorés: %s', exc)
    _TARIF_CACHE = cache
    return cache


def _tarif_for_exam(nom: str) -> int:
    nom_upper = (nom or '').upper()
    cache = _load_tarif_cache()
    for key, montant in cache.items():
        if len(key) > 2 and key in nom_upper:
            return montant
    return cache.get('CONSULTATION', TARIFS_ACTES['CONSULTATION'])


def _tarif_consultation() -> int:
    return _load_tarif_cache().get('CONSULTATION', TARIFS_ACTES['CONSULTATION'])


def _tarif_hospitalisation() -> int:
    return _load_tarif_cache().get('HOSPITALISATION', TARIFS_ACTES['HOSPITALISATION'])


def _parse_date_part(value) -> str | None:
    if not value:
        return None
    s = str(value)
    return s[:10] if len(s) >= 10 else None


def _days_since(date_str: str | None, ref: date) -> int | None:
    if not date_str:
        return None
    try:
        d = date.fromisoformat(date_str[:10])
        return (ref - d).days
    except ValueError:
        return None


def _extract_bearer_token(auth_header: str | None) -> str | None:
    if not auth_header:
        return None
    match = re.match(r'^Bearer\s+(.+)$', auth_header.strip(), re.IGNORECASE)
    return match.group(1) if match else None


def _get(path: str, token: str | None = None, timeout: int = 8) -> dict | list | None:
    """GET Medical API — essaie le service interne puis la Gateway (JWT requis).

    Transmet X-Tenant-ID (Tenant Context courant — voir
    config/tenant_routing/context.py) sur les DEUX chemins : la Gateway
    ET le repli direct SERVICE_MEDICAL_URL (qui contourne la Gateway).
    Sans ce header, un appel direct qui aboutirait accidentellement
    perdrait silencieusement le tenant courant côté Medical-Monitoring.
    Absent si aucun Tenant Context réel n'est établi (pool non assigné,
    ou hors cycle de requête) — jamais envoyé comme la chaîne "None".
    """
    headers = {'Accept': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'

    from config.tenant_routing.context import get_current_tenant_context
    tenant_context = get_current_tenant_context()
    if tenant_context is not None and tenant_context.tenant_id:
        headers['X-Tenant-ID'] = tenant_context.tenant_id

    # Gateway en premier : le JWT auth/personnel est accepté ; l'appel direct Medical renvoie souvent 401.
    bases = [_gateway_medical_url(), f'{_base_url()}{API_PREFIX}']
    seen = set()
    for base in bases:
        if base in seen:
            continue
        seen.add(base)
        url = f'{base}{path}'
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            logger.warning('[MedicalClient] GET %s failed: %s', url, exc)
    return None


def _as_list(data) -> list:
    if data is None:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get('results', [])
    return []


def _patient_age(birth) -> int | None:
    if not birth:
        return None
    try:
        if isinstance(birth, str):
            y = int(birth.split('-')[0])
        else:
            y = birth.year if hasattr(birth, 'year') else None
        return date.today().year - y if y else None
    except (ValueError, IndexError, TypeError):
        return None


def _montant_deja_paye(patient_id: str) -> int:
    """Somme des quittances validées en compta pour ce patient."""
    return _patient_quittance_stats(patient_id)['total_encaisse']


def _patient_quittance_stats(patient_id: str) -> dict:
    """Statistiques quittances pour un patient (historique caisse)."""
    from decimal import Decimal
    from django.db.models import Count, Sum
    from apps.caisse.models import Quittance

    pid = str(patient_id)
    agg_all = Quittance.objects.filter(patient_id=pid).aggregate(
        nb=Count('id'),
        total=Sum('montant'),
    )
    agg_validees = Quittance.objects.filter(
        patient_id=pid,
        est_validee=True,
    ).aggregate(nb=Count('id'), total=Sum('montant'))
    total_valide = agg_validees['total'] or Decimal('0')
    return {
        'nb_quittances': agg_all['nb'] or 0,
        'nb_quittances_validees': agg_validees['nb'] or 0,
        'total_encaisse': int(total_valide),
        'total_toutes_quittances': float(agg_all['total'] or 0),
    }


def _filter_prestations_fifo(prestations: list[dict], montant_paye: int) -> tuple[list[dict], int, int]:
    """
    Applique les paiements déjà encaissés sur les prestations (FIFO par date).
    Retourne (prestations_non_payées, montant_restant, montant_alloué_aux_prestations_affichées).
    """
    if not prestations:
        return [], 0, 0

    sorted_p = sorted(prestations, key=lambda p: p.get('date_tri') or '')
    credit = montant_paye
    unpaid: list[dict] = []

    for p in sorted_p:
        montant = int(p.get('montant', 0) or 0)
        if credit >= montant:
            credit -= montant
        else:
            unpaid.append(p)

    montant_du_unpaid = sum(int(p.get('montant', 0) or 0) for p in unpaid)
    montant_restant = max(0, montant_du_unpaid - credit)
    montant_alloue = montant_paye - credit

    # Nettoyer les champs internes avant envoi au frontend
    cleaned = []
    for p in unpaid:
        item = {k: v for k, v in p.items() if k != 'date_tri'}
        cleaned.append(item)

    return cleaned, montant_restant, montant_alloue


def _build_patient_entry(
    patient: dict,
    prestations: list[dict],
    montant_paye: int = 0,
    montant_restant: int | None = None,
) -> dict:
    pid = str(patient.get('id', ''))
    montant_du = sum(p.get('montant', 0) for p in prestations)
    if montant_restant is None:
        montant_restant = max(0, montant_du - montant_paye)
    return {
        'id': pid,
        'matricule': patient.get('matricule', ''),
        'nom': patient.get('nom', ''),
        'prenom': patient.get('prenom', ''),
        'date_naissance': patient.get('date_naissance'),
        'age': _patient_age(patient.get('date_naissance')),
        'contact': patient.get('numero_securite_sociale') or patient.get('contact', ''),
        'adresse': '',
        'id_session': None,
        'service_courant': prestations[0].get('service', 'laboratoire') if prestations else 'caisse',
        'personnel_responsable': 'caissier',
        'debut': None,
        'prestations_a_payer': prestations,
        'montant_du': montant_du,
        'montant_paye': montant_paye,
        'montant_restant': montant_restant,
        'montant_total_suggere': montant_restant,
        'peut_facturer': montant_restant > 0,
        'motif_caisse': ' ; '.join(
            f"{p['libelle']} ({p['montant']} FCFA)" for p in prestations
        ),
        **_patient_quittance_stats(pid),
    }


def _append_prestation(bucket: dict[str, list[dict]], pid: str, prestation: dict) -> None:
    """Évite les doublons (même id de prestation)."""
    items = bucket.setdefault(pid, [])
    pid_prest = prestation.get('id')
    if pid_prest and any(p.get('id') == pid_prest for p in items):
        return
    items.append(prestation)


def _fetch_medical_snapshot(token: str | None) -> dict | None:
    """Charge les listes Medical (lecture seule)."""
    if not token:
        return None
    patients_raw = _get('/patients/', token=token)
    consultations_raw = _get('/consultations/', token=token)
    examens_raw = _get('/examens/', token=token)
    visites_raw = _get('/visites/', token=token)
    hospitalisations_raw = _get('/hospitalisations/', token=token)
    if not any([patients_raw, consultations_raw, examens_raw, visites_raw]):
        return None

    consultations = _as_list(consultations_raw)
    visites = _as_list(visites_raw)
    return {
        'patients_by_id': {
            str(p['id']): p for p in _as_list(patients_raw) if p.get('id')
        },
        'consultations': consultations,
        'examens': _as_list(examens_raw),
        'visites': visites,
        'hospitalisations': _as_list(hospitalisations_raw),
        'consultation_to_patient': {
            str(c['id']): str(c['patient'])
            for c in consultations if c.get('id') and c.get('patient')
        },
        'consultation_meta': {
            str(c['id']): {
                'visite_id': str(c.get('visite') or ''),
                'date_tri': c.get('date_heure') or '',
            }
            for c in consultations if c.get('id')
        },
        'visites_a_facturer': {
            str(v['id'])
            for v in visites
            if v.get('id') and v.get('statut') in ('EN_COURS', 'TERMINE')
        },
        'visite_dates': {
            str(v['id']): v.get('date_heure') or ''
            for v in visites if v.get('id')
        },
    }


def _collect_patient_prestations(patient_id: str, snapshot: dict) -> list[dict]:
    """Tous les actes facturables d'un patient."""
    pid = str(patient_id)
    prestations: list[dict] = []
    bucket: dict[str, list[dict]] = {pid: prestations}

    consultation_to_patient = snapshot['consultation_to_patient']
    consultation_meta = snapshot['consultation_meta']
    visites_a_facturer = snapshot['visites_a_facturer']
    visite_dates = snapshot['visite_dates']
    consultation_ids_with_exam: set[str] = set()

    for exam in snapshot['examens']:
        if exam.get('statut') not in ('EN_ATTENTE', 'PRELEVE', 'REALISE', 'VALIDE'):
            continue
        cid = str(exam.get('consultation', ''))
        if consultation_to_patient.get(cid) != pid:
            continue
        consultation_ids_with_exam.add(cid)
        nom_exam = exam.get('nom', 'Examen')
        meta = consultation_meta.get(cid, {})
        date_tri = meta.get('date_tri') or ''
        _append_prestation(bucket, pid, {
            'id': f"examen-{exam.get('id', '')}",
            'type': 'examen',
            'libelle': nom_exam,
            'motif': exam.get('motif', ''),
            'montant': _tarif_for_exam(nom_exam),
            'statut_medical': exam.get('statut'),
            'service': 'laboratoire',
            'type_recette': 'laboratoire',
            'categorie': 'examen',
            'visite_id': meta.get('visite_id', ''),
            'consultation_id': cid,
            'date_tri': date_tri,
            'date_heure': date_tri,
        })

    for consultation in snapshot['consultations']:
        cid = str(consultation.get('id', ''))
        if str(consultation.get('patient', '')) != pid:
            continue
        visite_id = str(consultation.get('visite', ''))
        if visite_id not in visites_a_facturer and cid not in consultation_ids_with_exam:
            continue
        date_tri = consultation.get('date_heure') or ''
        _append_prestation(bucket, pid, {
            'id': f"consultation-{cid}",
            'type': 'consultation',
            'libelle': 'Consultation médicale',
            'motif': consultation.get('motif') or 'Consultation médicale',
            'montant': _tarif_consultation(),
            'statut_medical': 'A_FACTURER',
            'service': 'consultation',
            'type_recette': 'consultation',
            'categorie': 'consultation',
            'visite_id': visite_id,
            'consultation_id': cid,
            'date_tri': date_tri,
            'date_heure': date_tri,
        })

    for hosp in snapshot['hospitalisations']:
        if str(hosp.get('patient', '')) != pid:
            continue
        if hosp.get('statut') not in ('EN_COURS', 'TERMINE'):
            continue
        visite_id = str(hosp.get('visite') or '')
        date_tri = visite_dates.get(visite_id, '')
        libelle = f"Hospitalisation — {hosp.get('service') or 'service'}"
        if hosp.get('duree_prevue'):
            libelle += f" ({hosp.get('duree_prevue')})"
        _append_prestation(bucket, pid, {
            'id': f"hospitalisation-{hosp.get('id', '')}",
            'type': 'hospitalisation',
            'libelle': libelle,
            'motif': hosp.get('motif', ''),
            'montant': _tarif_hospitalisation(),
            'statut_medical': hosp.get('statut'),
            'service': hosp.get('service') or 'hospitalisation',
            'type_recette': 'hospitalisation',
            'categorie': 'hospitalisation',
            'visite_id': visite_id,
            'date_tri': date_tri,
            'date_heure': date_tri,
        })

    for visite in snapshot['visites']:
        if str(visite.get('patient', '')) != pid:
            continue
        if visite.get('statut') not in ('EN_COURS', 'TERMINE'):
            continue
        date_tri = visite.get('date_heure') or ''
        _append_prestation(bucket, pid, {
            'id': f"visite-{visite.get('id', '')}",
            'type': 'visite',
            'libelle': f"Visite — {visite.get('motif_visite', 'passage')}",
            'motif': visite.get('motif_visite', ''),
            'montant': 0,
            'statut_medical': visite.get('statut'),
            'service': 'consultation',
            'type_recette': 'consultation',
            'categorie': 'visite',
            'visite_id': str(visite.get('id', '')),
            'date_tri': date_tri,
            'date_heure': date_tri,
        })

    return sorted(prestations, key=lambda p: p.get('date_tri') or '')


def _classify_prestations_payment(
    prestations: list[dict],
    montant_paye: int,
) -> tuple[list[dict], list[dict]]:
    """Marque chaque acte payé/impayé via FIFO. Retourne (tous_classés, impayés)."""
    credit = montant_paye
    classified: list[dict] = []
    unpaid: list[dict] = []
    for p in sorted(prestations, key=lambda x: x.get('date_tri') or ''):
        montant = int(p.get('montant', 0) or 0)
        item = {k: v for k, v in p.items() if k != 'date_tri'}
        if montant <= 0:
            item['statut_encaissement'] = 'paye'
            item['quittance_numero'] = None
            classified.append(item)
            continue
        if credit >= montant:
            credit -= montant
            item['statut_encaissement'] = 'paye'
            item['quittance_numero'] = None
        else:
            item['statut_encaissement'] = 'impaye'
            item['quittance_numero'] = None
            unpaid.append(item)
        classified.append(item)
    return classified, unpaid


def _get_encaissements_valides(patient_id: str) -> list[dict]:
    from apps.caisse.models import Quittance

    result = []
    for q in Quittance.objects.filter(
        patient_id=str(patient_id),
        est_validee=True,
    ).select_related(
        'cheque', 'paiement_mobile', 'paiement_carte', 'virement',
    ).order_by('-date_creation')[:50]:
        detail = _quittance_payment_label(q)
        result.append({
            'id': q.id,
            'numero': q.numero,
            'date': q.date_creation.date().isoformat() if q.date_creation else None,
            'montant': float(q.montant),
            'motif': q.motif,
            'mode_paiement': q.mode_paiement,
            'mode_paiement_detail': detail,
            'est_validee': q.est_validee,
            'est_assure': q.est_assure,
            'montant_assurance': float(q.montant_assurance or 0),
            'montant_patient': float(q.montant_patient or 0),
        })
    return result


def _quittance_payment_label(q) -> str:
    mode = q.mode_paiement
    if mode == 'cheque' and hasattr(q, 'cheque') and q.cheque:
        return f"Chèque {q.cheque.numero} — {q.cheque.banque}"
    if mode == 'mobile_money' and hasattr(q, 'paiement_mobile') and q.paiement_mobile:
        pm = q.paiement_mobile
        return f"{pm.get_operateur_display() if hasattr(pm, 'get_operateur_display') else pm.operateur} — {pm.reference_transaction}"
    if mode == 'carte' and hasattr(q, 'paiement_carte') and q.paiement_carte:
        pc = q.paiement_carte
        return f"Carte ****{pc.quatre_derniers_chiffres}"
    if mode == 'virement' and hasattr(q, 'virement') and q.virement:
        v = q.virement
        return f"Virement {v.banque_emettrice} — {v.reference}"
    if mode == 'assurance':
        return f"Assurance {q.taux_couverture or 0}% — patient {q.montant_patient or q.montant} FCFA"
    if mode == 'especes':
        return 'Espèces'
    return mode or ''


def build_patient_billing_profile(
    patient_id: str,
    auth_header: str | None = None,
    date_ref: date | None = None,
) -> dict:
    """Profil facturation : actes, impayés, encaissements."""
    ref = date_ref or date.today()
    ref_str = ref.isoformat()
    pid = str(patient_id)
    token = _extract_bearer_token(auth_header)

    patient = None
    medical_available = False
    snapshot = _fetch_medical_snapshot(token) if token else None
    if snapshot:
        medical_available = True
        patient = snapshot['patients_by_id'].get(pid)

    if not patient:
        from apps.messaging.patient_cache import PatientCache
        try:
            cached = PatientCache.objects.get(patient_id=pid)
            patient = {
                'id': pid,
                'nom': cached.nom,
                'prenom': cached.prenom,
                'matricule': cached.matricule,
            }
        except PatientCache.DoesNotExist:
            patient = {'id': pid, 'nom': '', 'prenom': '', 'matricule': ''}

    montant_paye = _montant_deja_paye(pid)
    all_prestations = _collect_patient_prestations(pid, snapshot) if snapshot else []
    classified, unpaid_raw = _classify_prestations_payment(all_prestations, montant_paye)
    _, montant_restant, _ = _filter_prestations_fifo(all_prestations, montant_paye)

    unpaid_clean = [{k: v for k, v in p.items() if k != 'date_tri'} for p in unpaid_raw]

    actes_aujourdhui = []
    actes_impayes_historique = []
    for acte in classified:
        acte_date = _parse_date_part(acte.get('date_heure'))
        row = {**acte}
        if acte_date == ref_str:
            actes_aujourdhui.append(row)
        if acte.get('statut_encaissement') == 'impaye' and acte_date and acte_date < ref_str:
            row = {**row, 'jours_depuis': _days_since(acte_date, ref)}
            actes_impayes_historique.append(row)

    encaissements = _get_encaissements_valides(pid)
    nb_impayes_anciens = len(actes_impayes_historique)

    return {
        'patient': {
            'id': pid,
            'nom': patient.get('nom', ''),
            'prenom': patient.get('prenom', ''),
            'matricule': patient.get('matricule', ''),
            'age': _patient_age(patient.get('date_naissance')),
        },
        'date_reference': ref_str,
        'medical_available': medical_available,
        'actes_aujourdhui': actes_aujourdhui,
        'actes_impayes_historique': actes_impayes_historique,
        'encaissements_deja_effectues': encaissements,
        'prestations_a_payer': unpaid_clean,
        'montant_restant_total': montant_restant,
        'montant_deja_encaisse': montant_paye,
        'nb_impayes_anciens': nb_impayes_anciens,
        'alerte_impayes_anciens': nb_impayes_anciens > 0,
        **_patient_quittance_stats(pid),
    }


def fetch_fiche_encaissement(
    patient_id: str,
    auth_header: str | None = None,
    date_ref: date | None = None,
) -> dict:
    return build_patient_billing_profile(patient_id, auth_header, date_ref)


def fetch_patients_en_attente(auth_header: str | None = None) -> list[dict]:
    """
    Panneau assistant : patients avec prestations impayées (Medical + FIFO compta).
    """
    token = _extract_bearer_token(auth_header)
    if not token:
        logger.warning('[MedicalClient] patients-en-attente sans token JWT')
        return []

    snapshot = _fetch_medical_snapshot(token)
    if not snapshot:
        return _fallback_patients(auth_header)

    pending_by_patient: dict[str, list[dict]] = {}
    for pid in snapshot['patients_by_id']:
        prestations = _collect_patient_prestations(pid, snapshot)
        if prestations:
            pending_by_patient[pid] = prestations

    if not pending_by_patient:
        return []

    result = []
    for pid, all_prestations in pending_by_patient.items():
        patient = snapshot['patients_by_id'].get(pid)
        if not patient:
            continue
        montant_paye = _montant_deja_paye(pid)
        unpaid_prestations, montant_restant, _ = _filter_prestations_fifo(
            all_prestations, montant_paye
        )
        if montant_restant <= 0:
            continue
        profile = build_patient_billing_profile(pid, auth_header)
        entry = _build_patient_entry(
            patient,
            unpaid_prestations,
            montant_paye=montant_paye,
            montant_restant=montant_restant,
        )
        entry['nb_impayes_anciens'] = profile.get('nb_impayes_anciens', 0)
        entry['alerte_impayes_anciens'] = profile.get('alerte_impayes_anciens', False)
        entry['montant_restant_total'] = montant_restant
        result.append(entry)
        from apps.messaging.patient_cache import upsert_patient
        upsert_patient({
            'patient_id': pid,
            'nom': patient.get('nom', ''),
            'prenom': patient.get('prenom', ''),
            'matricule': patient.get('matricule', ''),
        })

    return result


def search_patients(query: str, auth_header: str | None = None) -> list[dict]:
    """
    Recherche un patient (cache local + Medical) pour consulter l'historique des quittances.
    """
    from django.db.models import Q
    from apps.messaging.patient_cache import PatientCache, upsert_patient

    q = (query or '').strip()
    if len(q) < 2:
        return []

    merged: dict[str, dict] = {}

    # Medical est la source de vérité. On n'utilise le cache local qu'en repli,
    # lorsque Medical est injoignable — sinon d'anciens patients supprimés/renommés
    # (fantômes du cache) réapparaîtraient côté caisse alors qu'ils n'existent plus.
    token = _extract_bearer_token(auth_header)
    medical_results = None
    if token:
        raw = _get(f'/patients/?search={quote(q)}', token=token)
        if raw is not None:  # None = Medical injoignable
            medical_results = _as_list(raw)

    if medical_results is not None:
        for p in medical_results:
            pid = str(p.get('id', ''))
            if not pid:
                continue
            merged[pid] = {
                'id': pid,
                'nom': p.get('nom', ''),
                'prenom': p.get('prenom', ''),
                'matricule': p.get('matricule', ''),
                'date_naissance': p.get('date_naissance'),
                'age': _patient_age(p.get('date_naissance')),
            }
            upsert_patient({
                'patient_id': pid,
                'nom': p.get('nom', ''),
                'prenom': p.get('prenom', ''),
                'matricule': p.get('matricule', ''),
            })
    else:
        # Repli : cache local uniquement (Medical indisponible).
        for p in PatientCache.objects.filter(
            Q(nom__icontains=q)
            | Q(prenom__icontains=q)
            | Q(matricule__icontains=q)
        )[:25]:
            merged[p.patient_id] = {
                'id': p.patient_id,
                'nom': p.nom,
                'prenom': p.prenom,
                'matricule': p.matricule,
            }

    result = []
    for pid, patient in merged.items():
        stats = _patient_quittance_stats(pid)
        summary = {'montant_restant_total': 0, 'nb_impayes_anciens': 0, 'alerte_impayes_anciens': False}
        if token:
            try:
                prof = build_patient_billing_profile(pid, auth_header)
                summary = {
                    'montant_restant_total': prof.get('montant_restant_total', 0),
                    'nb_impayes_anciens': prof.get('nb_impayes_anciens', 0),
                    'alerte_impayes_anciens': prof.get('alerte_impayes_anciens', False),
                }
            except Exception as exc:
                logger.warning('[MedicalClient] profil billing search %s: %s', pid, exc)
        result.append({**patient, **stats, **summary})

    result.sort(key=lambda x: (-(x.get('nb_quittances') or 0), x.get('nom', '')))
    return result


def _fallback_patients(auth_header: str | None = None) -> list[dict]:
    """Cache local uniquement si Medical est inaccessible — patients avec impayés réels."""
    from apps.messaging.patient_cache import PatientCache

    result = []
    for p in PatientCache.objects.all()[:100]:
        pid = str(p.patient_id)
        try:
            profile = build_patient_billing_profile(pid, auth_header)
        except Exception:
            logger.debug('[MedicalClient] fallback skip patient %s', pid, exc_info=True)
            continue
        montant_restant = float(
            profile.get('montant_restant_total')
            or profile.get('montant_restant')
            or 0
        )
        if montant_restant <= 0:
            continue
        prestations = (
            profile.get('prestations_a_payer')
            or profile.get('prestations_impayees')
            or []
        )
        patient_stub = {
            'id': pid,
            'matricule': p.matricule,
            'nom': p.nom,
            'prenom': p.prenom,
        }
        entry = _build_patient_entry(
            patient_stub,
            prestations,
            montant_paye=int(profile.get('montant_paye_total') or 0),
            montant_restant=int(montant_restant),
        )
        entry['nb_impayes_anciens'] = profile.get('nb_impayes_anciens', 0)
        entry['alerte_impayes_anciens'] = profile.get('alerte_impayes_anciens', False)
        entry['montant_restant_total'] = montant_restant
        result.append(entry)
    return result


def redirect_patient_service(patient_id: str, new_service: str) -> dict:
    """Proxy redirect — à implémenter côté Medical (sessions)."""
    logger.info(
        '[MedicalClient] redirect patient=%s service=%s (stub)',
        patient_id,
        new_service,
    )
    return {
        'success': True,
        'message': f'Patient redirigé vers {new_service}',
        'data': {'patient_id': patient_id, 'new_service': new_service},
    }
