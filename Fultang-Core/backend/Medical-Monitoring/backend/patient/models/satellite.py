import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from .choices import ContactType

class Adresse(models.Model):
    """Représente une adresse physique au Cameroun ou ailleurs."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pays = models.CharField(max_length=100, default='Cameroun', verbose_name=_("Pays"))
    ville = models.CharField(max_length=100, verbose_name=_("Ville"))
    quartier = models.CharField(max_length=100, verbose_name=_("Quartier"))
    rue = models.CharField(max_length=255, blank=True, null=True, verbose_name=_("Rue / Rue secondaire"))
    code_postal = models.CharField(max_length=20, blank=True, null=True, verbose_name=_("Code Postal"))

    class Meta:
        verbose_name = _("Adresse")
        verbose_name_plural = _("Adresses")

    def __str__(self):
        return f"{self.quartier}, {self.ville} ({self.pays})"

class Nationalite(models.Model):
    """Libellé de nationalité (ex: Camerounaise, Française)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    libelle = models.CharField(max_length=100, unique=True, verbose_name=_("Libellé"))

    class Meta:
        verbose_name = _("Nationalité")
        verbose_name_plural = _("Nationalités")

    def __str__(self):
        return self.libelle

class Contact(models.Model):
    """Moyen de joindre un patient ou une personne de confiance."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=20, choices=ContactType.choices, verbose_name=_("Type de contact"))
    numero = models.CharField(max_length=50, verbose_name=_("Numéro"))
    
    # Liens optionnels vers Patient ou PersonneAPrevenir
    patient = models.ForeignKey(
        'Patient', on_delete=models.CASCADE, related_name='contacts', 
        null=True, blank=True
    )
    personne_a_prevenir = models.ForeignKey(
        'PersonneAPrevenir', on_delete=models.CASCADE, related_name='contacts',
        null=True, blank=True
    )

    class Meta:
        verbose_name = _("Contact")
        verbose_name_plural = _("Contacts")

    def __str__(self):
        return f"{self.type}: {self.numero}"
