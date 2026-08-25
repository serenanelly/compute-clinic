"""
Serializers pour le modèle Rapport.
"""
from rest_framework import serializers
from apps.comptabilite_matiere.models import Rapport, PieceJointeRapport


class PieceJointeRapportNestedSerializer(serializers.ModelSerializer):
    """Serializer pour les pièces jointes dans un rapport."""
    
    type_piece_display = serializers.CharField(
        source='get_type_piece_display',
        read_only=True
    )
    
    class Meta:
        model = PieceJointeRapport
        fields = [
            'id_piece_jointe',
            'type_piece',
            'type_piece_display',
            'nom_fichier',
            'chemin_fichier',
            'donnees_json',
            'created_at',
        ]
        read_only_fields = ['id_piece_jointe', 'created_at']


class RapportSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle Rapport."""
    
    type_rapport_display = serializers.CharField(
        source='get_type_rapport_display',
        read_only=True
    )
    expediteur_id = serializers.CharField(source='id_expediteur', read_only=True)
    destinataire_id = serializers.CharField(source='id_destinataire', read_only=True)
    expediteur = serializers.CharField(source='id_expediteur', read_only=True)
    destinataire = serializers.CharField(source='id_destinataire', read_only=True)
    pieces_jointes = PieceJointeRapportNestedSerializer(many=True, read_only=True)
    
    class Meta:
        model = Rapport
        fields = [
            'id',
            'code_rapport',
            'objet',
            'corps',
            'statut',
            'id_personnel',
            'id_expediteur',
            'expediteur_id',
            'expediteur',
            'id_destinataire',
            'destinataire_id',
            'destinataire',
            'nom_expediteur',
            'nom_destinataire',
            'date_creation',
            'date_envoi',
            'date_lecture',
            'est_lu',
            'type_rapport',
            'type_rapport_display',
            'archive_associee',
            'pieces_jointes',
        ]
        read_only_fields = ['id', 'date_creation', 'date_lecture']
    
    # Removed get_expediteur_nom and get_destinataire_nom as they require models


class RapportCreateSerializer(serializers.ModelSerializer):
    """Serializer pour la création de Rapport."""

    expediteur = serializers.CharField(write_only=True, required=False)
    destinataire = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Rapport
        fields = [
            'code_rapport',
            'objet',
            'corps',
            'id_personnel',
            'id_expediteur',
            'id_destinataire',
            'expediteur',
            'destinataire',
            'nom_expediteur',
            'nom_destinataire',
            'type_rapport',
            'archive_associee',
        ]

    def validate(self, attrs):
        if attrs.get('expediteur') and not attrs.get('id_expediteur'):
            attrs['id_expediteur'] = attrs.pop('expediteur')
        else:
            attrs.pop('expediteur', None)
        if attrs.get('destinataire') and not attrs.get('id_destinataire'):
            attrs['id_destinataire'] = attrs.pop('destinataire')
        else:
            attrs.pop('destinataire', None)
        return attrs


class RapportMarkReadSerializer(serializers.Serializer):
    """Serializer pour marquer un rapport comme lu."""
    pass  # Pas de champs nécessaires, l'action est automatique
