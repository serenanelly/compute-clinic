# Seed du catalogue FunctionalService — Tenant Configuration (couche
# établissement), catégorie "Services".
#
# Liste dérivée du code EXISTANT de FullTang (rôles service-personnel,
# apps métier Medical-Monitoring/fultang-compta-financiere/ComptaMatiere/
# Gestion-Infrastructures) — pas une liste inventée. `display_order` place
# les services les plus centraux au parcours patient en premier, cohérent
# avec l'ordre attendu dans l'IHM (voir Établissement > Configuration >
# Services).

from django.db import migrations

FUNCTIONAL_SERVICES = [
    # (code, name, display_order)
    ("MEDECINE_GENERALE", "Médecine générale", 10),
    ("SOINS_INFIRMIERS", "Soins infirmiers", 20),
    ("PHARMACIE", "Pharmacie", 30),
    ("LABORATOIRE", "Laboratoire", 40),
    ("CAISSE", "Caisse / Encaissement", 50),
    ("COMPTA_FINANCIERE", "Comptabilité financière", 60),
    ("COMPTA_MATIERE", "Comptabilité matière", 70),
    ("GESTION_PERSONNEL", "Gestion du personnel", 80),
    ("GESTION_INFRASTRUCTURES", "Gestion des infrastructures", 90),
]


def seed_functional_services(apps, schema_editor):
    FunctionalService = apps.get_model("tenants", "FunctionalService")
    for code, name, display_order in FUNCTIONAL_SERVICES:
        FunctionalService.objects.get_or_create(
            code=code, defaults={"name": name, "display_order": display_order},
        )


def unseed_functional_services(apps, schema_editor):
    FunctionalService = apps.get_model("tenants", "FunctionalService")
    FunctionalService.objects.filter(
        code__in=[code for code, _, _ in FUNCTIONAL_SERVICES],
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("tenants", "0008_functionalservice_tenant_address_tenant_email_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_functional_services, reverse_code=unseed_functional_services),
    ]
