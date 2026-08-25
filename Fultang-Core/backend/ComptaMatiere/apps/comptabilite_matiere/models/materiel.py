"""
Modèle Materiel pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-18
"""
from django.db import models
from django.core.validators import MinValueValidator


class Materiel(models.Model):
    """
    Modèle de base pour tous les matériels.
    
    Ce modèle sert de base pour les matériels médicaux et durables.
    """
    
    idMateriel = models.AutoField(
        primary_key=True,
        verbose_name="Identifiant du matériel"
    )
    code_materiel = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Code du matériel",
        help_text="Code unique d'identification du matériel"
    )
    
    nom_Materiel = models.CharField(
        max_length=200,
        verbose_name="Nom du matériel",
        help_text="Nom descriptif du matériel"
    )
    
    prix_achat_unitaire = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        verbose_name="Prix d'achat unitaire",
        help_text="Prix d'achat par unité (en FCFA)"
    )
    
    quantite_stock = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name="Quantité en stock",
        help_text="Quantité actuellement disponible en stock"
    )
    
    date_derniere_modification = models.DateTimeField(
        auto_now=True,
        verbose_name="Date de dernière modification",
        help_text="Date et heure de la dernière modification (automatique)"
    )
    
    class Meta:
        verbose_name = "Matériel"
        verbose_name_plural = "Matériels"
        ordering = ['nom_Materiel']
        db_table = 'comptabilite_matiere_materiel'
    
    def __str__(self):
        return f"{self.nom_Materiel} (Stock: {self.quantite_stock})"
