"""
Serializers pour le modèle LigneSortie.
"""
from rest_framework import serializers
from apps.comptabilite_matiere.models import LigneSortie


class LigneSortieSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle LigneSortie."""
    
    type_materiel_display = serializers.CharField(
        source='get_type_materiel_display',
        read_only=True
    )
    
    class Meta:
        model = LigneSortie
        fields = [
            'id_ligne_sortie',
            'id_sortie',
            'id_materiel',
            'code_materiel',
            'nom_materiel',
            'type_materiel',
            'type_materiel_display',
            'quantite',
            'prix_unitaire',
            'sous_total',
        ]
        read_only_fields = ['id_ligne_sortie', 'sous_total']


class LigneSortieCreateSerializer(serializers.ModelSerializer):
    """Serializer pour la création de LigneSortie."""
    
    class Meta:
        model = LigneSortie
        fields = [
            'id_sortie',
            'id_materiel',
            'code_materiel',
            'nom_materiel',
            'type_materiel',
            'quantite',
            'prix_unitaire',
        ]
