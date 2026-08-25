# Noms dénormalisés de l'expéditeur/destinataire pour un affichage fiable.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("comptabilite_matiere", "0013_alter_besoin_statut_approuve"),
    ]

    operations = [
        migrations.AddField(
            model_name="rapport",
            name="nom_expediteur",
            field=models.CharField(
                blank=True,
                null=True,
                max_length=200,
                help_text="Nom complet de l'expéditeur, figé à l'envoi",
                verbose_name="Nom de l'expéditeur",
            ),
        ),
        migrations.AddField(
            model_name="rapport",
            name="nom_destinataire",
            field=models.CharField(
                blank=True,
                null=True,
                max_length=200,
                help_text="Nom complet du destinataire, figé à l'envoi",
                verbose_name="Nom du destinataire",
            ),
        ),
    ]
