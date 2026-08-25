"""
Serializers pour le modèle PieceJointeRapport.
"""
from rest_framework import serializers
from apps.comptabilite_matiere.models import PieceJointeRapport


class PieceJointeRapportSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle PieceJointeRapport."""
    
    type_piece_display = serializers.CharField(
        source='get_type_piece_display',
        read_only=True
    )
    
    class Meta:
        model = PieceJointeRapport
        fields = [
            'id_piece_jointe',
            'id_rapport',
            'type_piece',
            'type_piece_display',
            'nom_fichier',
            'chemin_fichier',
            'donnees_json',
            'created_at',
        ]
        read_only_fields = ['id_piece_jointe', 'created_at']


class PieceJointeRapportCreateSerializer(serializers.ModelSerializer):
    """Serializer pour la création de PieceJointeRapport."""
    
    class Meta:
        model = PieceJointeRapport
        fields = [
            'id_rapport',
            'type_piece',
            'nom_fichier',
            'chemin_fichier',
            'donnees_json',
        ]
