from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("infrastructures", "0004_seed_types_salle"),
    ]

    operations = [
        migrations.AddField(
            model_name="salle",
            name="nb_lits",
            field=models.IntegerField(
                blank=True,
                help_text="Nombre de lits (≤ capacité totale)",
                null=True,
            ),
        ),
    ]
