from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patient', '0003_alter_patient_matricule'),
    ]

    operations = [
        migrations.AddField(
            model_name='patient',
            name='code_identifiant',
            field=models.CharField(
                blank=True,
                max_length=50,
                null=True,
                unique=True,
                verbose_name='Code identifiant (accueil rapide)',
            ),
        ),
        migrations.AddField(
            model_name='patient',
            name='est_anonyme',
            field=models.BooleanField(
                default=False,
                verbose_name='Dossier anonyme / identité minimale',
            ),
        ),
        migrations.AddField(
            model_name='patient',
            name='dossier_incomplet',
            field=models.BooleanField(
                default=False,
                verbose_name='Dossier à compléter par le personnel soignant',
            ),
        ),
        migrations.AlterField(
            model_name='patient',
            name='profession',
            field=models.CharField(
                blank=True,
                default='',
                max_length=100,
                verbose_name='Profession',
            ),
        ),
        migrations.AlterField(
            model_name='patient',
            name='lieu_naissance',
            field=models.CharField(
                blank=True,
                default='',
                max_length=100,
                verbose_name='Lieu de naissance',
            ),
        ),
        migrations.AlterModelOptions(
            name='patient',
            options={
                'ordering': ['nom', 'prenom'],
                'verbose_name': 'Patient',
                'verbose_name_plural': 'Patients',
            },
        ),
    ]
