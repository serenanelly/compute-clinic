"""
Modèle Besoin pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-18
"""
from django.db import models
from django.utils import timezone


class Besoin(models.Model):
    """
    Modèle représentant un besoin émis par un personnel.
    
    Un besoin peut être émis par un membre du personnel et sera traité
    par le directeur avec différents statuts possibles.
    """
    
    # Choix pour le statut du besoin
    class StatutChoices(models.TextChoices):
        NON_TRAITE = 'NON_TRAITE', 'Non Traité'
        EN_COURS = 'EN_COURS', 'En Cours'
        APPROUVE = 'APPROUVE', 'Approuvé'
        TRAITE = 'TRAITE', 'Traité'
        REJETE = 'REJETE', 'Rejeté'
    
    idBesoin = models.AutoField(
        primary_key=True,
        verbose_name="Identifiant du besoin"
    )
    
    date_creation_besoin = models.DateTimeField(
        default=timezone.now,
        verbose_name="Date de création",
        help_text="Date et heure de création du besoin (automatique)"
    )
    
    idPersonnel_emetteur = models.CharField(
        max_length=36,
        verbose_name="ID Personnel émetteur",
        help_text="Identifiant du personnel ayant émis le besoin"
    )
    
    motif = models.TextField(
        verbose_name="Motif",
        help_text="Justification du besoin"
    )
    
    statut = models.CharField(
        max_length=20,
        choices=StatutChoices.choices,
        default=StatutChoices.NON_TRAITE,
        verbose_name="Statut",
        help_text="État actuel du besoin"
    )

    
    date_traitement_directeur = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Date de traitement",
        help_text="Date et heure du traitement par le directeur"
    )
    
    commentaire_directeur = models.TextField(
        null=True,
        blank=True,
        verbose_name="Commentaire du directeur",
        help_text="Commentaire du directeur sur le besoin"
    )
    
    class Meta:
        verbose_name = "Besoin"
        verbose_name_plural = "Besoins"
        ordering = ['-date_creation_besoin']
        db_table = 'comptabilite_matiere_besoin'
    
    def __str__(self):
        return f"Besoin #{self.idBesoin} - {self.get_statut_display()} - {self.idPersonnel_emetteur}"
    
    def save(self, *args, **kwargs):
        """
        Surcharge de la méthode save pour gérer la date de traitement.
        """
        # Si le statut passe à TRAITE ou REJETE et qu'il n'y a pas de date de traitement
        if self.statut in [self.StatutChoices.TRAITE, self.StatutChoices.REJETE]:
            if not self.date_traitement_directeur:
                self.date_traitement_directeur = timezone.now()
        
        super().save(*args, **kwargs)
