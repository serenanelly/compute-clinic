# Generated manually — CORR-A3

import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('patient', '0001_initial'),
        ('medical_workflow', '0010_visite_triage_urgence'),
    ]

    operations = [
        migrations.AddField(
            model_name='visite',
            name='medecin_oriente_id',
            field=models.UUIDField(blank=True, null=True, verbose_name='Médecin orienté'),
        ),
        migrations.AddField(
            model_name='delivrancemedicament',
            name='montant_fcfa',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=12, null=True,
                verbose_name='Montant estimé (FCFA)',
            ),
        ),
        migrations.AddField(
            model_name='delivrancemedicament',
            name='quittance_reference',
            field=models.CharField(
                blank=True, default='', max_length=64,
                verbose_name='Référence quittance caisse',
            ),
        ),
        migrations.CreateModel(
            name='InterventionChirurgicale',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('medecin_chirurgien_id', models.UUIDField(verbose_name='Chirurgien responsable')),
                ('libelle', models.CharField(max_length=255, verbose_name='Intervention')),
                ('urgence', models.BooleanField(default=False, verbose_name='Chirurgie urgente')),
                ('statut', models.CharField(
                    choices=[
                        ('PLANIFIEE', 'Planifiée'),
                        ('EN_COURS', 'En cours'),
                        ('TERMINEE', 'Terminée'),
                        ('ANNULEE', 'Annulée'),
                    ],
                    default='PLANIFIEE', max_length=20,
                )),
                ('acompte_montant', models.DecimalField(
                    blank=True, decimal_places=2, max_digits=12, null=True,
                    verbose_name='Acompte versé',
                )),
                ('dette_restante', models.DecimalField(
                    blank=True, decimal_places=2, max_digits=12, null=True,
                    verbose_name='Dette restante',
                )),
                ('date_intervention', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, default='')),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
                ('patient', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='interventions_chirurgicales', to='patient.patient',
                )),
                ('visite', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='interventions', to='medical_workflow.visite',
                )),
            ],
            options={
                'verbose_name': 'Intervention chirurgicale',
                'verbose_name_plural': 'Interventions chirurgicales',
                'ordering': ['-date_creation'],
            },
        ),
        migrations.CreateModel(
            name='MembreEquipeOperatoire',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('personnel_id', models.UUIDField(verbose_name='Personnel')),
                ('role', models.CharField(choices=[
                    ('CHIRURGIEN', 'Chirurgien'),
                    ('ANESTHESISTE', 'Anesthésiste'),
                    ('INFIRMIER', 'Infirmier'),
                    ('AIDE', 'Aide opératoire'),
                ], max_length=20)),
                ('intervention', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='equipe', to='medical_workflow.interventionchirurgicale',
                )),
            ],
            options={
                'verbose_name': 'Membre équipe opératoire',
                'unique_together': {('intervention', 'personnel_id', 'role')},
            },
        ),
    ]
