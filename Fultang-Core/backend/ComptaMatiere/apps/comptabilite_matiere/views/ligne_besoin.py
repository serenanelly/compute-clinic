"""
ViewSet pour le modèle LigneBesoin.
"""
from rest_framework import viewsets, status
from rest_framework.response import Response
from apps.comptabilite_matiere.models import LigneBesoin
from apps.comptabilite_matiere.serializers import (
    LigneBesoinSerializer,
    LigneBesoinCreateSerializer,
)


class LigneBesoinViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour les opérations CRUD sur LigneBesoin.
    """
    queryset = LigneBesoin.objects.all()
    serializer_class = LigneBesoinSerializer
    
    def get_serializer_class(self):
        if self.action == 'create':
            return LigneBesoinCreateSerializer
        return LigneBesoinSerializer
    
    def get_queryset(self):
        """Filtre les lignes par besoin si spécifié."""
        queryset = LigneBesoin.objects.all()
        besoin_id = self.request.query_params.get('besoin', None)
        if besoin_id:
            queryset = queryset.filter(id_besoin=besoin_id)
        return queryset
