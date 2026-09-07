# Seed d'un unique compte PLATFORM_ADMIN de démonstration.
#
# Volontairement un seul compte, mot de passe de démo committé — cohérent
# avec la façon dont service-personnel seed déjà ses comptes de démo
# (voir seed_admin_only.py : superadmin@fultang.local / FultangAdmin2026!).
# La gestion complète des comptes PLATFORM_ADMIN (plusieurs comptes,
# rotation de mot de passe, etc.) est hors périmètre de cette étape.

from django.contrib.auth.hashers import make_password
from django.db import migrations

EMAIL = "platform-admin@fultang.local"
PASSWORD = "PlatformAdmin2026!"


def seed_platform_admin(apps, schema_editor):
    PlatformAdmin = apps.get_model("tenants", "PlatformAdmin")
    PlatformAdmin.objects.get_or_create(
        email=EMAIL,
        defaults={
            "password": make_password(PASSWORD),
            "nom": "Admin",
            "prenom": "Plateforme",
        },
    )


def unseed_platform_admin(apps, schema_editor):
    PlatformAdmin = apps.get_model("tenants", "PlatformAdmin")
    PlatformAdmin.objects.filter(email=EMAIL).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("tenants", "0005_platformadmin"),
    ]

    operations = [
        migrations.RunPython(seed_platform_admin, reverse_code=unseed_platform_admin),
    ]
