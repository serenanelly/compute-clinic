"""
Modèle MaterielDurable pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-18
"""
from django.db import models
from .materiel import Materiel


class MaterielDurable(Materiel):
    """
    Modèle pour les matériels durables (équipements médicaux, mobilier, etc.).
    
    Hérite de Materiel et ajoute des attributs spécifiques aux matériels durables.
    """
    
    class EtatChoices(models.TextChoices):
        BON_ETAT = 'BON_ETAT', 'Bon État'
        EN_REPARATION = 'EN_REPARATION', 'En Réparation'
        REFORME = 'REFORME', 'Réformé'
    
    Etat = models.CharField(
        max_length=20,
        choices=EtatChoices.choices,
        default=EtatChoices.BON_ETAT,
        verbose_name="État",
        help_text="État actuel du matériel"
    )
    
    localisation = models.CharField(
        max_length=200,
        verbose_name="Localisation",
        help_text="Emplacement actuel du matériel dans l'hôpital"
    )
    
    date_Enregistrement = models.DateField(
        auto_now_add=True,
        verbose_name="Date d'enregistrement",
        help_text="Date d'enregistrement initial du matériel (automatique)"
    )
    
    class Meta:
        verbose_name = "Matériel Durable"
        verbose_name_plural = "Matériels Durables"
        ordering = ['nom_Materiel']
        db_table = 'comptabilite_matiere_materiel_durable'
    
    def __str__(self):
        return f"{self.nom_Materiel} - {self.localisation} ({self.get_Etat_display()})"
    
    def est_en_bon_etat(self):
        """Vérifie si le matériel est en bon état."""
        return self.Etat == self.EtatChoices.BON_ETAT
    
    def mettre_en_reparation(self):
        """Met le matériel en réparation."""
        self.Etat = self.EtatChoices.EN_REPARATION
        self.save(update_fields=['Etat'])
    
    def remettre_en_service(self):
        """Remet le matériel en service (bon état)."""
        self.Etat = self.EtatChoices.BON_ETAT
        self.save(update_fields=['Etat'])
