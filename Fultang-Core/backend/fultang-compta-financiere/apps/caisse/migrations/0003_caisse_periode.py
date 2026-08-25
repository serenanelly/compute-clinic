from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('caisse', '0002_quittance_est_validee_patient_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='caissejournaliere',
            name='date',
            field=models.DateField(verbose_name='Date'),
        ),
        migrations.AddField(
            model_name='caissejournaliere',
            name='libelle_periode',
            field=models.CharField(blank=True, default='', max_length=120, verbose_name='Libellé période'),
        ),
        migrations.AddField(
            model_name='caissejournaliere',
            name='periode_debut',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Début de période'),
        ),
        migrations.AddField(
            model_name='caissejournaliere',
            name='periode_fin_prevue',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Fin de période prévue'),
        ),
    ]
