import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from patient.models.patient import Patient
from .choices import StatutHospitalisation
from .visit import Visite

class Hospitalisation(models.Model):
    """Gère le séjour hospitalier d'un patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='hospitalisations')
    visite = models.ForeignKey(Visite, on_delete=models.CASCADE, related_name='hospitalisations', null=True, blank=True)
    
    # Liens externes obligatoires
    room_id = models.UUIDField(verbose_name=_("ID de la Chambre"), null=True, blank=True)
    doctor_id = models.UUIDField(verbose_name=_("ID du Médecin en charge"), null=True, blank=True)
    
    motif = models.TextField(verbose_name=_("Motif d'hospitalisation"))
    service = models.CharField(max_length=100, null=True, blank=True, verbose_name=_("Service d'accueil"))
    duree_prevue = models.CharField(max_length=100, blank=True, null=True, verbose_name=_("Durée prévue"))
    statut = models.CharField(
        max_length=20, 
        choices=StatutHospitalisation.choices, 
        default=StatutHospitalisation.EN_COURS,
        verbose_name=_("Statut")
    )

    class Meta:
        verbose_name = _("Hospitalisation")
        verbose_name_plural = _("Hospitalisations")

class SoinAdministre(models.Model):
    """Soins reçus par le patient (liés directement au patient)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='soins_recus')
    visite = models.ForeignKey(Visite, on_delete=models.CASCADE, related_name='soins', null=True, blank=True)
    
    # Personnel externe obligatoire
    responsible_person_id = models.UUIDField(verbose_name=_("ID du Personnel responsable"))
    
    motif = models.TextField(verbose_name=_("Motif du soin"))
    type_soin = models.CharField(max_length=100, verbose_name=_("Type de soin"))
    nom = models.CharField(max_length=255, verbose_name=_("Nom du soin"))
    description = models.TextField(blank=True, null=True, verbose_name=_("Description"))
    observation = models.TextField(blank=True, null=True, verbose_name=_("Observation"))

    class Meta:
        verbose_name = _("Soin Administré")
        verbose_name_plural = _("Soins Administrés")
