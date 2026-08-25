"""
ViewSet pour le modèle LigneSortie.
"""
from rest_framework import viewsets
from apps.comptabilite_matiere.models import LigneSortie
from apps.comptabilite_matiere.serializers import (
    LigneSortieSerializer,
    LigneSortieCreateSerializer,
)


class LigneSortieViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les opérations CRUD sur LigneSortie.
    """
    queryset = LigneSortie.objects.all()
    serializer_class = LigneSortieSerializer
    
    def get_serializer_class(self):
        if self.action == 'create':
            return LigneSortieCreateSerializer
        return LigneSortieSerializer
    
    def get_queryset(self):
        """Filtre les lignes par sortie si spécifié."""
        queryset = LigneSortie.objects.all()
        sortie_id = self.request.query_params.get('sortie', None)
        if sortie_id:
            queryset = queryset.filter(id_sortie=sortie_id)
        return queryset
