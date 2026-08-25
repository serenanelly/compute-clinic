# Generated for the Tenant Registry (Phase 1 — Tenant Management)

import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Tenant',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, help_text='Identifiant technique unique du tenant (UUID).', primary_key=True, serialize=False)),
                ('name', models.CharField(help_text="Nom de l'établissement de santé.", max_length=255)),
                ('identifier', models.SlugField(help_text='Identifiant métier unique et stable du tenant (ex: utilisé plus tard pour la résolution par sous-domaine ou par header). Ne doit pas changer une fois attribué.', max_length=100, unique=True)),
                ('status', models.CharField(choices=[('ACTIVE', 'Actif'), ('INACTIVE', 'Inactif')], default='ACTIVE', help_text='Statut du tenant dans le registre (actif / inactif).', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True, help_text='Date de création de l\'enregistrement du tenant.')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
