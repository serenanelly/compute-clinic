from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from config.permissions import HasFunctionalServiceEnabled
from .models import TypeBatiment, TypeSalle, Batiment, Etage, Salle
from .serializers import TypeBatimentSerializer, TypeSalleSerializer, BatimentSerializer, EtageSerializer, SalleSerializer

class TypeBatimentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('GESTION_INFRASTRUCTURES')]
    queryset = TypeBatiment.objects.all()
    serializer_class = TypeBatimentSerializer

class TypeSalleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('GESTION_INFRASTRUCTURES')]
    queryset = TypeSalle.objects.all()
    serializer_class = TypeSalleSerializer

class BatimentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('GESTION_INFRASTRUCTURES')]
    queryset = Batiment.objects.all()
    serializer_class = BatimentSerializer

class EtageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('GESTION_INFRASTRUCTURES')]
    queryset = Etage.objects.all()
    serializer_class = EtageSerializer

class SalleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('GESTION_INFRASTRUCTURES')]
    queryset = Salle.objects.all()
    serializer_class = SalleSerializer
