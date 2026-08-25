"""
Seed démo — Comptabilité matière (stock, besoins, livraisons, sorties, inventaires).

Usage :
  python manage.py seed_demo_matiere
  python manage.py seed_demo_matiere --flush
"""
from decimal import Decimal
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.comptabilite_matiere.models import (
    ArchiveInventaire,
    Besoin,
    LigneArchiveInventaire,
    LigneBesoin,
    LigneLivraison,
    LigneSortie,
    Livraison,
    MaterielDurable,
    MaterielMedical,
    Rapport,
    Sortie,
)


class Command(BaseCommand):
    help = "Seed démo comptabilité matière — matériels, besoins, flux stock"

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush',
            action='store_true',
            help='Vide les tables compta matière avant de recréer les données',
        )

    def handle(self, *args, **options):
        if options['flush']:
            self._flush()

        if MaterielMedical.objects.exists() and not options['flush']:
            self.stdout.write(self.style.WARNING('Données compta matière déjà présentes — seed ignoré.'))
            return

        self.stdout.write(self.style.WARNING('\n═══ SEED DÉMO — Comptabilité Matière ═══\n'))

        with transaction.atomic():
            medicaux = self._seed_materiels_medicaux()
            durables = self._seed_materiels_durables()
            self._seed_besoins()
            self._seed_livraisons(medicaux)
            self._seed_sorties(medicaux)
            self._seed_inventaires(medicaux)
            self._seed_rapports()

        self.stdout.write(self.style.SUCCESS('\n✅ Seed compta matière terminé.\n'))

    def _flush(self):
        self.stdout.write(self.style.ERROR('Vidage des données compta matière...'))
        for model in [
            LigneArchiveInventaire, Rapport, LigneSortie, Sortie,
            LigneLivraison, Livraison, LigneBesoin, Besoin,
            ArchiveInventaire, MaterielMedical, MaterielDurable,
        ]:
            model.objects.all().delete()

    def _seed_materiels_medicaux(self):
        items = [
            ('MED-001', 'Paracétamol 500mg', 'MEDICAMENT', 'BOITE', 800, 1200, 150),
            ('MED-002', 'Amoxicilline 500mg', 'MEDICAMENT', 'BOITE', 1500, 2200, 80),
            ('MED-003', 'Sérum physiologique 500ml', 'CONSOMMABLE', 'FLACON', 350, 500, 200),
            ('MED-004', 'Gants latex (boîte 100)', 'CONSOMMABLE', 'BOITE', 2500, 3200, 25),
            ('MED-005', 'Réactif glucose', 'REACTIF', 'FLACON', 4500, 0, 12),
            ('MED-006', 'Ibuprofène 400mg', 'MEDICAMENT', 'BOITE', 900, 1400, 60),
            ('MED-007', 'Compresses stériles', 'CONSOMMABLE', 'SACHET', 150, 250, 300),
            ('MED-008', 'Oméprazole 20mg', 'MEDICAMENT', 'PLAQUETTE', 1100, 1800, 45),
            ('MED-009', 'Masques chirurgicaux (boîte)', 'CONSOMMABLE', 'BOITE', 1800, 2500, 18),
            ('MED-010', 'Vitamine C 1000mg', 'MEDICAMENT', 'TUBE', 600, 950, 8),
        ]
        created = []
        for code, nom, cat, unite, pa, pv, stock in items:
            obj, _ = MaterielMedical.objects.get_or_create(
                code_materiel=code,
                defaults={
                    'nom_Materiel': nom,
                    'categorie': cat,
                    'unite_mesure': unite,
                    'prix_achat_unitaire': Decimal(str(pa)),
                    'prix_vente_unitaire': Decimal(str(pv or pa * 1.3)),
                    'quantite_stock': stock,
                },
            )
            created.append(obj)
        return created

    def _seed_materiels_durables(self):
        items = [
            ('DUR-001', 'Fauteuil roulant standard', 'BON_ETAT', 'Pharmacie'),
            ('DUR-002', 'Défibrillateur portable', 'BON_ETAT', 'Urgences'),
            ('DUR-003', 'Oxymètre de pouls', 'EN_REPARATION', 'Consultation'),
        ]
        created = []
        for code, nom, etat, loc in items:
            obj, _ = MaterielDurable.objects.get_or_create(
                code_materiel=code,
                defaults={
                    'nom_Materiel': nom,
                    'prix_achat_unitaire': Decimal('150000'),
                    'quantite_stock': 1,
                    'Etat': etat,
                    'localisation': loc,
                },
            )
            created.append(obj)
        return created

    def _seed_besoins(self):
        now = timezone.now()
        specs = [
            ('Réapprovisionnement gants et masques', 'NON_TRAITE', '5', [
                ('Gants latex', 20, 'HIGH'),
                ('Masques chirurgicaux', 15, 'NORMAL'),
            ]),
            ('Urgence réactifs laboratoire', 'NON_TRAITE', '8', [
                ('Réactif glucose', 10, 'HIGH'),
            ]),
            ('Renouvellement stock pharmacie', 'EN_COURS', '5', [
                ('Paracétamol 500mg', 50, 'NORMAL'),
                ('Amoxicilline 500mg', 30, 'NORMAL'),
            ]),
            ('Matériel maternité', 'TRAITE', '5', [
                ('Compresses stériles', 100, 'NORMAL'),
            ]),
            ('Équipement obsolète', 'REJETE', '8', [
                ('Défibrillateur portable', 1, 'LOW'),
            ]),
        ]
        for motif, statut, emetteur_id, lignes in specs:
            besoin = Besoin.objects.create(
                motif=motif,
                statut=statut,
                idPersonnel_emetteur=emetteur_id,
                date_creation_besoin=now - timedelta(days=len(lignes)),
                commentaire_directeur='Validé pour commande' if statut == 'EN_COURS' else (
                    'Budget insuffisant' if statut == 'REJETE' else None
                ),
                date_traitement_directeur=now if statut in ('TRAITE', 'REJETE', 'EN_COURS') else None,
            )
            for nom, qte, priorite in lignes:
                LigneBesoin.objects.create(
                    id_besoin=besoin,
                    materiel_nom=nom,
                    quantite_demandee=qte,
                    priorite=priorite,
                    quantite_accordee=qte if statut == 'TRAITE' else None,
                )

    def _seed_livraisons(self, medicaux):
        now = timezone.now()
        livraison = Livraison.objects.create(
            bon_livraison_numero='BL-2026-001',
            nom_fournisseur='MediSupply Cameroun',
            contact_fournisseur='+237690000001',
            date_reception=now - timedelta(days=5),
            montant_total=Decimal('0'),
            id_personnel_receptionnaire='5',
        )
        for med, qte in zip(medicaux[:3], [50, 30, 100]):
            LigneLivraison.objects.create(
                id_livraison=livraison,
                type_materiel='MEDICAL',
                materiel=med,
                code_materiel=med.code_materiel,
                nom_materiel=med.nom_Materiel,
                quantite_conforme=qte,
                quantite_non_conforme=0,
                prix_unitaire_achat=med.prix_achat_unitaire,
            )

    def _seed_sorties(self, medicaux):
        now = timezone.now()
        specs = [
            ('SORT-2026-001', 'VENTE', '8', Decimal('3600'), medicaux[0], 3),
            ('SORT-2026-002', 'VENTE', '8', Decimal('4400'), medicaux[1], 2),
            ('SORT-2026-003', 'UTILISATION_SERVICE', '5', Decimal('0'), medicaux[2], 10),
            ('SORT-2026-004', 'PERIME', '5', Decimal('0'), medicaux[6], 5),
        ]
        for idx, (numero, motif, personnel_id, montant, med, qte) in enumerate(specs):
            sortie = Sortie.objects.create(
                numero_sortie=numero,
                date_sortie=now - timedelta(hours=idx + 1),
                motif_sortie=motif,
                idPersonnel=personnel_id,
                service_responsable='Pharmacie' if motif == 'VENTE' else 'Maternité',
                montant_total=montant,
            )
            LigneSortie.objects.create(
                id_sortie=sortie,
                id_materiel=med,
                code_materiel=med.code_materiel,
                nom_materiel=med.nom_Materiel,
                type_materiel='MEDICAL',
                quantite=qte,
                prix_unitaire=med.prix_vente_unitaire if motif == 'VENTE' else Decimal('0'),
            )

    def _seed_inventaires(self, medicaux):
        now = timezone.now()
        archive_ouverte = ArchiveInventaire.objects.create(
            code_archive='ARC-20260701-01',
            id_responsable='8',
            statut=ArchiveInventaire.StatutChoices.OUVERT,
            observations='Inventaire pharmacie en cours',
        )
        for med in medicaux[:5]:
            LigneArchiveInventaire.objects.create(
                id_archive=archive_ouverte,
                id_materiel=med,
                code_materiel=med.code_materiel,
                nom_materiel=med.nom_Materiel,
                quantite_ancien_stock=med.quantite_stock,
                quantite_nouveau_stock=med.quantite_stock,
            )

        archive_cloturee = ArchiveInventaire.objects.create(
            code_archive='ARC-20260601-01',
            id_responsable='8',
            statut=ArchiveInventaire.StatutChoices.CLOTURE,
            date_termine=now - timedelta(days=30),
            observations='Inventaire mensuel pharmacie — clôturé',
        )
        for med in medicaux[5:8]:
            LigneArchiveInventaire.objects.create(
                id_archive=archive_cloturee,
                id_materiel=med,
                code_materiel=med.code_materiel,
                nom_materiel=med.nom_Materiel,
                quantite_ancien_stock=med.quantite_stock + 10,
                quantite_nouveau_stock=med.quantite_stock,
            )

    def _seed_rapports(self):
        now = timezone.now()
        Rapport.objects.create(
            code_rapport='RPT-2026-001',
            objet='État des stocks critiques — pharmacie',
            corps='Plusieurs médicaments sont sous le seuil d\'alerte. Merci de valider les besoins en cours.',
            id_expediteur='8',
            id_destinataire='12',
            type_rapport=Rapport.TypeRapportChoices.STOCK,
            statut='non lu',
        )
        Rapport.objects.create(
            code_rapport='RPT-2026-002',
            objet='Rapport inventaire juin 2026',
            corps='Inventaire mensuel clôturé. Écarts mineurs constatés sur les consommables.',
            id_expediteur='8',
            id_destinataire='5',
            type_rapport=Rapport.TypeRapportChoices.INVENTAIRE,
            statut='lu',
            est_lu=True,
            date_lecture=now - timedelta(days=2),
        )
