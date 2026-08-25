"""
Commande de seed démo — Exercice 2025 clôturé (historique complet) + 2026 ouvert (vide).

Flux historique 2025 :
  Quittances validées et comptabilisées, charges, budgets consommés, états financiers.
Exercice 2026 :
  Ouvert sans quittances ni écritures — données opérationnelles à saisir en production.
Les fournisseurs sont recréés à l'identique à chaque --flush.

Usage :
  python manage.py seed_demo           # Ajoute les données
  python manage.py seed_demo --flush   # Vide la BD compta puis recrée tout
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from datetime import date, timedelta
import random


class Command(BaseCommand):
    help = "Seed démo : exercice 2025 clôturé + 2026 ouvert vide"

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush', action='store_true',
            help='Vide toutes les tables avant de recréer les données'
        )

    def handle(self, *args, **options):
        if options['flush']:
            self._flush_all()

        self.stdout.write(self.style.WARNING('\n══════════════════════════════════════════'))
        self.stdout.write(self.style.WARNING('  SEED DÉMO — Polyclinique Fultang'))
        self.stdout.write(self.style.WARNING('══════════════════════════════════════════\n'))

        with transaction.atomic():
            comptes = self._seed_plan_comptable()
            journaux = self._seed_journaux(comptes)
            categories = self._seed_categories(comptes)
            fournisseurs = self._seed_fournisseurs(comptes)
            ex2025, ex2026 = self._seed_exercices()
            self._seed_budgets(ex2025, ex2026, categories)
            self._seed_exercice_2025_historique(ex2025, comptes, journaux)
            self._seed_ordres_paiement(fournisseurs)
            self._seed_caisse_journaliere(ex2025)
            self._cloturer_exercice(ex2025)
            self._generer_report_nouveau(ex2025)
            self._seed_exercice_2026_caissier(ex2026, comptes, journaux)

        self._rebuild_audit_trail()
        self._print_summary()

    # ─────────────────────────────────────────────────────────────────
    def _flush_all(self):
        self.stdout.write(self.style.ERROR('🗑️  Vidage de la base de données...'))
        from apps.caisse.models import Quittance, CaisseJournaliere, DepenseMenue, InventaireCaisse
        from apps.comptabilite.models import (
            LigneEcriture, EcritureComptable, BudgetPrevisionnel,
            ExerciceComptable, PrestationDeService, AuditLog
        )
        from apps.sorties.models import (
            OrdrePaiement, Facture, LigneFacture, BonCommande,
            DemandeAchat, Fournisseur, CategorieSortie
        )
        from apps.comptabilite.models import Journal, CompteComptable

        for model in [
            DepenseMenue, InventaireCaisse, CaisseJournaliere,
            LigneEcriture, EcritureComptable,
            Quittance,
            BudgetPrevisionnel,
            OrdrePaiement, LigneFacture, Facture, BonCommande, DemandeAchat,
            AuditLog,
            PrestationDeService,
            Fournisseur, CategorieSortie,
            Journal,
            ExerciceComptable,
            CompteComptable,
        ]:
            count = model.objects.count()
            model.objects.all().delete()
            self.stdout.write(f'  ✗ {model.__name__} : {count} supprimés')

    # ─────────────────────────────────────────────────────────────────
    def _seed_plan_comptable(self):
        from apps.comptabilite.models import CompteComptable

        COMPTES = [
            # Classe 1
            ('10',   'Capital',                          '1', 'passif'),
            ('101',  'Capital social',                   '1', 'passif'),
            ('12',   'Report à nouveau',                 '1', 'passif'),
            ('121',  'Report à nouveau créditeur',       '1', 'passif'),
            ('13',   "Résultat net de l'exercice",       '1', 'passif'),
            ('131',  'Résultat net — Bénéfice',          '1', 'passif'),
            # Classe 2
            ('21',   'Immobilisations incorporelles',    '2', 'actif'),
            ('23',   'Bâtiments',                        '2', 'actif'),
            ('24',   'Matériel et mobilier',             '2', 'actif'),
            ('241',  'Matériel médical',                 '2', 'actif'),
            ('242',  'Matériel informatique',            '2', 'actif'),
            ('28',   'Amortissements',                   '2', 'actif'),
            # Classe 3
            ('31',   'Stocks de médicaments',            '3', 'actif'),
            ('32',   'Stocks de consommables',           '3', 'actif'),
            # Classe 4
            ('40',   'Fournisseurs',                     '4', 'passif'),
            ('401',  'Fournisseurs — dettes en compte',  '4', 'passif'),
            ('4011', 'Pharma-Dist SARL',                 '4', 'passif'),
            ('4012', 'MedEquip Cameroun',                '4', 'passif'),
            ('4013', 'Bureau Plus',                      '4', 'passif'),
            ('41',   'Clients',                          '4', 'actif'),
            ('411',  'Clients divers',                   '4', 'actif'),
            ('4111', 'Patients non assurés',             '4', 'actif'),
            ('4112', 'ACTIVA Assurances',                '4', 'actif'),
            ('4113', 'CHANAS Assurances',                '4', 'actif'),
            ('4114', 'SAAR Assurances',                  '4', 'actif'),
            ('42',   'Personnel',                        '4', 'passif'),
            ('421',  'Rémunérations dues',               '4', 'passif'),
            ('43',   'Organismes sociaux',               '4', 'passif'),
            ('431',  'CNPS',                             '4', 'passif'),
            ('44',   'État et collectivités',            '4', 'passif'),
            ('447',  'Impôts et taxes',                  '4', 'passif'),
            # Classe 5
            ('52',   'Banques',                          '5', 'tresorerie'),
            ('521',  'Banque principale (BICEC)',        '5', 'tresorerie'),
            ('57',   'Caisse',                           '5', 'tresorerie'),
            ('571',  'Caisse principale',                '5', 'tresorerie'),
            ('58',   'Mobile Money',                     '5', 'tresorerie'),
            ('581',  'Orange Money',                     '5', 'tresorerie'),
            ('582',  'MTN Mobile Money',                 '5', 'tresorerie'),
            # Classe 6
            ('60',   'Achats',                           '6', 'charge'),
            ('601',  'Achats de médicaments',            '6', 'charge'),
            ('602',  'Achats de consommables médicaux',  '6', 'charge'),
            ('603',  'Fournitures de bureau',            '6', 'charge'),
            ('61',   'Services extérieurs A',            '6', 'charge'),
            ('62',   'Services extérieurs B',            '6', 'charge'),
            ('63',   'Impôts et taxes',                  '6', 'charge'),
            ('64',   'Charges de personnel',             '6', 'charge'),
            ('641',  'Salaires et traitements',          '6', 'charge'),
            ('645',  'Charges sociales (CNPS)',          '6', 'charge'),
            ('66',   'Charges financières',              '6', 'charge'),
            ('68',   'Dotations aux amortissements',     '6', 'charge'),
            # Classe 7
            ('70',   'Ventes de prestations',            '7', 'produit'),
            ('701',  'Consultations médicales',          '7', 'produit'),
            ('702',  'Hospitalisations',                 '7', 'produit'),
            ('703',  'Examens de laboratoire',           '7', 'produit'),
            ('704',  'Imagerie médicale',                '7', 'produit'),
            ('705',  'Actes chirurgicaux',               '7', 'produit'),
            ('706',  'Pharmacie',                        '7', 'produit'),
            ('707',  'Maternité & Gynécologie',          '7', 'produit'),
            ('708',  'Pédiatrie',                        '7', 'produit'),
            ('75',   "Autres produits d'exploitation",   '7', 'produit'),
        ]

        comptes_map = {}
        created = 0
        for numero, libelle, classe, type_c in COMPTES:
            obj, is_new = CompteComptable.objects.get_or_create(
                numero_compte=numero,
                defaults={'libelle': libelle, 'classe': classe, 'type_compte': type_c, 'actif': True}
            )
            comptes_map[numero] = obj
            if is_new:
                created += 1

        # Relier les parents
        for c in CompteComptable.objects.all():
            if len(c.numero_compte) > 2:
                for length in range(len(c.numero_compte) - 1, 1, -1):
                    parent = CompteComptable.objects.filter(
                        numero_compte=c.numero_compte[:length]
                    ).first()
                    if parent:
                        if c.compte_parent != parent:
                            c.compte_parent = parent
                            c.save(update_fields=['compte_parent'])
                        break

        self.stdout.write(f'  📊 Plan comptable : {created} créés / {CompteComptable.objects.count()} total')
        return comptes_map

    # ─────────────────────────────────────────────────────────────────
    def _seed_journaux(self, comptes):
        from apps.comptabilite.models import Journal

        JOURNAUX = [
            ('JA',  'Journal des Achats',           '521'),
            ('JV',  'Journal des Ventes',            '411'),
            ('JC',  'Journal de Caisse',             '571'),
            ('JB',  'Journal de Banque',             '521'),
            ('JMM', 'Journal Mobile Money',          '581'),
            ('JOD', 'Journal des Opérations Div.',   None),
            ('JRN', 'Journal de Report à Nouveau',   None),
        ]
        journaux_map = {}
        created = 0
        for code, libelle, num in JOURNAUX:
            contrepartie = comptes.get(num) if num else None
            obj, is_new = Journal.objects.get_or_create(
                code=code,
                defaults={'libelle': libelle, 'compte_contrepartie': contrepartie}
            )
            journaux_map[code] = obj
            if is_new:
                created += 1

        self.stdout.write(f'  📒 Journaux : {created} créés / {Journal.objects.count()} total')
        return journaux_map

    # ─────────────────────────────────────────────────────────────────
    def _seed_categories(self, comptes):
        from apps.sorties.models import CategorieSortie

        CATS = [
            ('ACH-MED',  'Achats médicaments',       'achat',         '601'),
            ('ACH-CONS', 'Achats consommables',       'achat',         '602'),
            ('ACH-FOUR', 'Fournitures bureau',        'achat',         '603'),
            ('SRV-EXT',  'Services extérieurs',       'service',       '62'),
            ('SAL',      'Salaires',                  'salaire',       '641'),
            ('CHG-SOC',  'Charges sociales CNPS',     'charge_sociale','645'),
            ('INV-MAT',  'Investissement matériel',   'investissement','241'),
            ('FONC',     'Fonctionnement général',    'fonctionnement','62'),
        ]
        cats_map = {}
        created = 0
        for code, libelle, type_c, num in CATS:
            compte = comptes.get(num)
            obj, is_new = CategorieSortie.objects.get_or_create(
                code=code,
                defaults={'libelle': libelle, 'type_categorie': type_c, 'compte_comptable': compte}
            )
            cats_map[code] = obj
            if is_new:
                created += 1

        self.stdout.write(f'  🗂️  Catégories : {created} créées / {CategorieSortie.objects.count()} total')
        return cats_map

    # ─────────────────────────────────────────────────────────────────
    def _seed_fournisseurs(self, comptes):
        from apps.sorties.models import Fournisseur

        compte_401 = comptes.get('401')
        FOURNISSEURS = [
            ('Pharma-Dist SARL',    'P2024001', '699 11 22 33', 'pharma-dist@cm.com',   'BP 1234 Yaoundé'),
            ('MedEquip Cameroun',   'M2024002', '699 44 55 66', 'medequip@cm.com',      'BP 5678 Douala'),
            ('Bureau Plus',         'B2024003', '699 77 88 99', 'bureauplus@cm.com',    'BP 9012 Yaoundé'),
            ('Électricité Générale','E2024004', '699 00 11 22', 'elec@cm.com',          'BP 3456 Yaoundé'),
        ]
        fournisseurs_map = {}
        created = 0
        for raison, niu, tel, email, adresse in FOURNISSEURS:
            obj, is_new = Fournisseur.objects.get_or_create(
                niu=niu,
                defaults={
                    'raison_sociale': raison, 'telephone': tel,
                    'email': email, 'adresse': adresse,
                    'compte_comptable': compte_401, 'actif': True
                }
            )
            fournisseurs_map[raison] = obj
            if is_new:
                created += 1

        self.stdout.write(f'  🏭 Fournisseurs : {created} créés / {Fournisseur.objects.count()} total')
        return fournisseurs_map

    # ─────────────────────────────────────────────────────────────────
    def _seed_exercices(self):
        from apps.comptabilite.models import ExerciceComptable

        ex2025, _ = ExerciceComptable.objects.get_or_create(
            annee=2025,
            defaults={
                'date_debut': date(2025, 1, 1),
                'date_fin':   date(2025, 12, 31),
                'statut':     'ouvert',
            }
        )
        ex2026, _ = ExerciceComptable.objects.get_or_create(
            annee=2026,
            defaults={
                'date_debut': date(2026, 1, 1),
                'date_fin':   date(2026, 12, 31),
                'statut':     'ouvert',
            }
        )
        if ex2026.statut != 'ouvert':
            ex2026.statut = 'ouvert'
            ex2026.save(update_fields=['statut'])
        self.stdout.write(f'  📅 Exercices : 2025 ({ex2025.statut}) + 2026 ({ex2026.statut})')
        return ex2025, ex2026

    # ─────────────────────────────────────────────────────────────────
    def _seed_budgets(self, ex2025, ex2026, categories):
        from apps.comptabilite.models import BudgetPrevisionnel

        # (exercice, categorie_code, libelle, service, montant_prevu, montant_consomme, priorite)
        BUDGETS = [
            # 2025 — clôturé (consommation complète pour comparatif)
            (ex2025, 'ACH-MED',  'Budget médicaments 2025',       'pharmacie',   9_500_000, 9_100_000, 'haute'),
            (ex2025, 'ACH-CONS', 'Budget consommables 2025',      'laboratoire', 4_000_000, 3_850_000, 'haute'),
            (ex2025, 'SAL',      'Masse salariale 2025',          'chirurgie',  20_000_000, 20_000_000, 'critique'),
            (ex2025, 'CHG-SOC',  'CNPS 2025',                     'chirurgie',   3_000_000, 3_000_000, 'critique'),
            (ex2025, 'SRV-EXT',  'Services extérieurs 2025',      'maternite',   1_500_000, 1_420_000, 'normale'),
            (ex2025, 'ACH-FOUR', 'Fournitures bureau 2025',       'pediatrie',     700_000,   680_000, 'normale'),
            (ex2025, 'INV-MAT',  'Matériel médical 2025',         'chirurgie',   6_000_000, 5_800_000, 'haute'),
            (ex2025, 'FONC',     'Fonctionnement général 2025',   'laboratoire', 2_500_000, 2_400_000, 'normale'),
            (ex2025, 'ACH-MED',  'Budget neurologie 2025',        'neurologie',  2_000_000, 1_750_000, 'normale'),
            # 2026 — exercice courant (prévisions seules)
            (ex2026, 'ACH-MED',  'Budget médicaments 2026',       'pharmacie',  10_000_000, 0, 'haute'),
            (ex2026, 'ACH-CONS', 'Budget consommables 2026',      'laboratoire', 4_200_000, 0, 'haute'),
            (ex2026, 'SAL',      'Masse salariale 2026',          'chirurgie',  21_000_000, 0, 'critique'),
            (ex2026, 'CHG-SOC',  'CNPS 2026',                     'chirurgie',   3_150_000, 0, 'critique'),
            (ex2026, 'SRV-EXT',  'Services extérieurs 2026',      'maternite',   1_600_000, 0, 'normale'),
            (ex2026, 'ACH-FOUR', 'Fournitures bureau 2026',       'pediatrie',     750_000, 0, 'normale'),
            (ex2026, 'INV-MAT',  'Matériel médical 2026',         'chirurgie',   6_500_000, 0, 'haute'),
            (ex2026, 'FONC',     'Fonctionnement général 2026',   'laboratoire', 2_600_000, 0, 'normale'),
            (ex2026, 'ACH-MED',  'Budget neurologie 2026',        'neurologie',  2_200_000, 0, 'normale'),
        ]

        created = 0
        for ex, cat_code, libelle, service, prevu, consomme, priorite in BUDGETS:
            cat = categories.get(cat_code)
            if not cat:
                continue
            _, is_new = BudgetPrevisionnel.objects.get_or_create(
                exercice=ex, categorie=cat, service_hospitalier=service,
                defaults={
                    'libelle': libelle,
                    'montant_prevu': Decimal(str(prevu)),
                    'montant_consomme': Decimal(str(consomme)),
                    'priorite': priorite,
                }
            )
            if is_new:
                created += 1

        self.stdout.write(f'  💰 Budgets : {created} créés / {BudgetPrevisionnel.objects.count()} total')

    # ─────────────────────────────────────────────────────────────────
    def _creer_quittance_et_ecriture(self, ex, comptes, journaux, jour, type_recette,
                                      mode_paiement, montant, motif, patient_id,
                                      caissier_id=1, comptabiliser=True):
        """
        Crée une quittance validée par le caissier, puis génère l'écriture comptable.
        C'est exactement le flux : Caissier valide → Comptable génère écriture.
        """
        from apps.caisse.models import Quittance
        from apps.comptabilite.models import EcritureComptable, LigneEcriture

        # Mapping journal selon mode de paiement
        journal_map = {
            'especes':      'JC',
            'cheque':       'JB',
            'carte':        'JB',
            'mobile_money': 'JMM',
            'virement':     'JB',
            'assurance':    'JOD',
        }
        # Mapping compte trésorerie selon mode de paiement
        tresorerie_map = {
            'especes':      '571',
            'cheque':       '521',
            'carte':        '521',
            'mobile_money': '581',
            'virement':     '521',
            'assurance':    '4112',  # ACTIVA par défaut
        }
        # Mapping compte produit selon type de recette
        produit_map = {
            'consultation':    '701',
            'hospitalisation': '702',
            'laboratoire':     '703',
            'imagerie':        '704',
            'chirurgie':       '705',
            'pharmacie':       '706',
            'maternite':       '707',
            'pediatrie':       '708',
            'autre':           '75',
        }

        journal = journaux.get(journal_map.get(mode_paiement, 'JOD'))
        compte_tresorerie = comptes.get(tresorerie_map.get(mode_paiement, '571'))
        compte_produit = comptes.get(produit_map.get(type_recette, '75'))

        # 1. Créer la quittance (caissier valide)
        qt = Quittance.objects.create(
            montant=Decimal(str(montant)),
            motif=motif,
            type_recette=type_recette,
            mode_paiement=mode_paiement,
            est_validee=True,
            est_comptabilisee=False,
            journal=journal,
            exercice=ex,
            caissier_id=caissier_id,
            patient_id=patient_id,
        )
        # Forcer la date de création à la date souhaitée
        Quittance.objects.filter(pk=qt.pk).update(date_creation=timezone.make_aware(
            timezone.datetime(jour.year, jour.month, jour.day, 9, 0, 0)
        ))
        qt.refresh_from_db()

        if not comptabiliser:
            return qt, None

        # 2. Générer l'écriture comptable (comptable génère)
        ecriture = EcritureComptable.objects.create(
            date_ecriture=jour,
            libelle=f"Encaissement {qt.numero} — {motif}",
            journal=journal,
            exercice=ex,
            statut='validee',
            piece_justificative=qt.numero,
            quittance_id=qt.id,
            date_validation=timezone.make_aware(
                timezone.datetime(jour.year, jour.month, jour.day, 10, 0, 0)
            ),
        )
        # Débit trésorerie
        LigneEcriture.objects.create(
            ecriture=ecriture,
            compte=compte_tresorerie,
            libelle=f"Encaissement {qt.numero}",
            montant_debit=Decimal(str(montant)),
            montant_credit=None,
        )
        # Crédit produit
        LigneEcriture.objects.create(
            ecriture=ecriture,
            compte=compte_produit,
            libelle=f"Recette {type_recette} — {qt.numero}",
            montant_debit=None,
            montant_credit=Decimal(str(montant)),
        )

        # Marquer la quittance comme comptabilisée
        Quittance.objects.filter(pk=qt.pk).update(est_comptabilisee=True)

        return qt, ecriture

    # ─────────────────────────────────────────────────────────────────
    def _creer_ecriture_charge(self, ex, comptes, journaux, jour, compte_charge_num,
                                compte_tresorerie_num, montant, libelle):
        """Crée une écriture de charge (dépense) : Débit charge / Crédit trésorerie."""
        from apps.comptabilite.models import EcritureComptable, LigneEcriture

        compte_charge = comptes.get(compte_charge_num)
        compte_tres = comptes.get(compte_tresorerie_num)
        journal = journaux.get('JA')

        ecriture = EcritureComptable.objects.create(
            date_ecriture=jour,
            libelle=libelle,
            journal=journal,
            exercice=ex,
            statut='validee',
            date_validation=timezone.make_aware(
                timezone.datetime(jour.year, jour.month, jour.day, 14, 0, 0)
            ),
        )
        LigneEcriture.objects.create(
            ecriture=ecriture, compte=compte_charge,
            libelle=libelle,
            montant_debit=Decimal(str(montant)), montant_credit=None,
        )
        LigneEcriture.objects.create(
            ecriture=ecriture, compte=compte_tres,
            libelle=libelle,
            montant_debit=None, montant_credit=Decimal(str(montant)),
        )
        return ecriture

    # ─────────────────────────────────────────────────────────────────
    def _seed_exercice_2025_historique(self, ex2025, comptes, journaux):
        """Exercice 2025 — 12 mois comptabilisés (archives avant clôture)."""
        self.stdout.write('\n  📆 Génération historique exercice 2025 (12 mois comptabilisés)...')

        MOIS_2025 = [
            # Jan
            (1, [
                ('consultation',    'especes',     25000,  'Consultation générale',        101),
                ('consultation',    'especes',     25000,  'Consultation générale',        102),
                ('consultation',    'mobile_money',50000,  'Consultation spécialisée',     103),
                ('laboratoire',     'especes',     40000,  'Analyse NFS',                  104),
                ('laboratoire',     'especes',     25000,  'Analyse urine',                105),
                ('hospitalisation', 'virement',   175000,  'Hospitalisation 3 jours',      106),
                ('pharmacie',       'especes',    150000,  'Dispensation médicaments',     107),
                ('imagerie',        'especes',     75000,  'Radiographie thorax',          108),
                ('consultation',    'assurance',  100000,  'Consultation spécialisée',     109),
                ('chirurgie',       'cheque',     250000,  'Acte chirurgical mineur',      110),
                ('hospitalisation', 'virement',   350000,  'Hospitalisation longue durée', 111),
                ('maternite',       'especes',    375000,  'Accouchement normal',          112),
                ('laboratoire',     'especes',    120000,  'Bilan complet',                113),
                ('imagerie',        'especes',    125000,  'Échographie',                  114),
                ('pharmacie',       'mobile_money',200000, 'Médicaments chroniques',       115),
            ], 1_800_000),
            # Fév
            (2, [
                ('consultation',    'especes',      5000,  'Consultation générale',        111),
                ('consultation',    'especes',      5000,  'Consultation générale',        112),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  113),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 5 jours',      114),
                ('pharmacie',       'mobile_money', 12000, 'Dispensation médicaments',     115),
                ('imagerie',        'especes',     25000,  'Échographie abdominale',       116),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     117),
                ('maternite',       'especes',     75000,  'Accouchement normal',          118),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical mineur',      119),
                ('consultation',    'especes',      5000,  'Consultation générale',        120),
            ], 3_100_000),
            # Mar
            (3, [
                ('consultation',    'especes',      5000,  'Consultation générale',        121),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  122),
                ('laboratoire',     'mobile_money', 5000,  'Test paludisme',               123),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 4 jours',      124),
                ('pharmacie',       'especes',      9000,  'Dispensation médicaments',     125),
                ('imagerie',        'especes',     15000,  'Radiographie',                 126),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     127),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             128),
                ('maternite',       'especes',     75000,  'Accouchement normal',          129),
                ('consultation',    'especes',      5000,  'Consultation générale',        130),
                ('laboratoire',     'especes',      3500,  'Groupe sanguin',               131),
            ], 3_400_000),
            # Avr
            (4, [
                ('consultation',    'especes',      5000,  'Consultation générale',        132),
                ('consultation',    'especes',      5000,  'Consultation générale',        133),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  134),
                ('hospitalisation', 'virement',    70000,  'Hospitalisation 6 jours',      135),
                ('pharmacie',       'especes',     11000,  'Dispensation médicaments',     136),
                ('imagerie',        'especes',     25000,  'Échographie',                  137),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     138),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             139),
                ('consultation',    'especes',      5000,  'Consultation générale',        140),
            ], 3_300_000),
            # Mai
            (5, [
                ('consultation',    'especes',      5000,  'Consultation générale',        141),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  142),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      143),
                ('pharmacie',       'mobile_money', 8500,  'Dispensation médicaments',     144),
                ('imagerie',        'especes',     15000,  'Radiographie',                 145),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     146),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             147),
                ('maternite',       'especes',     75000,  'Accouchement normal',          148),
                ('consultation',    'especes',      5000,  'Consultation générale',        149),
                ('laboratoire',     'especes',      5000,  'Analyse urine',                150),
                ('consultation',    'especes',      5000,  'Consultation générale',        151),
            ], 3_500_000),
            # Jun
            (6, [
                ('consultation',    'especes',      5000,  'Consultation générale',        152),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  153),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      154),
                ('pharmacie',       'especes',     13000,  'Dispensation médicaments',     155),
                ('imagerie',        'especes',     25000,  'Échographie',                  156),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     157),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             158),
                ('consultation',    'especes',      5000,  'Consultation générale',        159),
                ('laboratoire',     'especes',      2000,  'Test paludisme',               160),
            ], 3_200_000),
            # Jul
            (7, [
                ('consultation',    'especes',      5000,  'Consultation générale',        161),
                ('consultation',    'especes',      5000,  'Consultation générale',        162),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  163),
                ('hospitalisation', 'virement',    70000,  'Hospitalisation 6 jours',      164),
                ('pharmacie',       'mobile_money', 9500,  'Dispensation médicaments',     165),
                ('imagerie',        'especes',     15000,  'Radiographie',                 166),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     167),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             168),
                ('maternite',       'especes',     75000,  'Accouchement normal',          169),
                ('consultation',    'especes',      5000,  'Consultation générale',        170),
                ('laboratoire',     'especes',      5000,  'Analyse urine',                171),
                ('consultation',    'especes',      5000,  'Consultation générale',        172),
            ], 3_600_000),
            # Aoû
            (8, [
                ('consultation',    'especes',      5000,  'Consultation générale',        173),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  174),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      175),
                ('pharmacie',       'especes',     10000,  'Dispensation médicaments',     176),
                ('imagerie',        'especes',     25000,  'Échographie',                  177),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     178),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             179),
                ('consultation',    'especes',      5000,  'Consultation générale',        180),
            ], 3_100_000),
            # Sep
            (9, [
                ('consultation',    'especes',      5000,  'Consultation générale',        181),
                ('consultation',    'especes',      5000,  'Consultation générale',        182),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  183),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      184),
                ('pharmacie',       'mobile_money', 11000, 'Dispensation médicaments',     185),
                ('imagerie',        'especes',     15000,  'Radiographie',                 186),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     187),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             188),
                ('maternite',       'especes',     75000,  'Accouchement normal',          189),
                ('consultation',    'especes',      5000,  'Consultation générale',        190),
            ], 3_400_000),
            # Oct
            (10, [
                ('consultation',    'especes',      5000,  'Consultation générale',        191),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  192),
                ('hospitalisation', 'virement',    70000,  'Hospitalisation 6 jours',      193),
                ('pharmacie',       'especes',     14000,  'Dispensation médicaments',     194),
                ('imagerie',        'especes',     25000,  'Échographie',                  195),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     196),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             197),
                ('consultation',    'especes',      5000,  'Consultation générale',        198),
                ('laboratoire',     'especes',      5000,  'Analyse urine',                199),
            ], 3_500_000),
            # Nov
            (11, [
                ('consultation',    'especes',      5000,  'Consultation générale',        200),
                ('consultation',    'especes',      5000,  'Consultation générale',        201),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  202),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      203),
                ('pharmacie',       'mobile_money', 9000,  'Dispensation médicaments',     204),
                ('imagerie',        'especes',     15000,  'Radiographie',                 205),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     206),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             207),
                ('maternite',       'especes',     75000,  'Accouchement normal',          208),
                ('consultation',    'especes',      5000,  'Consultation générale',        209),
            ], 3_300_000),
            # Déc
            (12, [
                ('consultation',    'especes',      5000,  'Consultation générale',        210),
                ('consultation',    'especes',      5000,  'Consultation générale',        211),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  212),
                ('hospitalisation', 'virement',    70000,  'Hospitalisation 6 jours',      213),
                ('pharmacie',       'especes',     16000,  'Dispensation médicaments',     214),
                ('imagerie',        'especes',     25000,  'Échographie',                  215),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     216),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             217),
                ('maternite',       'especes',     75000,  'Accouchement normal',          218),
                ('consultation',    'especes',      5000,  'Consultation générale',        219),
                ('laboratoire',     'especes',      5000,  'Analyse urine',                220),
                ('consultation',    'especes',      5000,  'Consultation générale',        221),
            ], 3_700_000),
        ]

        total_qt = 0
        total_ec = 0
        for mois, quittances, charges_mensuelles in MOIS_2025:
            jour_qt = date(2025, mois, 15)
            for type_r, mode, montant, motif, patient_id in quittances:
                qt, ec = self._creer_quittance_et_ecriture(
                    ex2025, comptes, journaux, jour_qt,
                    type_r, mode, montant, motif, patient_id,
                    comptabiliser=True
                )
                total_qt += 1
                if ec:
                    total_ec += 1

            # Écriture de charges mensuelles (salaires + achats)
            jour_charge = date(2025, mois, 28)
            # Charges = 65% des recettes du mois pour avoir un résultat positif ~35%
            recettes_mois = sum(m for _, _, m, _, _ in quittances)
            charges_total = int(recettes_mois * 0.65)
            sal    = int(charges_total * 0.55)
            achats = int(charges_total * 0.30)
            autres = charges_total - sal - achats

            self._creer_ecriture_charge(
                ex2025, comptes, journaux, jour_charge,
                '641', '521', sal, f"Salaires {mois:02d}/2025"
            )
            self._creer_ecriture_charge(
                ex2025, comptes, journaux, jour_charge,
                '601', '521', achats, f"Achats médicaments {mois:02d}/2025"
            )
            self._creer_ecriture_charge(
                ex2025, comptes, journaux, jour_charge,
                '62', '521', autres, f"Services extérieurs {mois:02d}/2025"
            )
            total_ec += 3

        self.stdout.write(f'    ✓ 2025 : {total_qt} quittances + {total_ec} écritures (exercice 2026 laissé vide)')

    # ─────────────────────────────────────────────────────────────────
    def _seed_exercice_2025_legacy_removed(self, ex2025, comptes, journaux):
        """
        Exercice 2025 — En cours (Jan–Mai comptabilisés, Jun–présent en attente).
        Quittances de Jan à Mai : comptabilisées.
        Quittances de Jun à présent : validées par caissier mais PAS encore comptabilisées
        → C'est ce que le comptable verra dans "Quittances à Comptabiliser".
        """
        self.stdout.write('\n  📆 Génération exercice 2025...')

        MOIS_COMPTABILISES = [
            # Jan 2025
            (1, [
                ('consultation',    'especes',      5000,  'Consultation générale',        301),
                ('consultation',    'especes',      5000,  'Consultation générale',        302),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  303),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      304),
                ('pharmacie',       'especes',      9500,  'Dispensation médicaments',     305),
                ('imagerie',        'especes',     15000,  'Radiographie',                 306),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     307),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             308),
                ('maternite',       'especes',     75000,  'Accouchement normal',          309),
                ('consultation',    'especes',      5000,  'Consultation générale',        310),
            ], 3_500_000),
            # Fév 2025
            (2, [
                ('consultation',    'especes',      5000,  'Consultation générale',        311),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  312),
                ('hospitalisation', 'virement',    70000,  'Hospitalisation 6 jours',      313),
                ('pharmacie',       'mobile_money', 11000, 'Dispensation médicaments',     314),
                ('imagerie',        'especes',     25000,  'Échographie',                  315),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     316),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             317),
                ('consultation',    'especes',      5000,  'Consultation générale',        318),
                ('laboratoire',     'especes',      5000,  'Analyse urine',                319),
            ], 3_600_000),
            # Mar 2025
            (3, [
                ('consultation',    'especes',      5000,  'Consultation générale',        320),
                ('consultation',    'especes',      5000,  'Consultation générale',        321),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  322),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      323),
                ('pharmacie',       'especes',     13000,  'Dispensation médicaments',     324),
                ('imagerie',        'especes',     15000,  'Radiographie',                 325),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     326),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             327),
                ('maternite',       'especes',     75000,  'Accouchement normal',          328),
                ('consultation',    'especes',      5000,  'Consultation générale',        329),
                ('laboratoire',     'especes',      2000,  'Test paludisme',               330),
            ], 3_800_000),
            # Avr 2025
            (4, [
                ('consultation',    'especes',      5000,  'Consultation générale',        331),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  332),
                ('hospitalisation', 'virement',    70000,  'Hospitalisation 6 jours',      333),
                ('pharmacie',       'especes',     15000,  'Dispensation médicaments',     334),
                ('imagerie',        'especes',     25000,  'Échographie',                  335),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     336),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             337),
                ('consultation',    'especes',      5000,  'Consultation générale',        338),
                ('maternite',       'especes',     75000,  'Accouchement normal',          339),
            ], 3_700_000),
            # Mai 2025
            (5, [
                ('consultation',    'especes',      5000,  'Consultation générale',        340),
                ('consultation',    'especes',      5000,  'Consultation générale',        341),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  342),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      343),
                ('pharmacie',       'mobile_money', 12000, 'Dispensation médicaments',     344),
                ('imagerie',        'especes',     15000,  'Radiographie',                 345),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     346),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             347),
                ('consultation',    'especes',      5000,  'Consultation générale',        348),
                ('laboratoire',     'especes',      5000,  'Analyse urine',                349),
            ], 3_900_000),
        ]

        # Quittances en attente de comptabilisation (Jun–présent 2025)
        # Le caissier a validé, mais le comptable n'a pas encore généré les écritures
        MOIS_EN_ATTENTE = [
            (6, [
                ('consultation',    'especes',      5000,  'Consultation générale',        350),
                ('consultation',    'especes',      5000,  'Consultation générale',        351),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  352),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      353),
                ('pharmacie',       'especes',     14000,  'Dispensation médicaments',     354),
                ('imagerie',        'especes',     25000,  'Échographie',                  355),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     356),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             357),
                ('maternite',       'especes',     75000,  'Accouchement normal',          358),
            ]),
            (7, [
                ('consultation',    'especes',      5000,  'Consultation générale',        359),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  360),
                ('hospitalisation', 'virement',    70000,  'Hospitalisation 6 jours',      361),
                ('pharmacie',       'mobile_money', 11000, 'Dispensation médicaments',     362),
                ('imagerie',        'especes',     15000,  'Radiographie',                 363),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     364),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             365),
                ('consultation',    'especes',      5000,  'Consultation générale',        366),
            ]),
            (8, [
                ('consultation',    'especes',      5000,  'Consultation générale',        367),
                ('consultation',    'especes',      5000,  'Consultation générale',        368),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  369),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      370),
                ('pharmacie',       'especes',     16000,  'Dispensation médicaments',     371),
                ('imagerie',        'especes',     25000,  'Échographie',                  372),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     373),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             374),
                ('maternite',       'especes',     75000,  'Accouchement normal',          375),
                ('consultation',    'especes',      5000,  'Consultation générale',        376),
            ]),
            (9, [
                ('consultation',    'especes',      5000,  'Consultation générale',        377),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  378),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      379),
                ('pharmacie',       'mobile_money', 13000, 'Dispensation médicaments',     380),
                ('imagerie',        'especes',     15000,  'Radiographie',                 381),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     382),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             383),
                ('consultation',    'especes',      5000,  'Consultation générale',        384),
            ]),
            (10, [
                ('consultation',    'especes',      5000,  'Consultation générale',        385),
                ('consultation',    'especes',      5000,  'Consultation générale',        386),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  387),
                ('hospitalisation', 'virement',    70000,  'Hospitalisation 6 jours',      388),
                ('pharmacie',       'especes',     18000,  'Dispensation médicaments',     389),
                ('imagerie',        'especes',     25000,  'Échographie',                  390),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     391),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             392),
                ('maternite',       'especes',     75000,  'Accouchement normal',          393),
                ('consultation',    'especes',      5000,  'Consultation générale',        394),
                ('laboratoire',     'especes',      5000,  'Analyse urine',                395),
            ]),
            (11, [
                ('consultation',    'especes',      5000,  'Consultation générale',        396),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  397),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      398),
                ('pharmacie',       'especes',     14000,  'Dispensation médicaments',     399),
                ('imagerie',        'especes',     15000,  'Radiographie',                 400),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     401),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             402),
                ('consultation',    'especes',      5000,  'Consultation générale',        403),
            ]),
            (12, [
                ('consultation',    'especes',      5000,  'Consultation générale',        404),
                ('consultation',    'especes',      5000,  'Consultation générale',        405),
                ('laboratoire',     'especes',      8000,  'Analyse NFS',                  406),
                ('hospitalisation', 'virement',    35000,  'Hospitalisation 3 jours',      407),
                ('pharmacie',       'mobile_money', 20000, 'Dispensation médicaments',     408),
                ('imagerie',        'especes',     25000,  'Échographie',                  409),
                ('consultation',    'assurance',   10000,  'Consultation spécialisée',     410),
                ('chirurgie',       'cheque',      50000,  'Acte chirurgical',             411),
                ('maternite',       'especes',     75000,  'Accouchement normal',          412),
                ('consultation',    'especes',      5000,  'Consultation générale',        413),
                ('laboratoire',     'especes',      5000,  'Analyse urine',                414),
            ]),
        ]

        total_qt = 0
        total_ec = 0

        # Mois comptabilisés (Jan–Mai)
        for mois, quittances, charges_mensuelles in MOIS_COMPTABILISES:
            jour_qt = date(2025, mois, 15)
            for type_r, mode, montant, motif, patient_id in quittances:
                self._creer_quittance_et_ecriture(
                    ex2025, comptes, journaux, jour_qt,
                    type_r, mode, montant, motif, patient_id,
                    comptabiliser=True
                )
                total_qt += 1
                total_ec += 1

            # Charges mensuelles
            jour_charge = date(2025, mois, 28)
            recettes_mois = sum(m for _, _, m, _, _ in quittances)
            charges_total = int(recettes_mois * 0.65)
            sal    = int(charges_total * 0.55)
            achats = int(charges_total * 0.30)
            autres = charges_total - sal - achats
            self._creer_ecriture_charge(ex2025, comptes, journaux, jour_charge, '641', '521', sal, f"Salaires {mois:02d}/2025")
            self._creer_ecriture_charge(ex2025, comptes, journaux, jour_charge, '601', '521', achats, f"Achats médicaments {mois:02d}/2025")
            self._creer_ecriture_charge(ex2025, comptes, journaux, jour_charge, '62', '521', autres, f"Services extérieurs {mois:02d}/2025")
            total_ec += 3

        # Mois en attente (Jun–Déc) — quittances validées par caissier, PAS comptabilisées
        for mois, quittances in MOIS_EN_ATTENTE:
            jour_qt = date(2025, mois, 15)
            for type_r, mode, montant, motif, patient_id in quittances:
                self._creer_quittance_et_ecriture(
                    ex2025, comptes, journaux, jour_qt,
                    type_r, mode, montant, motif, patient_id,
                    comptabiliser=False  # ← Caissier a validé, comptable n'a pas encore agi
                )
                total_qt += 1

        self.stdout.write(f'    ✓ 2025 : {total_qt} quittances ({len(MOIS_EN_ATTENTE) * 9} en attente de comptabilisation) + {total_ec} écritures')

    # ─────────────────────────────────────────────────────────────────
    def _seed_ordres_paiement(self, fournisseurs):
        """Ordres de paiement à différents statuts pour tester le flux."""
        from apps.sorties.models import OrdrePaiement

        OPS = [
            ('fournisseur', 450_000, 'cheque',   'approuve_directeur', 'Pharma-Dist SARL'),
            ('fournisseur', 280_000, 'virement', 'approuve_directeur', 'MedEquip Cameroun'),
            ('fournisseur', 125_000, 'caisse',   'valide_comptable',   'Bureau Plus'),
            ('charge',      350_000, 'virement', 'approuve_directeur', 'Électricité Générale'),
            ('salaire',   1_500_000, 'virement', 'execute',            'Masse salariale Oct 2025'),
            ('fournisseur', 180_000, 'cheque',   'brouillon',          'Pharma-Dist SARL'),
            ('charge',       75_000, 'caisse',   'valide_comptable',   'Entretien locaux'),
        ]

        created = 0
        for type_s, montant, mode, statut, beneficiaire in OPS:
            op = OrdrePaiement.objects.create(
                type_sortie=type_s,
                montant=Decimal(str(montant)),
                mode_paiement=mode,
                statut=statut,
                beneficiaire=beneficiaire,
                est_comptabilise=(statut == 'execute'),
            )
            created += 1

        self.stdout.write(f'  📜 Ordres de paiement : {created} créés')

    # ─────────────────────────────────────────────────────────────────
    def _seed_caisse_journaliere(self, ex2025):
        """Crée quelques caisses journalières pour tester l'ouverture/fermeture."""
        from apps.caisse.models import CaisseJournaliere, DepenseMenue
        from apps.sorties.models import CategorieSortie

        cat_fonc = CategorieSortie.objects.filter(code='FONC').first()

        CAISSES = [
            # (date, solde_ouverture, solde_physique, statut)
            (date(2025, 11, 20), 50_000, 187_500, 'fermee'),
            (date(2025, 11, 21), 187_500, 245_000, 'fermee'),
            (date(2025, 11, 22), 245_000, 198_000, 'fermee'),
            (date(2025, 11, 24), 198_000, 312_000, 'fermee'),
            (date(2025, 12, 31), 312_000, 298_000, 'fermee'),
        ]

        created = 0
        for jour, solde_ouv, solde_phys, statut in CAISSES:
            if CaisseJournaliere.objects.filter(date=jour).exists():
                continue
            caisse = CaisseJournaliere.objects.create(
                date=jour,
                solde_ouverture=Decimal(str(solde_ouv)),
                solde_theorique=Decimal(str(solde_ouv)),
                statut=statut,
                caissier_id=1,
            )
            if statut == 'fermee' and solde_phys:
                # Calculer l'écart
                ecart = Decimal(str(solde_phys)) - Decimal(str(solde_ouv))
                CaisseJournaliere.objects.filter(pk=caisse.pk).update(
                    solde_physique=Decimal(str(solde_phys)),
                    solde_theorique=Decimal(str(solde_phys - 2000)),  # léger écart simulé
                    ecart=Decimal('2000'),
                )
            # Ajouter quelques dépenses menues
            if statut == 'fermee':
                DepenseMenue.objects.create(
                    caisse=caisse,
                    montant=Decimal('2500'),
                    motif='Achat stylos et cahiers',
                    categorie_sortie=cat_fonc,
                    caissier_id=1,
                )
            created += 1

        self.stdout.write(f'  🏦 Caisses journalières : {created} créées')

    def _seed_exercice_2026_caissier(self, ex2026, comptes, journaux):
        """Quittances 2026 pour tester le module caissier (multi-modes)."""
        from apps.caisse.models import (
            Quittance, Cheque, PaiementMobile, PaiementCarte, VirementBancaire,
        )
        from apps.messaging.patient_cache import upsert_patient

        if not ex2026:
            return

        today = date.today()
        patients = [
            ('patient-demo-001', 'Ewane', 'Nehemie', '26F0001'),
            ('patient-demo-002', 'Mbarga', 'Paul', '26F0002'),
            ('patient-demo-003', 'Nkomo', 'Marie', '26F0003'),
        ]
        for pid, nom, prenom, matricule in patients:
            upsert_patient({
                'patient_id': pid,
                'nom': nom,
                'prenom': prenom,
                'matricule': matricule,
            })

        samples = [
            (today - timedelta(days=2), 'consultation', 'especes', 15_000, 'Consultation', 'patient-demo-001', None, True),
            (today - timedelta(days=1), 'laboratoire', 'mobile_money', 8_000, 'NFS', 'patient-demo-001', 'mobile', True),
            (today, 'consultation', 'cheque', 15_000, 'Consultation', 'patient-demo-002', 'cheque', False),
            (today, 'imagerie', 'carte', 150_000, 'IRM', 'patient-demo-002', 'carte', False),
            (today - timedelta(days=5), 'consultation', 'virement', 15_000, 'Consultation', 'patient-demo-003', 'virement', True),
            (today, 'consultation', 'assurance', 20_000, 'Consultation assurée', 'patient-demo-003', 'assurance', False),
        ]

        created = 0
        comptabilisees = 0
        for jour, type_rec, mode, montant, motif, patient_id, detail, comptabiliser in samples:
            if Quittance.objects.filter(
                patient_id=patient_id, motif=motif, exercice=ex2026,
            ).exists():
                continue
            qt, ec = self._creer_quittance_et_ecriture(
                ex2026, comptes, journaux, jour, type_rec, mode, montant,
                motif, patient_id, caissier_id=1, comptabiliser=comptabiliser,
            )
            if detail == 'mobile':
                PaiementMobile.objects.create(
                    quittance=qt, operateur='orange',
                    numero_payant='699001122', reference_transaction='MM-2026-001',
                )
            elif detail == 'cheque':
                Cheque.objects.create(
                    quittance=qt, numero='CHQ-88421',
                    banque='Afriland', titulaire='Mbarga Paul',
                )
            elif detail == 'carte':
                PaiementCarte.objects.create(
                    quittance=qt, quatre_derniers_chiffres='4242',
                    reference_transaction='CB-2026-99', id_terminal='TPE-01',
                )
            elif detail == 'virement':
                VirementBancaire.objects.create(
                    quittance=qt, banque_emettrice='BICEC',
                    reference='VIR-2026-55', date_virement=jour,
                )
            elif detail == 'assurance':
                Quittance.objects.filter(pk=qt.pk).update(
                    est_assure=True,
                    taux_couverture=Decimal('80'),
                    montant_assurance=Decimal('16000'),
                    montant_patient=Decimal('4000'),
                )
            created += 1
            if comptabiliser:
                comptabilisees += 1

        self.stdout.write(
            f'  💳 Quittances caissier 2026 : {created} créées '
            f'({comptabilisees} comptabilisées, {created - comptabilisees} en attente)'
        )

    # ─────────────────────────────────────────────────────────────────
    def _cloturer_exercice(self, exercice):
        """Clôture l'exercice historique et ouvre l'exercice N+1."""
        from apps.comptabilite.models import LigneEcriture, ExerciceComptable
        from django.db.models import Sum

        lignes = LigneEcriture.objects.filter(ecriture__exercice=exercice, ecriture__statut='validee')

        produits = lignes.filter(compte__classe='7').aggregate(
            debit=Sum('montant_debit'), credit=Sum('montant_credit')
        )
        charges = lignes.filter(compte__classe='6').aggregate(
            debit=Sum('montant_debit'), credit=Sum('montant_credit')
        )

        total_produits = float((produits['credit'] or 0) - (produits['debit'] or 0))
        total_charges  = float((charges['debit'] or 0) - (charges['credit'] or 0))
        resultat_net   = total_produits - total_charges

        exercice.statut = 'cloture'
        exercice.resultat_net = Decimal(str(round(resultat_net, 2)))
        exercice.date_cloture = timezone.make_aware(timezone.datetime(2026, 1, 15, 10, 0, 0))
        exercice.save()

        ex_suivant = ExerciceComptable.objects.filter(annee=exercice.annee + 1).first()
        if ex_suivant:
            ex_suivant.statut = 'ouvert'
            ex_suivant.save(update_fields=['statut'])

        self.stdout.write(
            f'\n  🔒 Exercice {exercice.annee} clôturé — '
            f'Produits: {total_produits:,.0f} FCFA | '
            f'Charges: {total_charges:,.0f} FCFA | '
            f'Résultat: {resultat_net:,.0f} FCFA'
        )
        if ex_suivant:
            self.stdout.write(f'  📂 Exercice {ex_suivant.annee} ouvert (vide, prêt pour l\'activité courante)')

    # ─────────────────────────────────────────────────────────────────
    # ─────────────────────────────────────────────────────────────────
    def _generer_report_nouveau(self, exercice_cloture):
        """Génère le report à nouveau (JRN) de l'exercice clôturé vers N+1.

        Reporte les soldes bilan (classes 1-5) sur l'exercice suivant,
        de sorte que la trésorerie 2026 inclut les soldes accumulés en 2025.
        """
        from apps.comptabilite.tresorerie_helper import generer_report_nouveau

        result = generer_report_nouveau(exercice_cloture)
        if result is None:
            self.stdout.write(self.style.WARNING(
                f'  ⚠ Report à nouveau : exercice {exercice_cloture.annee + 1} inexistant.'
            ))
        elif result.get('error'):
            self.stdout.write(self.style.ERROR(f'  ✗ Report à nouveau : {result["error"]}'))
        elif result.get('skipped'):
            self.stdout.write(f'  ℹ Report à nouveau : {result["message"]}')
        else:
            self.stdout.write(
                f'  📜 Report à nouveau généré → exercice {result["exercice_cible"]} '
                f'({result["comptes_reportes"]} comptes reportés, '
                f'trésorerie reportée : {result.get("tresorerie_reportee", 0):,.0f} FCFA)'
            )

    # ─────────────────────────────────────────────────────────────────
    def _rebuild_audit_trail(self):
        """Reconstruit la piste d'audit à partir des entités seedées (caissier, comptable, directeur)."""
        from apps.comptabilite.models import AuditLog, EcritureComptable, BudgetPrevisionnel, ExerciceComptable
        from apps.caisse.models import Quittance, CaisseJournaliere, DepenseMenue
        from apps.sorties.models import OrdrePaiement

        AuditLog.objects.all().delete()

        ACTORS = {
            'caissier': (1, 'Paul Talla', 'caissier'),
            'comptable': (2, 'Isaac Njoya', 'comptable_financier'),
            'directeur': (3, 'Fultang Directeur', 'directeur'),
        }

        def _log(actor, action, module, description, objet_id=None, objet_reference=None):
            uid, name, role = ACTORS[actor]
            AuditLog.log(
                action=action,
                module=module,
                description=description,
                objet_id=objet_id,
                objet_reference=objet_reference,
                utilisateur_id=uid,
                utilisateur_nom=name,
                role_utilisateur=role,
            )

        for caisse in CaisseJournaliere.objects.order_by('date'):
            _log(
                'caissier', 'creation', 'caisse',
                f'Ouverture caisse {caisse.date} — solde {float(caisse.solde_ouverture or 0):,.0f} FCFA',
                objet_id=caisse.id,
            )
            if caisse.statut == 'fermee':
                _log(
                    'caissier', 'cloture', 'caisse',
                    f'Fermeture caisse {caisse.date}',
                    objet_id=caisse.id,
                )

        for qt in Quittance.objects.filter(est_validee=True).order_by('date_creation')[:50]:
            _log(
                'caissier', 'validation', 'quittance',
                f'Validation quittance {qt.numero} — {float(qt.montant or 0):,.0f} FCFA',
                objet_id=qt.id, objet_reference=qt.numero,
            )
            if qt.est_comptabilisee:
                ec = EcritureComptable.objects.filter(quittance_id=qt.id).first()
                _log(
                    'comptable', 'validation', 'ecriture',
                    f'Comptabilisation quittance {qt.numero}'
                    + (f' — écriture {ec.numero_ecriture}' if ec else ''),
                    objet_id=ec.id if ec else qt.id,
                    objet_reference=ec.numero_ecriture if ec else qt.numero,
                )

        for dep in DepenseMenue.objects.order_by('date_creation')[:30]:
            _log(
                'caissier', 'creation', 'caisse',
                f'Dépense menue {float(dep.montant or 0):,.0f} FCFA — {dep.motif}',
                objet_id=dep.id,
            )

        for budget in BudgetPrevisionnel.objects.order_by('id')[:30]:
            _log(
                'comptable', 'creation', 'budget',
                f'Allocation budget « {budget.libelle} » — {float(budget.montant_prevu or 0):,.0f} FCFA',
                objet_id=budget.id, objet_reference=budget.libelle,
            )

        for ex in ExerciceComptable.objects.filter(statut='cloture'):
            _log(
                'comptable', 'cloture', 'exercice',
                f'Clôture exercice {ex.annee} — résultat {float(ex.resultat_net or 0):,.0f} FCFA',
                objet_id=ex.id, objet_reference=f'EX-{ex.annee}',
            )

        for op in OrdrePaiement.objects.filter(statut__in=['execute', 'comptabilise']).order_by('id')[:20]:
            _log(
                'comptable', 'validation', 'ordre_paiement',
                f'Exécution ordre de paiement {op.numero} — {float(op.montant or 0):,.0f} FCFA',
                objet_id=op.id, objet_reference=op.numero,
            )
            _log(
                'directeur', 'validation', 'ordre_paiement',
                f'Approbation directeur ordre de paiement {op.numero}',
                objet_id=op.id, objet_reference=op.numero,
            )

        count = AuditLog.objects.count()
        self.stdout.write(f'  📋 Piste d\'audit reconstruite : {count} événements')

    def _print_summary(self):
        from apps.caisse.models import Quittance, CaisseJournaliere
        from apps.comptabilite.models import (
            CompteComptable, Journal, EcritureComptable, LigneEcriture,
            ExerciceComptable, BudgetPrevisionnel
        )
        from apps.sorties.models import OrdrePaiement, Fournisseur
        from apps.comptabilite.models import AuditLog

        self.stdout.write(self.style.SUCCESS('\n══════════════════════════════════════════'))
        self.stdout.write(self.style.SUCCESS('  ✅ SEED TERMINÉ — Résumé'))
        self.stdout.write(self.style.SUCCESS('══════════════════════════════════════════'))
        self.stdout.write(f'  Comptes comptables  : {CompteComptable.objects.count()}')
        self.stdout.write(f'  Journaux            : {Journal.objects.count()}')
        self.stdout.write(f'  Exercices           : {ExerciceComptable.objects.count()}')
        self.stdout.write(f'  Budgets             : {BudgetPrevisionnel.objects.count()}')
        self.stdout.write(f'  Quittances totales  : {Quittance.objects.count()}')
        qt_validees = Quittance.objects.filter(est_validee=True).count()
        qt_compta   = Quittance.objects.filter(est_comptabilisee=True).count()
        qt_attente  = Quittance.objects.filter(est_validee=True, est_comptabilisee=False).count()
        self.stdout.write(f'    → Validées         : {qt_validees}')
        self.stdout.write(f'    → Comptabilisées   : {qt_compta}')
        self.stdout.write(f'    → En attente compta: {qt_attente}  ← Le comptable verra ces quittances')
        self.stdout.write(f'  Écritures comptables: {EcritureComptable.objects.count()}')
        self.stdout.write(f'  Lignes d\'écriture   : {LigneEcriture.objects.count()}')
        self.stdout.write(f'  Ordres de paiement  : {OrdrePaiement.objects.count()}')
        self.stdout.write(f'  Fournisseurs        : {Fournisseur.objects.count()}')
        self.stdout.write(f'  Caisses journalières: {CaisseJournaliere.objects.count()}')
        self.stdout.write(f'  Événements audit    : {AuditLog.objects.count()}')

        for ex in ExerciceComptable.objects.all().order_by('annee'):
            self.stdout.write(f'\n  Exercice {ex.annee} ({ex.statut}):')
            qt_ex = Quittance.objects.filter(exercice=ex)
            ec_ex = EcritureComptable.objects.filter(exercice=ex)
            self.stdout.write(f'    Quittances : {qt_ex.count()} | Écritures : {ec_ex.count()}')
            if ex.resultat_net:
                self.stdout.write(f'    Résultat net : {float(ex.resultat_net):,.0f} FCFA')
            # Report à nouveau (JRN)
            jrn_count = ec_ex.filter(journal__code='JRN', statut='validee').count()
            if jrn_count:
                self.stdout.write(f'    Report à nouveau (JRN) : {jrn_count} écriture(s) de report')

        # Trésorerie exercice courant
        ex_courant = ExerciceComptable.objects.filter(statut='ouvert').first()
        if ex_courant:
            from apps.comptabilite.tresorerie_helper import get_tresorerie_detail
            tres = get_tresorerie_detail(ex_courant)
            self.stdout.write(f'\n  💰 Trésorerie exercice {ex_courant.annee} :')
            self.stdout.write(f'     Solde total (cl. 5)        : {tres["solde"]:,.0f} FCFA')
            self.stdout.write(f'     Report à nouveau (JRN)     : {tres["solde_report_a_nouveau"]:,.0f} FCFA')
            self.stdout.write(f'     Mouvements exercice courant: {tres["solde_mouvements_exercice"]:,.0f} FCFA')
            if tres['report_manquant']:
                self.stdout.write(self.style.WARNING('     ⚠ Report à nouveau MANQUANT depuis exercice précédent'))
            else:
                self.stdout.write(self.style.SUCCESS('     ✓ Report à nouveau OK'))

        self.stdout.write('\n  🔑 Exercice courant : 2026')
        self.stdout.write('     Historique & comparatif : exercice 2025 clôturé (onglet Exercices)')
        self.stdout.write('     Trésorerie : inclut report à nouveau depuis 2025 (JRN)')
        self.stdout.write('     Caissier : paul.talla@fultang.local / Fultang@123')
        self.stdout.write('     Comptable financier : i.njoya@fultang.local / Fultang@123')
        self.stdout.write('     Comptable matière : a.matiere@fultang.local / Fultang@123\n')

