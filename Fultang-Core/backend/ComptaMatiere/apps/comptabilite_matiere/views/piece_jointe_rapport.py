"""
ViewSet pour le modèle PieceJointeRapport.
"""
from rest_framework import viewsets
from apps.comptabilite_matiere.models import PieceJointeRapport
from apps.comptabilite_matiere.serializers import (
    PieceJointeRapportSerializer,
    PieceJointeRapportCreateSerializer,
)


class PieceJointeRapportViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les opérations CRUD sur PieceJointeRapport.
    """
    queryset = PieceJointeRapport.objects.all()
    serializer_class = PieceJointeRapportSerializer
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PieceJointeRapportCreateSerializer
        return PieceJointeRapportSerializer
    
    def get_queryset(self):
        """Filtre les pièces jointes par rapport si spécifié."""
        queryset = PieceJointeRapport.objects.select_related('id_rapport')
        rapport_id = self.request.query_params.get('rapport', None)
        if rapport_id:
            queryset = queryset.filter(id_rapport=rapport_id)
        return queryset
