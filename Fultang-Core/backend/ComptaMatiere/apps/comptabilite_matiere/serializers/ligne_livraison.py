from rest_framework import serializers
from apps.comptabilite_matiere.models import LigneLivraison

class LigneLivraisonSerializer(serializers.ModelSerializer):
    class Meta:
        model = LigneLivraison
        fields = "__all__"
