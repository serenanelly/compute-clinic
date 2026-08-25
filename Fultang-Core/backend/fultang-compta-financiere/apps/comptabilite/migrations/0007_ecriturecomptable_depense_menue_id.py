from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comptabilite', '0006_auditlog_modules_achats'),
    ]

    operations = [
        migrations.AddField(
            model_name='ecriturecomptable',
            name='depense_menue_id',
            field=models.IntegerField(
                blank=True,
                null=True,
                help_text="# EXT — ID de la dépense menue dans l'app caisse",
                verbose_name='ID Dépense menue source',
            ),
        ),
    ]
