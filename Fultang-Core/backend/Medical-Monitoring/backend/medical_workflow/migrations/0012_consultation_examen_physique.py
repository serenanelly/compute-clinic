# CORR-A4-002

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('medical_workflow', '0011_a3_flux_metier'),
    ]

    operations = [
        migrations.AddField(
            model_name='consultation',
            name='examen_physique',
            field=models.TextField(blank=True, default='', verbose_name='Examen physique'),
        ),
        migrations.AddField(
            model_name='consultation',
            name='champs_specialite',
            field=models.JSONField(blank=True, default=dict, verbose_name='Champs spécialité'),
        ),
    ]
