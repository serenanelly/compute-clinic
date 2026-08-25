from django.apps import AppConfig


class MedicalWorkflowConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'medical_workflow'

    def ready(self):
        import medical_workflow.signals  # noqa: F401 — enregistrement des signaux Django
