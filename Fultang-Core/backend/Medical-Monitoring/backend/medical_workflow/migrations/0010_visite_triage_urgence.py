# CORR-A3-007 triage infirmier, CORR-A3-001 mode urgence

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('medical_workflow', '0009_a2_regles_metier'),
    ]

    operations = [
        migrations.AddField(
            model_name='visite',
            name='infirmier_en_charge_id',
            field=models.UUIDField(blank=True, null=True, verbose_name='Infirmier en charge (triage)'),
        ),
        migrations.AddField(
            model_name='visite',
            name='parametres_complets',
            field=models.BooleanField(default=False, verbose_name='Paramètres vitaux enregistrés'),
        ),
        migrations.AddField(
            model_name='visite',
            name='mode_urgence',
            field=models.BooleanField(default=False, verbose_name='Admission urgences / dossier provisoire'),
        ),
    ]
