# CORR-A2-012 — groupe sanguin / rhésus facultatifs

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patient_informations', '0004_antecedent_date_optional'),
    ]

    operations = [
        migrations.AlterField(
            model_name='donneescliniques',
            name='groupe_sanguin',
            field=models.CharField(
                blank=True,
                choices=[('A', 'A'), ('B', 'B'), ('AB', 'AB'), ('O', 'O')],
                max_length=2,
                null=True,
                verbose_name='Groupe sanguin',
            ),
        ),
        migrations.AlterField(
            model_name='donneescliniques',
            name='facteur_rhesus',
            field=models.CharField(
                blank=True,
                choices=[('POSITIF', 'Positif'), ('NEGATIF', 'Négatif')],
                max_length=10,
                null=True,
                verbose_name='Facteur rhésus',
            ),
        ),
    ]
