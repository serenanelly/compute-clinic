from django.db import migrations, models


def set_existing_quittances_validated(apps, schema_editor):
    # Phase 8 (tenant_routing) : cible explicitement l'alias de CETTE
    # migration (schema_editor.connection.alias) — sans ça, la requête ORM
    # passe par TenantDatabaseRouter, qui exige un Tenant Context déjà
    # établi (absent lors d'un `migrate` hors requête HTTP, y compris pour
    # 'default' et pour toute nouvelle base tenant fraîchement provisionnée).
    Quittance = apps.get_model('caisse', 'Quittance')
    db_alias = schema_editor.connection.alias
    Quittance.objects.using(db_alias).all().update(est_validee=True)


class Migration(migrations.Migration):

    dependencies = [
        ('caisse', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='quittance',
            name='est_validee',
            field=models.BooleanField(default=False, verbose_name='Validée par le caissier'),
        ),
        migrations.AlterField(
            model_name='quittance',
            name='patient_id',
            field=models.CharField(
                blank=True,
                help_text='# EXT UUID ou référence',
                max_length=36,
                null=True,
                verbose_name='ID Patient',
            ),
        ),
        migrations.RunPython(set_existing_quittances_validated, migrations.RunPython.noop),
    ]
