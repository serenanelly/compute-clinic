# Generated manually for messaging app

import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='PatientCache',
            fields=[
                ('patient_id', models.CharField(max_length=36, primary_key=True, serialize=False)),
                ('nom', models.CharField(max_length=100)),
                ('prenom', models.CharField(blank=True, default='', max_length=100)),
                ('matricule', models.CharField(blank=True, default='', max_length=20)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Cache Patient',
                'verbose_name_plural': 'Cache Patients',
            },
        ),
        migrations.CreateModel(
            name='ProcessedEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_id', models.UUIDField(unique=True)),
                ('topic', models.CharField(max_length=100)),
                ('processed_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Événement traité',
                'ordering': ['-processed_at'],
            },
        ),
    ]
