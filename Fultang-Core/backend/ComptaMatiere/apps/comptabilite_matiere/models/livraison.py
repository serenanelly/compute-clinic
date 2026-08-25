"""
Modèle Livraison pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-18
"""
from django.db import models
from django.core.validators import MinValueValidator, RegexValidator


class Livraison(models.Model):
    """
    Modèle pour gérer les livraisons de matériel par les fournisseurs.
    """
    
    idLivraison = models.AutoField(
        primary_key=True,
        verbose_name="Identifiant de la livraison"
    )
    
    bon_livraison_numero = models.CharField(
        max_length=50,
        unique=True,
        verbose_name="Numéro du bon de livraison",
        help_text="Numéro du bon de livraison fourni par le fournisseur"
    )
    
    nom_fournisseur = models.CharField(
        max_length=200,
        verbose_name="Nom du fournisseur"
    )
    
    contact_fournisseur = models.CharField(
        max_length=15,
        verbose_name="Contact du fournisseur",
        help_text="Numéro de téléphone du fournisseur",
        validators=[
            RegexValidator(
                regex=r'^[0-9+\-\s()]+$',
                message="Le contact doit contenir uniquement des chiffres, espaces, +, -, ( ou )"
            )
        ]
    )
    
    date_reception = models.DateTimeField(
        verbose_name="Date de réception",
        help_text="Date et heure de réception de la livraison"
    )
    
    montant_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name="Montant total",
        help_text="Montant total de la livraison (en FCFA)"
    )
    
    date_creation = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Date de création",
        help_text="Date et heure de création de l'enregistrement (automatique)"
    )
    
    id_personnel_receptionnaire = models.CharField(
        max_length=36,
        verbose_name="ID Personnel réceptionnaire",
        help_text="Identifiant du personnel ayant réceptionné la livraison",
        null=True,
        blank=True
    )
    
    class Meta:
        verbose_name = "Livraison"
        verbose_name_plural = "Livraisons"
        ordering = ['-date_reception']
        db_table = 'comptabilite_matiere_livraison'
    
    def __str__(self):
        return f"Livraison #{self.bon_livraison_numero} - {self.nom_fournisseur}"
