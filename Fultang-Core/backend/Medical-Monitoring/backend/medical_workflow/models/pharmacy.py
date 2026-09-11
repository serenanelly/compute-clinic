import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from .consultation import MedicamentPrescrit
from patient.models.patient import Patient
from .choices import StatutAnomalie

class AnomaliePrescription(models.Model):
    """Anomalie signalée par le pharmacien sur une prescription."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    medicament = models.ForeignKey(MedicamentPrescrit, on_delete=models.CASCADE, related_name='anomalies')
    pharmacien_id = models.UUIDField(verbose_name=_("ID du Pharmacien"))
    commentaire = models.TextField(verbose_name=_("Commentaire / Motif de l'anomalie"))
    alternative_proposee = models.TextField(blank=True, null=True, verbose_name=_("Alternative proposée"))
    statut = models.CharField(
        max_length=20,
        choices=StatutAnomalie.choices,
        default=StatutAnomalie.NON_RESOLUE,
        verbose_name=_("Statut")
    )
    date_signalement = models.DateTimeField(auto_now_add=True)
    date_resolution = models.DateTimeField(blank=True, null=True)

    class Meta:
        verbose_name = _("Anomalie de Prescription")
        verbose_name_plural = _("Anomalies de Prescription")

class DelivranceMedicament(models.Model):
    """Traçabilité de la délivrance des médicaments par le pharmacien."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    medicament = models.ForeignKey(MedicamentPrescrit, on_delete=models.CASCADE, related_name='delivrances')
    pharmacien_id = models.UUIDField(verbose_name=_("ID du Pharmacien"))
    quantite_delivree = models.CharField(max_length=100, verbose_name=_("Quantité délivrée"))
    date_delivrance = models.DateTimeField(auto_now_add=True)
    montant_fcfa = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name=_("Montant estimé (FCFA)"),
    )
    quittance_reference = models.CharField(
        max_length=64, blank=True, default='',
        verbose_name=_("Référence quittance caisse"),
    )
    mode_delivrance = models.CharField(
        max_length=50, 
        choices=[('NOMINATIF', 'Nominatif (Dose par dose)'), ('GLOBAL', 'Global (Dotation service)')],
        default='NOMINATIF'
    )

    class Meta:
        verbose_name = _("Délivrance de Médicament")
        verbose_name_plural = _("Délivrances de Médicaments")

class ConciliationMedicamenteuse(models.Model):
    """Conciliation médicamenteuse à l'admission ou à la sortie."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='conciliations')
    pharmacien_id = models.UUIDField(verbose_name=_("ID du Pharmacien"))
    type_conciliation = models.CharField(
        max_length=20, 
        choices=[('ADMISSION', 'À l\'admission'), ('SORTIE', 'À la sortie')],
        default='ADMISSION'
    )
    liste_medicaments = models.TextField(verbose_name=_("Liste des médicaments antérieurs/de sortie"))
    divergences_identifiees = models.TextField(blank=True, null=True, verbose_name=_("Divergences non intentionnelles"))
    date_conciliation = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("Conciliation Médicamenteuse")
        verbose_name_plural = _("Conciliations Médicamenteuses")
