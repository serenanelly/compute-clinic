from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patient_informations', '0008_donneescliniques_pouls_spo2_optional'),
    ]

    operations = [
        migrations.AlterField(
            model_name='donneescliniques',
            name='poids',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name='Poids'),
        ),
        migrations.AlterField(
            model_name='donneescliniques',
            name='taille',
            field=models.CharField(blank=True, default='', max_length=50, verbose_name='Taille'),
        ),
    ]
