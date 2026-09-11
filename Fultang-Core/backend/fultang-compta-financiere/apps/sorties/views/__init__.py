"""ViewSets de l'app Sorties — 19 endpoints."""
from django.utils import timezone
from django.db.models import Sum
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from config.permissions import HasFunctionalServiceEnabled

from apps.sorties.models import (
    CategorieSortie, Fournisseur,
    DemandeAchat, BonCommande, LigneBonCommande,
    Facture, LigneFacture, OrdrePaiement,
    PaiementSalaire, ChargeSociale,
)
from apps.sorties.serializers import (
    CategorieSortieSerializer, FournisseurSerializer,
    DemandeAchatSerializer, BonCommandeSerializer,
    FactureSerializer, OrdrePaiementSerializer,
    PaiementSalaireSerializer, ChargeSocialeSerializer,
)


class CategorieSortieViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = CategorieSortie.objects.all()
    serializer_class = CategorieSortieSerializer
    filter_backends = [SearchFilter]
    search_fields = ['code', 'libelle']


class FournisseurViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = Fournisseur.objects.all()
    serializer_class = FournisseurSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['actif']
    search_fields = ['raison_sociale', 'niu']
    ordering = ['raison_sociale']

    @action(detail=True, methods=['get'], url_path='historique')
    def historique(self, request, pk=None):
        fournisseur = self.get_object()
        bons = fournisseur.bons_commande.all()
        return Response({
            'fournisseur': fournisseur.raison_sociale,
            'nombre_commandes': bons.count(),
            'total_commandes': float(bons.aggregate(t=Sum('montant_total'))['t'] or 0),
        })


class DemandeAchatViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = DemandeAchat.objects.all()
    serializer_class = DemandeAchatSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['statut', 'priorite', 'est_banque_de_sang']
    search_fields = ['numero', 'description']
    ordering = ['-date_creation']

    @action(detail=False, methods=['get'], url_path='arbitrage')
    def arbitrage(self, request):
        """Plan d'arbitrage global : priorise et alloue l'enveloppe disponible
        entre toutes les demandes en concurrence (banque de sang prioritaire,
        déduction des engagements, réserve de trésorerie, équité par ancienneté)."""
        from apps.sorties.arbitrage import compute_arbitrage, DEFAULT_RESERVE_RATIO
        reserve_ratio = request.query_params.get('reserve_ratio', DEFAULT_RESERVE_RATIO)
        return Response(compute_arbitrage(reserve_ratio))

    @action(detail=True, methods=['patch'], url_path='evaluer')
    def evaluer(self, request, pk=None):
        """Évaluation budgétaire par le comptable."""
        da = self.get_object()
        if da.statut != 'soumise':
            return Response({'error': 'Seule une demande soumise peut être évaluée par le comptable.'}, status=400)
        avis = request.data.get('avis_comptable')
        if avis not in ['favorable', 'defavorable']:
            return Response({'error': "avis_comptable doit être 'favorable' ou 'defavorable'."}, status=400)
        da.avis_comptable = avis
        da.commentaire_budgetaire = request.data.get('commentaire_budgetaire', '')
        priorite = request.data.get('priorite')
        if priorite in dict(DemandeAchat.PRIORITE_CHOICES):
            da.priorite = priorite
        da.statut = 'evaluee'
        da.save()
        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'validation', 'demande_achat',
            f'Évaluation comptable {da.numero} — avis {avis}'
            + (f' (priorité {da.priorite})' if priorite else ''),
            objet_id=da.id, objet_reference=da.numero,
            donnees_apres={
                'avis_comptable': avis,
                'priorite': da.priorite,
                'montant_estime': float(da.montant_estime or 0),
            },
        )
        return Response(DemandeAchatSerializer(da).data)

    @action(detail=True, methods=['patch'], url_path='approuver')
    def approuver(self, request, pk=None):
        """Approbation par le directeur — uniquement après évaluation comptable favorable."""
        da = self.get_object()
        if da.est_banque_de_sang:
            da.statut = 'approuvee'
            da.save()
            from apps.comptabilite.audit_helper import audit_action
            audit_action(
                request, 'validation', 'demande_achat',
                f'Approbation directeur (banque de sang) {da.numero}',
                objet_id=da.id, objet_reference=da.numero,
            )
            return Response(DemandeAchatSerializer(da).data)
        if da.statut != 'evaluee':
            return Response(
                {'error': 'Le comptable financier doit d\'abord évaluer cette demande.'},
                status=400,
            )
        if da.avis_comptable != 'favorable':
            return Response(
                {'error': "Avis comptable défavorable — le directeur ne peut pas approuver cette demande."},
                status=400,
            )
        da.statut = 'approuvee'
        da.save()
        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'validation', 'demande_achat',
            f'Approbation directeur {da.numero}',
            objet_id=da.id, objet_reference=da.numero,
        )
        return Response(DemandeAchatSerializer(da).data)

    @action(detail=True, methods=['patch'], url_path='rejeter')
    def rejeter(self, request, pk=None):
        """Rejet par le directeur après évaluation comptable."""
        da = self.get_object()
        if da.statut != 'evaluee':
            return Response({'error': 'Le comptable financier doit d\'abord évaluer cette demande.'}, status=400)
        da.statut = 'rejetee'
        motif = request.data.get('commentaire_budgetaire')
        if motif:
            da.commentaire_budgetaire = f"{da.commentaire_budgetaire}\n[Directeur] {motif}".strip()
        da.save()
        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'annulation', 'demande_achat',
            f'Rejet directeur {da.numero}' + (f' — {motif}' if motif else ''),
            objet_id=da.id, objet_reference=da.numero,
        )
        return Response(DemandeAchatSerializer(da).data)


class BonCommandeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = BonCommande.objects.prefetch_related('lignes').select_related('fournisseur')
    serializer_class = BonCommandeSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['statut', 'fournisseur']
    search_fields = ['numero']
    ordering = ['-date_creation']

    @action(detail=True, methods=['patch'], url_path='valider')
    def valider(self, request, pk=None):
        bc = self.get_object()
        if bc.statut != 'brouillon':
            return Response({'error': 'Seul un bon en brouillon peut être validé.'}, status=400)
        bc.statut = 'valide_comptable'
        bc.save()
        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'validation', 'bon_commande',
            f'Validation comptable bon de commande {bc.numero}',
            objet_id=bc.id, objet_reference=bc.numero,
        )
        return Response(BonCommandeSerializer(bc).data)

    @action(detail=True, methods=['patch'], url_path='approuver')
    def approuver(self, request, pk=None):
        """Approbation directeur après validation comptable."""
        bc = self.get_object()
        if bc.statut != 'valide_comptable':
            return Response({'error': 'Le bon doit être validé par le comptable avant approbation directeur.'}, status=400)
        bc.statut = 'approuve_directeur'
        bc.save()
        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'validation', 'bon_commande',
            f'Approbation directeur bon de commande {bc.numero}',
            objet_id=bc.id, objet_reference=bc.numero,
        )
        return Response(BonCommandeSerializer(bc).data)


class FactureViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = Facture.objects.prefetch_related('lignes')
    serializer_class = FactureSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['est_payee']
    ordering = ['-date_reception']

    @action(detail=False, methods=['get'], url_path='impayees')
    def impayees(self, request):
        qs = self.get_queryset().filter(est_payee=False)
        return Response({
            'nombre': qs.count(),
            'total': float(qs.aggregate(t=Sum('montant_ttc'))['t'] or 0),
            'factures': FactureSerializer(qs, many=True).data,
        })

    @action(detail=True, methods=['patch'], url_path='comptabiliser')
    def comptabiliser(self, request, pk=None):
        """Comptabilise la facture fournisseur : constate la charge et la dette.
        Débit : compte de charge (classe 6) — TTC (TVA non récupérable)
        Crédit : compte fournisseur (401) — TTC
        C'est cette écriture qui crée la dette soldée ensuite par l'ordre de paiement.
        """
        from django.db import transaction as db_transaction
        from apps.comptabilite.models import (
            EcritureComptable, LigneEcriture, CompteComptable,
            Journal, ExerciceComptable,
        )
        from decimal import Decimal

        facture = self.get_object()
        if facture.est_comptabilisee:
            return Response({'error': 'Cette facture est déjà comptabilisée.'}, status=400)

        # Compte de charge (classe 6) : choix optionnel, sinon 601 (Achats de médicaments)
        compte_charge_id = request.data.get('compte_charge_id')
        compte_charge = None
        if compte_charge_id:
            compte_charge = CompteComptable.objects.filter(id=compte_charge_id, classe='6').first()
        if not compte_charge:
            compte_charge = CompteComptable.objects.filter(
                numero_compte__startswith='601', actif=True
            ).first() or CompteComptable.objects.filter(classe='6', actif=True).order_by('numero_compte').first()

        # Compte fournisseur (401) : sous-compte du fournisseur si disponible, sinon 401 générique
        compte_fournisseur = getattr(facture.fournisseur, 'compte_comptable', None)
        if not (compte_fournisseur and str(compte_fournisseur.numero_compte).startswith('40')):
            compte_fournisseur = CompteComptable.objects.filter(
                numero_compte='401', actif=True
            ).first() or CompteComptable.objects.filter(
                numero_compte__startswith='401', actif=True
            ).order_by('numero_compte').first()

        if not compte_charge or not compte_fournisseur:
            return Response(
                {'error': "Plan comptable incomplet : compte de charge (classe 6) ou fournisseur (401) manquant."},
                status=400,
            )

        try:
            journal = Journal.objects.get(code='JA')
        except Journal.DoesNotExist:
            journal = Journal.objects.first()
        exercice = ExerciceComptable.objects.filter(statut='ouvert').first()
        if not journal or not exercice:
            return Response({'error': "Journal des achats ou exercice ouvert introuvable."}, status=400)

        montant = Decimal(str(facture.montant_ttc))
        nom_fourn = facture.fournisseur.raison_sociale if facture.fournisseur else 'Fournisseur'

        with db_transaction.atomic():
            from apps.comptabilite.audit_helper import get_creator_display_name
            ecriture = EcritureComptable.objects.create(
                date_ecriture=timezone.now().date(),
                libelle=f"Facture fournisseur {facture.numero_facture} — {nom_fourn}",
                journal=journal,
                exercice=exercice,
                statut='validee',
                piece_justificative=facture.numero_facture,
                date_validation=timezone.now(),
                created_by_nom=get_creator_display_name(request),
            )
            LigneEcriture.objects.create(
                ecriture=ecriture,
                compte=compte_charge,
                libelle=f"Achat {facture.numero_facture} — {nom_fourn}",
                montant_debit=montant,
                montant_credit=None,
            )
            LigneEcriture.objects.create(
                ecriture=ecriture,
                compte=compte_fournisseur,
                libelle=f"Dette fournisseur {facture.numero_facture} — {nom_fourn}",
                montant_debit=None,
                montant_credit=montant,
            )
            facture.est_comptabilisee = True
            facture.save(update_fields=['est_comptabilisee'])

        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'validation', 'facture',
            f'Comptabilisation facture {facture.numero_facture} — écriture {ecriture.numero_ecriture}',
            objet_id=facture.id, objet_reference=facture.numero_facture,
            donnees_apres={'montant_ttc': float(montant), 'ecriture_id': ecriture.id},
        )

        return Response(FactureSerializer(facture).data)


def _generer_ecriture_decaissement_op(op, created_by_nom=None):
    """Génère l'écriture de décaissement (Débit charge/401, Crédit trésorerie) pour un OP exécuté."""
    from apps.comptabilite.models import (
        EcritureComptable, LigneEcriture, CompteComptable,
        Journal, ExerciceComptable,
    )
    from decimal import Decimal

    if EcritureComptable.objects.filter(ordre_paiement_id=op.id).exists():
        if not op.est_comptabilise:
            op.est_comptabilise = True
            op.save(update_fields=['est_comptabilise'])
        return True, None

    mapping_charge = {
        'fournisseur': '401',
        'salaire': '641',
        'remboursement': '411',
        'charge': '62',
    }
    mapping_tresorerie = {
        'caisse': '571',
        'cheque': '521',
        'virement': '521',
    }

    num_charge = mapping_charge.get(op.type_sortie, '62')
    num_tres = mapping_tresorerie.get(op.mode_paiement, '521')

    compte_charge = CompteComptable.objects.filter(
        numero_compte__startswith=num_charge
    ).first()
    compte_tres = CompteComptable.objects.filter(
        numero_compte__startswith=num_tres
    ).first()

    try:
        journal = Journal.objects.get(code='JA')
    except Journal.DoesNotExist:
        journal = Journal.objects.first()

    exercice = ExerciceComptable.objects.filter(statut='ouvert').first()

    if not compte_charge or not compte_tres or not journal:
        return False, "Plan comptable incomplet : compte de charge ou trésorerie introuvable."

    ecriture = EcritureComptable.objects.create(
        date_ecriture=timezone.now().date(),
        libelle=f"Décaissement OP {op.numero} — {op.beneficiaire}",
        journal=journal,
        exercice=exercice,
        statut='validee',
        piece_justificative=op.numero,
        ordre_paiement_id=op.id,
        date_validation=timezone.now(),
        created_by_nom=created_by_nom,
    )
    montant = Decimal(str(op.montant))
    LigneEcriture.objects.create(
        ecriture=ecriture,
        compte=compte_charge,
        libelle=f"Charge {op.type_sortie} — {op.beneficiaire}",
        montant_debit=montant,
        montant_credit=None,
    )
    LigneEcriture.objects.create(
        ecriture=ecriture,
        compte=compte_tres,
        libelle=f"Sortie trésorerie {op.mode_paiement} — {op.numero}",
        montant_debit=None,
        montant_credit=montant,
    )
    op.est_comptabilise = True
    op.save(update_fields=['est_comptabilise'])

    if exercice:
        from apps.comptabilite.flux_operationnels import maj_budget_consomme
        maj_budget_consomme(exercice, op.montant, type_sortie=op.type_sortie)

    return True, None


class OrdrePaiementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = OrdrePaiement.objects.all()
    serializer_class = OrdrePaiementSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['statut', 'type_sortie', 'mode_paiement']
    search_fields = ['numero', 'beneficiaire']
    ordering = ['-date_creation']

    def create(self, request, *args, **kwargs):
        facture_id = request.data.get('facture')
        if not facture_id:
            return Response(
                {'error': 'Une facture fournisseur est requise avant de créer un ordre de paiement.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            facture = Facture.objects.get(pk=facture_id)
        except Facture.DoesNotExist:
            return Response({'error': 'Facture introuvable.'}, status=status.HTTP_400_BAD_REQUEST)
        if facture.est_payee:
            return Response(
                {'error': 'Cette facture est déjà réglée.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=['patch'], url_path='valider')
    def valider(self, request, pk=None):
        op = self.get_object()
        if op.statut != 'brouillon':
            return Response({'error': 'Seul un ordre en brouillon peut être validé.'}, status=400)
        op.statut = 'valide_comptable'
        op.save()
        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'validation', 'ordre_paiement',
            f'Validation comptable ordre de paiement {op.numero}',
            objet_id=op.id, objet_reference=op.numero,
            donnees_apres={'montant': float(op.montant or 0), 'beneficiaire': op.beneficiaire},
        )
        return Response(OrdrePaiementSerializer(op).data)

    @action(detail=True, methods=['patch'], url_path='approuver')
    def approuver(self, request, pk=None):
        op = self.get_object()
        if op.statut != 'valide_comptable':
            return Response({'error': "L'ordre doit être validé par le comptable d'abord."}, status=400)
        op.statut = 'approuve_directeur'
        op.save()
        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'validation', 'ordre_paiement',
            f'Approbation directeur ordre de paiement {op.numero}',
            objet_id=op.id, objet_reference=op.numero,
        )
        return Response(OrdrePaiementSerializer(op).data)

    @action(detail=True, methods=['patch'], url_path='executer')
    def executer(self, request, pk=None):
        op = self.get_object()
        if op.statut != 'approuve_directeur':
            return Response({'error': "L'ordre doit être approuvé par le directeur d'abord."}, status=400)

        from django.db import transaction as db_transaction

        with db_transaction.atomic():
            op.statut = 'execute'
            op.date_execution = timezone.now()
            op.save()

            # Marquer la facture comme payée si liée
            if op.facture:
                op.facture.est_payee = True
                op.facture.save()

            from apps.comptabilite.audit_helper import get_creator_display_name
            ok, err = _generer_ecriture_decaissement_op(
                op, created_by_nom=get_creator_display_name(request)
            )
            if not ok:
                return Response({'error': err}, status=400)

        from apps.comptabilite.audit_helper import audit_action
        from apps.messaging.events import OrdrePaiementExecuteEvent, build_event, TOPIC_ORDRE_PAIEMENT_EXECUTE
        from apps.messaging.kafka_producer import publish_event
        from config.tenant_routing.context import get_current_tenant_context

        audit_action(
            request, 'validation', 'ordre_paiement',
            f'Exécution ordre de paiement {op.numero}',
            objet_id=op.id, objet_reference=op.numero,
        )
        tenant_ctx = get_current_tenant_context()
        event = OrdrePaiementExecuteEvent(
            ordre_id=op.id,
            beneficiaire=op.beneficiaire or '',
            montant=str(op.montant),
            tenant_id=tenant_ctx.tenant_id if tenant_ctx else None,
        )
        publish_event(TOPIC_ORDRE_PAIEMENT_EXECUTE, build_event(event), key=str(op.id))

        return Response(OrdrePaiementSerializer(op).data)

    @action(detail=True, methods=['patch'], url_path='comptabiliser')
    def comptabiliser(self, request, pk=None):
        """Génère l'écriture de décaissement pour un OP déjà exécuté par le caissier."""
        op = self.get_object()
        if op.statut != 'execute':
            return Response({'error': 'Seul un ordre exécuté peut être comptabilisé.'}, status=400)

        from django.db import transaction as db_transaction

        with db_transaction.atomic():
            from apps.comptabilite.audit_helper import get_creator_display_name
            ok, err = _generer_ecriture_decaissement_op(
                op, created_by_nom=get_creator_display_name(request)
            )
            if not ok:
                return Response({'error': err}, status=400)

        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'validation', 'ordre_paiement',
            f'Comptabilisation ordre de paiement {op.numero}',
            objet_id=op.id, objet_reference=op.numero,
        )
        return Response(OrdrePaiementSerializer(op).data)


class PaiementSalaireViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = PaiementSalaire.objects.prefetch_related('charges_sociales')
    serializer_class = PaiementSalaireSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['mois', 'annee', 'est_paye']
    search_fields = ['nom_personnel', 'matricule']
    ordering = ['-annee', '-mois']

    @action(detail=False, methods=['post'], url_path='generer')
    def generer(self, request):
        """Génère les bulletins de paie pour un mois/année donné."""
        mois = request.data.get('mois', timezone.now().month)
        annee = request.data.get('annee', timezone.now().year)
        personnels = request.data.get('personnels', [])
        created = []
        for p in personnels:
            sal, _ = PaiementSalaire.objects.get_or_create(
                mois=mois, annee=annee, personnel_id=p.get('personnel_id'),
                defaults={
                    'nom_personnel': p.get('nom_personnel', ''),
                    'matricule': p.get('matricule', ''),
                    'poste': p.get('poste', ''),
                    'salaire_brut': p.get('salaire_brut', 0),
                    'retenue_cnps': p.get('retenue_cnps', 0),
                    'retenue_impots': p.get('retenue_impots', 0),
                    'deduction_ecart_caisse': p.get('deduction_ecart_caisse', 0),
                }
            )
            created.append(sal)
        return Response({
            'mois': mois, 'annee': annee,
            'bulletins_crees': len(created),
            'salaires': PaiementSalaireSerializer(created, many=True).data,
        }, status=201)

    @action(detail=True, methods=['patch'], url_path='payer')
    def payer(self, request, pk=None):
        sal = self.get_object()
        if sal.est_paye:
            return Response({'error': 'Ce salaire est déjà payé.'}, status=400)
        sal.est_paye = True
        sal.date_paiement = timezone.now()
        sal.save()
        return Response(PaiementSalaireSerializer(sal).data)

    @action(detail=False, methods=['get'], url_path='masse-salariale')
    def masse_salariale(self, request):
        qs = self.get_queryset()
        annee = request.query_params.get('annee', timezone.now().year)
        qs = qs.filter(annee=annee)
        return Response({
            'annee': annee,
            'total_brut': float(qs.aggregate(t=Sum('salaire_brut'))['t'] or 0),
            'total_net': float(qs.aggregate(t=Sum('salaire_net'))['t'] or 0),
            'nombre_bulletins': qs.count(),
        })


class ChargeSocialeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = ChargeSociale.objects.all()
    serializer_class = ChargeSocialeSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['type_charge', 'paiement_salaire']
