from django.db import migrations


class Migration(migrations.Migration):
    """Fusion des branches 0004_rendezvous_cree_par_role et 0006_donneescliniques_vitals_extra."""

    dependencies = [
        ('patient_informations', '0004_rendezvous_cree_par_role'),
        ('patient_informations', '0006_donneescliniques_vitals_extra'),
    ]

    operations = []
