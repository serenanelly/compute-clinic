from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('medical_workflow', '0012_consultation_examen_physique'),
    ]

    operations = [
        migrations.AddField(
            model_name='hospitalisation',
            name='numero_lit',
            field=models.CharField(blank=True, default='', max_length=20, verbose_name='Numéro de lit'),
        ),
    ]
