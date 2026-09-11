import uuid
from datetime import timedelta
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from patient.models.patient import Patient
from .choices import StatutVisite

class Visite(models.Model):
    """
    Dossier de visite (Container) regroupant toutes les prestations médicales 
    effectuées pour un patient lors d'un séjour ou d'un passage à l'hôpital.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        Patient, 
        on_delete=models.CASCADE, 
        related_name='visites', 
        verbose_name=_("Patient")
    )
    
    motif_visite = models.TextField(verbose_name=_("Motif global de la visite"))
    date_heure = models.DateTimeField(auto_now_add=True, verbose_name=_("Date et Heure d'ouverture"))
    statut = models.CharField(
        max_length=20, 
        choices=StatutVisite.choices, 
        default=StatutVisite.EN_COURS,
        verbose_name=_("Statut")
    )
    paiement_valide = models.BooleanField(
        default=False,
        verbose_name=_("Paiement consultation validé"),
        help_text=_("RG-CF-001 : validé après encaissement à la caisse."),
    )
    date_paiement = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Date de validation du paiement"),
    )
    infirmier_en_charge_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_("Infirmier en charge (triage)"),
    )
    parametres_complets = models.BooleanField(
        default=False,
        verbose_name=_("Paramètres vitaux enregistrés"),
    )
    mode_urgence = models.BooleanField(
        default=False,
        verbose_name=_("Admission urgences / dossier provisoire"),
    )
    medecin_oriente_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_("Médecin orienté (réception)"),
    )

    class Meta:
        verbose_name = _("Visite")
        verbose_name_plural = _("Visites")
        ordering = ['-date_heure']

    def __str__(self):
        return f"Visite de {self.patient.nom} - {self.date_heure.strftime('%d/%m/%Y')}"

    @property
    def delai_validite_heures(self):
        return getattr(settings, 'DELAI_VALIDITE_CONSULTATION_HEURES', 24)

    def paiement_est_actif(self):
        """RG-CF-001 + CORR-A2-002 : paiement valide dans le délai imparti."""
        if not self.paiement_valide or not self.date_paiement:
            return False
        expiration = self.date_paiement + timedelta(hours=self.delai_validite_heures)
        return timezone.now() <= expiration

    @property
    def paiement_expire_le(self):
        if not self.date_paiement:
            return None
        return self.date_paiement + timedelta(hours=self.delai_validite_heures)
