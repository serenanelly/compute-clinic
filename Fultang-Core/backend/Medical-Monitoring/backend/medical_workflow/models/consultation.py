import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from patient.models.patient import Patient
from .visit import Visite
from .choices import TypeDiagnostic

class Consultation(models.Model):
    """Représente une visite médicale d'un patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='consultations', verbose_name=_("Patient"))
    visite = models.ForeignKey(Visite, on_delete=models.CASCADE, related_name='consultations', verbose_name=_("Visite"), null=True, blank=True)
    
    motif = models.TextField(verbose_name=_("Motif de la consultation"))
    date_heure = models.DateTimeField(auto_now_add=True, verbose_name=_("Date et Heure"))
    
    # ID du médecin (Provient d'un service externe)
    medecin_charge = models.CharField(max_length=255, verbose_name=_("Médecin en charge"), null=True, blank=True)
    examen_physique = models.TextField(blank=True, default='', verbose_name=_("Examen physique"))
    champs_specialite = models.JSONField(default=dict, blank=True, verbose_name=_("Champs spécialité"))

    class Meta:
        verbose_name = _("Consultation")
        verbose_name_plural = _("Consultations")

    def __str__(self):
        return f"Consultation de {self.patient} le {self.date_heure.strftime('%d/%m/%Y')}"

class Symptome(models.Model):
    """Symptômes présentés par le patient lors d'une consultation."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE, related_name='symptomes')
    nom = models.CharField(max_length=255, verbose_name=_("Nom du symptôme"))
    localisation = models.CharField(max_length=255, blank=True, null=True, verbose_name=_("Localisation"))
    date_debut = models.DateField(blank=True, null=True, verbose_name=_("Date de début"))
    frequence = models.CharField(max_length=100, blank=True, null=True, verbose_name=_("Fréquence"))
    duree = models.CharField(max_length=100, blank=True, null=True, verbose_name=_("Durée"))
    evolution = models.TextField(blank=True, null=True, verbose_name=_("Évolution"))
    activite_declencheuse = models.CharField(max_length=255, blank=True, null=True, verbose_name=_("Activité déclencheuse"))

    class Meta:
        verbose_name = _("Symptôme")
        verbose_name_plural = _("Symptômes")

class Diagnostic(models.Model):
    """Diagnostic posé à l'issue de la consultation."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE, related_name='diagnostics')
    libelle = models.CharField(max_length=255, verbose_name=_("Libellé du diagnostic"))
    description = models.TextField(blank=True, null=True, verbose_name=_("Description"))
    conclusion = models.TextField(blank=True, null=True, verbose_name=_("Conclusion"))
    niveau_certitude = models.CharField(max_length=100, blank=True, null=True, verbose_name=_("Niveau de certitude"))
    type_diagnostic = models.CharField(
        max_length=20,
        choices=TypeDiagnostic.choices,
        default=TypeDiagnostic.ETIOLOGIQUE,
        verbose_name=_("Type de diagnostic"),
    )

    class Meta:
        verbose_name = _("Diagnostic")
        verbose_name_plural = _("Diagnostics")


class OrientationSpecialiste(models.Model):
    """Prescription d'orientation vers un spécialiste (CORR-A2-016)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey(
        Consultation, on_delete=models.CASCADE, related_name='orientations',
    )
    specialite = models.CharField(max_length=255, verbose_name=_("Spécialité / service"))
    motif = models.TextField(verbose_name=_("Motif de l'orientation"))
    date_heure = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Orientation spécialiste")
        verbose_name_plural = _("Orientations spécialiste")

class MedicamentPrescrit(models.Model):
    """Médicaments prescrits lors d'une consultation."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE, related_name='prescriptions')
    nom = models.CharField(max_length=255, verbose_name=_("Nom du médicament"))
    quantite = models.CharField(max_length=100, verbose_name=_("Quantité"))
    type_medicament = models.CharField(max_length=100, verbose_name=_("Type"))
    posologie = models.TextField(verbose_name=_("Posologie"))
    statut = models.CharField(
        max_length=20,
        choices=[('EN_ATTENTE', 'En attente'), ('VALIDEE', 'Validée'), ('ANOMALIE', 'Anomalie signalée'), ('DELIVREE', 'Délivrée')],
        default='EN_ATTENTE',
        verbose_name=_("Statut")
    )

    class Meta:
        verbose_name = _("Médicament Prescrit")
        verbose_name_plural = _("Médicaments Prescrits")
