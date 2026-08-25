from django.db import models
from django.utils.translation import gettext_lazy as _

class GroupeSanguin(models.TextChoices):
    A = 'A', 'A'
    B = 'B', 'B'
    AB = 'AB', 'AB'
    O = 'O', 'O'

class FacteurRhesus(models.TextChoices):
    POSITIF = 'POSITIF', '+'
    NEGATIF = 'NEGATIF', '-'

class StatutAddiction(models.TextChoices):
    ACTIF = 'ACTIF', _('Actif')
    SEVRE = 'SEVRE', _('Sevré')
    EN_COURS = 'EN_COURS', _('En cours de sevrage')

class StatutRDV(models.TextChoices):
    PROGRAMME = 'PROGRAMME', _('Programmé')
    ANNULE = 'ANNULE', _('Annulé')
    REPORTE = 'REPORTE', _('Reporté')
    TERMINE = 'TERMINE', _('Terminé')

class AntecedentType(models.TextChoices):
    MEDICAL = 'MEDICAL', _('Médical')
    FAMILIAL = 'FAMILIAL', _('Familial')
