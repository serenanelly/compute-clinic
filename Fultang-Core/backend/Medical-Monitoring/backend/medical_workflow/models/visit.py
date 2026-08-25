import uuid
from django.db import models
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

    class Meta:
        verbose_name = _("Visite")
        verbose_name_plural = _("Visites")
        ordering = ['-date_heure']

    def __str__(self):
        return f"Visite de {self.patient.nom} - {self.date_heure.strftime('%d/%m/%Y')}"
