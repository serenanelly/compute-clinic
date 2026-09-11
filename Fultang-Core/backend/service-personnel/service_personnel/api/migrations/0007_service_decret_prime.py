from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0006_admin_tenant_id_comptablefinancier_tenant_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="service",
            name="date_creation",
            field=models.DateField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name="service",
            name="date_decret",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="service",
            name="reference_decret",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.CreateModel(
            name="Prime",
            fields=[
                ("id_prime", models.AutoField(primary_key=True, serialize=False)),
                ("personnel_id", models.UUIDField(db_index=True)),
                ("montant_fcfa", models.DecimalField(decimal_places=2, max_digits=12)),
                ("motif", models.CharField(blank=True, default="", max_length=255)),
                ("date_debut", models.DateField()),
                ("date_fin", models.DateField(blank=True, null=True)),
                (
                    "service",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="primes",
                        to="api.service",
                    ),
                ),
            ],
            options={
                "verbose_name": "Prime",
                "verbose_name_plural": "Primes",
            },
        ),
    ]
