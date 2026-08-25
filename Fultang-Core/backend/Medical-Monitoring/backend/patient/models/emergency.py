import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from .choices import LienParenteType
from .satellite import Adresse

class PersonneAPrevenir(models.Model):
    """Personne à contacter en cas d'urgence pour un patient."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nom = models.CharField(max_length=100, verbose_name=_("Nom"))
    prenom = models.CharField(max_length=100, blank=True, null=True, verbose_name=_("Prénom"))
    
    # Chaque personne à prévenir a son adresse
    adresse = models.OneToOneField(
        Adresse, on_delete=models.SET_NULL, null=True, blank=True, 
        related_name='resident_urgence'
    )

    class Meta:
        verbose_name = _("Personne à Prévenir")
        verbose_name_plural = _("Personnes à Prévenir")

    def __str__(self):
        return f"{self.nom} {self.prenom or ''}"

class LienParente(models.Model):
    """Table de jonction entre Patient et PersonneAPrevenir."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey('Patient', on_delete=models.CASCADE)
    personne_a_prevenir = models.ForeignKey(PersonneAPrevenir, on_delete=models.CASCADE)
    
    relation = models.CharField(
        max_length=20, 
        choices=LienParenteType.choices, 
        default=LienParenteType.AUTRE,
        verbose_name=_("Type de relation")
    )
    relation_autre = models.CharField(
        max_length=100, 
        blank=True, 
        null=True, 
        verbose_name=_("Précision si autre")
    )

    class Meta:
        verbose_name = _("Lien de Parenté")
        verbose_name_plural = _("Liens de Parenté")
        unique_together = ('patient', 'personne_a_prevenir')
