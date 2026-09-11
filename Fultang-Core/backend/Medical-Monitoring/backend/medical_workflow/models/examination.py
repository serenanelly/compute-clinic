import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from .consultation import Consultation
from .choices import StatutExamen, CategorieExamen

class Examen(models.Model):
    """Représente un examen prescrit lors d'une consultation."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE, related_name='examens')
    nom = models.CharField(max_length=255, verbose_name=_("Nom de l'examen"))
    categorie = models.CharField(
        max_length=20,
        choices=CategorieExamen.choices,
        default=CategorieExamen.BIOLOGIE,
        verbose_name=_("Catégorie"),
    )
    motif = models.TextField(blank=True, default='', verbose_name=_("Motif de l'examen"))
    anatomie = models.CharField(max_length=255, blank=True, null=True, verbose_name=_("Zone anatomique"))
    statut = models.CharField(
        max_length=20, 
        choices=StatutExamen.choices, 
        default=StatutExamen.EN_ATTENTE,
        verbose_name=_("Statut")
    )

    class Meta:
        verbose_name = _("Examen")
        verbose_name_plural = _("Examens")

    def __str__(self):
        return f"{self.nom} (Statut: {self.statut})"

class ResultatExamen(models.Model):
    """Résultat détaillé d'un examen médical."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    examen = models.OneToOneField(Examen, on_delete=models.CASCADE, related_name='resultat')
    
    # ID du médecin ayant réalisé l'examen (externe)
    doctor_id = models.UUIDField(verbose_name=_("ID du Médecin responsable"))
    
    observations = models.TextField(blank=True, null=True, verbose_name=_("Observations"))
    resultats = models.TextField(verbose_name=_("Résultats détaillés"))
    interpretation = models.TextField(blank=True, null=True, verbose_name=_("Interprétation"))

    class Meta:
        verbose_name = _("Résultat d'Examen")
        verbose_name_plural = _("Résultats d'Examens")
