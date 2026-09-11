from rest_framework import viewsets
from django.db.models import Q
from .models import TypeBatiment, TypeSalle, Batiment, Etage, Salle
from .serializers import TypeBatimentSerializer, TypeSalleSerializer, BatimentSerializer, EtageSerializer, SalleSerializer


class TypeBatimentViewSet(viewsets.ModelViewSet):
    queryset = TypeBatiment.objects.all()
    serializer_class = TypeBatimentSerializer


class TypeSalleViewSet(viewsets.ModelViewSet):
    queryset = TypeSalle.objects.all()
    serializer_class = TypeSalleSerializer


class BatimentViewSet(viewsets.ModelViewSet):
    queryset = Batiment.objects.select_related('type').all()
    serializer_class = BatimentSerializer


class EtageViewSet(viewsets.ModelViewSet):
    queryset = Etage.objects.select_related('batiment').all()
    serializer_class = EtageSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        batiment_id = self.request.query_params.get('batiment')
        if batiment_id:
            qs = qs.filter(batiment_id=batiment_id)
        return qs


class SalleViewSet(viewsets.ModelViewSet):
    queryset = Salle.objects.select_related('type', 'etage', 'etage__batiment').all()
    serializer_class = SalleSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        service_id = params.get('service')
        if service_id:
            qs = qs.filter(service_id=service_id)

        statut = params.get('statut')
        if statut:
            qs = qs.filter(statut=statut)

        if params.get('places_disponibles') == 'true':
            qs = qs.filter(
                Q(nb_places_disponibles__gt=0) | Q(nb_places_disponibles__isnull=True, capacite__gt=0)
            )

        batiment_id = params.get('batiment')
        if batiment_id:
            qs = qs.filter(etage__batiment_id=batiment_id)

        etage_id = params.get('etage')
        if etage_id:
            qs = qs.filter(etage_id=etage_id)

        return qs
