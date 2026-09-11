import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Nouveau modèle Caissier (poste CAISSE) — correctif du mapping des
    rôles comptables. Avant ce correctif, aucun modèle dédié n'existait
    pour ce poste : POSTE_MODEL_MAP (views.py) le faisait pointer, par
    erreur, vers ComptableFinancier.
    """

    dependencies = [
        ('api', '0007_service_decret_prime'),
    ]

    operations = [
        migrations.CreateModel(
            name='Caissier',
            fields=[
                ('id_personnel', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('tenant_id', models.UUIDField(blank=True, db_index=True, editable=False, null=True)),
                ('nom', models.CharField(max_length=100)),
                ('prenom', models.CharField(max_length=100)),
                ('date_naissance', models.DateField()),
                ('adresse', models.TextField()),
                ('email', models.EmailField(max_length=254)),
                ('contact', models.CharField(max_length=50)),
                ('matricule', models.CharField(max_length=50)),
                ('date_embauche', models.DateField()),
                ('statut', models.CharField(choices=[('Actif', 'Actif'), ('Congé', 'Congé'), ('Suspendu', 'Suspendu'), ('Autre', 'Autre')], default='Actif', max_length=20)),
                ('mot_de_passe', models.CharField(max_length=255)),
                ('service', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_personnels', to='api.service')),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.AddConstraint(
            model_name='caissier',
            constraint=models.UniqueConstraint(fields=['tenant_id', 'email'], name='api_caissier_unique_email_per_tenant'),
        ),
        migrations.AddConstraint(
            model_name='caissier',
            constraint=models.UniqueConstraint(fields=['tenant_id', 'matricule'], name='api_caissier_unique_matricule_per_tenant'),
        ),
    ]
