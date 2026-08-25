"""
Modèle PieceJointeRapport pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-24
"""
from django.db import models


class PieceJointeRapport(models.Model):
    """
    Modèle représentant une pièce jointe associée à un rapport.
    
    Permet d'attacher différents types de documents ou données à un rapport.
    """
    
    class TypePieceChoices(models.TextChoices):
        ETAT_STOCK = 'ETAT_STOCK', 'État du stock'
        ARCHIVE = 'ARCHIVE', 'Archive'
        ANCIEN_STOCK = 'ANCIEN_STOCK', 'Ancien stock'
        NOUVEAU_STOCK = 'NOUVEAU_STOCK', 'Nouveau stock'
        DIFFERENCES = 'DIFFERENCES', 'Différences'
        AUTRE = 'AUTRE', 'Autre'
    
    id_piece_jointe = models.AutoField(
        primary_key=True,
        verbose_name="Identifiant de la pièce jointe"
    )
    
    id_rapport = models.ForeignKey(
        'Rapport',
        on_delete=models.CASCADE,
        related_name='pieces_jointes',
        verbose_name="Rapport",
        help_text="Référence au rapport parent"
    )
    
    type_piece = models.CharField(
        max_length=15,
        choices=TypePieceChoices.choices,
        verbose_name="Type de pièce",
        help_text="Type de la pièce jointe"
    )
    
    nom_fichier = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Nom du fichier",
        help_text="Nom du fichier attaché"
    )
    
    chemin_fichier = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name="Chemin du fichier",
        help_text="Chemin vers le fichier PDF sur le serveur"
    )
    
    donnees_json = models.JSONField(
        blank=True,
        null=True,
        verbose_name="Données JSON",
        help_text="Données stockées en format JSON"
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Date de création"
    )
    
    class Meta:
        verbose_name = "Pièce jointe"
        verbose_name_plural = "Pièces jointes"
        ordering = ['id_rapport', '-created_at']
        db_table = 'comptabilite_matiere_piece_jointe_rapport'
    
    def __str__(self):
        return f"{self.get_type_piece_display()} - {self.nom_fichier or 'Sans nom'}"
