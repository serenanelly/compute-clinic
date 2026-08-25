import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from .examination import Examen, ResultatExamen

class Prelevement(models.Model):
    """Prélèvement effectué pour un examen."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    examen = models.ForeignKey(Examen, on_delete=models.CASCADE, related_name='prelevements')
    laborantin_id = models.UUIDField(verbose_name=_("ID du Laborantin"))
    type_prelevement = models.CharField(max_length=100, verbose_name=_("Type de prélèvement (ex: Sang, Urine)"))
    date_prelevement = models.DateTimeField(auto_now_add=True)
    code_barre = models.CharField(max_length=100, blank=True, null=True, unique=True, verbose_name=_("Code barre / Numéro de tube"))
    
    class Meta:
        verbose_name = _("Prélèvement")
        verbose_name_plural = _("Prélèvements")

class ValeurCritique(models.Model):
    """Valeur critique signalée par le laborantin."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resultat = models.ForeignKey(ResultatExamen, on_delete=models.CASCADE, related_name='valeurs_critiques')
    laborantin_id = models.UUIDField(verbose_name=_("ID du Laborantin ayant signalé"))
    valeur_mesuree = models.CharField(max_length=255, verbose_name=_("Valeur mesurée"))
    seuil_alerte = models.CharField(max_length=255, verbose_name=_("Seuil d'alerte dépassé"))
    commentaire = models.TextField(blank=True, null=True, verbose_name=_("Commentaire / Action recommandée"))
    date_signalement = models.DateTimeField(auto_now_add=True)
    medecin_notifie = models.BooleanField(default=False, verbose_name=_("Médecin notifié"))

    class Meta:
        verbose_name = _("Valeur Critique")
        verbose_name_plural = _("Valeurs Critiques")
