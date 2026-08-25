"""
Modèle Rapport pour l'application comptabilite_matiere.

Author: DeDjomo
Organization: ENSPY
Date: 2025-12-24
"""
from django.db import models
from django.utils import timezone
class Rapport(models.Model):
    """
    Modèle de rapport interne entre services.
    
    Permet l'envoi de rapports entre différents personnels (comptable, 
    pharmacien, directeur) avec possibilité de pièces jointes.
    """
    
    class TypeRapportChoices(models.TextChoices):
        GENERAL = 'GENERAL', 'Général'
        INVENTAIRE = 'INVENTAIRE', 'Inventaire'
        STOCK = 'STOCK', 'Stock'
        LIVRAISON = 'LIVRAISON', 'Livraison'
    
    # Keep existing fields from original model
    statut = models.CharField(
        max_length=10,
        choices=[("lu", "Lu"), ("non lu", "Non lu")],
        default="non lu",
        verbose_name="Statut du rapport",
    )
    
    objet = models.CharField(
        max_length=255,
        verbose_name="Objet du rapport"
    )
    
    corps = models.TextField(
        verbose_name="Corps du rapport"
    )
    
    date_creation = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Date de création"
    )
    
    id_personnel = models.CharField(
        max_length=36,
        null=True,
        blank=True,
        verbose_name="ID Personnel"
    )
    
    # New fields added for enhanced functionality
    code_rapport = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        verbose_name="Code du rapport",
        help_text="Code unique (format: RPT-YYYY-XXX)"
    )
    
    id_expediteur = models.CharField(
        max_length=36,
        verbose_name="ID Expéditeur",
        help_text="Identifiant du personnel qui envoie le rapport",
        null=True,
        blank=True,
    )
    
    id_destinataire = models.CharField(
        max_length=36,
        verbose_name="ID Destinataire",
        help_text="Identifiant du personnel qui reçoit le rapport",
        null=True,
        blank=True,
    )

    # Noms dénormalisés (fixés à l'envoi) pour un affichage fiable de l'émetteur
    # et du destinataire, indépendamment de la résolution d'identifiant.
    nom_expediteur = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name="Nom de l'expéditeur",
        help_text="Nom complet de l'expéditeur, figé à l'envoi",
    )

    nom_destinataire = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name="Nom du destinataire",
        help_text="Nom complet du destinataire, figé à l'envoi",
    )

    date_envoi = models.DateTimeField(
        default=timezone.now,
        verbose_name="Date d'envoi",
        help_text="Date et heure d'envoi du rapport"
    )
    
    date_lecture = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Date de lecture",
        help_text="Date et heure de lecture du rapport"
    )
    
    est_lu = models.BooleanField(
        default=False,
        verbose_name="Lu",
        help_text="Indique si le rapport a été lu"
    )
    
    type_rapport = models.CharField(
        max_length=15,
        choices=TypeRapportChoices.choices,
        default=TypeRapportChoices.GENERAL,
        verbose_name="Type de rapport",
        help_text="Catégorie du rapport"
    )
    
    archive_associee = models.ForeignKey(
        'ArchiveInventaire',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='rapports',
        verbose_name="Archive associée",
        help_text="Archive d'inventaire liée (pour rapports d'inventaire)"
    )
    
    class Meta:
        verbose_name = "Rapport"
        verbose_name_plural = "Rapports"
        ordering = ['-date_creation']
        db_table = 'comptabilite_matiere_rapport'
    
    def __str__(self):
        status = "Lu" if self.est_lu else "Non lu"
        if self.code_rapport:
            return f"Rapport {self.code_rapport}: {self.objet[:30]} ({status})"
        return f"{self.objet} ({self.statut})"
    
    def marquer_comme_lu(self):
        """Marque le rapport comme lu avec la date actuelle."""
        if not self.est_lu:
            self.est_lu = True
            self.statut = "lu"
            self.date_lecture = timezone.now()
            self.save(update_fields=['est_lu', 'statut', 'date_lecture'])
