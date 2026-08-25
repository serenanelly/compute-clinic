"""
ViewSet pour le modèle Rapport.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.comptabilite_matiere.models import Rapport
from apps.comptabilite_matiere.serializers import (
    RapportSerializer,
    RapportCreateSerializer,
)


class RapportViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les opérations CRUD sur Rapport.
    Fournit des actions personnalisées pour marquer comme lu et filtrer.
    """
    queryset = Rapport.objects.all()
    serializer_class = RapportSerializer
    pagination_class = None  # Désactiver la pagination pour récupérer tous les rapports
    
    def get_serializer_class(self):
        if self.action == 'create':
            return RapportCreateSerializer
        return RapportSerializer
    
    def get_queryset(self):
        """Filtre les rapports par différents critères."""
        queryset = Rapport.objects.select_related(
            'archive_associee'
        ).prefetch_related('pieces_jointes')
        
        # Filtrer par type
        type_rapport = self.request.query_params.get('type', None)
        if type_rapport:
            queryset = queryset.filter(type_rapport=type_rapport)
        
        # Filtrer par statut lu/non lu
        est_lu = self.request.query_params.get('est_lu', None)
        if est_lu is not None:
            queryset = queryset.filter(est_lu=est_lu.lower() == 'true')
        
        return queryset

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        """Marque le rapport comme lu."""
        rapport = self.get_object()
        rapport.marquer_comme_lu()
        return Response(
            {'message': 'Rapport marqué comme lu.'},
            status=status.HTTP_200_OK
        )
    
    @action(detail=False, methods=['get'], url_path='sent')
    def sent(self, request):
        """Retourne les rapports envoyés par l'utilisateur connecté."""
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        rapports = self.get_queryset().filter(id_expediteur=user_id)
        serializer = self.get_serializer(rapports, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='received')
    def received(self, request):
        """Retourne les rapports reçus par l'utilisateur connecté."""
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        rapports = self.get_queryset().filter(id_destinataire=user_id)
        serializer = self.get_serializer(rapports, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='received/unread')
    def received_unread(self, request):
        """Retourne les rapports non lus reçus par l'utilisateur."""
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {'error': 'user_id requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        rapports = self.get_queryset().filter(
            id_destinataire=user_id,
            est_lu=False
        )
        serializer = self.get_serializer(rapports, many=True)
        return Response(serializer.data)
