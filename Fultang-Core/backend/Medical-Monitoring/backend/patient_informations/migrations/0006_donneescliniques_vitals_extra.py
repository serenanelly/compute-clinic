# CORR-A4-001

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patient_informations', '0005_groupe_sanguin_optional'),
    ]

    operations = [
        migrations.AddField(
            model_name='donneescliniques',
            name='frequence_respiratoire',
            field=models.CharField(blank=True, max_length=50, null=True, verbose_name='Fréquence respiratoire'),
        ),
        migrations.AddField(
            model_name='donneescliniques',
            name='glycemie',
            field=models.CharField(blank=True, max_length=50, null=True, verbose_name='Glycémie (g/L)'),
        ),
    ]
