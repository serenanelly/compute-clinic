"""
Configuration de l'application comptabilite_matiere.
"""
from django.apps import AppConfig


class ComptabiliteMatiereConfig(AppConfig):
    """Configuration de l'application de comptabilité matière."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.comptabilite_matiere'
    verbose_name = 'Comptabilité Matière'
