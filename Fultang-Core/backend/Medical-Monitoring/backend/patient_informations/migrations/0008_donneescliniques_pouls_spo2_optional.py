from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patient_informations', '0007_merge_rendezvous_vitals'),
    ]

    operations = [
        migrations.AlterField(
            model_name='donneescliniques',
            name='pouls',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name='Pouls'),
        ),
        migrations.AlterField(
            model_name='donneescliniques',
            name='taux_oxygene',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name="Taux d'oxygène"),
        ),
    ]
