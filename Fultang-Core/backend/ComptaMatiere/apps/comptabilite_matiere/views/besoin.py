"""
Vues pour l'application comptabilite_matiere.

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

from apps.comptabilite_matiere.models import Besoin
from apps.comptabilite_matiere.serializers import (
    BesoinSerializer,
    BesoinCreateSerializer,
    BesoinUpdateSerializer,
    CommentaireDirecteurSerializer,
    ModifierStatutSerializer,
)


class BesoinViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les besoins.
    
    Endpoints:
    - GET /api/besoins/ : Liste tous les besoins
    - GET /api/besoins/{id}/ : Détails d'un besoin
    - POST /api/besoins/ : Créer un nouveau besoin
    - PUT/PATCH /api/besoins/{id}/ : Mettre à jour un besoin
    - DELETE /api/besoins/{id}/ : Supprimer un besoin
    - POST /api/besoins/{id}/ajouter_commentaire/ : Ajouter le commentaire du directeur
    - PATCH /api/besoins/{id}/modifier_statut/ : Modifier le statut
    """
    
    queryset = Besoin.objects.all()
    permission_classes = [DevelopmentOrAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    
    # Filtres
    filterset_fields = ['statut', 'idPersonnel_emetteur']
    search_fields = ['motif', 'commentaire_directeur']
    ordering_fields = ['date_creation_besoin', 'date_traitement_directeur', 'statut']
    ordering = ['-date_creation_besoin']
    
    def get_serializer_class(self):
        """
        Retourner le sérialiseur approprié selon l'action.
        """
        if self.action == 'create':
            return BesoinCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return BesoinUpdateSerializer
        elif self.action == 'ajouter_commentaire':
            return CommentaireDirecteurSerializer
        elif self.action == 'modifier_statut':
            return ModifierStatutSerializer
        return BesoinSerializer
    
    def create(self, request, *args, **kwargs):
        """
        Créer un nouveau besoin.
        
        Body (JSON):
        {
            "motif": "Description du besoin",
            "idPersonnel_emetteur": 1
        }
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Retourner les données complètes du besoin créé
        besoin = Besoin.objects.get(pk=serializer.instance.pk)
        response_serializer = BesoinSerializer(besoin)
        
        headers = self.get_success_headers(response_serializer.data)
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    def list(self, request, *args, **kwargs):
        """
        Lister tous les besoins avec pagination.
        
        Query params optionnels:
        - statut: Filtrer par statut
        - idPersonnel_emetteur: Filtrer par personnel émetteur
        - search: Recherche dans motif et commentaire
        - ordering: Trier par champ (ex: -date_creation_besoin)
        """
        return super().list(request, *args, **kwargs)
    
    def retrieve(self, request, *args, **kwargs):
        """
        Récupérer le détail d'un besoin spécifique.
        """
        return super().retrieve(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """
        Supprimer un besoin.
        """
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {"message": "Besoin supprimé avec succès."},
            status=status.HTTP_204_NO_CONTENT
        )
    
    @action(detail=True, methods=['post'])
    def ajouter_commentaire(self, request, pk=None):
        """
        Ajouter le commentaire du directeur et mettre à jour la date de traitement.
        
        Endpoint: POST /api/besoins/{id}/ajouter_commentaire/
        
        Body (JSON):
        {
            "commentaire_directeur": "Votre commentaire ici"
        }
        
        La date de traitement est automatiquement définie à la date/heure actuelle.
        """
        besoin = self.get_object()
        serializer = CommentaireDirecteurSerializer(
            besoin, 
            data=request.data,
            partial=False
        )
        
        if serializer.is_valid():
            serializer.save()
            # Retourner le besoin complet mis à jour
            response_serializer = BesoinSerializer(besoin)
            return Response(
                {
                    "message": "Commentaire ajouté avec succès.",
                    "besoin": response_serializer.data
                },
                status=status.HTTP_200_OK
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['patch'])
    def modifier_statut(self, request, pk=None):
        """
        Modifier le statut d'un besoin.
        
        Endpoint: PATCH /api/besoins/{id}/modifier_statut/
        
        Body (JSON):
        {
            "statut": "TRAITE"  // Valeurs possibles: NON_TRAITE, EN_COURS, TRAITE, REJETE
        }
        
        Si le statut devient TRAITE ou REJETE, la date de traitement
        est automatiquement définie (si elle n'existe pas déjà).
        """
        besoin = self.get_object()
        serializer = ModifierStatutSerializer(
            besoin,
            data=request.data,
            partial=False
        )
        
        if serializer.is_valid():
            serializer.save()
            # Retourner le besoin complet mis à jour
            response_serializer = BesoinSerializer(besoin)
            return Response(
                {
                    "message": f"Statut modifié avec succès en '{besoin.get_statut_display()}'.",
                    "besoin": response_serializer.data
                },
                status=status.HTTP_200_OK
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def mes_besoins(self, request):
        """
        Récupérer les besoins émis par l'utilisateur connecté.
        
        Endpoint: GET /api/besoins/mes_besoins/
        """
        besoins = self.queryset.filter(idPersonnel_emetteur=request.user.id)
        page = self.paginate_queryset(besoins)
        
        if page is not None:
            serializer = BesoinSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = BesoinSerializer(besoins, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def par_statut(self, request):
        """
        Récupérer les besoins groupés par statut.
        
        Endpoint: GET /api/besoins/par_statut/
        """
        statuts = {}
        for statut_key, statut_label in Besoin.StatutChoices.choices:
            besoins = self.queryset.filter(statut=statut_key)
            statuts[statut_key] = {
                'label': statut_label,
                'count': besoins.count(),
                'besoins': BesoinSerializer(besoins, many=True).data
            }
        
        return Response(statuts)
