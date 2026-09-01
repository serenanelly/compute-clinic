# Seed du catalogue PlatformService avec les microservices déjà connus
# de FullTang (Phase 5 — Tenant Database Management).
#
# Codes alignés sur les exemples fournis dans la spécification de la
# tâche (PERSONNEL, INFRASTRUCTURE, COMPTA, COMPTA_MATIERE, MEDICAL).
# Le routing HTTP réel (SERVICE_*_URL) reste dans api-gateway/app/config.py
# pour cette phase — ce seed ne fait que peupler le catalogue déclaratif.

from django.db import migrations

SERVICES = [
    ("PERSONNEL", "Service Personnel"),
    ("INFRASTRUCTURE", "Gestion des Infrastructures"),
    ("COMPTA", "Comptabilité Financière"),
    ("COMPTA_MATIERE", "Comptabilité Matière"),
    ("MEDICAL", "Medical Monitoring"),
]


def seed_services(apps, schema_editor):
    PlatformService = apps.get_model("tenants", "PlatformService")
    for code, name in SERVICES:
        PlatformService.objects.get_or_create(code=code, defaults={"name": name})


def unseed_services(apps, schema_editor):
    PlatformService = apps.get_model("tenants", "PlatformService")
    PlatformService.objects.filter(code__in=[code for code, _ in SERVICES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("tenants", "0002_platformservice_tenantdatabase"),
    ]

    operations = [
        migrations.RunPython(seed_services, reverse_code=unseed_services),
    ]
