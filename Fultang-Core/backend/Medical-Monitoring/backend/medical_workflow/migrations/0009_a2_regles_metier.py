# Generated manually — CORR-A2 batch (examens, diagnostics, hospitalisation, orientation)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('medical_workflow', '0008_visite_paiement'),
    ]

    operations = [
        migrations.AddField(
            model_name='examen',
            name='categorie',
            field=models.CharField(
                choices=[('BIOLOGIE', 'Biologie'), ('IMAGERIE', 'Imagerie'), ('HISTOLOGIE', 'Histologie')],
                default='BIOLOGIE',
                max_length=20,
                verbose_name='Catégorie',
            ),
        ),
        migrations.AddField(
            model_name='diagnostic',
            name='type_diagnostic',
            field=models.CharField(
                choices=[('DIFFERENTIEL', 'Différentiel'), ('ETIOLOGIQUE', 'Étiologique')],
                default='ETIOLOGIQUE',
                max_length=20,
                verbose_name='Type de diagnostic',
            ),
        ),
        migrations.CreateModel(
            name='OrientationSpecialiste',
            fields=[
                ('id', models.UUIDField(editable=False, primary_key=True, serialize=False)),
                ('specialite', models.CharField(max_length=255, verbose_name='Spécialité / service')),
                ('motif', models.TextField(verbose_name="Motif de l'orientation")),
                ('date_heure', models.DateTimeField(auto_now_add=True)),
                ('consultation', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='orientations',
                    to='medical_workflow.consultation',
                )),
            ],
            options={
                'verbose_name': 'Orientation spécialiste',
                'verbose_name_plural': 'Orientations spécialiste',
            },
        ),
        migrations.AddField(
            model_name='hospitalisation',
            name='validation_medicale',
            field=models.BooleanField(default=False, verbose_name='Sortie médicale validée'),
        ),
        migrations.AddField(
            model_name='hospitalisation',
            name='date_validation_medicale',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='hospitalisation',
            name='validation_financiere',
            field=models.BooleanField(default=False, verbose_name='Sortie financière validée'),
        ),
        migrations.AddField(
            model_name='hospitalisation',
            name='date_validation_financiere',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='hospitalisation',
            name='type_sortie',
            field=models.CharField(
                blank=True,
                choices=[
                    ('AUTORISEE', 'Sortie autorisée'),
                    ('CONTRE_AVIS', 'Sortie contre avis médical'),
                    ('EVASION', 'Évasion'),
                ],
                max_length=20,
                null=True,
                verbose_name='Type de sortie',
            ),
        ),
        migrations.AddField(
            model_name='hospitalisation',
            name='notes_sortie',
            field=models.TextField(blank=True, null=True, verbose_name='Notes de sortie'),
        ),
        migrations.AlterField(
            model_name='hospitalisation',
            name='statut',
            field=models.CharField(
                choices=[
                    ('EN_ATTENTE_LIT', 'En attente de lit'),
                    ('EN_COURS', 'En cours'),
                    ('EN_SORTIE', 'En cours de sortie'),
                    ('TERMINE', 'Terminée'),
                ],
                default='EN_ATTENTE_LIT',
                max_length=20,
                verbose_name='Statut',
            ),
        ),
    ]
