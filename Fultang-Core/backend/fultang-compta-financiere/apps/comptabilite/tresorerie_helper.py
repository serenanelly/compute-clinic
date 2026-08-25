"""
Détail de la trésorerie (classe 5) et génération du report à nouveau (journal JRN).

La trésorerie de l'exercice ouvert = soldes reportés (JRN depuis N-1) + mouvements
de l'exercice courant (encaissements, décaissements, quittances comptabilisées…).
"""
from django.db.models import Sum, Q
from django.utils import timezone

from apps.comptabilite.models import (
    LigneEcriture,
    EcritureComptable,
    ExerciceComptable,
    Journal,
    CompteComptable,
)


def _lignes_tresorerie(exercice):
    if not exercice:
        return LigneEcriture.objects.none()
    return LigneEcriture.objects.filter(
        ecriture__exercice=exercice,
        ecriture__statut='validee',
        compte__classe='5',
    )


def get_tresorerie_detail(exercice):
    """
    Retourne le solde classe 5 décomposé entre report à nouveau (JRN) et mouvements courants.
    """
    if not exercice:
        return {
            'solde': 0.0,
            'solde_report_a_nouveau': 0.0,
            'solde_mouvements_exercice': 0.0,
            'report_manquant': False,
            'exercice_report_source': None,
            'report_a_nouveau_present': False,
        }

    base = _lignes_tresorerie(exercice)
    total = base.aggregate(d=Sum('montant_debit'), c=Sum('montant_credit'))
    solde_total = float((total['d'] or 0) - (total['c'] or 0))

    report_q = Q(ecriture__journal__code='JRN') | Q(ecriture__libelle__icontains='report à nouveau')
    report_agg = base.filter(report_q).aggregate(d=Sum('montant_debit'), c=Sum('montant_credit'))
    solde_report = float((report_agg['d'] or 0) - (report_agg['c'] or 0))
    solde_mouvements = solde_total - solde_report

    prev = ExerciceComptable.objects.filter(annee=exercice.annee - 1, statut='cloture').first()
    has_jrn = EcritureComptable.objects.filter(
        exercice=exercice,
        journal__code='JRN',
        statut='validee',
    ).exists()
    report_manquant = bool(prev and not has_jrn)

    return {
        'solde': solde_total,
        'solde_report_a_nouveau': solde_report,
        'solde_mouvements_exercice': solde_mouvements,
        'report_manquant': report_manquant,
        'exercice_report_source': prev.annee if prev else None,
        'report_a_nouveau_present': has_jrn,
    }


def get_solde_tresorerie(exercice):
    """Solde agrégé classe 5 pour l'exercice (report JRN + mouvements)."""
    return get_tresorerie_detail(exercice)['solde']


def generer_report_nouveau(exercice_cloture):
    """
    Génère l'écriture de report à nouveau de l'exercice clôturé vers N+1.
    Retourne un dict décrivant le résultat ; None si l'exercice suivant n'existe pas.
    """
    if exercice_cloture.statut != 'cloture':
        return {'error': "L'exercice doit être clôturé avant de générer le report."}

    try:
        exercice_suivant = ExerciceComptable.objects.get(annee=exercice_cloture.annee + 1)
    except ExerciceComptable.DoesNotExist:
        return None

    if EcritureComptable.objects.filter(
        exercice=exercice_suivant,
        journal__code='JRN',
        statut='validee',
    ).exists():
        return {
            'skipped': True,
            'message': f"Report à nouveau déjà présent pour l'exercice {exercice_suivant.annee}.",
            'exercice_cible': exercice_suivant.annee,
        }

    try:
        journal_jrn = Journal.objects.get(code='JRN')
    except Journal.DoesNotExist:
        return {'error': "Le journal JRN (Report à Nouveau) n'existe pas."}

    comptes_bilan = CompteComptable.objects.filter(
        classe__in=['1', '2', '3', '4', '5'], actif=True
    )
    lignes_report = []
    for compte in comptes_bilan:
        agg = LigneEcriture.objects.filter(
            compte=compte,
            ecriture__exercice=exercice_cloture,
            ecriture__statut='validee',
        ).aggregate(debit=Sum('montant_debit'), credit=Sum('montant_credit'))
        solde = (agg['debit'] or 0) - (agg['credit'] or 0)
        if solde != 0:
            lignes_report.append({'compte': compte, 'solde': solde})

    if not lignes_report:
        return {
            'skipped': True,
            'message': 'Aucun solde bilan à reporter.',
            'exercice_cible': exercice_suivant.annee,
        }

    # ------------------------------------------------------------------
    # Équilibrage OBLIGATOIRE : on reporte TOUT, y compris le résultat.
    # Le net des soldes de bilan (classes 1-5) est égal au résultat de
    # l'exercice clôturé (produits classe 7 − charges classe 6), car les
    # comptes de gestion 6/7 ne se reportent pas tels quels : leur solde
    # net devient le résultat, viré dans les capitaux propres (compte 12
    # « Report à nouveau »). Sans cette ligne, l'écriture d'ouverture est
    # déséquilibrée du montant du résultat → la balance ne tombe pas juste.
    # ------------------------------------------------------------------
    total_solde = sum(item['solde'] for item in lignes_report)
    if total_solde != 0:
        compte_ran = (
            CompteComptable.objects.filter(numero_compte='12').first()
            or CompteComptable.objects.filter(numero_compte='121').first()
        )
        if compte_ran is None:
            return {'error': "Le compte 12 (Report à nouveau) est introuvable dans le plan comptable."}
        # solde négatif du net des classes 1-5 → contrepartie qui équilibre.
        lignes_report.append({'compte': compte_ran, 'solde': -total_solde})

    ecriture = EcritureComptable.objects.create(
        date_ecriture=exercice_suivant.date_debut,
        libelle=f"Report à nouveau — Exercice {exercice_cloture.annee}",
        journal=journal_jrn,
        exercice=exercice_suivant,
        statut='validee',
        date_validation=timezone.now(),
    )
    for item in lignes_report:
        if item['solde'] > 0:
            LigneEcriture.objects.create(
                ecriture=ecriture,
                compte=item['compte'],
                libelle=f"Report {item['compte'].numero_compte}",
                montant_debit=item['solde'],
                montant_credit=None,
            )
        else:
            LigneEcriture.objects.create(
                ecriture=ecriture,
                compte=item['compte'],
                libelle=f"Report {item['compte'].numero_compte}",
                montant_debit=None,
                montant_credit=abs(item['solde']),
            )

    # Trésorerie reportée (classe 5 uniquement) pour information
    tres_report = sum(
        item['solde'] for item in lignes_report if item['compte'].classe == '5'
    )

    return {
        'created': True,
        'message': f"Report à nouveau généré pour l'exercice {exercice_suivant.annee}.",
        'numero_ecriture': ecriture.numero_ecriture,
        'comptes_reportes': len(lignes_report),
        'exercice_cible': exercice_suivant.annee,
        'tresorerie_reportee': float(tres_report),
    }
