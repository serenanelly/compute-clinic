"""ViewSets de l'app Caisse — 28 endpoints."""
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Q, F
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.caisse.models import (
    Quittance, Cheque, PaiementMobile, PaiementCarte, VirementBancaire,
    CaisseJournaliere, DepenseMenue, InventaireCaisse,
)
from apps.caisse.serializers import (
    QuittanceSerializer, QuittanceListSerializer,
    ChequeDetailSerializer,
    CaisseJournaliereSerializer, DepenseMenueSerializer, InventaireCaisseSerializer,
)
from apps.comptabilite.exercice_scope import get_exercice_ouvert


def _derniere_caisse_fermee():
    """Dernière caisse clôturée avec solde physique — source du report à l'ouverture."""
    return (
        CaisseJournaliere.objects.filter(statut='fermee', solde_physique__isnull=False)
        .order_by(F('date_fermeture').desc(nulls_last=True), '-date_creation', '-id')
        .first()
    )
#  QUITTANCES  (13 endpoints)
# ─────────────────────────────────────────────────────────────────────

class QuittanceViewSet(viewsets.ModelViewSet):
    queryset = Quittance.objects.select_related('journal', 'exercice', 'compte_tiers')
    serializer_class = QuittanceSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['type_recette', 'mode_paiement', 'est_validee', 'est_comptabilisee', 'est_urgence']
    search_fields = ['numero', 'motif']
    ordering_fields = ['date_creation', 'montant']
    ordering = ['-date_creation']

    def get_queryset(self):
        qs = super().get_queryset()
        ex_param = self.request.query_params.get('exercice')
        if ex_param:
            return qs.filter(exercice_id=ex_param)
        ex = get_exercice_ouvert()
        if ex:
            return qs.filter(exercice=ex)
        return qs.none()

    def get_serializer_class(self):
        if self.action == 'list':
            return QuittanceListSerializer
        return QuittanceSerializer

    def _resolve_caissier_id(self, request):
        cid = request.data.get('caissier_id')
        if cid is not None and cid != '':
            try:
                return int(cid)
            except (TypeError, ValueError):
                pass
        user_id = request.META.get('HTTP_X_USER_ID')
        if user_id:
            try:
                return int(user_id)
            except (TypeError, ValueError):
                pass
        return None

    def _apply_assurance_fields(self, request, validated_data):
        if validated_data.get('mode_paiement') != 'assurance':
            return {}
        taux = request.data.get('taux_couverture')
        montant = validated_data.get('montant')
        if not taux or not montant:
            return {'est_assure': True}
        taux_d = Decimal(str(taux))
        m = Decimal(str(montant))
        part_assurance = (m * taux_d / Decimal('100')).quantize(Decimal('0.01'))
        part_patient = m - part_assurance
        extra = {
            'est_assure': True,
            'taux_couverture': taux_d,
            'montant_assurance': part_assurance,
            'montant_patient': part_patient,
        }
        assurance_id = request.data.get('assurance_id')
        if assurance_id:
            extra['assurance_id'] = int(assurance_id)
        compte_tiers_id = request.data.get('compte_tiers_id')
        if compte_tiers_id:
            from apps.comptabilite.models import CompteComptable
            try:
                extra['compte_tiers'] = CompteComptable.objects.get(pk=compte_tiers_id)
            except CompteComptable.DoesNotExist:
                pass
        return extra

    def _create_payment_details(self, quittance, data):
        mode = quittance.mode_paiement
        if mode == 'cheque':
            Cheque.objects.create(
                quittance=quittance,
                numero=data.get('cheque_numero', ''),
                banque=data.get('cheque_banque', ''),
                titulaire=data.get('cheque_titulaire', ''),
            )
        elif mode == 'mobile_money':
            PaiementMobile.objects.create(
                quittance=quittance,
                operateur=data.get('mobile_operateur', 'orange'),
                numero_payant=data.get('mobile_numero', ''),
                reference_transaction=data.get('mobile_reference', ''),
            )
        elif mode == 'carte':
            PaiementCarte.objects.create(
                quittance=quittance,
                quatre_derniers_chiffres=data.get('carte_numero', ''),
                reference_transaction=data.get('carte_reference', ''),
                id_terminal=data.get('carte_terminal', ''),
            )
        elif mode == 'virement':
            date_v = data.get('virement_date') or timezone.now().date().isoformat()
            try:
                from datetime import date as date_cls
                date_virement = date_cls.fromisoformat(str(date_v)[:10])
            except ValueError:
                date_virement = timezone.now().date()
            VirementBancaire.objects.create(
                quittance=quittance,
                banque_emettrice=data.get('virement_banque', ''),
                reference=data.get('virement_reference', ''),
                date_virement=date_virement,
            )

    def create(self, request, *args, **kwargs):
        from apps.caisse.models import CaisseJournaliere
        if not CaisseJournaliere.get_ouverte():
            return Response(
                {
                    'error': 'Aucune caisse ouverte actuellement.',
                    'detail': 'Veuillez ouvrir la caisse journalière avant d\'enregistrer un encaissement.',
                    'code': 'CAISSE_FERMEE',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            QuittanceSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def perform_create(self, serializer):
        """Assigne automatiquement le journal selon le mode de paiement."""
        from apps.comptabilite.models import Journal, ExerciceComptable
        assurance_extra = self._apply_assurance_fields(self.request, serializer.validated_data)
        caissier_id = self._resolve_caissier_id(self.request)
        save_kwargs = {**assurance_extra}
        if caissier_id is not None:
            save_kwargs['caissier_id'] = caissier_id
        instance = serializer.save(**save_kwargs)
        # Déterminer le journal
        mapping = {
            'especes': 'JC',
            'cheque': 'JB',
            'carte': 'JB',
            'mobile_money': 'JMM',
            'virement': 'JB',
            'assurance': 'JOD',
        }
        code_journal = mapping.get(instance.mode_paiement, 'JOD')
        try:
            journal = Journal.objects.get(code=code_journal)
            instance.journal = journal
        except Journal.DoesNotExist:
            pass
        # Exercice courant
        try:
            exercice = ExerciceComptable.objects.get(statut='ouvert')
            instance.exercice = exercice
        except ExerciceComptable.DoesNotExist:
            pass
        instance.save()
        self._create_payment_details(instance, self.request.data)
        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            self.request, 'creation', 'quittance',
            f'Création quittance {instance.numero}',
            objet_id=instance.id, objet_reference=instance.numero,
        )
        if instance.est_validee:
            self._appliquer_validation_quittance(instance, self.request)
        from apps.caisse.models import CaisseJournaliere
        caisse = CaisseJournaliere.get_ouverte()
        if caisse and instance.est_validee and instance.mode_paiement == 'especes':
            caisse.solde_theorique = caisse.recalculer_solde_theorique()
            caisse.save(update_fields=['solde_theorique'])

    @action(detail=False, methods=['get'], url_path='a_comptabiliser')
    def a_comptabiliser(self, request):
        """Quittances validées non encore comptabilisées — pour le comptable."""
        qs = self.get_queryset().filter(est_validee=True, est_comptabilisee=False)
        serializer = QuittanceListSerializer(qs, many=True)
        return Response({'nombre': qs.count(), 'quittances': serializer.data})

    @action(detail=True, methods=['post'], url_path='generer_ecriture')
    def generer_ecriture(self, request, pk=None):
        """
        Le COMPTABLE génère l'écriture comptable en partie double depuis une quittance.
        Débit : compte de trésorerie (571 Caisse ou 521 Banque)
        Crédit : compte de produit (classe 7) fourni en paramètre
        """
        from apps.comptabilite.models import (
            EcritureComptable, LigneEcriture, CompteComptable, Journal
        )
        quittance = self.get_object()

        if not quittance.est_validee:
            return Response({'error': 'La quittance doit être validée.'}, status=400)
        if quittance.est_comptabilisee:
            return Response({'error': 'Cette quittance est déjà comptabilisée.'}, status=400)

        compte_produit_id = request.data.get('compte_produit_id')
        if not compte_produit_id:
            return Response({'error': 'compte_produit_id est requis.'}, status=400)

        try:
            compte_produit = CompteComptable.objects.get(pk=compte_produit_id, classe='7')
        except CompteComptable.DoesNotExist:
            return Response({'error': 'Compte de produit (classe 7) introuvable.'}, status=400)

        # Compte de trésorerie selon mode de paiement
        mapping_tresorerie = {
            'especes': '571',
            'cheque': '521',
            'carte': '521',
            'mobile_money': '521',
            'virement': '521',
            'assurance': '411',
        }
        num_tresorerie = mapping_tresorerie.get(quittance.mode_paiement, '571')
        try:
            compte_tresorerie = CompteComptable.objects.filter(
                numero_compte__startswith=num_tresorerie
            ).first()
            if not compte_tresorerie:
                raise CompteComptable.DoesNotExist
        except CompteComptable.DoesNotExist:
            return Response({'error': f'Compte de trésorerie {num_tresorerie} introuvable.'}, status=400)

        journal = quittance.journal
        if not journal:
            try:
                journal = Journal.objects.get(code='JV')
            except Journal.DoesNotExist:
                return Response({'error': 'Journal introuvable.'}, status=400)

        with transaction.atomic():
            from apps.comptabilite.audit_helper import get_creator_display_name
            ecriture = EcritureComptable.objects.create(
                date_ecriture=quittance.date_creation.date(),
                libelle=f"Encaissement quittance {quittance.numero} — {quittance.motif}",
                journal=journal,
                exercice=quittance.exercice,
                statut='validee',
                piece_justificative=quittance.numero,
                quittance_id=quittance.id,
                date_validation=timezone.now(),
                created_by_nom=get_creator_display_name(request),
            )
            # Débit trésorerie
            LigneEcriture.objects.create(
                ecriture=ecriture,
                compte=compte_tresorerie,
                libelle=f"Encaissement {quittance.numero}",
                montant_debit=quittance.montant,
                montant_credit=None,
            )
            # Crédit produit
            LigneEcriture.objects.create(
                ecriture=ecriture,
                compte=compte_produit,
                libelle=f"Recette {quittance.type_recette} — {quittance.numero}",
                montant_debit=None,
                montant_credit=quittance.montant,
            )
            quittance.est_comptabilisee = True
            quittance.save()

        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'validation', 'ecriture',
            f'Comptabilisation quittance {quittance.numero} — écriture {ecriture.numero_ecriture}',
            objet_id=ecriture.id, objet_reference=ecriture.numero_ecriture,
            donnees_apres={'quittance': quittance.numero, 'montant': float(quittance.montant or 0)},
        )

        return Response({
            'message': 'Écriture générée avec succès.',
            'numero_ecriture': ecriture.numero_ecriture,
            'quittance': quittance.numero,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='a_valider')
    def a_valider(self, request):
        """Quittances en attente de validation par le caissier."""
        qs = self.get_queryset().filter(est_validee=False)
        serializer = QuittanceListSerializer(qs, many=True)
        return Response(serializer.data)

    def _appliquer_validation_quittance(self, quittance, request):
        import logging
        from apps.comptabilite.audit_helper import audit_action
        from apps.messaging.events import QuittanceValideeEvent, build_event, TOPIC_QUITTANCE_VALIDEE
        from apps.messaging.kafka_producer import publish_event

        logger = logging.getLogger(__name__)
        try:
            audit_action(
                request, 'validation', 'quittance',
                f'Validation quittance {quittance.numero}',
                objet_id=quittance.id, objet_reference=quittance.numero,
            )
        except Exception as exc:
            logger.warning('[Quittance] audit validation ignoré: %s', exc)
        try:
            event = QuittanceValideeEvent(
                quittance_id=quittance.id,
                patient_id=str(quittance.patient_id) if quittance.patient_id else None,
                montant=str(quittance.montant),
                session_id=quittance.session_id,
            )
            publish_event(TOPIC_QUITTANCE_VALIDEE, build_event(event), key=str(quittance.id))
        except Exception as exc:
            logger.warning('[Quittance] Kafka validation ignoré: %s', exc)

    @action(detail=True, methods=['post'], url_path='valider')
    def valider(self, request, pk=None):
        """Le caissier valide une quittance (marque est_validee=True)."""
        quittance = self.get_object()
        if quittance.est_validee:
            return Response({'error': 'Cette quittance est déjà validée.'}, status=400)
        compte_comptable_id = request.data.get('compte_comptable_id')
        if compte_comptable_id:
            from apps.comptabilite.models import CompteComptable
            try:
                compte = CompteComptable.objects.get(pk=compte_comptable_id)
                quittance.compte_tiers = compte
            except CompteComptable.DoesNotExist:
                pass
        quittance.est_validee = True
        quittance.save()
        self._appliquer_validation_quittance(quittance, request)
        return Response(QuittanceSerializer(quittance).data)

    @action(detail=False, methods=['get'], url_path='validees')
    def validees(self, request):
        """Quittances validées avec filtres optionnels (date_debut, date_fin, mode_paiement)."""
        qs = self.get_queryset().filter(est_validee=True).order_by('-date_creation')
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        mode_paiement = request.query_params.get('mode_paiement')
        if date_debut:
            qs = qs.filter(date_creation__date__gte=date_debut)
        if date_fin:
            qs = qs.filter(date_creation__date__lte=date_fin)
        if mode_paiement:
            qs = qs.filter(mode_paiement=mode_paiement)
        serializer = QuittanceListSerializer(qs, many=True)
        total = qs.aggregate(t=Sum('montant'))['t'] or 0
        from apps.caisse.views.caissier_views import _quittance_to_legacy
        legacy = [_quittance_to_legacy(q) for q in qs]
        return Response({
            'count': qs.count(),
            'total_montant': float(total),
            'quittances': legacy,
            'results': legacy,
        })

    @action(detail=False, methods=['get'], url_path='du_jour')
    def du_jour(self, request):
        today = timezone.now().date()
        qs = self.get_queryset().filter(date_creation__date=today)
        total = qs.aggregate(t=Sum('montant'))['t'] or 0
        return Response({
            'date': today,
            'nombre': qs.count(),
            'total': float(total),
            'quittances': QuittanceListSerializer(qs, many=True).data,
        })

    @action(detail=False, methods=['get'], url_path='de_la_semaine')
    def de_la_semaine(self, request):
        from datetime import timedelta
        debut = timezone.now().date() - timedelta(days=7)
        qs = self.get_queryset().filter(date_creation__date__gte=debut)
        total = qs.aggregate(t=Sum('montant'))['t'] or 0
        return Response({'nombre': qs.count(), 'total': float(total),
                         'quittances': QuittanceListSerializer(qs, many=True).data})

    @action(detail=False, methods=['get'], url_path='du_mois')
    def du_mois(self, request):
        now = timezone.now()
        qs = self.get_queryset().filter(
            date_creation__year=now.year, date_creation__month=now.month
        )
        total = qs.aggregate(t=Sum('montant'))['t'] or 0
        return Response({'mois': now.month, 'annee': now.year,
                         'nombre': qs.count(), 'total': float(total),
                         'quittances': QuittanceListSerializer(qs, many=True).data})

    @action(detail=False, methods=['get'], url_path='statistiques')
    def statistiques(self, request):
        qs = self.get_queryset()
        today = timezone.now().date()
        par_mode = {}
        for code, label in Quittance.MODE_PAIEMENT_CHOICES:
            sub = qs.filter(mode_paiement=code)
            par_mode[code] = {'label': label, 'nombre': sub.count(),
                               'total': float(sub.aggregate(t=Sum('montant'))['t'] or 0)}
        par_type = {}
        for code, label in Quittance.TYPE_RECETTE_CHOICES:
            sub = qs.filter(type_recette=code)
            par_type[code] = {'label': label, 'nombre': sub.count(),
                               'total': float(sub.aggregate(t=Sum('montant'))['t'] or 0)}
        return Response({
            'total_quittances': qs.count(),
            'total_montant': float(qs.aggregate(t=Sum('montant'))['t'] or 0),
            'a_comptabiliser': qs.filter(est_validee=True, est_comptabilisee=False).count(),
            'par_mode_paiement': par_mode,
            'par_type_recette': par_type,
        })

    @action(detail=False, methods=['get'], url_path='statistiques_avancees')
    def statistiques_avancees(self, request):
        from datetime import date
        annee = int(request.query_params.get('annee', timezone.now().year))
        mois_data = []
        for mois in range(1, 13):
            qs = self.get_queryset().filter(date_creation__year=annee, date_creation__month=mois)
            mois_data.append({
                'mois': mois, 'nombre': qs.count(),
                'total': float(qs.aggregate(t=Sum('montant'))['t'] or 0),
            })
        return Response({'annee': annee, 'evolution_mensuelle': mois_data})

    @action(detail=False, methods=['get'], url_path='journal_ventilation')
    def journal_ventilation(self, request):
        """
        Retourne le journal de ventilation au format attendu par le frontend:
        liste d'objets {compte_numero, compte_libelle, type_flux, montant_total}
        """
        from apps.comptabilite.models import CompteComptable
        qs = self.get_queryset().filter(est_validee=True)

        # Filtres optionnels
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        if date_debut:
            qs = qs.filter(date_creation__date__gte=date_debut)
        if date_fin:
            qs = qs.filter(date_creation__date__lte=date_fin)

        # Mappage des comptes de trésorerie selon mode de paiement
        mapping_tresorerie = {
            'especes': '571',
            'cheque': '521',
            'carte': '521',
            'mobile_money': '521',
            'virement': '521',
            'assurance': '411',
        }

        aggregation = {}

        for q in qs:
            montant = float(q.montant or 0)

            # Compte trésorerie (débit)
            num_tres = mapping_tresorerie.get(q.mode_paiement, '571')
            compte_tres = CompteComptable.objects.filter(numero_compte__startswith=num_tres).first()
            if compte_tres:
                key = (compte_tres.numero_compte, 'debit')
                aggregation.setdefault(key, {'compte': compte_tres, 'montant': 0.0})
                aggregation[key]['montant'] += montant

            # Compte de contrepartie (crédit): soit compte_tiers si renseigné, sinon premier compte produit disponible
            if q.compte_tiers:
                compte_ctr = q.compte_tiers
            else:
                compte_ctr = CompteComptable.objects.filter(classe='7').first()

            if compte_ctr:
                key = (compte_ctr.numero_compte, 'credit')
                aggregation.setdefault(key, {'compte': compte_ctr, 'montant': 0.0})
                aggregation[key]['montant'] += montant

        # Construire la liste de résultats
        result = []
        for (numero, flux), info in aggregation.items():
            result.append({
                'compte_numero': numero,
                'compte_libelle': info['compte'].libelle if info['compte'] else '',
                'type_flux': 'credit' if flux == 'credit' else 'debit',
                'montant_total': float(round(info['montant'], 2))
            })

        # Trier par numéro de compte puis type
        result.sort(key=lambda x: (x['compte_numero'], x['type_flux']))

        return Response(result)

    @action(detail=True, methods=['get'], url_path='export_detail')
    def export_detail(self, request, pk=None):
        q = self.get_object()
        return Response({
            'numero': q.numero, 'montant': float(q.montant),
            'motif': q.motif, 'type_recette': q.type_recette,
            'mode_paiement': q.mode_paiement, 'date': q.date_creation,
            'est_assure': q.est_assure,
            'montant_patient': float(q.montant_patient or q.montant),
            'montant_assurance': float(q.montant_assurance or 0),
        })

    @action(detail=False, methods=['get'], url_path='export_csv')
    def export_csv(self, request):
        qs = self.get_queryset()
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        if date_debut:
            qs = qs.filter(date_creation__date__gte=date_debut)
        if date_fin:
            qs = qs.filter(date_creation__date__lte=date_fin)
        data = QuittanceListSerializer(qs, many=True).data
        return Response({'nombre': qs.count(), 'quittances': data})


# ─────────────────────────────────────────────────────────────────────
#  CHÈQUES  (5 endpoints)
# ─────────────────────────────────────────────────────────────────────

class ChequeViewSet(viewsets.ModelViewSet):
    queryset = Cheque.objects.select_related('quittance')
    serializer_class = ChequeDetailSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['est_encaisse']
    search_fields = ['numero', 'banque', 'titulaire']

    @action(detail=True, methods=['post'], url_path='encaisser')
    def encaisser(self, request, pk=None):
        cheque = self.get_object()
        if cheque.est_encaisse:
            return Response({'error': 'Ce chèque est déjà encaissé.'}, status=400)
        cheque.est_encaisse = True
        cheque.date_encaissement = timezone.now().date()
        cheque.save()
        return Response({'message': 'Chèque encaissé.', 'cheque': ChequeDetailSerializer(cheque).data})

    @action(detail=False, methods=['get'], url_path='non-encaisses')
    def non_encaisses(self, request):
        qs = self.get_queryset().filter(est_encaisse=False)
        return Response({'nombre': qs.count(), 'cheques': ChequeDetailSerializer(qs, many=True).data})

    @action(detail=False, methods=['get'], url_path='encaisses')
    def encaisses(self, request):
        qs = self.get_queryset().filter(est_encaisse=True)
        return Response({'nombre': qs.count(), 'cheques': ChequeDetailSerializer(qs, many=True).data})


# ─────────────────────────────────────────────────────────────────────
#  CAISSE JOURNALIÈRE  (3 endpoints)
# ─────────────────────────────────────────────────────────────────────

class CaisseJournaliereViewSet(viewsets.ModelViewSet):
    queryset = CaisseJournaliere.objects.all()
    serializer_class = CaisseJournaliereSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['statut', 'date']
    ordering = ['-date']

    @action(detail=False, methods=['get'], url_path='ouverte')
    def ouverte(self, request):
        """Retourne la caisse actuellement ouverte (ou null)."""
        caisse = CaisseJournaliere.get_ouverte()
        if not caisse:
            return Response({'ouverte': False, 'caisse': None})
        data = CaisseJournaliereSerializer(caisse).data
        data['solde_theorique'] = str(caisse.recalculer_solde_theorique())
        return Response({'ouverte': True, 'caisse': data})

    @action(detail=False, methods=['get'], url_path='dernier-solde')
    def dernier_solde(self, request):
        """
        Renvoie le solde de report autoritaire pour la prochaine ouverture :
        le solde_physique de la dernière caisse fermée (même source que `ouvrir`).
        Le frontend doit afficher CETTE valeur, sans la recalculer côté client.
        """
        last_fermee = _derniere_caisse_fermee()
        if last_fermee is None:
            return Response({
                'solde_ouverture': None,
                'source': 'aucune_cloture',
                'has_report': False,
            })
        return Response({
            'solde_ouverture': str(last_fermee.solde_physique),
            'source': 'report_cloture',
            'has_report': True,
            'caisse_source_id': last_fermee.id,
            'date_fermeture': last_fermee.date_fermeture,
        })

    @action(detail=False, methods=['post'], url_path='ouvrir')
    def ouvrir(self, request):
        from datetime import datetime, timedelta, time as time_cls
        if CaisseJournaliere.objects.filter(statut='ouverte').exists():
            return Response(
                {
                    'error': 'Une caisse est déjà ouverte.',
                    'detail': 'Fermez la caisse en cours avant d\'en ouvrir une nouvelle.',
                    'code': 'CAISSE_DEJA_OUVERTE',
                },
                status=400,
            )

        now = timezone.now()
        today = now.date()

        # Anti-fraude : report automatique depuis la dernière clôture physique.
        last_fermee = _derniere_caisse_fermee()
        if last_fermee is not None:
            solde = last_fermee.solde_physique
            solde_source = 'report_cloture'
        else:
            solde = request.data.get('solde_ouverture')
            if solde is None or str(solde).strip() == '':
                return Response(
                    {
                        'error': 'Fond de caisse initial requis.',
                        'detail': (
                            'Aucune clôture précédente trouvée. '
                            'Le chef comptable doit saisir le fond initial une seule fois.'
                        ),
                        'code': 'FOND_INITIAL_REQUIS',
                    },
                    status=400,
                )
            solde_source = 'saisie_initiale'

        type_periode = (request.data.get('type_periode') or 'journee').strip()

        periode_debut = now
        libelle = 'Journée standard'
        periode_fin_prevue = None

        if type_periode == 'garde_24h':
            libelle = 'Garde 24h/24'
            periode_fin_prevue = now + timedelta(hours=24)
        elif type_periode == 'personnalisee':
            libelle = request.data.get('libelle_periode') or 'Période personnalisée'
            debut_raw = request.data.get('periode_debut')
            fin_raw = request.data.get('periode_fin_prevue')
            if debut_raw:
                periode_debut = timezone.make_aware(
                    datetime.fromisoformat(debut_raw.replace('Z', ''))
                ) if 'T' in debut_raw else timezone.make_aware(
                    datetime.combine(today, time_cls.min)
                )
            if fin_raw:
                periode_fin_prevue = timezone.make_aware(
                    datetime.fromisoformat(fin_raw.replace('Z', ''))
                ) if 'T' in fin_raw else timezone.make_aware(
                    datetime.combine(today, time_cls.max)
                )
        else:
            # Journée standard 07h → 19h (ajustable par l'établissement)
            periode_debut = timezone.make_aware(datetime.combine(today, time_cls(7, 0)))
            periode_fin_prevue = timezone.make_aware(datetime.combine(today, time_cls(19, 0)))
            libelle = 'Journée standard (07h–19h)'

        caisse = CaisseJournaliere.objects.create(
            date=today,
            solde_ouverture=Decimal(str(solde)),
            solde_theorique=Decimal(str(solde)),
            caissier_id=request.data.get('caissier_id'),
            libelle_periode=libelle,
            periode_debut=periode_debut,
            periode_fin_prevue=periode_fin_prevue,
        )
        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'creation', 'caisse',
            f'Ouverture caisse {today} — solde {solde} FCFA',
            objet_id=caisse.id,
        )
        data = CaisseJournaliereSerializer(caisse).data
        data['solde_ouverture_source'] = solde_source
        return Response(data, status=201)

    @action(detail=True, methods=['patch'], url_path='fermer')
    def fermer(self, request, pk=None):
        caisse = self.get_object()
        if caisse.statut == 'fermee':
            return Response({'error': 'Cette caisse est déjà fermée.'}, status=400)
        solde_physique = request.data.get('solde_physique')
        if solde_physique is None:
            return Response({'error': 'solde_physique est requis.'}, status=400)
        solde_theorique = caisse.recalculer_solde_theorique()
        caisse.solde_theorique = solde_theorique
        caisse.solde_physique = Decimal(str(solde_physique))
        caisse.ecart = caisse.solde_physique - solde_theorique
        caisse.statut = 'fermee'
        caisse.date_fermeture = timezone.now()
        caisse.save()
        from apps.comptabilite.audit_helper import audit_action
        from apps.messaging.events import CaisseFermeeEvent, build_event, TOPIC_CAISSE_FERMEE
        from apps.messaging.kafka_producer import publish_event

        audit_action(
            request, 'cloture', 'caisse',
            f'Fermeture caisse {caisse.date}',
            objet_id=caisse.id,
        )
        event = CaisseFermeeEvent(
            caisse_id=caisse.id,
            montant_total=str(caisse.solde_physique or 0),
            ecart=str(caisse.ecart or 0),
            date=str(caisse.date),
            caissier_id=caisse.caissier_id,
        )
        publish_event(TOPIC_CAISSE_FERMEE, build_event(event), key=str(caisse.id))
        return Response(CaisseJournaliereSerializer(caisse).data)


# ─────────────────────────────────────────────────────────────────────
#  INVENTAIRE DE CAISSE  (3 endpoints)
# ─────────────────────────────────────────────────────────────────────

class InventaireCaisseViewSet(viewsets.ModelViewSet):
    queryset = InventaireCaisse.objects.all()
    serializer_class = InventaireCaisseSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['statut', 'annee', 'mois']
    ordering = ['-annee', '-mois']

    @action(detail=True, methods=['patch'], url_path='clore')
    def clore(self, request, pk=None):
        inventaire = self.get_object()
        if inventaire.statut == 'clos':
            return Response({'error': 'Inventaire déjà clos.'}, status=400)
        inventaire.statut = 'clos'
        if 'ecart_justifie' in request.data:
            inventaire.ecart_justifie = request.data['ecart_justifie']
        if 'observations' in request.data:
            inventaire.observations = request.data['observations']
        inventaire.save()
        return Response(InventaireCaisseSerializer(inventaire).data)


# ─────────────────────────────────────────────────────────────────────
#  DÉPENSES MENUES  (2 endpoints)
# ─────────────────────────────────────────────────────────────────────

def _generer_ecriture_depense_menue(depense):
    """
    Génère l'écriture comptable d'une dépense menue de caisse.
    Débit compte de charge (classe 6, dérivé de la catégorie de sortie),
    Crédit 571 (espèces caisse). Journal de caisse (JC). Idempotent.
    """
    from apps.comptabilite.models import (
        EcritureComptable, LigneEcriture, CompteComptable, Journal, ExerciceComptable,
    )

    if EcritureComptable.objects.filter(depense_menue_id=depense.id).exists():
        return True, None

    # Compte de charge : celui rattaché à la catégorie de sortie, sinon fallback classe 6.
    compte_charge = None
    if depense.categorie_sortie_id and depense.categorie_sortie.compte_comptable_id:
        compte_charge = depense.categorie_sortie.compte_comptable
    if compte_charge is None:
        compte_charge = CompteComptable.objects.filter(numero_compte__startswith='6').first()

    compte_tres = CompteComptable.objects.filter(numero_compte__startswith='571').first()

    try:
        journal = Journal.objects.get(code='JC')
    except Journal.DoesNotExist:
        journal = Journal.objects.first()

    exercice = ExerciceComptable.objects.filter(statut='ouvert').first()

    if not compte_charge or not compte_tres or not journal:
        return False, "Plan comptable incomplet : compte de charge (classe 6) ou caisse (571) introuvable."

    montant = Decimal(str(depense.montant))
    ecriture = EcritureComptable.objects.create(
        date_ecriture=timezone.now().date(),
        libelle=f"Dépense menue — {depense.motif}",
        journal=journal,
        exercice=exercice,
        statut='validee',
        piece_justificative=f"DM-{depense.id}",
        depense_menue_id=depense.id,
        date_validation=timezone.now(),
    )
    LigneEcriture.objects.create(
        ecriture=ecriture,
        compte=compte_charge,
        libelle=f"Charge — {depense.motif}",
        montant_debit=montant,
        montant_credit=None,
    )
    LigneEcriture.objects.create(
        ecriture=ecriture,
        compte=compte_tres,
        libelle=f"Sortie de caisse (espèces) — {depense.motif}",
        montant_debit=None,
        montant_credit=montant,
    )
    return True, None


class DepenseMenueViewSet(viewsets.ModelViewSet):
    queryset = DepenseMenue.objects.select_related('caisse', 'categorie_sortie')
    serializer_class = DepenseMenueSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['caisse', 'categorie_sortie']
    search_fields = ['motif']
    ordering = ['-date_creation']

    def perform_create(self, serializer):
        instance = serializer.save()
        caisse = instance.caisse
        if caisse and caisse.statut == 'ouverte':
            caisse.solde_theorique = caisse.recalculer_solde_theorique()
            caisse.save(update_fields=['solde_theorique'])
        from apps.comptabilite.audit_helper import audit_action
        from apps.comptabilite.exercice_scope import get_exercice_ouvert
        from apps.comptabilite.flux_operationnels import maj_budget_consomme

        exercice = get_exercice_ouvert()
        if exercice and instance.categorie_sortie_id:
            maj_budget_consomme(
                exercice, instance.montant, categorie_sortie=instance.categorie_sortie
            )

        # Générer l'écriture comptable (journal de caisse / grand livre)
        ok, err = _generer_ecriture_depense_menue(instance)
        if not ok:
            audit_action(
                self.request, 'creation', 'caisse',
                f'Dépense menue {instance.montant} FCFA — écriture NON générée : {err}',
                objet_id=instance.id,
            )

        audit_action(
            self.request, 'creation', 'caisse',
            f'Dépense menue {instance.montant} FCFA — {instance.motif}',
            objet_id=instance.id,
        )
