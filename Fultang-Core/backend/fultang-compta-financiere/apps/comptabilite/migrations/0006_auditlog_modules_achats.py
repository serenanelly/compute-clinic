from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comptabilite', '0005_ecriturecomptable_created_by_nom'),
    ]

    operations = [
        migrations.AlterField(
            model_name='auditlog',
            name='module',
            field=models.CharField(
                choices=[
                    ('compte_comptable', 'Compte Comptable'),
                    ('journal', 'Journal'),
                    ('ecriture', 'Écriture Comptable'),
                    ('exercice', 'Exercice Comptable'),
                    ('budget', 'Budget Prévisionnel'),
                    ('prestation', 'Prestation de Service'),
                    ('quittance', 'Quittance'),
                    ('demande_achat', "Demande d'achat"),
                    ('bon_commande', 'Bon de Commande'),
                    ('facture', 'Facture Fournisseur'),
                    ('ordre_paiement', 'Ordre de Paiement'),
                    ('caisse', 'Caisse Journalière'),
                    ('inventaire', 'Inventaire Caisse'),
                ],
                max_length=30,
                verbose_name='Module',
            ),
        ),
    ]
