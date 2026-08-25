from django.db import models
from django.utils.translation import gettext_lazy as _

class Sexe(models.TextChoices):
    MASCULIN = 'M', _('Masculin')
    FEMININ = 'F', _('Féminin')

class StatutMatrimonial(models.TextChoices):
    CELIBATAIRE = 'CELIBATAIRE', _('Célibataire')
    MARIE = 'MARIE', _('Marié(e)')
    VEUF = 'VEUF', _('Veuf(ve)')
    DIVORCE = 'DIVORCE', _('Divorcé(e)')

class ContactType(models.TextChoices):
    WHATSAPP = 'WHATSAPP', _('WhatsApp')
    TELEPHONIQUE = 'TELEPHONE', _('Téléphonique')

class LienParenteType(models.TextChoices):
    PERE = 'PERE', _('Père')
    MERE = 'MERE', _('Mère')
    FRERE_SOEUR = 'FRERE_SOEUR', _('Frère / Sœur')
    CONJOINT = 'CONJOINT', _('Conjoint(e)')
    AMI = 'AMI', _('Ami(e)')
    AUTRE = 'AUTRE', _('Autre')
