from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from core.permissions import HasFunctionalServiceEnabled
from apps.comptabilite_matiere.models import LigneLivraison
from apps.comptabilite_matiere.serializers import LigneLivraisonSerializer

class LigneLivraisonViewSet(viewsets.ModelViewSet):
    """ViewSet for managing LigneLivraison objects."""
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_MATIERE')]
    queryset = LigneLivraison.objects.all()
    serializer_class = LigneLivraisonSerializer
    
    def get_queryset(self):
        """Filtre les lignes par livraison si spécifié."""
        queryset = LigneLivraison.objects.all()
        livraison_id = self.request.query_params.get('livraison', None)
        if livraison_id:
            queryset = queryset.filter(id_livraison=livraison_id)
        return queryset
