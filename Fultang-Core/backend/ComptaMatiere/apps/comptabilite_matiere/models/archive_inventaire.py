"""
Modèle ArchiveInventaire pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-24
"""
from django.db import models
from django.utils import timezone
class ArchiveInventaire(models.Model):
    """
    Modèle représentant une archive d'inventaire.
    
    Stocke les informations d'un inventaire avec l'historique des stocks,
    incluant les états avant et après inventaire.
    """
    
    class StatutChoices(models.TextChoices):
        OUVERT = 'OUVERT', 'Ouvert'
        CLOTURE = 'CLOTURE', 'Clôturé'
        ANNULE = 'ANNULE', 'Annulé'
    
    id_archive = models.AutoField(
        primary_key=True,
        verbose_name="Identifiant de l'archive"
    )
    
    code_archive = models.CharField(
        max_length=20,
        unique=True,
        verbose_name="Code de l'archive",
        help_text="Code unique (format: ARC-YYYYMMDD-XX)"
    )
    
    date_creation = models.DateTimeField(
        default=timezone.now,
        verbose_name="Date de création",
        help_text="Date et heure de création de l'archive"
    )
    
    date_termine = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Date de fin",
        help_text="Date et heure de fin de l'inventaire"
    )
    
    id_responsable = models.CharField(
        max_length=36,
        verbose_name="ID Responsable",
        help_text="Identifiant du personnel responsable de l'inventaire"
    )
    
    statut = models.CharField(
        max_length=10,
        choices=StatutChoices.choices,
        default=StatutChoices.OUVERT,
        verbose_name="Statut",
        help_text="État actuel de l'inventaire"
    )
    
    observations = models.TextField(
        blank=True,
        null=True,
        verbose_name="Observations",
        help_text="Remarques générales sur l'inventaire"
    )
    
    rapport_associe = models.ForeignKey(
        'Rapport',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='archives_liees',
        verbose_name="Rapport associé",
        help_text="Rapport lié à cet inventaire (optionnel)"
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Date de création enregistrement"
    )
    
    class Meta:
        verbose_name = "Archive d'inventaire"
        verbose_name_plural = "Archives d'inventaire"
        ordering = ['-date_creation']
        db_table = 'comptabilite_matiere_archive_inventaire'
    
    def __str__(self):
        return f"Archive {self.code_archive} - {self.get_statut_display()}"
    
    def terminer(self):
        """
        Marque l'inventaire comme terminé et met à jour le stock théorique
        avec la valeur physique de chaque matériel.
        """
        if self.statut == self.StatutChoices.OUVERT:
            # Commencer une transaction pour assurer la cohérence si possible
            # Ici on boucle sur les lignes pour mettre à jour le stock des matériels
            for ligne in self.lignes.all():
                if ligne.quantite_nouveau_stock is not None:
                    materiel = ligne.id_materiel
                    materiel.quantite_stock = ligne.quantite_nouveau_stock
                    materiel.save()
            
            self.statut = self.StatutChoices.CLOTURE
            self.date_termine = timezone.now()
            self.save(update_fields=['statut', 'date_termine'])
    
    def annuler(self):
        """Annule l'inventaire."""
        self.statut = self.StatutChoices.ANNULE
        self.save(update_fields=['statut'])
