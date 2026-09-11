"""
ViewSets de l'app Comptabilité — Passo.
Tous les 34 endpoints du module comptabilité.
"""
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Q, Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from config.permissions import HasFunctionalServiceEnabled

from apps.comptabilite.models import (
    CompteComptable, Journal, EcritureComptable, LigneEcriture,
    ExerciceComptable, BudgetPrevisionnel, PrestationDeService,
    AuditLog,
)
from apps.comptabilite.exercice_scope import get_exercice_ouvert, resolve_exercice_id
from apps.comptabilite.flux_operationnels import (
    get_charges_comptables,
    get_kpis_exercice_unifies,
    get_recettes_operationnelles,
    get_sorties_operationnelles,
    synchroniser_budgets_exercice,
)
from apps.comptabilite.serializers import (
    CompteComptableSerializer, CompteComptableArborescenceSerializer,
    CompteComptableListSerializer,
    JournalSerializer, JournalListSerializer,
    EcritureComptableSerializer, EcritureComptableListSerializer,
    ExerciceComptableSerializer,
    BudgetPrevisionnelSerializer,
    PrestationDeServiceSerializer,
    AuditLogSerializer,
)


# =====================================================================
#                     COMPTES COMPTABLES (6 endpoints)
# =====================================================================

class CompteComptableViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les Comptes Comptables OHADA.

    Endpoints:
    - GET/POST  /api/comptes-comptables/
    - GET/PUT   /api/comptes-comptables/{id}/
    - GET       /api/comptes-comptables/par-classe/{n}/
    - GET       /api/comptes-comptables/produits/
    - GET       /api/comptes-comptables/arborescence/
    - GET       /api/comptes-comptables/statistiques/
    """
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = CompteComptable.objects.all()
    serializer_class = CompteComptableSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['classe', 'type_compte', 'actif']
    search_fields = ['numero_compte', 'libelle', 'description']
    ordering_fields = ['numero_compte', 'classe', 'date_creation']
    ordering = ['numero_compte']

    @action(detail=False, methods=['get'], url_path='par-classe/(?P<classe>[1-7])')
    def par_classe(self, request, classe=None):
        """Retourne les comptes d'une classe donnée (1 à 7)."""
        comptes = self.get_queryset().filter(classe=classe, actif=True)
        serializer = CompteComptableListSerializer(comptes, many=True)
        return Response({
            'classe': classe,
            'nombre': comptes.count(),
            'comptes': serializer.data,
        })

    @action(detail=False, methods=['get'], url_path='produits')
    def produits(self, request):
        """Retourne uniquement les comptes de produit (classe 7)."""
        comptes = self.get_queryset().filter(classe='7', actif=True)
        serializer = CompteComptableListSerializer(comptes, many=True)
        return Response({
            'nombre': comptes.count(),
            'comptes': serializer.data,
        })

    @action(detail=False, methods=['get'], url_path='arborescence')
    def arborescence(self, request):
        """Plan comptable en arborescence."""
        racines = self.get_queryset().filter(
            compte_parent__isnull=True, actif=True
        ).order_by('numero_compte')
        serializer = CompteComptableArborescenceSerializer(racines, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='statistiques')
    def statistiques(self, request):
        """Statistiques du plan comptable."""
        stats_classe = {}
        for code, label in CompteComptable.CLASSE_CHOICES:
            count = self.get_queryset().filter(classe=code).count()
            actifs = self.get_queryset().filter(classe=code, actif=True).count()
            stats_classe[code] = {
                'label': label, 'total': count,
                'actifs': actifs, 'inactifs': count - actifs,
            }
        stats_type = {}
        for code, label in CompteComptable.TYPE_COMPTE_CHOICES:
            stats_type[code] = {
                'label': label,
                'total': self.get_queryset().filter(type_compte=code).count(),
            }
        return Response({
            'total_comptes': self.get_queryset().count(),
            'total_actifs': self.get_queryset().filter(actif=True).count(),
            'par_classe': stats_classe,
            'par_type': stats_type,
        })


# =====================================================================
#                     JOURNAUX (4 endpoints)
# =====================================================================

class JournalViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les Journaux Comptables.

    Endpoints:
    - GET/POST  /api/journaux/
    - GET       /api/journaux/{code}/
    - GET       /api/journaux/{code}/ecritures/
    - GET       /api/journaux/statistiques/
    """
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = Journal.objects.all()
    serializer_class = JournalSerializer
    lookup_field = 'code'
    filter_backends = [SearchFilter]
    search_fields = ['code', 'libelle']

    @action(detail=True, methods=['get'], url_path='ecritures')
    def ecritures(self, request, code=None):
        """Écritures d'un journal avec filtres par période."""
        journal = self.get_object()
        ecritures = journal.ecritures.all()

        # Filtres optionnels par date
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        if date_debut:
            ecritures = ecritures.filter(date_ecriture__gte=date_debut)
        if date_fin:
            ecritures = ecritures.filter(date_ecriture__lte=date_fin)

        serializer = EcritureComptableListSerializer(ecritures, many=True)
        return Response({
            'journal': journal.code,
            'nombre': ecritures.count(),
            'ecritures': serializer.data,
        })

    @action(detail=False, methods=['get'], url_path='statistiques')
    def statistiques(self, request):
        """Statistiques par journal."""
        stats = []
        for journal in Journal.objects.all():
            ecritures = journal.ecritures.filter(statut='validee')
            stats.append({
                'code': journal.code,
                'libelle': journal.libelle,
                'total_ecritures': journal.ecritures.count(),
                'ecritures_validees': ecritures.count(),
            })
        return Response(stats)


# =====================================================================
#                  ÉCRITURES COMPTABLES (7 endpoints)
# =====================================================================

class EcritureComptableViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les Écritures Comptables.

    Endpoints:
    - POST      /api/ecritures/                    — Créer avec lignes
    - GET       /api/ecritures/                    — Liste filtrée
    - GET       /api/ecritures/{id}/               — Détail avec lignes
    - PATCH     /api/ecritures/{id}/valider/       — Valider
    - GET       /api/ecritures/grand-livre/{id}/   — Grand Livre d'un compte
    - GET       /api/ecritures/balance/            — Balance Générale
    - GET       /api/ecritures/statistiques/       — Stats
    """
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = EcritureComptable.objects.prefetch_related('lignes', 'lignes__compte', 'journal')
    serializer_class = EcritureComptableSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['statut', 'journal', 'exercice']
    search_fields = ['numero_ecriture', 'libelle', 'piece_justificative']
    ordering_fields = ['date_ecriture', 'numero_ecriture']
    ordering = ['-date_ecriture']

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
            return EcritureComptableListSerializer
        return EcritureComptableSerializer

    def perform_create(self, serializer):
        from apps.comptabilite.audit_helper import audit_action, get_creator_display_name
        ecriture = serializer.save(created_by_nom=get_creator_display_name(self.request))
        audit_action(
            self.request, 'creation', 'ecriture',
            f'Création écriture {ecriture.numero_ecriture} — {ecriture.libelle}',
            objet_id=ecriture.id, objet_reference=ecriture.numero_ecriture,
        )

    @action(detail=True, methods=['patch'], url_path='valider')
    def valider(self, request, pk=None):
        """Valider une écriture brouillon."""
        ecriture = self.get_object()
        if ecriture.statut != 'brouillon':
            return Response(
                {'error': f"Impossible de valider : statut actuel = '{ecriture.statut}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not ecriture.est_equilibree:
            return Response(
                {'error': f"L'écriture n'est pas équilibrée : "
                          f"débit={ecriture.total_debit}, crédit={ecriture.total_credit}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        ecriture.statut = 'validee'
        ecriture.date_validation = timezone.now()
        ecriture.save()
        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'validation', 'ecriture',
            f'Validation écriture {ecriture.numero_ecriture} — {ecriture.libelle}',
            objet_id=ecriture.id, objet_reference=ecriture.numero_ecriture,
        )
        return Response(EcritureComptableSerializer(ecriture).data)

    @action(detail=False, methods=['get'], url_path='grand-livre/(?P<compte_id>[0-9]+)')
    def grand_livre(self, request, compte_id=None):
        """Grand Livre d'un compte : mouvements chronologiques + solde cumulé."""
        try:
            compte = CompteComptable.objects.get(pk=compte_id)
        except CompteComptable.DoesNotExist:
            return Response({'error': 'Compte non trouvé'}, status=status.HTTP_404_NOT_FOUND)

        lignes = LigneEcriture.objects.filter(
            compte=compte, ecriture__statut='validee'
        ).select_related('ecriture', 'ecriture__journal').order_by('ecriture__date_ecriture', 'id')

        ex_id = resolve_exercice_id(request, allow_historique=True)
        if ex_id:
            lignes = lignes.filter(ecriture__exercice_id=ex_id)

        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        if date_debut:
            lignes = lignes.filter(ecriture__date_ecriture__gte=date_debut)
        if date_fin:
            lignes = lignes.filter(ecriture__date_ecriture__lte=date_fin)

        mouvements = []
        solde_cumule = Decimal('0.00')
        for ligne in lignes:
            debit = ligne.montant_debit or Decimal('0.00')
            credit = ligne.montant_credit or Decimal('0.00')
            solde_cumule += debit - credit
            mouvements.append({
                'date': ligne.ecriture.date_ecriture,
                'numero_ecriture': ligne.ecriture.numero_ecriture,
                'journal': ligne.ecriture.journal.code,
                'libelle': ligne.libelle or ligne.ecriture.libelle,
                'debit': float(debit),
                'credit': float(credit),
                'solde_cumule': float(solde_cumule),
            })

        return Response({
            'compte': {'id': compte.id, 'numero': compte.numero_compte, 'libelle': compte.libelle},
            'nombre_mouvements': len(mouvements),
            'total_debit': float(sum(m['debit'] for m in mouvements)),
            'total_credit': float(sum(m['credit'] for m in mouvements)),
            'solde_final': float(solde_cumule),
            'mouvements': mouvements,
        })

    @action(detail=False, methods=['get'], url_path='comptes-utilises')
    def comptes_utilises(self, request):
        """Retourne uniquement les comptes qui ont au moins une ligne d'écriture validée."""
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')

        lignes = LigneEcriture.objects.filter(ecriture__statut='validee')
        if date_debut:
            lignes = lignes.filter(ecriture__date_ecriture__gte=date_debut)
        if date_fin:
            lignes = lignes.filter(ecriture__date_ecriture__lte=date_fin)

        compte_ids = lignes.values_list('compte_id', flat=True).distinct()
        comptes = CompteComptable.objects.filter(id__in=compte_ids).order_by('numero_compte')

        return Response([
            {'id': c.id, 'numero_compte': c.numero_compte, 'libelle': c.libelle, 'classe': c.classe}
            for c in comptes
        ])

    @action(detail=False, methods=['get'], url_path='grand-livre-global')
    def grand_livre_global(self, request):
        """
        Grand Livre complet — TOUS les comptes du plan comptable.
        Comptes avec mouvements : affiche les lignes + solde cumulé.
        Comptes sans mouvements : affiche l'en-tête avec solde = 0.
        """
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')

        # Tous les comptes actifs du plan, triés par numéro
        tous_comptes = CompteComptable.objects.filter(actif=True).order_by('numero_compte')

        # Toutes les lignes validées
        lignes_qs = LigneEcriture.objects.filter(
            ecriture__statut='validee'
        ).select_related('ecriture', 'ecriture__journal', 'compte').order_by(
            'compte__numero_compte', 'ecriture__date_ecriture', 'id'
        )
        if date_debut:
            lignes_qs = lignes_qs.filter(ecriture__date_ecriture__gte=date_debut)
        if date_fin:
            lignes_qs = lignes_qs.filter(ecriture__date_ecriture__lte=date_fin)

        # Indexer les lignes par compte_id
        from collections import defaultdict
        lignes_par_compte = defaultdict(list)
        for ligne in lignes_qs:
            lignes_par_compte[ligne.compte_id].append(ligne)

        # Construire la réponse groupée par compte
        comptes_data = []
        all_mouvements = []

        for compte in tous_comptes:
            lignes = lignes_par_compte.get(compte.id, [])
            mouvements = []
            solde_cumule = Decimal('0.00')
            total_debit = Decimal('0.00')
            total_credit = Decimal('0.00')

            for ligne in lignes:
                debit = ligne.montant_debit or Decimal('0.00')
                credit = ligne.montant_credit or Decimal('0.00')
                solde_cumule += debit - credit
                total_debit += debit
                total_credit += credit
                mouvement = {
                    'date': ligne.ecriture.date_ecriture,
                    'numero_ecriture': ligne.ecriture.numero_ecriture,
                    'journal': ligne.ecriture.journal.code,
                    'libelle': ligne.libelle or ligne.ecriture.libelle,
                    'debit': float(debit),
                    'credit': float(credit),
                    'solde_cumule': float(solde_cumule),
                    'compte_id': compte.id,
                    'numero_compte': compte.numero_compte,
                    'libelle_compte': compte.libelle,
                }
                mouvements.append(mouvement)
                all_mouvements.append(mouvement)

            comptes_data.append({
                'compte_id': compte.id,
                'numero_compte': compte.numero_compte,
                'libelle_compte': compte.libelle,
                'classe': compte.classe,
                'total_debit': float(total_debit),
                'total_credit': float(total_credit),
                'solde_final': float(solde_cumule),
                'nombre_mouvements': len(mouvements),
                'mouvements': mouvements,
            })

        return Response({
            'nombre_comptes': len(comptes_data),
            'nombre_mouvements': len(all_mouvements),
            'comptes': comptes_data,
            'mouvements': all_mouvements,
        })

    @action(detail=False, methods=['get'], url_path='balance')
    def balance(self, request):
        """Balance Générale : tous les comptes avec débits, crédits, soldes."""
        comptes = CompteComptable.objects.filter(actif=True).order_by('numero_compte')

        # Filtres optionnels
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        classe = request.query_params.get('classe')
        if classe:
            comptes = comptes.filter(classe=classe)

        lignes_filter = Q(lignes_ecriture__ecriture__statut='validee')
        if date_debut:
            lignes_filter &= Q(lignes_ecriture__ecriture__date_ecriture__gte=date_debut)
        if date_fin:
            lignes_filter &= Q(lignes_ecriture__ecriture__date_ecriture__lte=date_fin)

        comptes_list = []
        total_debits = Decimal('0.00')
        total_credits = Decimal('0.00')
        total_solde_debit = Decimal('0.00')
        total_solde_credit = Decimal('0.00')

        ex_id = resolve_exercice_id(request, allow_historique=True)

        for compte in comptes:
            agg = LigneEcriture.objects.filter(
                compte=compte,
                ecriture__statut='validee'
            )
            if ex_id:
                agg = agg.filter(ecriture__exercice_id=ex_id)
            if date_debut:
                agg = agg.filter(ecriture__date_ecriture__gte=date_debut)
            if date_fin:
                agg = agg.filter(ecriture__date_ecriture__lte=date_fin)

            totaux = agg.aggregate(
                debit=Sum('montant_debit'),
                credit=Sum('montant_credit')
            )
            debit = totaux['debit'] or Decimal('0.00')
            credit = totaux['credit'] or Decimal('0.00')

            if debit == 0 and credit == 0:
                continue  # Pas de mouvements

            solde = debit - credit
            total_debits += debit
            total_credits += credit
            
            # Calculer les totaux des soldes
            if solde > 0:
                total_solde_debit += solde
            else:
                total_solde_credit += abs(solde)

            comptes_list.append({
                'compte_numero': compte.numero_compte,
                'compte_libelle': compte.libelle,
                'classe': compte.classe,
                'mouvements_debit': float(debit),
                'mouvements_credit': float(credit),
                'solde_debit': float(solde) if solde > 0 else 0,
                'solde_credit': float(abs(solde)) if solde < 0 else 0,
            })

        return Response({
            'nombre_comptes': len(comptes_list),
            'equilibre': abs(total_debits - total_credits) < Decimal('0.01'),
            'comptes': comptes_list,
            'totaux': {
                'mouvements_debit': float(total_debits),
                'mouvements_credit': float(total_credits),
                'solde_debit': float(total_solde_debit),
                'solde_credit': float(total_solde_credit),
            }
        })

    @action(detail=False, methods=['get'], url_path='statistiques')
    def statistiques(self, request):
        """Statistiques des écritures."""
        qs = self.get_queryset()
        return Response({
            'total': qs.count(),
            'brouillons': qs.filter(statut='brouillon').count(),
            'validees': qs.filter(statut='validee').count(),
            'annulees': qs.filter(statut='annulee').count(),
        })


# =====================================================================
#                  EXERCICE COMPTABLE (4 endpoints)
# =====================================================================

class ExerciceComptableViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les Exercices Comptables.

    Endpoints:
    - GET/POST  /api/exercices/
    - GET       /api/exercices/{id}/
    - POST      /api/exercices/{id}/cloturer/
    - POST      /api/exercices/{id}/report-nouveau/
    """
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = ExerciceComptable.objects.all()
    serializer_class = ExerciceComptableSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['statut', 'annee']
    ordering = ['-annee']

    def perform_create(self, serializer):
        from apps.comptabilite.audit_helper import audit_action
        exercice = serializer.save()
        audit_action(
            self.request, 'creation', 'exercice',
            f'Création exercice {exercice.annee}',
            objet_id=exercice.id, objet_reference=f'EX-{exercice.annee}',
        )

    @action(detail=False, methods=['get'], url_path='courant')
    def courant(self, request):
        """Exercice comptable ouvert (référence des vues opérationnelles)."""
        exercice = get_exercice_ouvert()
        if not exercice:
            return Response(
                {'error': "Aucun exercice comptable ouvert."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(ExerciceComptableSerializer(exercice).data)

    @action(detail=False, methods=['get'], url_path='comparatif')
    def comparatif(self, request):
        """Comparatif pluriannuel : recettes, dépenses, budgets, résultat."""
        rows = []
        prev = None
        for ex in ExerciceComptable.objects.order_by('annee'):
            if ex.statut == 'ouvert':
                synchroniser_budgets_exercice(ex)
            kpis = self._kpis_exercice(ex.id)
            budgets = BudgetPrevisionnel.objects.filter(exercice=ex)
            budget_prevu = budgets.aggregate(t=Sum('montant_prevu'))['t'] or 0
            budget_consomme = budgets.aggregate(t=Sum('montant_consomme'))['t'] or 0
            row = {
                'exercice_id': ex.id,
                'annee': ex.annee,
                'code': f'EX-{ex.annee}',
                'statut': ex.statut,
                'resultat_net': float(ex.resultat_net) if ex.resultat_net is not None else kpis['resultat_net'],
                **kpis,
                'budget_prevu': float(budget_prevu),
                'budget_consomme': float(budget_consomme),
            }
            if prev:
                row['variation_recettes_pct'] = self._variation_pct(
                    prev['total_recettes'], row['total_recettes']
                )
                row['variation_depenses_pct'] = self._variation_pct(
                    prev['total_depenses'], row['total_depenses']
                )
            rows.append(row)
            prev = row
        return Response({'exercices': rows})

    @action(detail=True, methods=['get'], url_path='synthese-historique')
    def synthese_historique(self, request, pk=None):
        """Synthèse read-only d'un exercice (historique / archives)."""
        exercice = self.get_object()
        kpis = self._kpis_exercice(exercice.id)
        budgets = BudgetPrevisionnel.objects.filter(exercice=exercice)
        nb_ecritures = EcritureComptable.objects.filter(exercice=exercice).count()
        nb_validees = EcritureComptable.objects.filter(exercice=exercice, statut='validee').count()
        from apps.caisse.models import Quittance
        return Response({
            'exercice': ExerciceComptableSerializer(exercice).data,
            'kpis': kpis,
            'budgets': {
                'prevu': float(budgets.aggregate(t=Sum('montant_prevu'))['t'] or 0),
                'consomme': float(budgets.aggregate(t=Sum('montant_consomme'))['t'] or 0),
                'lignes': BudgetPrevisionnelSerializer(budgets, many=True).data,
            },
            'comptabilite': {
                'nb_ecritures': nb_ecritures,
                'nb_ecritures_validees': nb_validees,
                'nb_quittances': Quittance.objects.filter(exercice=exercice).count(),
            },
            'liens_rapports': {
                'balance': f'/api/ecritures/balance/?exercice={exercice.id}',
                'bilan': f'/api/etats-financiers/bilan/?exercice={exercice.id}',
                'compte_resultat': f'/api/etats-financiers/compte-resultat/?exercice={exercice.id}',
                'flux_tresorerie': f'/api/etats-financiers/flux-tresorerie/?exercice={exercice.id}',
            },
        })

    @staticmethod
    def _variation_pct(ancien, nouveau):
        if not ancien:
            return None
        return round((nouveau - ancien) / ancien * 100, 2)

    @staticmethod
    def _kpis_exercice(exercice_id):
        exercice = ExerciceComptable.objects.filter(pk=exercice_id).first()
        if not exercice:
            return {
                'total_recettes': 0,
                'total_depenses': 0,
                'depenses_comptabilisees': 0,
                'depenses_operationnelles': 0,
                'total_sorties': 0,
                'resultat_net': 0,
                'resultat_net_comptable': 0,
            }
        unified = get_kpis_exercice_unifies(exercice)
        return {
            'total_recettes': unified['total_recettes'],
            'total_depenses': unified['total_sorties'],
            'depenses_comptabilisees': unified['total_depenses'],
            'depenses_operationnelles': unified['total_sorties'],
            'total_sorties': unified['total_sorties'],
            'depenses_menues': unified['depenses_menues'],
            'ordres_paiement_executes': unified['ordres_paiement_executes'],
            'recettes_en_attente': unified['recettes_en_attente'],
            'resultat_net': unified['resultat_net_operationnel'],
            'resultat_net_comptable': unified['resultat_net'],
        }

    @action(detail=True, methods=['post'], url_path='cloturer')
    def cloturer(self, request, pk=None):
        """Clôturer l'exercice : calcul du résultat net."""
        exercice = self.get_object()
        if exercice.statut == 'cloture':
            return Response(
                {'error': "Cet exercice est déjà clôturé."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Vérifier que l'exercice a atteint son terme calendaire
        today = timezone.localdate()
        if today < exercice.date_fin:
            return Response(
                {
                    'error': (
                        f"Opération impossible : l'exercice comptable {exercice.annee} ne peut pas être clôturé "
                        f"avant sa date de fin prévue ({exercice.date_fin.strftime('%d/%m/%Y')}). "
                        f"La date courante du système est le {today.strftime('%d/%m/%Y')}."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calcul du résultat : total produits (classe 7) - total charges (classe 6)
        ecritures_validees = LigneEcriture.objects.filter(
            ecriture__exercice=exercice,
            ecriture__statut='validee'
        )
        total_produits = ecritures_validees.filter(
            compte__classe='7'
        ).aggregate(
            debit=Sum('montant_debit'),
            credit=Sum('montant_credit')
        )
        total_charges = ecritures_validees.filter(
            compte__classe='6'
        ).aggregate(
            debit=Sum('montant_debit'),
            credit=Sum('montant_credit')
        )

        produits = (total_produits['credit'] or 0) - (total_produits['debit'] or 0)
        charges = (total_charges['debit'] or 0) - (total_charges['credit'] or 0)
        resultat_net = produits - charges

        exercice.statut = 'cloture'
        exercice.resultat_net = resultat_net
        exercice.date_cloture = timezone.now()
        exercice.save()

        from apps.comptabilite.audit_helper import audit_action
        audit_action(
            request, 'cloture', 'exercice',
            f'Clôture exercice {exercice.annee} — résultat net {float(resultat_net):,.0f} FCFA',
            objet_id=exercice.id, objet_reference=f'EX-{exercice.annee}',
            donnees_apres={
                'resultat_net': float(resultat_net),
                'total_produits': float(produits),
                'total_charges': float(charges),
            },
        )

        from apps.comptabilite.tresorerie_helper import generer_report_nouveau
        report_result = generer_report_nouveau(exercice)

        payload = {
            'message': f"Exercice {exercice.annee} clôturé avec succès.",
            'total_produits': float(produits),
            'total_charges': float(charges),
            'resultat_net': float(resultat_net),
            'type_resultat': 'Bénéfice' if resultat_net >= 0 else 'Perte',
            'exercice': ExerciceComptableSerializer(exercice).data,
        }
        if report_result:
            payload['report_a_nouveau'] = report_result

        return Response(payload)

    @action(detail=True, methods=['post'], url_path='report-nouveau')
    def report_nouveau(self, request, pk=None):
        """Générer les écritures de report à nouveau pour N+1."""
        exercice = self.get_object()
        from apps.comptabilite.tresorerie_helper import generer_report_nouveau

        result = generer_report_nouveau(exercice)
        if result is None:
            return Response(
                {'error': f"L'exercice {exercice.annee + 1} n'existe pas. Créez-le d'abord."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if result.get('error'):
            return Response({'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)
        if result.get('skipped'):
            return Response({
                'message': result['message'],
                'ecritures_creees': 0,
                'exercice_cible': result.get('exercice_cible'),
            })
        return Response({
            'message': result['message'],
            'numero_ecriture': result['numero_ecriture'],
            'comptes_reportes': result['comptes_reportes'],
            'tresorerie_reportee': result.get('tresorerie_reportee'),
        })


# =====================================================================
#                  BUDGET PRÉVISIONNEL (3 endpoints)
# =====================================================================

class BudgetPrevisionnelViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les Budgets Prévisionnels.

    Endpoints:
    - GET/POST  /api/budgets/
    - GET       /api/budgets/par-service/{id}/
    - GET       /api/budgets/evaluation/
    """
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = BudgetPrevisionnel.objects.select_related('exercice', 'categorie')
    serializer_class = BudgetPrevisionnelSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['exercice', 'priorite', 'service_hospitalier']
    search_fields = ['libelle', 'service_hospitalier']
    ordering = ['-exercice__annee', 'categorie']

    def get_queryset(self):
        qs = super().get_queryset()
        ex_param = self.request.query_params.get('exercice')
        if ex_param:
            return qs.filter(exercice_id=ex_param)
        ex = get_exercice_ouvert()
        if ex:
            return qs.filter(exercice=ex)
        return qs.none()

    def perform_create(self, serializer):
        from apps.comptabilite.audit_helper import audit_action
        budget = serializer.save()
        audit_action(
            self.request, 'creation', 'budget',
            f'Allocation budget « {budget.libelle} » — {float(budget.montant_prevu or 0):,.0f} FCFA',
            objet_id=budget.id,
            objet_reference=budget.libelle,
            donnees_apres={
                'montant_prevu': float(budget.montant_prevu or 0),
                'service': budget.service_hospitalier,
            },
        )

    @action(detail=False, methods=['get'], url_path='par-service/(?P<service_id>[0-9]+)')
    def par_service(self, request, service_id=None):
        """Budget d'un service hospitalier."""
        budgets = self.get_queryset().filter(service_hospitalier_id=service_id)
        serializer = self.get_serializer(budgets, many=True)
        total_prevu = budgets.aggregate(t=Sum('montant_prevu'))['t'] or 0
        total_consomme = budgets.aggregate(t=Sum('montant_consomme'))['t'] or 0
        return Response({
            'service_id': int(service_id),
            'nombre_budgets': budgets.count(),
            'total_prevu': float(total_prevu),
            'total_consomme': float(total_consomme),
            'total_disponible': float(total_prevu - total_consomme),
            'budgets': serializer.data,
        })

    @action(detail=False, methods=['get'], url_path='evaluation')
    def evaluation(self, request):
        """Évaluation budgétaire globale."""
        qs = self.get_queryset()
        exercice_id = request.query_params.get('exercice')
        if exercice_id:
            qs = qs.filter(exercice_id=exercice_id)

        total_prevu = qs.aggregate(t=Sum('montant_prevu'))['t'] or 0
        total_consomme = qs.aggregate(t=Sum('montant_consomme'))['t'] or 0
        taux = round((total_consomme / total_prevu * 100), 2) if total_prevu > 0 else 0

        # Par priorité
        par_priorite = {}
        for code, label in BudgetPrevisionnel.PRIORITE_CHOICES:
            sub = qs.filter(priorite=code)
            prevu = sub.aggregate(t=Sum('montant_prevu'))['t'] or 0
            consomme = sub.aggregate(t=Sum('montant_consomme'))['t'] or 0
            par_priorite[code] = {
                'nombre': sub.count(),
                'prevu': float(prevu),
                'consomme': float(consomme),
                'disponible': float(prevu - consomme),
            }

        return Response({
            'total_prevu': float(total_prevu),
            'total_consomme': float(total_consomme),
            'total_disponible': float(total_prevu - total_consomme),
            'taux_consommation': taux,
            'par_priorite': par_priorite,
        })


# =====================================================================
#                  PRESTATIONS DE SERVICE (2 endpoints)
# =====================================================================

class PrestationDeServiceViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les Prestations de Service.

    Endpoints:
    - GET/POST  /api/prestations-de-service/
    - GET       /api/prestations-de-service/by-service/{id}/
    """
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = PrestationDeService.objects.select_related('compte_comptable')
    serializer_class = PrestationDeServiceSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['type_prestation', 'actif']
    search_fields = ['code', 'libelle']
    ordering = ['type_prestation', 'code']

    @action(detail=False, methods=['get'], url_path='by-service/(?P<service_id>[0-9]+)')
    def by_service(self, request, service_id=None):
        """Prestations d'un service hospitalier."""
        prestations = self.get_queryset().filter(
            service_hospitalier_id=service_id, actif=True
        )
        serializer = self.get_serializer(prestations, many=True)
        return Response({
            'service_id': int(service_id),
            'nombre': prestations.count(),
            'prestations': serializer.data,
        })


# =====================================================================
#                  ÉTATS FINANCIERS SYSCOHADA (4 endpoints)
# =====================================================================

class EtatsFinanciersViewSet(viewsets.ViewSet):
    """
    ViewSet pour les États Financiers SYSCOHADA.
    Endpoints en lecture seule — générés depuis les écritures validées.

    Endpoints:
    - GET  /api/etats-financiers/bilan/
    - GET  /api/etats-financiers/compte-resultat/
    - GET  /api/etats-financiers/flux-tresorerie/
    - GET  /api/etats-financiers/resultat-par-service/
    """
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]

    def _get_date_filters(self, request):
        """Extraire les filtres de date communs."""
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        exercice_id = request.query_params.get('exercice')
        if not exercice_id:
            ex = get_exercice_ouvert()
            exercice_id = ex.id if ex else None
        filters = Q(ecriture__statut='validee')
        if date_debut:
            filters &= Q(ecriture__date_ecriture__gte=date_debut)
        if date_fin:
            filters &= Q(ecriture__date_ecriture__lte=date_fin)
        if exercice_id:
            filters &= Q(ecriture__exercice_id=exercice_id)
        return filters

    def _solde_classe(self, filters, classe):
        """Calculer le solde d'une classe de comptes."""
        agg = LigneEcriture.objects.filter(
            filters, compte__classe=classe
        ).aggregate(debit=Sum('montant_debit'), credit=Sum('montant_credit'))
        return {
            'debit': agg['debit'] or Decimal('0'),
            'credit': agg['credit'] or Decimal('0'),
        }

    def _soldes_par_compte(self, filters, classes):
        """Calculer les soldes par compte pour des classes données."""
        comptes = CompteComptable.objects.filter(
            classe__in=classes, actif=True
        ).order_by('numero_compte')
        resultats = []
        for compte in comptes:
            agg = LigneEcriture.objects.filter(
                filters, compte=compte
            ).aggregate(debit=Sum('montant_debit'), credit=Sum('montant_credit'))
            debit = agg['debit'] or Decimal('0')
            credit = agg['credit'] or Decimal('0')
            if debit == 0 and credit == 0:
                continue
            solde = debit - credit
            resultats.append({
                'numero_compte': compte.numero_compte,
                'libelle': compte.libelle,
                'debit': float(debit),
                'credit': float(credit),
                'solde': float(solde),
            })
        return resultats

    @action(detail=False, methods=['get'], url_path='bilan')
    def bilan(self, request):
        """
        Bilan SYSCOHADA.
        Actif : classes 2 (Immobilisations), 3 (Stocks), 4 débiteurs, 5 (Trésorerie active)
        Passif : classe 1 (Capitaux), 4 créditeurs, 5 (Trésorerie passive)
        """
        filters = self._get_date_filters(request)

        # ACTIF
        actif_immobilisations = self._soldes_par_compte(filters, ['2'])
        actif_stocks = self._soldes_par_compte(filters, ['3'])
        actif_tresorerie = self._soldes_par_compte(filters, ['5'])
        actif_clients = self._soldes_par_compte(filters, ['4'])
        # Filtrer classe 4 : comptes débiteurs = actif, créditeurs = passif
        actif_tiers = [c for c in actif_clients if c['solde'] > 0]
        passif_tiers = [c for c in actif_clients if c['solde'] < 0]
        actif_tresorerie_active = [c for c in actif_tresorerie if c['solde'] > 0]
        passif_tresorerie = [c for c in actif_tresorerie if c['solde'] < 0]

        total_actif = sum(c['solde'] for c in actif_immobilisations) + \
                      sum(c['solde'] for c in actif_stocks) + \
                      sum(c['solde'] for c in actif_tiers) + \
                      sum(c['solde'] for c in actif_tresorerie_active)

        # PASSIF
        passif_capitaux = self._soldes_par_compte(filters, ['1'])
        total_passif = sum(abs(c['solde']) for c in passif_capitaux) + \
                       sum(abs(c['solde']) for c in passif_tiers) + \
                       sum(abs(c['solde']) for c in passif_tresorerie)

        return Response({
            'titre': 'Bilan — SYSCOHADA',
            'actif': {
                'immobilisations': actif_immobilisations,
                'stocks': actif_stocks,
                'creances_tiers': actif_tiers,
                'tresorerie_active': actif_tresorerie_active,
                'total_actif': float(total_actif),
            },
            'passif': {
                'capitaux_propres': passif_capitaux,
                'dettes_tiers': passif_tiers,
                'tresorerie_passive': passif_tresorerie,
                'total_passif': float(total_passif),
            },
            'equilibre': abs(total_actif - total_passif) < 0.01,
        })

    @action(detail=False, methods=['get'], url_path='compte-resultat')
    def compte_resultat(self, request):
        """
        Compte de Résultat SYSCOHADA.
        Charges (classe 6) vs Produits (classe 7).
        """
        filters = self._get_date_filters(request)

        charges_detail = self._soldes_par_compte(filters, ['6'])
        produits_detail = self._soldes_par_compte(filters, ['7'])

        # Charges = débit - crédit (solde débiteur)
        total_charges = sum(c['solde'] for c in charges_detail)
        # Produits = crédit - débit (solde créditeur, donc on inverse)
        total_produits = sum(abs(c['solde']) for c in produits_detail)

        resultat_net = total_produits - total_charges

        return Response({
            'titre': 'Compte de Résultat — SYSCOHADA',
            'charges': {
                'detail': charges_detail,
                'total': float(total_charges),
            },
            'produits': {
                'detail': produits_detail,
                'total': float(total_produits),
            },
            'resultat_net': float(resultat_net),
            'type_resultat': 'Bénéfice' if resultat_net >= 0 else 'Perte',
        })

    @action(detail=False, methods=['get'], url_path='flux-tresorerie')
    def flux_tresorerie(self, request):
        """
        Tableau des Flux de Trésorerie (TFT) SYSCOHADA.
        3 catégories : opérationnels, investissement, financement.
        """
        filters = self._get_date_filters(request)

        # Flux opérationnels : recettes (classe 7) - charges (classe 6) via trésorerie
        tresorerie = self._solde_classe(filters, '5')
        flux_tresorerie_net = tresorerie['debit'] - tresorerie['credit']

        # Flux d'investissement : mouvements classe 2 (immobilisations)
        investissement = self._solde_classe(filters, '2')
        flux_investissement = -(investissement['debit'] - investissement['credit'])

        # Flux de financement : mouvements classe 1 (capitaux)
        financement = self._solde_classe(filters, '1')
        flux_financement = financement['credit'] - financement['debit']

        # Flux opérationnels = total - investissement - financement
        produits = self._solde_classe(filters, '7')
        charges = self._solde_classe(filters, '6')
        flux_operationnel = (produits['credit'] - produits['debit']) - \
                           (charges['debit'] - charges['credit'])

        return Response({
            'titre': 'Tableau des Flux de Trésorerie — SYSCOHADA',
            'flux_operationnels': float(flux_operationnel),
            'flux_investissement': float(flux_investissement),
            'flux_financement': float(flux_financement),
            'variation_tresorerie': float(flux_tresorerie_net),
        })

    @action(detail=False, methods=['get'], url_path='resultat-par-service')
    def resultat_par_service(self, request):
        """Résultat par service hospitalier (comptabilité analytique simplifiée)."""
        filters = self._get_date_filters(request)

        # Regrouper les prestations par service
        services = PrestationDeService.objects.values(
            'service_hospitalier', 'service_hospitalier_id'
        ).distinct().exclude(service_hospitalier__isnull=True)

        resultats = []
        for service in services:
            # RECETTES : écritures liées aux comptes de produits (Classe 7) de ce service
            comptes_produits = PrestationDeService.objects.filter(
                service_hospitalier=service['service_hospitalier']
            ).values_list('compte_comptable_id', flat=True)

            agg_produits = LigneEcriture.objects.filter(
                filters,
                compte_id__in=comptes_produits,
                ecriture__statut='validee'
            ).aggregate(debit=Sum('montant_debit'), credit=Sum('montant_credit'))

            recettes = (agg_produits['credit'] or 0) - (agg_produits['debit'] or 0)

            # DÉPENSES : écritures liées aux comptes de charges (Classe 6) de ce service
            # On utilise les budgets pour identifier les comptes de charges par service
            comptes_charges = BudgetPrevisionnel.objects.filter(
                service_hospitalier=service['service_hospitalier']
            ).values_list('compte_comptable_id', flat=True).distinct()

            agg_charges = LigneEcriture.objects.filter(
                filters,
                compte_id__in=comptes_charges,
                compte__classe='6',  # Classe 6 = Charges
                ecriture__statut='validee'
            ).aggregate(debit=Sum('montant_debit'), credit=Sum('montant_credit'))

            depenses = (agg_charges['debit'] or 0) - (agg_charges['credit'] or 0)

            # Calculer le résultat
            resultat = float(recettes) - float(depenses)

            resultats.append({
                'service': service['service_hospitalier'],
                'service_id': service['service_hospitalier_id'],
                'recettes': float(recettes),
                'depenses': float(depenses),
                'resultat': resultat,
            })

        resultats.sort(key=lambda x: x['recettes'], reverse=True)
        return Response({
            'titre': 'Résultat par Service Hospitalier',
            'nombre_services': len(resultats),
            'services': resultats,
        })


# =====================================================================
#                  AUDIT LOG — PISTE D'AUDIT (2 endpoints)
# =====================================================================

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet pour la Piste d'Audit (lecture seule).

    Endpoints:
    - GET  /api/audit-log/
    - GET  /api/audit-log/par-utilisateur/{id}/
    """
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['action', 'module', 'utilisateur_id']
    search_fields = ['description', 'objet_reference', 'utilisateur_nom']
    ordering = ['-date_action']

    @action(detail=False, methods=['get'], url_path='par-utilisateur/(?P<user_id>[0-9]+)')
    def par_utilisateur(self, request, user_id=None):
        """Activité d'un utilisateur spécifique."""
        logs = self.get_queryset().filter(utilisateur_id=user_id)

        # Stats par action
        par_action = {}
        for code, label in AuditLog.ACTION_CHOICES:
            count = logs.filter(action=code).count()
            if count > 0:
                par_action[code] = {'label': label, 'count': count}

        serializer = self.get_serializer(logs[:50], many=True)
        return Response({
            'utilisateur_id': int(user_id),
            'total_actions': logs.count(),
            'par_action': par_action,
            'dernieres_actions': serializer.data,
        })


# =====================================================================
#                  TABLEAU DE BORD FINANCIER (2 endpoints)
# =====================================================================

class TableauDeBordViewSet(viewsets.ViewSet):
    """
    ViewSet pour le Tableau de Bord Financier.

    Endpoints:
    - GET  /api/tableau-de-bord/
    - GET  /api/tableau-de-bord/evolution-mensuelle/
    """
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_FINANCIERE')]

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        """KPIs financiers globaux (exercice ouvert uniquement)."""
        exercice = get_exercice_ouvert()
        ex_filter = Q(ecriture__exercice=exercice) if exercice else Q(pk__in=[])
        ecritures_validees = LigneEcriture.objects.filter(
            ecriture__statut='validee'
        ).filter(ex_filter)

        compta = get_charges_comptables(exercice) if exercice else {
            'total_recettes': 0, 'total_depenses': 0, 'resultat_net': 0,
        }
        total_recettes = compta['total_recettes']
        depenses_comptabilisees = compta['total_depenses']

        sorties = get_sorties_operationnelles(exercice=exercice) if exercice else {
            'depenses_menues': 0, 'ordres_paiement': 0, 'total_sorties': 0,
        }
        depenses_operationnelles = sorties['total_sorties']
        # Le compte de résultat (P&L) s'appuie sur le grand-livre (charges classe 6),
        # source de vérité unique cohérente avec balance / grand-livre / journal.
        # Les sorties opérationnelles (caisse/OP) restent affichées séparément à titre
        # de suivi de trésorerie.
        total_depenses = depenses_comptabilisees

        # Trésorerie (classe 5) — report JRN + mouvements exercice courant
        from apps.comptabilite.tresorerie_helper import get_tresorerie_detail
        tresorerie_detail = get_tresorerie_detail(exercice)
        solde_tresorerie = tresorerie_detail['solde']

        # Créances clients (classe 4 débiteurs)
        clients = ecritures_validees.filter(
            compte__classe='4', compte__numero_compte__startswith='41'
        ).aggregate(debit=Sum('montant_debit'), credit=Sum('montant_credit'))
        creances = (clients['debit'] or 0) - (clients['credit'] or 0)

        # Dettes fournisseurs (classe 4 créditeurs)
        fournisseurs = ecritures_validees.filter(
            compte__classe='4', compte__numero_compte__startswith='40'
        ).aggregate(debit=Sum('montant_debit'), credit=Sum('montant_credit'))
        dettes = (fournisseurs['credit'] or 0) - (fournisseurs['debit'] or 0)

        # Ratios (résultat flux = recettes comptabilisées − sorties caisse/OP)
        resultat_net_comptable = compta['resultat_net']
        resultat_net = float(total_recettes) - float(total_depenses)
        marge = round((resultat_net / float(total_recettes) * 100), 2) if total_recettes else 0

        ecritures_qs = EcritureComptable.objects.filter(exercice=exercice) if exercice else EcritureComptable.objects.none()
        nb_ecritures = ecritures_qs.count()
        nb_ecritures_validees = ecritures_qs.filter(statut='validee').count()
        nb_brouillons = ecritures_qs.filter(statut='brouillon').count()

        budgets_qs = BudgetPrevisionnel.objects.filter(exercice=exercice) if exercice else BudgetPrevisionnel.objects.none()
        budgets = budgets_qs.aggregate(
            prevu=Sum('montant_prevu'), consomme=Sum('montant_consomme')
        )
        budget_prevu = budgets['prevu'] or 0
        budget_consomme = budgets['consomme'] or 0

        from apps.caisse.models import Quittance

        qt_attente_qs = Quittance.objects.filter(
            est_validee=True, est_comptabilisee=False, exercice=exercice
        ) if exercice else Quittance.objects.none()
        recettes_en_attente = qt_attente_qs.aggregate(t=Sum('montant'))['t'] or 0
        nb_quittances_attente = qt_attente_qs.count()

        if exercice and exercice.statut == 'ouvert':
            synchroniser_budgets_exercice(exercice)

        # Engagements : demandes approuvées non encore décaissées (comptabilité d'engagement)
        from apps.sorties.models import DemandeAchat
        engagements = float(
            DemandeAchat.objects.filter(statut='approuvee').aggregate(
                t=Sum('montant_estime')
            )['t'] or 0
        )
        budget_disponible_brut = float(budget_prevu - budget_consomme)
        budget_disponible_net = budget_disponible_brut - engagements
        solde_tresorerie_f = float(solde_tresorerie)

        return Response({
            'titre': 'Tableau de Bord Financier',
            'exercice': ExerciceComptableSerializer(exercice).data if exercice else None,
            'kpis': {
                'total_recettes': float(total_recettes),
                'recettes_comptabilisees': float(total_recettes),
                'recettes_en_attente': float(recettes_en_attente),
                'nb_quittances_attente': nb_quittances_attente,
                'total_depenses': float(total_depenses),
                'depenses_comptabilisees': float(depenses_comptabilisees),
                'depenses_operationnelles': float(depenses_operationnelles),
                'depenses_menues': sorties['depenses_menues'],
                'ordres_paiement_executes': sorties['ordres_paiement'],
                'resultat_net': resultat_net,
                'resultat_net_comptable': float(resultat_net_comptable),
                'marge_nette_pct': marge,
                'solde_tresorerie': solde_tresorerie_f,
                'creances_clients': float(creances),
                'dettes_fournisseurs': float(dettes),
            },
            'tresorerie': {
                'solde': solde_tresorerie_f,
                'solde_report_a_nouveau': tresorerie_detail['solde_report_a_nouveau'],
                'solde_mouvements_exercice': tresorerie_detail['solde_mouvements_exercice'],
                'report_manquant': tresorerie_detail['report_manquant'],
                'exercice_report_source': tresorerie_detail['exercice_report_source'],
                'report_a_nouveau_present': tresorerie_detail['report_a_nouveau_present'],
                'nature': 'comptabilite_classe_5',
                'libelle': 'Trésorerie réelle (report à nouveau JRN + mouvements classe 5)',
            },
            'ecritures': {
                'total': nb_ecritures,
                'validees': nb_ecritures_validees,
                'brouillons': nb_brouillons,
            },
            'budget': {
                'prevu': float(budget_prevu),
                'consomme': float(budget_consomme),
                'engagements': engagements,
                'disponible': budget_disponible_net,
                'disponible_sans_engagements': budget_disponible_brut,
                'taux_consommation': round(float(budget_consomme / budget_prevu * 100), 2) if budget_prevu else 0,
                'nature': 'controle_gestion',
                'libelle': 'Enveloppe prévisionnelle (plafond d\'autorisation, hors bilan)',
            },
            'coherence': {
                'ecart_enveloppe_tresorerie': round(budget_disponible_brut - solde_tresorerie_f, 2),
                'alerte_decouplage': budget_disponible_brut > max(solde_tresorerie_f * 2, 500_000),
            },
        })

    @action(detail=False, methods=['get'], url_path='evolution-mensuelle')
    def evolution_mensuelle(self, request):
        """Évolution mensuelle des recettes et dépenses (écritures + flux opérationnels)."""
        from apps.caisse.models import Quittance, DepenseMenue
        from apps.sorties.models import OrdrePaiement

        exercice_id = request.query_params.get('exercice_id')
        exercice = None
        if exercice_id:
            exercice = ExerciceComptable.objects.filter(pk=exercice_id).first()
        if not exercice:
            exercice = get_exercice_ouvert()

        annee = int(request.query_params.get(
            'annee', exercice.annee if exercice else timezone.now().year
        ))

        mois_data = []
        for mois in range(1, 13):
            lignes = LigneEcriture.objects.filter(
                ecriture__statut='validee',
                ecriture__date_ecriture__year=annee,
                ecriture__date_ecriture__month=mois,
            )
            if exercice:
                lignes = lignes.filter(ecriture__exercice=exercice)

            produits = lignes.filter(compte__classe='7').aggregate(
                debit=Sum('montant_debit'), credit=Sum('montant_credit')
            )
            charges_agg = lignes.filter(compte__classe='6').aggregate(
                debit=Sum('montant_debit'), credit=Sum('montant_credit')
            )
            recettes = float((produits['credit'] or 0) - (produits['debit'] or 0))
            depenses = float((charges_agg['debit'] or 0) - (charges_agg['credit'] or 0))

            recettes_attente = Quittance.objects.filter(
                est_validee=True,
                est_comptabilisee=False,
                date_creation__year=annee,
                date_creation__month=mois,
            )
            if exercice:
                recettes_attente = recettes_attente.filter(exercice=exercice)
            recettes_attente_sum = float(
                recettes_attente.aggregate(t=Sum('montant'))['t'] or 0
            )

            dep_menues = float(
                DepenseMenue.objects.filter(
                    date_creation__year=annee, date_creation__month=mois
                ).aggregate(t=Sum('montant'))['t'] or 0
            )
            op_mois = float(
                OrdrePaiement.objects.filter(
                    statut__in=['execute', 'comptabilise'],
                    date_execution__year=annee,
                    date_execution__month=mois,
                ).aggregate(t=Sum('montant'))['t'] or 0
            )
            depenses_operationnelles = dep_menues + op_mois

            mois_data.append({
                'mois': mois,
                'recettes': recettes,
                'recettes_attente': recettes_attente_sum,
                'depenses': depenses_operationnelles,
                'depenses_comptabilisees': depenses,
                'depenses_operationnelles': depenses_operationnelles,
                'resultat': recettes - depenses_operationnelles,
                'resultat_comptable': recettes - depenses,
            })

        total_recettes = sum(m['recettes'] for m in mois_data)
        total_depenses = sum(m['depenses'] for m in mois_data)
        total_depenses_compta = sum(m['depenses_comptabilisees'] for m in mois_data)

        return Response({
            'annee': int(annee),
            'exercice_id': exercice.id if exercice else None,
            'total_recettes': total_recettes,
            'total_depenses': total_depenses,
            'total_depenses_comptabilisees': total_depenses_compta,
            'resultat_annuel': total_recettes - total_depenses,
            'resultat_annuel_comptable': total_recettes - total_depenses_compta,
            'mois': mois_data,
        })
