from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('medical_workflow', '0007_hospitalisation_service'),
    ]

    operations = [
        migrations.AddField(
            model_name='visite',
            name='paiement_valide',
            field=models.BooleanField(
                default=False,
                help_text='RG-CF-001 : True après encaissement consultation à la caisse.',
                verbose_name='Paiement consultation validé',
            ),
        ),
        migrations.AddField(
            model_name='visite',
            name='date_paiement',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Date de validation du paiement'),
        ),
    ]
