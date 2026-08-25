"""
ViewSets pour les modèles Livraison et Sortie.

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

from apps.comptabilite_matiere.models import Livraison, Sortie
from apps.comptabilite_matiere.serializers import (
    LivraisonSerializer,
    LivraisonCreateSerializer,
    LivraisonUpdateSerializer,
    SortieSerializer,
    SortieCreateSerializer,
    SortieUpdateSerializer,
)


class LivraisonViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les livraisons.
    
    Endpoints:
    - GET /api/livraisons/ : Liste toutes les livraisons
    - POST /api/livraisons/ : Créer une nouvelle livraison
    - GET /api/livraisons/{id}/ : Détails d'une livraison
    - PATCH /api/livraisons/{id}/ : Mettre à jour une livraison
    - DELETE /api/livraisons/{id}/ : Supprimer une livraison
    """
    
    queryset = Livraison.objects.all()
    permission_classes = [DevelopmentOrAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    
    filterset_fields = ['nom_fournisseur', 'id_personnel_receptionnaire']
    search_fields = ['bon_livraison_numero', 'nom_fournisseur', 'contact_fournisseur']
    ordering_fields = ['date_reception', 'montant_total', 'date_creation']
    ordering = ['-date_reception']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return LivraisonCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return LivraisonUpdateSerializer
        return LivraisonSerializer
    
    @action(detail=False, methods=['get'])
    def par_fournisseur(self, request):
        """
        Récupérer les livraisons groupées par fournisseur.
        
        Endpoint: GET /api/livraisons/par_fournisseur/
        """
        from django.db.models import Count, Sum
        
        fournisseurs = self.queryset.values('nom_fournisseur').annotate(
            count=Count('idLivraison'),
            total=Sum('montant_total')
        ).order_by('nom_fournisseur')
        
        result = {}
        for fourn in fournisseurs:
            livraisons = self.queryset.filter(nom_fournisseur=fourn['nom_fournisseur'])
            result[fourn['nom_fournisseur']] = {
                'count': fourn['count'],
                'montant_total': float(fourn['total']) if fourn['total'] else 0,
                'livraisons': LivraisonSerializer(livraisons, many=True).data
            }
        
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def statistiques(self, request):
        """
        Statistiques sur les livraisons.
        
        Endpoint: GET /api/livraisons/statistiques/
        """
        from django.db.models import Sum, Avg, Count
        
        stats = self.queryset.aggregate(
            total_livraisons=Count('idLivraison'),
            montant_total=Sum('montant_total'),
            montant_moyen=Avg('montant_total'),
        )
        
        return Response({
            'total_livraisons': stats['total_livraisons'] or 0,
            'montant_total': float(stats['montant_total']) if stats['montant_total'] else 0,
            'montant_moyen': float(stats['montant_moyen']) if stats['montant_moyen'] else 0,
        })


class SortieViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les sorties.
    
    Endpoints:
    - GET /api/sorties/ : Liste toutes les sorties
    - POST /api/sorties/ : Créer une nouvelle sortie
    - GET /api/sorties/{id}/ : Détails d'une sortie
    - PATCH /api/sorties/{id}/ : Mettre à jour une sortie
    - DELETE /api/sorties/{id}/ : Supprimer une sortie
    """
    
    queryset = Sortie.objects.all()
    permission_classes = [DevelopmentOrAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    
    filterset_fields = ['motif_sortie', 'idPersonnel']
    search_fields = ['numero_sortie']
    ordering_fields = ['date_sortie', 'numero_sortie']
    ordering = ['-date_sortie']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return SortieCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return SortieUpdateSerializer
        return SortieSerializer
    
    @action(detail=False, methods=['get'])
    def par_motif(self, request):
        """
        Récupérer les sorties groupées par motif.
        
        Endpoint: GET /api/sorties/par_motif/
        """
        motifs = {}
        for motif_key, motif_label in Sortie.MotifSortieChoices.choices:
            sorties = self.queryset.filter(motif_sortie=motif_key)
            motifs[motif_key] = {
                'label': motif_label,
                'count': sorties.count(),
                'sorties': SortieSerializer(sorties, many=True).data
            }
        
        return Response(motifs)
    
    @action(detail=False, methods=['get'])
    def mes_sorties(self, request):
        """
        Récupérer les sorties effectuées par l'utilisateur connecté.
        
        Endpoint: GET /api/sorties/mes_sorties/
        """
        sorties = self.queryset.filter(idPersonnel=request.user.id)
        page = self.paginate_queryset(sorties)
        
        if page is not None:
            serializer = SortieSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = SortieSerializer(sorties, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def statistiques(self, request):
        """
        Statistiques sur les sorties.
        
        Endpoint: GET /api/sorties/statistiques/
        """
        from django.db.models import Count
        
        stats_par_motif = {}
        for motif_key, motif_label in Sortie.MotifSortieChoices.choices:
            count = self.queryset.filter(motif_sortie=motif_key).count()
            stats_par_motif[motif_key] = {
                'label': motif_label,
                'count': count
            }
        
        return Response({
            'total_sorties': self.queryset.count(),
            'par_motif': stats_par_motif
        })
