# Generated manually — CORR-A3-010

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comptabilite_matiere', '0014_rapport_noms_denormalises'),
    ]

    operations = [
        migrations.AddField(
            model_name='besoin',
            name='fournisseur_souhaite',
            field=models.CharField(
                blank=True, default='', max_length=200,
                verbose_name='Fournisseur souhaité',
            ),
        ),
    ]
