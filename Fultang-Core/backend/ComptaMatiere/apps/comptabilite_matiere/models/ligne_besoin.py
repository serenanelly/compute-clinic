"""
Modèle LigneBesoin pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-24
"""
from django.db import models
from django.core.validators import MinValueValidator


class LigneBesoin(models.Model):
    """
    Modèle représentant une ligne de détail d'un besoin.
    
    Chaque besoin peut contenir plusieurs lignes, chacune correspondant
    à un article demandé avec sa quantité et sa priorité.
    """
    
    class PrioriteChoices(models.TextChoices):
        LOW = 'LOW', 'Basse'
        NORMAL = 'NORMAL', 'Normale'
        HIGH = 'HIGH', 'Haute'
    
    id_ligne_besoin = models.AutoField(
        primary_key=True,
        verbose_name="Identifiant de la ligne"
    )
    
    id_besoin = models.ForeignKey(
        'Besoin',
        on_delete=models.CASCADE,
        related_name='lignes',
        verbose_name="Besoin",
        help_text="Référence au besoin parent"
    )
    
    materiel_nom = models.CharField(
        max_length=150,
        verbose_name="Nom du matériel",
        help_text="Nom du matériel demandé"
    )
    
    quantite_demandee = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name="Quantité demandée",
        help_text="Quantité de matériel demandée"
    )
    
    priorite = models.CharField(
        max_length=10,
        choices=PrioriteChoices.choices,
        default=PrioriteChoices.NORMAL,
        verbose_name="Priorité",
        help_text="Niveau de priorité de la demande"
    )
    
    description_justification = models.TextField(
        blank=True,
        null=True,
        verbose_name="Justification",
        help_text="Justification de la demande"
    )
    
    quantite_accordee = models.PositiveIntegerField(
        blank=True,
        null=True,
        verbose_name="Quantité accordée",
        help_text="Quantité accordée après traitement (nullable avant traitement)"
    )
    
    class Meta:
        verbose_name = "Ligne de besoin"
        verbose_name_plural = "Lignes de besoin"
        ordering = ['id_besoin', '-priorite']
        db_table = 'comptabilite_matiere_ligne_besoin'
    
    def __str__(self):
        return f"{self.materiel_nom} x{self.quantite_demandee} ({self.get_priorite_display()})"
