from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comptabilite', '0003_auditlog'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditlog',
            name='role_utilisateur',
            field=models.CharField(
                blank=True,
                help_text='Rôle métier (caissier, comptable_financier, etc.)',
                max_length=50,
                null=True,
                verbose_name='Rôle utilisateur',
            ),
        ),
    ]
