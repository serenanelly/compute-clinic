from rest_framework import viewsets, filters
from .models import (
    DonneesCliniques, Allergie, Maladie, Traitement, Antecedent,
    ModeDeVie, Voyage, ActivitePhysique, Addiction, RendezVous
)
from .serializers import (
    DonneesCliniquesSerializer, AllergieSerializer, MaladieSerializer,
    TraitementSerializer, AntecedentSerializer, ModeDeVieSerializer, 
    VoyageSerializer, ActivitePhysiqueSerializer, AddictionSerializer, 
    RendezVousSerializer
)

class DonneesCliniquesViewSet(viewsets.ModelViewSet):
    queryset = DonneesCliniques.objects.all()
    serializer_class = DonneesCliniquesSerializer

class AntecedentViewSet(viewsets.ModelViewSet):
    """Gestion des antécédents médicaux et familiaux."""
    queryset = Antecedent.objects.all()
    serializer_class = AntecedentSerializer

class AllergieViewSet(viewsets.ModelViewSet):
    queryset = Allergie.objects.all()
    serializer_class = AllergieSerializer

class MaladieViewSet(viewsets.ModelViewSet):
    queryset = Maladie.objects.all()
    serializer_class = MaladieSerializer

class TraitementViewSet(viewsets.ModelViewSet):
    queryset = Traitement.objects.all()
    serializer_class = TraitementSerializer

class ModeDeVieViewSet(viewsets.ModelViewSet):
    queryset = ModeDeVie.objects.all()
    serializer_class = ModeDeVieSerializer

class VoyageViewSet(viewsets.ModelViewSet):
    queryset = Voyage.objects.all()
    serializer_class = VoyageSerializer

class ActivitePhysiqueViewSet(viewsets.ModelViewSet):
    queryset = ActivitePhysique.objects.all()
    serializer_class = ActivitePhysiqueSerializer

class AddictionViewSet(viewsets.ModelViewSet):
    queryset = Addiction.objects.all()
    serializer_class = AddictionSerializer
class RendezVousViewSet(viewsets.ModelViewSet):
    """Vue globale pour la gestion du planning des rendez-vous."""
    queryset = RendezVous.objects.all().order_by('date_heure')
    serializer_class = RendezVousSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['patient__nom', 'patient__prenom', 'patient__matricule']
