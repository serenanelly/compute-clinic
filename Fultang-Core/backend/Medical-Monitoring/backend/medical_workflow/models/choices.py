from django.db import models
from django.utils.translation import gettext_lazy as _

class StatutExamen(models.TextChoices):
    """Statuts possibles pour un examen médical."""
    EN_ATTENTE = 'EN_ATTENTE', _('En attente')
    PRELEVE = 'PRELEVE', _('Prélèvement effectué')
    REALISE = 'REALISE', _('Résultats saisis (Non validés)')
    VALIDE = 'VALIDE', _('Résultats validés')

class StatutPrescription(models.TextChoices):
    """Statuts possibles pour une prescription médicamenteuse."""
    EN_ATTENTE = 'EN_ATTENTE', _('En attente')
    VALIDEE = 'VALIDEE', _('Validée')
    ANOMALIE = 'ANOMALIE', _('Anomalie signalée')
    DELIVREE = 'DELIVREE', _('Délivrée')

class StatutAnomalie(models.TextChoices):
    """Statuts pour une anomalie de prescription."""
    NON_RESOLUE = 'NON_RESOLUE', _('Non résolue')
    RESOLUE = 'RESOLUE', _('Résolue')

class CategorieExamen(models.TextChoices):
    """Catégorie d'examen prescrit (CORR-A2-008)."""
    BIOLOGIE = 'BIOLOGIE', _('Biologie')
    IMAGERIE = 'IMAGERIE', _('Imagerie')
    HISTOLOGIE = 'HISTOLOGIE', _('Histologie')


class TypeDiagnostic(models.TextChoices):
    """Hypothèse différentielle vs diagnostic étiologique retenu (CORR-A2-017)."""
    DIFFERENTIEL = 'DIFFERENTIEL', _('Différentiel')
    ETIOLOGIQUE = 'ETIOLOGIQUE', _('Étiologique')


class TypeSortie(models.TextChoices):
    """Type de sortie patient (CORR-A2-004)."""
    AUTORISEE = 'AUTORISEE', _('Sortie autorisée')
    CONTRE_AVIS = 'CONTRE_AVIS', _('Sortie contre avis médical')
    EVASION = 'EVASION', _('Évasion')


class StatutHospitalisation(models.TextChoices):
    """Statuts possibles pour une hospitalisation."""
    EN_ATTENTE_LIT = 'EN_ATTENTE_LIT', _('En attente de lit')
    EN_COURS = 'EN_COURS', _('En cours')
    EN_SORTIE = 'EN_SORTIE', _('En cours de sortie')
    TERMINE = 'TERMINE', _('Terminée')

class StatutVisite(models.TextChoices):
    """Statuts possibles pour un dossier de visite."""
    EN_COURS = 'EN_COURS', _('En cours')
    TERMINE = 'TERMINE', _('Terminé')
    ANNULE = 'ANNULE', _('Annulé')
