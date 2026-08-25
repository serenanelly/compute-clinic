from rest_framework import viewsets
from .models import TypeBatiment, TypeSalle, Batiment, Etage, Salle
from .serializers import TypeBatimentSerializer, TypeSalleSerializer, BatimentSerializer, EtageSerializer, SalleSerializer

class TypeBatimentViewSet(viewsets.ModelViewSet):
    queryset = TypeBatiment.objects.all()
    serializer_class = TypeBatimentSerializer

class TypeSalleViewSet(viewsets.ModelViewSet):
    queryset = TypeSalle.objects.all()
    serializer_class = TypeSalleSerializer

class BatimentViewSet(viewsets.ModelViewSet):
    queryset = Batiment.objects.all()
    serializer_class = BatimentSerializer

class EtageViewSet(viewsets.ModelViewSet):
    queryset = Etage.objects.all()
    serializer_class = EtageSerializer

class SalleViewSet(viewsets.ModelViewSet):
    queryset = Salle.objects.all()
    serializer_class = SalleSerializer
