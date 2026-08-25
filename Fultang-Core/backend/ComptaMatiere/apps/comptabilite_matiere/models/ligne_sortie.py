"""
Modèle LigneSortie pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-24
"""
from django.db import models
from django.core.validators import MinValueValidator


class LigneSortie(models.Model):
    """
    Modèle représentant une ligne de détail d'une sortie.
    
    Chaque sortie peut contenir plusieurs lignes, chacune correspondant
    à un article sorti avec sa quantité et son prix (pour les ventes).
    """
    
    class TypeMaterielChoices(models.TextChoices):
        MEDICAL = 'MEDICAL', 'Médical'
        DURABLE = 'DURABLE', 'Durable'
    
    id_ligne_sortie = models.AutoField(
        primary_key=True,
        verbose_name="Identifiant de la ligne"
    )
    
    id_sortie = models.ForeignKey(
        'Sortie',
        on_delete=models.CASCADE,
        related_name='lignes',
        verbose_name="Sortie",
        help_text="Référence à la sortie parent"
    )
    
    id_materiel = models.ForeignKey(
        'Materiel',
        on_delete=models.PROTECT,
        related_name='lignes_sortie',
        verbose_name="Matériel",
        help_text="Référence au matériel sorti"
    )
    
    code_materiel = models.CharField(
        max_length=50,
        verbose_name="Code du matériel",
        help_text="Code d'identification du matériel"
    )
    
    nom_materiel = models.CharField(
        max_length=150,
        verbose_name="Nom du matériel",
        help_text="Nom du matériel sorti"
    )
    
    type_materiel = models.CharField(
        max_length=10,
        choices=TypeMaterielChoices.choices,
        verbose_name="Type de matériel",
        help_text="Type du matériel (médical ou durable)"
    )
    
    quantite = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        verbose_name="Quantité",
        help_text="Quantité de matériel sortie"
    )
    
    prix_unitaire = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Prix unitaire",
        help_text="Prix unitaire (pour les ventes)"
    )
    
    sous_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="Sous-total",
        help_text="Sous-total (quantité × prix, pour les ventes)"
    )
    
    class Meta:
        verbose_name = "Ligne de sortie"
        verbose_name_plural = "Lignes de sortie"
        ordering = ['id_sortie', 'id_ligne_sortie']
        db_table = 'comptabilite_matiere_ligne_sortie'
    
    def __str__(self):
        return f"{self.nom_materiel} x{self.quantite}"
    
    def save(self, *args, **kwargs):
        """
        Calcule automatiquement le sous-total et met à jour le stock.
        Vérifie que le stock est suffisant avant de décrémenter.
        """
        if self.prix_unitaire is not None:
            self.sous_total = self.quantite * self.prix_unitaire
            
        materiel = self.id_materiel
        
        if not self.pk:
            # Nouvelle sortie
            if materiel.quantite_stock < self.quantite:
                raise ValueError(f"Stock insuffisant pour {materiel.nom_Materiel}. Disponible: {materiel.quantite_stock}")
            
            materiel.quantite_stock -= self.quantite
            materiel.save()
        else:
            # Mise à jour
            old_instance = LigneSortie.objects.get(pk=self.pk)
            diff = self.quantite - old_instance.quantite
            if diff != 0:
                if materiel.quantite_stock < diff:
                    raise ValueError(f"Stock insuffisant pour ajuster la sortie de {materiel.nom_Materiel}. Disponible: {materiel.quantite_stock}")
                
                materiel.quantite_stock -= diff
                materiel.save()
                
        super().save(*args, **kwargs)

        # Mettre à jour le montant_total de la Sortie parente (surtout pour les ventes)
        sortie = self.id_sortie
        total = sum(l.sous_total or 0 for l in sortie.lignes.all())
        sortie.montant_total = total
        sortie.save(update_fields=['montant_total'])
