# Ajout du statut APPROUVE au workflow des besoins.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("comptabilite_matiere", "0012_personnel_uuid_ids"),
    ]

    operations = [
        migrations.AlterField(
            model_name="besoin",
            name="statut",
            field=models.CharField(
                choices=[
                    ("NON_TRAITE", "Non Traité"),
                    ("EN_COURS", "En Cours"),
                    ("APPROUVE", "Approuvé"),
                    ("TRAITE", "Traité"),
                    ("REJETE", "Rejeté"),
                ],
                default="NON_TRAITE",
                help_text="État actuel du besoin",
                max_length=20,
                verbose_name="Statut",
            ),
        ),
    ]
