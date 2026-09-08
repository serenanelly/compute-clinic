from django.db import migrations


TYPES_SALLE = [
    ("Chambre d'hospitalisation", "Chambre pour hospitalisation des patients"),
    ("Salle de consultation", "Salle destinée aux consultations médicales"),
    ("Bureau", "Bureau administratif ou de personnel"),
    ("Bloc opératoire", "Salle d'opération chirurgicale"),
    ("Salle de soins", "Salle destinée aux soins infirmiers"),
    ("Laboratoire", "Salle de laboratoire et d'analyses"),
    ("Salle d'attente", "Espace d'attente pour les patients"),
    ("Magasin", "Local de stockage / réserve"),
]


def creer_types_salle(apps, schema_editor):
    # `.using(db_alias)` est requis explicitement ici (documentation
    # Django sur les migrations de données multi-bases) : sans cela,
    # `TypeSalle.objects.get_or_create(...)` repasse par
    # DATABASE_ROUTERS (TenantDatabaseRouter, voir config/tenant_routing)
    # pour choisir sa base — qui exige un Tenant Context de requête HTTP,
    # absent pendant `migrate` (aussi bien pour 'default' que pour un
    # alias tenant lors du provisioning). Fixer explicitement la base
    # cible de CETTE migration (schema_editor.connection.alias) contourne
    # le router, exactement comme pour les opérations de schéma.
    db_alias = schema_editor.connection.alias
    TypeSalle = apps.get_model('infrastructures', 'TypeSalle')
    for nom, description in TYPES_SALLE:
        TypeSalle.objects.using(db_alias).get_or_create(nom=nom, defaults={"description": description})


def noop(apps, schema_editor):
    # On ne supprime pas les types (des salles peuvent y être rattachées).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('infrastructures', '0003_alter_batiment_id_alter_etage_id_alter_salle_id_and_more'),
    ]

    operations = [
        migrations.RunPython(creer_types_salle, noop),
    ]
