from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comptabilite', '0004_auditlog_role_utilisateur'),
    ]

    operations = [
        migrations.AddField(
            model_name='ecriturecomptable',
            name='created_by_nom',
            field=models.CharField(
                blank=True,
                help_text="Nom affiché du comptable / utilisateur ayant créé l'écriture",
                max_length=200,
                null=True,
                verbose_name='Créé par (nom)',
            ),
        ),
    ]
