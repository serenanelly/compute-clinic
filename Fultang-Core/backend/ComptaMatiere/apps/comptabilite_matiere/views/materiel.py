"""
ViewSets pour les modèles de matériel.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-18
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.comptabilite_matiere.permissions import DevelopmentOrAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.comptabilite_matiere.models import Materiel, MaterielMedical, MaterielDurable
from apps.comptabilite_matiere.serializers import (
    MaterielSerializer,
    MaterielCreateSerializer,
    MaterielUpdateSerializer,
    MaterielMedicalSerializer,
    MaterielMedicalCreateSerializer,
    MaterielMedicalUpdateSerializer,
    MaterielDurableSerializer,
    MaterielDurableCreateSerializer,
    MaterielDurableUpdateSerializer,
)


class MaterielViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les matériels (base).
    
    Endpoints:
    - GET /api/materiels/ : Liste tous les matériels
    - POST /api/materiels/ : Créer un nouveau matériel
    - GET /api/materiels/{id}/ : Détails d'un matériel
    - PATCH /api/materiels/{id}/ : Mettre à jour un matériel
    - DELETE /api/materiels/{id}/ : Supprimer un matériel
    """
    
    queryset = Materiel.objects.all()
    permission_classes = [DevelopmentOrAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    
    search_fields = ['nom_Materiel']
    ordering_fields = ['nom_Materiel', 'prix_achat_unitaire', 'quantite_stock', 'date_derniere_modification']
    ordering = ['nom_Materiel']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return MaterielCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return MaterielUpdateSerializer
        return MaterielSerializer
    
    @action(detail=False, methods=['get'])
    def stock_faible(self, request):
        """
        Récupérer les matériels avec un stock faible (< 10).
        
        Endpoint: GET /api/materiels/stock_faible/
        """
        materiels = self.queryset.filter(quantite_stock__lt=10)
        serializer = MaterielSerializer(materiels, many=True)
        return Response({
            'count': materiels.count(),
            'materiels': serializer.data
        })


class MaterielMedicalViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les matériels médicaux.
    
    Endpoints:
    - GET /api/materiels-medicaux/ : Liste tous les matériels médicaux
    - POST /api/materiels-medicaux/ : Créer un nouveau matériel médical
    - GET /api/materiels-medicaux/{id}/ : Détails d'un matériel médical
    - PATCH /api/materiels-medicaux/{id}/ : Mettre à jour un matériel médical
    - DELETE /api/materiels-medicaux/{id}/ : Supprimer un matériel médical
    """
    
    queryset = MaterielMedical.objects.all()
    permission_classes = [DevelopmentOrAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    pagination_class = None  # Désactiver la pagination pour récupérer tous les éléments
    
    filterset_fields = ['categorie', 'unite_mesure']
    search_fields = ['nom_Materiel']
    ordering_fields = ['nom_Materiel', 'prix_achat_unitaire', 'prix_vente_unitaire', 'quantite_stock']
    ordering = ['nom_Materiel']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return MaterielMedicalCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return MaterielMedicalUpdateSerializer
        return MaterielMedicalSerializer
    
    @action(detail=False, methods=['get'])
    def par_categorie(self, request):
        """
        Récupérer les matériels médicaux groupés par catégorie.
        
        Endpoint: GET /api/materiels-medicaux/par_categorie/
        """
        from apps.comptabilite_matiere.models.materiel_medical import MaterielMedical
        
        categories = {}
        for categorie_key, categorie_label in MaterielMedical.CategorieChoices.choices:
            materiels = self.queryset.filter(categorie=categorie_key)
            categories[categorie_key] = {
                'label': categorie_label,
                'count': materiels.count(),
                'materiels': MaterielMedicalSerializer(materiels, many=True).data
            }
        
        return Response(categories)
    
    @action(detail=False, methods=['get'])
    def stock_faible(self, request):
        """
        Récupérer les matériels médicaux avec un stock faible (< 20).
        
        Endpoint: GET /api/materiels-medicaux/stock_faible/
        """
        materiels = self.queryset.filter(quantite_stock__lt=20)
        serializer = MaterielMedicalSerializer(materiels, many=True)
        return Response({
            'count': materiels.count(),
            'materiels': serializer.data
        })

    @action(detail=False, methods=['get'])
    def alertes_peremption(self, request):
        """
        Récupérer les matériels médicaux approchant de la date de péremption (< 30 jours).
        Se base sur les lignes de livraison.
        """
        from django.utils import timezone
        from datetime import timedelta
        from apps.comptabilite_matiere.models import LigneLivraison
        
        limite = timezone.now().date() + timedelta(days=30)
        lignes = LigneLivraison.objects.filter(
            type_materiel='MEDICAL',
            date_peremption__lte=limite,
            date_peremption__gte=timezone.now().date()
        ).select_related('materiel', 'id_livraison')
        
        data = [
            {
                'id_materiel': l.materiel.idMateriel,
                'nom_materiel': l.nom_materiel or l.materiel.nom_Materiel,
                'date_peremption': l.date_peremption,
                'quantite_restante': l.materiel.quantite_stock,
                'bon_livraison': l.id_livraison.bon_livraison_numero
            }
            for l in lignes
        ]
        
        return Response({
            'count': len(data),
            'alertes': data
        })


class MaterielDurableViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les matériels durables.
    
    Endpoints:
    - GET /api/materiels-durables/ : Liste tous les matériels durables
    - POST /api/materiels-durables/ : Créer un nouveau matériel durable
    - GET /api/materiels-durables/{id}/ : Détails d'un matériel durable
    - PATCH /api/materiels-durables/{id}/ : Mettre à jour un matériel durable
    - DELETE /api/materiels-durables/{id}/ : Supprimer un matériel durable
    """
    
    queryset = MaterielDurable.objects.all()
    permission_classes = [DevelopmentOrAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    pagination_class = None  # Désactiver la pagination pour récupérer tous les éléments
    
    filterset_fields = ['Etat', 'localisation']
    search_fields = ['nom_Materiel', 'localisation']
    ordering_fields = ['nom_Materiel', 'localisation', 'Etat', 'date_Enregistrement']
    ordering = ['nom_Materiel']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return MaterielDurableCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return MaterielDurableUpdateSerializer
        return MaterielDurableSerializer
    
    @action(detail=True, methods=['post'])
    def mettre_en_reparation(self, request, pk=None):
        """
        Mettre un matériel en réparation.
        
        Endpoint: POST /api/materiels-durables/{id}/mettre_en_reparation/
        """
        materiel = self.get_object()
        
        if materiel.Etat == MaterielDurable.EtatChoices.EN_REPARATION:
            return Response(
                {'message': 'Le matériel est déjà en réparation.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        materiel.mettre_en_reparation()
        return Response(
            {
                'message': f'{materiel.nom_Materiel} a été mis en réparation.',
                'materiel': MaterielDurableSerializer(materiel).data
            },
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def remettre_en_service(self, request, pk=None):
        """
        Remettre un matériel en service.
        
        Endpoint: POST /api/materiels-durables/{id}/remettre_en_service/
        """
        materiel = self.get_object()
        
        if materiel.Etat == MaterielDurable.EtatChoices.EN_BON_ETAT:
            return Response(
                {'message': 'Le matériel est déjà en bon état.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        materiel.remettre_en_service()
        return Response(
            {
                'message': f'{materiel.nom_Materiel} a été remis en service.',
                'materiel': MaterielDurableSerializer(materiel).data
            },
            status=status.HTTP_200_OK
        )
    
    @action(detail=False, methods=['get'])
    def en_reparation(self, request):
        """
        Récupérer les matériels actuellement en réparation.
        
        Endpoint: GET /api/materiels-durables/en_reparation/
        """
        materiels = self.queryset.filter(Etat=MaterielDurable.EtatChoices.EN_REPARATION)
        serializer = MaterielDurableSerializer(materiels, many=True)
        return Response({
            'count': materiels.count(),
            'materiels': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def par_localisation(self, request):
        """
        Récupérer les matériels groupés par localisation.
        
        Endpoint: GET /api/materiels-durables/par_localisation/
        """
        from django.db.models import Count
        
        localisations = self.queryset.values('localisation').annotate(
            count=Count('idMateriel')
        ).order_by('localisation')
        
        result = {}
        for loc in localisations:
            materiels = self.queryset.filter(localisation=loc['localisation'])
            result[loc['localisation']] = {
                'count': loc['count'],
                'materiels': MaterielDurableSerializer(materiels, many=True).data
            }
        
        return Response(result)
