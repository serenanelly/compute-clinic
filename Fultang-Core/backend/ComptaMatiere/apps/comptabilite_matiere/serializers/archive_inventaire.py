"""
Serializers pour le modèle ArchiveInventaire.
"""
from rest_framework import serializers
from apps.comptabilite_matiere.models import ArchiveInventaire, LigneArchiveInventaire


class LigneArchiveInventaireSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle LigneArchiveInventaire."""
    
    statut_difference_display = serializers.CharField(
        source='get_statut_difference_display',
        read_only=True
    )
    
    class Meta:
        model = LigneArchiveInventaire
        fields = [
            'id_ligne_archive',
            'id_archive',
            'id_materiel',
            'code_materiel',
            'nom_materiel',
            'prix_vente',
            'quantite_ancien_stock',
            'quantite_nouveau_stock',
            'difference',
            'statut_difference',
            'statut_difference_display',
        ]
        read_only_fields = ['id_ligne_archive', 'difference', 'statut_difference']


class ArchiveInventaireSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle ArchiveInventaire."""
    
    statut_display = serializers.CharField(
        source='get_statut_display',
        read_only=True
    )
    responsable_id = serializers.CharField(source='id_responsable', read_only=True)
    lignes = LigneArchiveInventaireSerializer(many=True, read_only=True)
    
    class Meta:
        model = ArchiveInventaire
        fields = [
            'id_archive',
            'code_archive',
            'date_creation',
            'date_termine',
            'id_responsable',
            'responsable_id',
            'statut',
            'statut_display',
            'observations',
            'rapport_associe',
            'created_at',
            'lignes',
        ]
        read_only_fields = ['id_archive', 'created_at']


class ArchiveInventaireCreateSerializer(serializers.ModelSerializer):
    """Serializer pour la création d'ArchiveInventaire."""
    
    class Meta:
        model = ArchiveInventaire
        fields = [
            'id_archive',
            'code_archive',
            'id_responsable',
            'observations',
        ]
        read_only_fields = ['id_archive']


class LigneArchiveInventaireUpdateSerializer(serializers.ModelSerializer):
    """Serializer pour la mise à jour du nouveau stock dans LigneArchiveInventaire."""
    
    class Meta:
        model = LigneArchiveInventaire
        fields = [
            'quantite_nouveau_stock',
        ]
