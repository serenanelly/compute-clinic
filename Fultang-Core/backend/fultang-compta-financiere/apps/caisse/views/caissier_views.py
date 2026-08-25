"""BFF Caissier — endpoints /api/caissier/* pour le frontend."""
from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.caisse.models import Quittance
from apps.caisse.serializers import QuittanceListSerializer
from apps.integration.medical_client import (
    fetch_fiche_encaissement,
    fetch_patients_en_attente,
    redirect_patient_service,
    search_patients,
    _quittance_payment_label,
)


def _quittance_to_legacy(q: Quittance) -> dict:
    from apps.messaging.patient_cache import get_patient_display_name

    patient_id = q.patient_id
    patient_nom = get_patient_display_name(str(patient_id)) if patient_id else None
    return {
        'id': q.id,
        'idQuittance': q.id,
        'numero': q.numero,
        'numero_quittance': q.numero,
        'montant': str(q.montant),
        'Montant_paye': str(q.montant),
        'motif': q.motif,
        'Motif': q.motif,
        'mode_paiement': q.mode_paiement,
        'mode_paiement_detail': _quittance_payment_label(q),
        'type_recette': q.type_recette,
        'date_creation': q.date_creation.isoformat() if q.date_creation else None,
        'date_paiement': q.date_creation.isoformat() if q.date_creation else None,
        'est_validee': q.est_validee,
        'patient_id': patient_id,
        'patient_nom': patient_nom,
        'session_id': q.session_id,
        'id_session': q.session_id,
    }


class CaissierViewSet(viewsets.ViewSet):
    """
    BFF pour le module caissier.
    GET  /api/caissier/patients-en-attente/
    GET  /api/caissier/rechercher-patients/?q=
    GET  /api/caissier/{pk}/quittances/
    POST /api/caissier/{pk}/redirect-service/
    """

    @action(detail=False, methods=['get'], url_path='patients-en-attente')
    def patients_en_attente(self, request):
        try:
            patients_list = fetch_patients_en_attente(
                auth_header=request.headers.get('Authorization'),
            )
            return Response({
                'success': True,
                'count': len(patients_list),
                'data': patients_list,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': 'Erreur lors de la récupération des patients',
                'detail': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='rechercher-patients')
    def rechercher_patients(self, request):
        """Recherche patient par nom/matricule — pour historique des quittances."""
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 2:
            return Response({
                'success': True,
                'count': 0,
                'data': [],
                'message': 'Saisissez au moins 2 caractères.',
            }, status=status.HTTP_200_OK)
        try:
            patients = search_patients(
                q,
                auth_header=request.headers.get('Authorization'),
            )
            return Response({
                'success': True,
                'count': len(patients),
                'data': patients,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': 'Erreur lors de la recherche',
                'detail': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='fiche-encaissement')
    def fiche_encaissement(self, request, pk=None):
        """Fiche patient : actes du jour, impayés historiques, encaissements."""
        from datetime import date as date_cls
        date_param = request.query_params.get('date')
        date_ref = None
        if date_param:
            try:
                date_ref = date_cls.fromisoformat(date_param[:10])
            except ValueError:
                pass
        try:
            data = fetch_fiche_encaissement(
                str(pk),
                auth_header=request.headers.get('Authorization'),
                date_ref=date_ref,
            )
            return Response({'success': True, 'data': data}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': 'Erreur fiche encaissement',
                'detail': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='quittances')
    def get_patient_quittances(self, request, pk=None):
        try:
            qs = Quittance.objects.filter(patient_id=str(pk)).select_related(
                'cheque', 'paiement_mobile', 'paiement_carte', 'virement',
            ).order_by('-date_creation')
            data = [_quittance_to_legacy(q) for q in qs]
            return Response({
                'success': True,
                'count': len(data),
                'data': data,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': 'Error fetching patient receipts',
                'detail': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='historique-flux')
    def historique_flux(self, request):
        """Historique unifié : entrées (quittances) + sorties (dépenses menues, OP)."""
        from django.db.models import Sum, Q
        from django.utils import timezone
        from apps.caisse.models import CaisseJournaliere, DepenseMenue
        from apps.sorties.models import OrdrePaiement
        from apps.messaging.patient_cache import get_patient_display_name

        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        mode_paiement = request.query_params.get('mode_paiement')
        type_flux = request.query_params.get('type_flux')
        caisse_id = request.query_params.get('caisse_id')

        caisse_ouverte = CaisseJournaliere.get_ouverte()
        if not date_debut and not date_fin and caisse_ouverte:
            if caisse_ouverte.periode_debut:
                date_debut = caisse_ouverte.periode_debut.date().isoformat()
            else:
                date_debut = caisse_ouverte.date.isoformat()
            date_fin = timezone.now().date().isoformat()

        quittances_qs = Quittance.objects.filter(est_validee=True).select_related(
            'cheque', 'paiement_mobile', 'paiement_carte', 'virement',
        ).order_by('-date_creation')
        depenses_qs = DepenseMenue.objects.select_related('caisse').order_by('-date_creation')
        ops_qs = OrdrePaiement.objects.filter(
            statut__in=['execute', 'comptabilise'],
        ).order_by('-date_execution', '-date_creation')

        if caisse_id:
            depenses_qs = depenses_qs.filter(caisse_id=caisse_id)
            quittances_qs = quittances_qs.filter(
                date_creation__date__gte=date_debut if date_debut else '2000-01-01',
            )
        elif caisse_ouverte and not request.query_params.get('date_debut'):
            depenses_qs = depenses_qs.filter(caisse_id=caisse_ouverte.id)

        if date_debut:
            quittances_qs = quittances_qs.filter(date_creation__date__gte=date_debut)
            depenses_qs = depenses_qs.filter(date_creation__date__gte=date_debut)
            ops_qs = ops_qs.filter(
                Q(date_execution__date__gte=date_debut)
                | (Q(date_execution__isnull=True) & Q(date_creation__date__gte=date_debut))
            )
        if date_fin:
            quittances_qs = quittances_qs.filter(date_creation__date__lte=date_fin)
            depenses_qs = depenses_qs.filter(date_creation__date__lte=date_fin)
            ops_qs = ops_qs.filter(
                Q(date_execution__date__lte=date_fin)
                | (Q(date_execution__isnull=True) & Q(date_creation__date__lte=date_fin))
            )
        if mode_paiement:
            quittances_qs = quittances_qs.filter(mode_paiement=mode_paiement)
            # Les sorties (dépenses menues, OP) restent visibles — elles ne sont pas filtrées par mode

        flux = []

        if type_flux in (None, '', 'entree', 'all'):
            for q in quittances_qs:
                leg = _quittance_to_legacy(q)
                flux.append({
                    **leg,
                    'type_flux': 'entree',
                    'categorie': 'quittance',
                    'libelle': q.motif,
                    'montant_flux': float(q.montant),
                })

        if type_flux in (None, '', 'sortie', 'all'):
            for d in depenses_qs:
                flux.append({
                    'id': f'dep-{d.id}',
                    'type_flux': 'sortie',
                    'categorie': 'depense_menue',
                    'numero': f'DEP-{d.id}',
                    'numero_quittance': f'DEP-{d.id}',
                    'libelle': d.motif,
                    'Motif': d.motif,
                    'patient_nom': 'Dépense caisse',
                    'montant': str(d.montant),
                    'Montant_paye': str(d.montant),
                    'montant_flux': float(d.montant),
                    'mode_paiement': 'especes',
                    'caisse_id': d.caisse_id,
                    'caisse_periode': d.caisse.libelle_periode if d.caisse else None,
                    'date_creation': d.date_creation.isoformat() if d.date_creation else None,
                    'date_paiement': d.date_creation.isoformat() if d.date_creation else None,
                })
            for op in ops_qs:
                dt_exec = op.date_execution or op.date_creation
                hors_caisse = op.mode_paiement != 'caisse'
                flux.append({
                    'id': f'op-{op.id}',
                    'type_flux': 'sortie',
                    'categorie': 'ordre_paiement',
                    'sortie_hors_caisse': hors_caisse,
                    'numero': op.numero,
                    'numero_quittance': op.numero,
                    'libelle': op.beneficiaire or f'OP {op.type_sortie}',
                    'Motif': op.beneficiaire or f'Ordre de paiement {op.numero}',
                    'patient_nom': op.beneficiaire or 'Bénéficiaire',
                    'type_sortie': op.type_sortie,
                    'montant': str(op.montant),
                    'Montant_paye': str(op.montant),
                    'montant_flux': float(op.montant),
                    'mode_paiement': op.mode_paiement,
                    'date_creation': dt_exec.isoformat() if dt_exec else None,
                    'date_paiement': dt_exec.isoformat() if dt_exec else None,
                })

        flux.sort(key=lambda x: x.get('date_paiement') or '', reverse=True)

        total_entrees = sum(f['montant_flux'] for f in flux if f['type_flux'] == 'entree')
        total_sorties = sum(f['montant_flux'] for f in flux if f['type_flux'] == 'sortie')
        nb_entrees = sum(1 for f in flux if f['type_flux'] == 'entree')
        nb_sorties = sum(1 for f in flux if f['type_flux'] == 'sortie')

        caisse_ouverte = CaisseJournaliere.get_ouverte()
        caisse_data = None
        if caisse_ouverte:
            caisse_data = {
                'id': caisse_ouverte.id,
                'libelle_periode': caisse_ouverte.libelle_periode,
                'periode_debut': caisse_ouverte.periode_debut.isoformat() if caisse_ouverte.periode_debut else None,
                'periode_fin_prevue': caisse_ouverte.periode_fin_prevue.isoformat() if caisse_ouverte.periode_fin_prevue else None,
                'solde_ouverture': float(caisse_ouverte.solde_ouverture),
                'solde_theorique': float(caisse_ouverte.recalculer_solde_theorique()),
            }

        return Response({
            'success': True,
            'flux': flux,
            'periode': {'date_debut': date_debut, 'date_fin': date_fin},
            'stats': {
                'total_entrees': total_entrees,
                'total_sorties': total_sorties,
                'solde_net': total_entrees - total_sorties,
                'nb_entrees': nb_entrees,
                'nb_sorties': nb_sorties,
                'nb_transactions': len(flux),
            },
            'caisse_ouverte': caisse_data,
        })

    @action(detail=False, methods=['get'], url_path='rapport-caisse')
    def rapport_caisse(self, request):
        """KPIs caissier basés sur les flux réels (quittances + sorties caisse)."""
        from django.db.models import Sum, Count
        from django.utils import timezone
        from apps.caisse.models import CaisseJournaliere, DepenseMenue
        from apps.sorties.models import OrdrePaiement

        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        caisse_ouverte = CaisseJournaliere.get_ouverte()
        if not date_debut and not date_fin and caisse_ouverte:
            if caisse_ouverte.periode_debut:
                date_debut = caisse_ouverte.periode_debut.date().isoformat()
            else:
                date_debut = caisse_ouverte.date.isoformat()
            date_fin = timezone.now().date().isoformat()
        if not date_debut or not date_fin:
            today = timezone.now().date()
            date_debut = date_debut or today.replace(day=1).isoformat()
            date_fin = date_fin or today.isoformat()

        qt_qs = Quittance.objects.filter(
            est_validee=True,
            date_creation__date__gte=date_debut,
            date_creation__date__lte=date_fin,
        )
        dep_qs = DepenseMenue.objects.filter(
            date_creation__date__gte=date_debut,
            date_creation__date__lte=date_fin,
        )
        if caisse_ouverte:
            dep_qs = dep_qs.filter(caisse_id=caisse_ouverte.id)
        from django.db.models import Q
        op_base = OrdrePaiement.objects.filter(statut__in=['execute', 'comptabilise'])
        op_qs = op_base.filter(
            Q(date_execution__date__gte=date_debut, date_execution__date__lte=date_fin)
            | (
                Q(date_execution__isnull=True)
                & Q(date_creation__date__gte=date_debut, date_creation__date__lte=date_fin)
            )
        )
        op_caisse_qs = op_qs.filter(mode_paiement='caisse')
        op_banque_qs = op_qs.exclude(mode_paiement='caisse')

        total_recettes = float(qt_qs.aggregate(t=Sum('montant'))['t'] or 0)
        depenses_menues = float(dep_qs.aggregate(t=Sum('montant'))['t'] or 0)
        decaissements_op_caisse = float(op_caisse_qs.aggregate(t=Sum('montant'))['t'] or 0)
        decaissements_op_banque = float(op_banque_qs.aggregate(t=Sum('montant'))['t'] or 0)
        decaissements_op = decaissements_op_caisse + decaissements_op_banque
        # Résultat journalier caisse : recettes − sorties physiques caisse uniquement
        total_depenses_caisse = depenses_menues + decaissements_op_caisse
        total_depenses = depenses_menues + decaissements_op
        resultat_net = total_recettes - total_depenses_caisse

        especes = float(
            qt_qs.filter(mode_paiement='especes').aggregate(t=Sum('montant'))['t'] or 0
        ) - total_depenses_caisse

        par_mode = {}
        for code, label in Quittance.MODE_PAIEMENT_CHOICES:
            sub = qt_qs.filter(mode_paiement=code)
            par_mode[code] = {
                'label': label,
                'nombre': sub.count(),
                'total': float(sub.aggregate(t=Sum('montant'))['t'] or 0),
            }

        caisse_ouverte = CaisseJournaliere.get_ouverte()
        solde_tresorerie = float(caisse_ouverte.recalculer_solde_theorique()) if caisse_ouverte else especes
        caisse_info = None
        if caisse_ouverte:
            caisse_info = {
                'id': caisse_ouverte.id,
                'libelle_periode': caisse_ouverte.libelle_periode,
                'solde_ouverture': float(caisse_ouverte.solde_ouverture),
                'solde_theorique': solde_tresorerie,
                'periode_debut': caisse_ouverte.periode_debut.isoformat() if caisse_ouverte.periode_debut else None,
            }

        return Response({
            'periode': {'date_debut': date_debut, 'date_fin': date_fin},
            'kpis': {
                'total_recettes': total_recettes,
                'total_depenses': total_depenses,
                'total_depenses_caisse': total_depenses_caisse,
                'depenses_menues': depenses_menues,
                'decaissements_op': decaissements_op,
                'decaissements_op_caisse': decaissements_op_caisse,
                'decaissements_op_banque': decaissements_op_banque,
                'resultat_net': resultat_net,
                'solde_tresorerie': solde_tresorerie,
                'creances_clients': 0,
                'dettes_fournisseurs': decaissements_op,
            },
            'quittances': {
                'nombre': qt_qs.count(),
                'total': total_recettes,
            },
            'par_mode_paiement': par_mode,
            'caisse_ouverte': bool(caisse_ouverte),
            'caisse': caisse_info,
        })

    @action(detail=True, methods=['post'], url_path='redirect-service')
    def redirect_patient(self, request, pk=None):
        new_service = request.data.get('new_service')
        if not new_service:
            return Response({
                'success': False,
                'error': 'New service is required',
            }, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = redirect_patient_service(str(pk), new_service)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': 'Error redirecting patient',
                'detail': str(e),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
