"""
Modèle MaterielMedical pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-18
"""
from django.db import models
from django.core.validators import MinValueValidator
from .materiel import Materiel


class MaterielMedical(Materiel):
    """
    Modèle pour les matériels médicaux (médicaments, consommables, réactifs).
    
    Hérite de Materiel et ajoute des attributs spécifiques aux matériels médicaux.
    """
    
    class CategorieChoices(models.TextChoices):
        MEDICAMENT = 'MEDICAMENT', 'Médicament'
        CONSOMMABLE = 'CONSOMMABLE', 'Consommable'
        REACTIF = 'REACTIF', 'Réactif'
    
    class UniteMesureChoices(models.TextChoices):
        BOITE = 'BOITE', 'Boîte'
        FLACON = 'FLACON', 'Flacon'
        UNITE = 'UNITE', 'Unité'
        PLAQUETTE = 'PLAQUETTE', 'Plaquette'
        SACHET = 'SACHET', 'Sachet'
        TUBE = 'TUBE', 'Tube'
    
    categorie = models.CharField(
        max_length=20,
        choices=CategorieChoices.choices,
        verbose_name="Catégorie",
        help_text="Type de matériel médical"
    )
    
    unite_mesure = models.CharField(
        max_length=50,
        choices=UniteMesureChoices.choices,
        verbose_name="Unité de mesure",
        help_text="Unité dans laquelle le matériel est compté (ex: BOITE, FLACON, SACHET...)"
    )
    
    prix_vente_unitaire = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        verbose_name="Prix de vente unitaire",
        help_text="Prix de vente par unité (en FCFA)"
    )
    
    class Meta:
        verbose_name = "Matériel Médical"
        verbose_name_plural = "Matériels Médicaux"
        ordering = ['nom_Materiel']
        db_table = 'comptabilite_matiere_materiel_medical'
    
    def __str__(self):
        return f"{self.nom_Materiel} ({self.get_categorie_display()}) - {self.get_unite_mesure_display()}"
    
    def calculer_marge(self):
        """Calculer la marge bénéficiaire."""
        if self.prix_achat_unitaire > 0:
            return self.prix_vente_unitaire - self.prix_achat_unitaire
        return 0
    
    def calculer_taux_marge(self):
        """Calculer le taux de marge en pourcentage."""
        if self.prix_achat_unitaire > 0:
            return ((self.prix_vente_unitaire - self.prix_achat_unitaire) / self.prix_achat_unitaire) * 100
        return 0
