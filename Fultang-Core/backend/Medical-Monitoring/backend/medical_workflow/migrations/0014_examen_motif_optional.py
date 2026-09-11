from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('medical_workflow', '0013_hospitalisation_numero_lit'),
    ]

    operations = [
        migrations.AlterField(
            model_name='examen',
            name='motif',
            field=models.TextField(blank=True, default='', verbose_name="Motif de l'examen"),
        ),
    ]
