from rest_framework import serializers
from .models import TypeBatiment, TypeSalle, Batiment, Etage, Salle

class TypeBatimentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeBatiment
        fields = '__all__'

class TypeSalleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeSalle
        fields = '__all__'

class BatimentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Batiment
        fields = '__all__'

class EtageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Etage
        fields = '__all__'

class SalleSerializer(serializers.ModelSerializer):
    nb_places_total = serializers.IntegerField(source='capacite', required=False)
    service = serializers.IntegerField(source='service_id', required=False, allow_null=True)
    service_nom = serializers.SerializerMethodField()
    type_nom = serializers.CharField(source='type.nom', read_only=True)
    nom = serializers.CharField(required=False)

    type = serializers.PrimaryKeyRelatedField(queryset=TypeSalle.objects.all(), required=False)
    etage = serializers.PrimaryKeyRelatedField(queryset=Etage.objects.all(), required=False)

    class Meta:
        model = Salle
        fields = [
            'id', 'nom', 'type', 'type_nom', 'numero', 'statut', 'etage',
            'tarif_journalier', 'nb_places_disponibles',
            'nb_places_total', 'service', 'service_nom'
        ]

    def get_service_nom(self, obj):
        services_map = {
            1: "Médecine Générale",
            2: "Pédiatrie",
            3: "Gynécologie-Obstétrique",
            4: "Cardiologie",
            5: "Urgences",
            6: "Chirurgie",
            7: "Maternité"
        }
        return services_map.get(obj.service_id, f"Service {obj.service_id}" if obj.service_id else "Non affecté")

    def create(self, validated_data):
        if 'type' not in validated_data:
            type_salle, _ = TypeSalle.objects.get_or_create(nom="Chambre d'hospitalisation", defaults={"description": "Chambre pour hospitalisation"})
            validated_data['type'] = type_salle
        if 'etage' not in validated_data:
            type_bat, _ = TypeBatiment.objects.get_or_create(nom="Batiment Principal", defaults={"description": "Bâtiment principal de la clinique"})
            batiment, _ = Batiment.objects.get_or_create(nom="Hôpital Central", defaults={"type": type_bat, "nb_etages": 5, "date_construction": "2020-01-01"})
            etage, _ = Etage.objects.get_or_create(numero=1, batiment=batiment)
            validated_data['etage'] = etage
        if 'nom' not in validated_data:
            validated_data['nom'] = f"Chambre {validated_data.get('numero', '')}"
        
        if 'nb_places_disponibles' not in validated_data or validated_data['nb_places_disponibles'] is None:
            validated_data['nb_places_disponibles'] = validated_data.get('capacite', 1)
            
        return super().create(validated_data)
