from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patient_informations', '0003_donneescliniques_temperature_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='rendezvous',
            name='cree_par_role',
            field=models.CharField(
                choices=[
                    ('RECEPTIONNISTE', 'Réceptionniste'),
                    ('INFIRMIER', 'Infirmier'),
                    ('MEDECIN', 'Médecin'),
                ],
                default='RECEPTIONNISTE',
                max_length=20,
                verbose_name='Créé par (rôle)',
            ),
        ),
    ]
