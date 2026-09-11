import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from patient.models.patient import Patient
from .visit import Visite


class StatutIntervention(models.TextChoices):
    PLANIFIEE = 'PLANIFIEE', _('Planifiée')
    EN_COURS = 'EN_COURS', _('En cours')
    TERMINEE = 'TERMINEE', _('Terminée')
    ANNULEE = 'ANNULEE', _('Annulée')


class RoleEquipeOperatoire(models.TextChoices):
    CHIRURGIEN = 'CHIRURGIEN', _('Chirurgien')
    ANESTHESISTE = 'ANESTHESISTE', _('Anesthésiste')
    INFIRMIER = 'INFIRMIER', _('Infirmier')
    AIDE = 'AIDE', _('Aide opératoire')


class InterventionChirurgicale(models.Model):
    """Entité intervention chirurgicale — CORR-A3-013 à A3-015."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='interventions_chirurgicales',
    )
    visite = models.ForeignKey(
        Visite,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='interventions',
    )
    medecin_chirurgien_id = models.UUIDField(verbose_name=_('Chirurgien responsable'))
    libelle = models.CharField(max_length=255, verbose_name=_('Intervention'))
    urgence = models.BooleanField(default=False, verbose_name=_('Chirurgie urgente'))
    statut = models.CharField(
        max_length=20,
        choices=StatutIntervention.choices,
        default=StatutIntervention.PLANIFIEE,
    )
    acompte_montant = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name=_('Acompte versé'),
    )
    dette_restante = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name=_('Dette restante'),
    )
    date_intervention = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _('Intervention chirurgicale')
        verbose_name_plural = _('Interventions chirurgicales')
        ordering = ['-date_creation']

    def __str__(self):
        return f"{self.libelle} — {self.patient}"


class MembreEquipeOperatoire(models.Model):
    """Membre de l'équipe opératoire — CORR-A3-015."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    intervention = models.ForeignKey(
        InterventionChirurgicale,
        on_delete=models.CASCADE,
        related_name='equipe',
    )
    personnel_id = models.UUIDField(verbose_name=_('Personnel'))
    role = models.CharField(max_length=20, choices=RoleEquipeOperatoire.choices)

    class Meta:
        verbose_name = _('Membre équipe opératoire')
        unique_together = [('intervention', 'personnel_id', 'role')]
