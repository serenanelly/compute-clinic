from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patient_informations', '0003_donneescliniques_temperature_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='antecedent',
            name='date',
            field=models.DateField(
                blank=True,
                null=True,
                verbose_name="Date de l'antécédent",
            ),
        ),
    ]
