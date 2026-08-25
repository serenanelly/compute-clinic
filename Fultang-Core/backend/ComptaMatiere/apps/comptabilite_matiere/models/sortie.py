"""
Modèle Sortie pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-18
"""
from django.db import models
from django.core.validators import MinValueValidator
class Sortie(models.Model):
    """
    Modèle pour gérer les sorties de matériel.
    """
    
    class MotifSortieChoices(models.TextChoices):
        VENTE = 'VENTE', 'Vente'
        UTILISATION_SERVICE = 'UTILISATION_SERVICE', 'Utilisation Service'
        DEFECTUEUX = 'DEFECTUEUX', 'Défectueux'
        PERIME = 'PERIME', 'Périmé'
        PERTE = 'PERTE', 'Perte'
    
    idSortie = models.AutoField(
        primary_key=True,
        verbose_name="Identifiant de la sortie"
    )
    
    numero_sortie = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Numéro de sortie",
        help_text="Numéro de référence unique de la sortie"
    )
    
    date_sortie = models.DateTimeField(
        verbose_name="Date de sortie",
        help_text="Date et heure de la sortie"
    )
    
    motif_sortie = models.CharField(
        max_length=30,
        choices=MotifSortieChoices.choices,
        verbose_name="Motif de sortie",
        help_text="Raison de la sortie du matériel"
    )
    
    idPersonnel = models.CharField(
        max_length=36,
        verbose_name="ID Personnel responsable",
        help_text="Identifiant du personnel ayant effectué la sortie"
    )
    
    service_responsable = models.CharField(
        max_length=100,
        verbose_name="Service responsable",
        help_text="Service effectuant la sortie",
        blank=True,
        null=True
    )
    
    montant_total = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name="Montant total",
        help_text="Montant total de la sortie (pour les ventes)"
    )
    
    heure_sortie = models.TimeField(
        blank=True,
        null=True,
        verbose_name="Heure de sortie",
        help_text="Heure de la sortie"
    )
    
    observations = models.TextField(
        blank=True,
        null=True,
        verbose_name="Observations",
        help_text="Remarques sur la sortie"
    )
    
    class Meta:
        verbose_name = "Sortie"
        verbose_name_plural = "Sorties"
        ordering = ['-date_sortie']
        db_table = 'comptabilite_matiere_sortie'
    
    def __str__(self):
        return f"Sortie #{self.numero_sortie} - {self.get_motif_sortie_display()}"

