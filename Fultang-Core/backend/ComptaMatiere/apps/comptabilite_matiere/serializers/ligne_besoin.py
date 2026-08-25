"""
Serializers pour le modèle LigneBesoin.
"""
from rest_framework import serializers
from apps.comptabilite_matiere.models import LigneBesoin


class LigneBesoinSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle LigneBesoin."""
    
    priorite_display = serializers.CharField(
        source='get_priorite_display',
        read_only=True
    )
    
    class Meta:
        model = LigneBesoin
        fields = [
            'id_ligne_besoin',
            'id_besoin',
            'materiel_nom',
            'quantite_demandee',
            'priorite',
            'priorite_display',
            'description_justification',
            'quantite_accordee',
        ]
        read_only_fields = ['id_ligne_besoin']


class LigneBesoinCreateSerializer(serializers.ModelSerializer):
    """Serializer pour la création de LigneBesoin."""
    
    class Meta:
        model = LigneBesoin
        fields = [
            'id_besoin',
            'materiel_nom',
            'quantite_demandee',
            'priorite',
            'description_justification',
        ]
