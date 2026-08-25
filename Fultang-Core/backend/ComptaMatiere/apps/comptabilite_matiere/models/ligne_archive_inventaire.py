"""
Modèle LigneArchiveInventaire pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-24
"""
from django.db import models


class LigneArchiveInventaire(models.Model):
    """
    Modèle représentant une ligne d'archive d'inventaire.
    
    Contient les détails par produit avec les 3 colonnes principales:
    ancien stock, nouveau stock, et différence.
    """
    
    class StatutDifferenceChoices(models.TextChoices):
        EXCEDENT = 'EXCEDENT', 'Excédent'
        DEFICIT = 'DEFICIT', 'Déficit'
        CONFORME = 'CONFORME', 'Conforme'
    
    id_ligne_archive = models.AutoField(
        primary_key=True,
        verbose_name="Identifiant de la ligne"
    )
    
    id_archive = models.ForeignKey(
        'ArchiveInventaire',
        on_delete=models.CASCADE,
        related_name='lignes',
        verbose_name="Archive",
        help_text="Référence à l'archive parent"
    )
    
    id_materiel = models.ForeignKey(
        'Materiel',
        on_delete=models.PROTECT,
        related_name='lignes_archive',
        verbose_name="Matériel",
        help_text="Référence au matériel"
    )
    
    code_materiel = models.CharField(
        max_length=50,
        verbose_name="Code du matériel",
        help_text="Code d'identification du matériel"
    )
    
    nom_materiel = models.CharField(
        max_length=150,
        verbose_name="Nom du matériel",
        help_text="Nom du matériel"
    )
    
    prix_vente = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Prix de vente",
        help_text="Prix de vente du matériel"
    )
    
    quantite_ancien_stock = models.PositiveIntegerField(
        verbose_name="Ancien stock",
        help_text="Quantité avant inventaire"
    )
    
    quantite_nouveau_stock = models.PositiveIntegerField(
        blank=True,
        null=True,
        verbose_name="Nouveau stock",
        help_text="Quantité après inventaire (renseigné lors du comptage)"
    )
    
    difference = models.IntegerField(
        blank=True,
        null=True,
        verbose_name="Différence",
        help_text="Différence (nouveau - ancien)"
    )
    
    statut_difference = models.CharField(
        max_length=10,
        choices=StatutDifferenceChoices.choices,
        blank=True,
        null=True,
        verbose_name="Statut de la différence",
        help_text="Indique si excédent, déficit ou conforme"
    )
    
    class Meta:
        verbose_name = "Ligne d'archive d'inventaire"
        verbose_name_plural = "Lignes d'archive d'inventaire"
        ordering = ['id_archive', 'nom_materiel']
        db_table = 'comptabilite_matiere_ligne_archive_inventaire'
        unique_together = ['id_archive', 'id_materiel']
    
    def __str__(self):
        return f"{self.nom_materiel}: {self.quantite_ancien_stock} → {self.quantite_nouveau_stock or '?'}"
    
    def calculer_difference(self):
        """Calcule la différence et le statut après mise à jour du nouveau stock."""
        if self.quantite_nouveau_stock is not None:
            self.difference = self.quantite_nouveau_stock - self.quantite_ancien_stock
            if self.difference > 0:
                self.statut_difference = self.StatutDifferenceChoices.EXCEDENT
            elif self.difference < 0:
                self.statut_difference = self.StatutDifferenceChoices.DEFICIT
            else:
                self.statut_difference = self.StatutDifferenceChoices.CONFORME
    
    def save(self, *args, **kwargs):
        """Calcule automatiquement la différence avant sauvegarde."""
        self.calculer_difference()
        super().save(*args, **kwargs)
