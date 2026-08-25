# Correction de la migration 0003 :
# AlterField integer->UUID est impossible directement sous PostgreSQL.
# On utilise RunSQL : pour chaque table on supprime l'ancienne colonne PK
# et on recrée une colonne UUID. La base est vide donc aucune donnée n'est perdue.

from django.db import migrations


# Tables concernées et leurs noms Django dans le schema api_*
TABLES = [
    'api_admin',
    'api_comptablefinancier',
    'api_comptablematiere',
    'api_directeur',
    'api_infirmiere',
    'api_laborantin',
    'api_medecin',
    'api_pharmacien',
    'api_receptionniste',
]


def convert_table_pk_to_uuid(table):
    """Génère le SQL pour passer la PK d'une table de integer à UUID."""
    return f"""
        ALTER TABLE {table} DROP CONSTRAINT {table}_pkey CASCADE;
        ALTER TABLE {table} DROP COLUMN id_personnel;
        ALTER TABLE {table} ADD COLUMN id_personnel uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY;
    """


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_remove_admin_poste_remove_admin_salaire_de_base_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="\n".join(convert_table_pk_to_uuid(t) for t in TABLES),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
