#!/usr/bin/env python
"""
seed_medical.py — Peuplement de démonstration pour Medical-Monitoring
=====================================================================
Crée 20 patients fictifs avec adresses, contacts et visites médicales.

Usage :
    docker exec -w /app fultang-medical-backend python seed_medical.py
"""

import os
import sys
import django
from datetime import date, timedelta
import random

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import transaction
from patient.models.satellite import Adresse, Nationalite, Contact
from patient.models.emergency import PersonneAPrevenir, LienParente
from patient.models.patient import Patient
from patient.models.choices import Sexe, StatutMatrimonial, ContactType, LienParenteType
from medical_workflow.models.visit import Visite
from medical_workflow.models.choices import StatutVisite

# ──────────────────────────────────────────────────────────────────────────────
# Données fictives
# ──────────────────────────────────────────────────────────────────────────────

PATIENTS_DATA = [
    ("Mballa",      "Sophie",   "F", date(1985, 3, 15),  "Yaoundé",    "Informaticienne",   "MARIE"),
    ("Nkomo",       "Jean",     "M", date(1972, 7, 22),  "Douala",     "Enseignant",        "MARIE"),
    ("Ateba",       "Carine",   "F", date(1990, 11, 8),  "Bafoussam",  "Commerçante",       "CELIBATAIRE"),
    ("Biya",        "Paul",     "M", date(1965, 1, 30),  "Ngaoundéré", "Agriculteur",       "MARIE"),
    ("Tabi",        "Marie",    "F", date(1998, 6, 5),   "Yaoundé",    "Étudiante",         "CELIBATAIRE"),
    ("Essomba",     "Luc",      "M", date(1980, 9, 12),  "Kribi",      "Pêcheur",           "MARIE"),
    ("Mbassi",      "Hélène",   "F", date(1975, 4, 27),  "Ebolowa",    "Infirmière",        "MARIE"),
    ("Kamga",       "Robert",   "M", date(1988, 12, 3),  "Bafoussam",  "Chauffeur",         "MARIE"),
    ("Foko",        "Irène",    "F", date(1995, 2, 19),  "Douala",     "Coiffeuse",         "CELIBATAIRE"),
    ("Tchamba",     "Pierre",   "M", date(1960, 8, 14),  "Maroua",     "Retraité",          "VEUF"),
    ("Nyobe",       "Estelle",  "F", date(1993, 5, 7),   "Yaoundé",    "Juriste",           "CELIBATAIRE"),
    ("Manga",       "Alain",    "M", date(1977, 10, 25), "Limbe",      "Pétrolier",         "MARIE"),
    ("Ewane",       "Berthe",   "F", date(1969, 3, 31),  "Kumba",      "Ménagère",          "MARIE"),
    ("Ondoua",      "Franck",   "M", date(1992, 7, 16),  "Sangmélima", "Médecin",           "CELIBATAIRE"),
    ("Bikele",      "Nadège",   "F", date(1987, 1, 9),   "Yaoundé",    "Architecte",        "DIVORCE"),
    ("Onana",       "Christel", "F", date(2001, 4, 22),  "Douala",     "Étudiante",         "CELIBATAIRE"),
    ("Belibi",      "Samuel",   "M", date(1955, 6, 18),  "Mbalmayo",   "Pasteur",           "MARIE"),
    ("Edoa",        "Cécile",   "F", date(1983, 9, 2),   "Bertoua",    "Comptable",         "MARIE"),
    ("Ngoumou",     "Jacques",  "M", date(1970, 11, 28), "Tibati",     "Menuisier",         "MARIE"),
    ("Tsanga",      "Laure",    "F", date(1996, 8, 11),  "Yaoundé",    "Journaliste",       "CELIBATAIRE"),
]

VILLES = ["Yaoundé", "Douala", "Bafoussam", "Ngaoundéré", "Ebolowa", "Kribi", "Maroua", "Garoua"]
QUARTIERS = ["Bastos", "Akwa", "Biyem-Assi", "Melen", "Bonamoussadi", "Ndokotti", "Briqueterie", "Mvan"]
MOTIFS = [
    "Douleurs abdominales persistantes",
    "Fièvre et frissons depuis 3 jours",
    "Consultation de contrôle annuelle",
    "Céphalées intenses",
    "Suivi grossesse — 2ème trimestre",
    "Toux chronique avec expectoration",
    "Hypertension artérielle — suivi mensuel",
    "Traumatisme membre inférieur suite à chute",
    "Éruption cutanée inexpliquée",
    "Bilan préopératoire",
    "Douleurs thoraciques",
    "Diabète type 2 — contrôle glycémique",
]
PREFIXES_TEL = ["697", "699", "677", "678", "655", "654", "671", "672"]

def random_phone():
    return f"+237 {random.choice(PREFIXES_TEL)} {random.randint(10,99)} {random.randint(10,99)} {random.randint(10,99)}"

def random_nss():
    return f"NSS{random.randint(100000000, 999999999)}"

def random_date_visite(days_ago_max=180):
    offset = random.randint(0, days_ago_max)
    return date.today() - timedelta(days=offset)

# ──────────────────────────────────────────────────────────────────────────────
# Peuplement
# ──────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def seed():
    # Vérification : pas de double seed
    if Patient.objects.count() >= 20:
        print(f"⚠  Base déjà peuplée ({Patient.objects.count()} patients). Seed ignoré.")
        return

    print("── Création des nationalités ──────────────────────────────────────")
    nat_cam, _ = Nationalite.objects.get_or_create(libelle="Camerounaise")
    nat_fra, _ = Nationalite.objects.get_or_create(libelle="Française")
    nat_civ, _ = Nationalite.objects.get_or_create(libelle="Ivoirienne")
    nationalites_pool = [nat_cam, nat_cam, nat_cam, nat_fra, nat_civ]  # majorité camerounaise

    print("── Création des patients ───────────────────────────────────────────")
    created_patients = []

    for nom, prenom, sexe_code, dob, ville, profession, statut in PATIENTS_DATA:
        # Adresse
        adresse = Adresse.objects.create(
            pays="Cameroun",
            ville=ville,
            quartier=random.choice(QUARTIERS),
            rue=f"Rue {random.randint(1, 200)}",
        )

        # Patient
        patient = Patient.objects.create(
            nom=nom,
            prenom=prenom,
            sexe=Sexe.MASCULIN if sexe_code == "M" else Sexe.FEMININ,
            date_naissance=dob,
            lieu_naissance=ville,
            profession=profession,
            statut_matrimonial=statut,
            adresse=adresse,
            courriel=f"{prenom.lower()}.{nom.lower()}@example.cm",
            numero_securite_sociale=random_nss(),
            nombre_enfants=random.randint(0, 5),
        )
        patient.nationalites.add(random.choice(nationalites_pool))

        # Contact téléphonique
        Contact.objects.create(
            type=ContactType.TELEPHONIQUE,
            numero=random_phone(),
            patient=patient,
        )
        # Optionnel : WhatsApp
        if random.random() > 0.4:
            Contact.objects.create(
                type=ContactType.WHATSAPP,
                numero=random_phone(),
                patient=patient,
            )

        # Personne à prévenir
        urgence_adresse = Adresse.objects.create(
            pays="Cameroun",
            ville=random.choice(VILLES),
            quartier=random.choice(QUARTIERS),
        )
        urgence = PersonneAPrevenir.objects.create(
            nom=f"Urgence_{nom}",
            prenom="Contact",
            adresse=urgence_adresse,
        )
        LienParente.objects.create(
            patient=patient,
            personne_a_prevenir=urgence,
            relation=random.choice([
                LienParenteType.CONJOINT,
                LienParenteType.FRERE_SOEUR,
                LienParenteType.MERE,
                LienParenteType.PERE,
            ]),
        )

        created_patients.append(patient)
        print(f"  ✔ {patient}")

    print(f"\n── Création des visites ({len(created_patients)} patients) ───────────────")
    for patient in created_patients:
        nb_visites = random.randint(1, 4)
        for _ in range(nb_visites):
            statut = random.choice([
                StatutVisite.EN_COURS,
                StatutVisite.TERMINE,
                StatutVisite.TERMINE,
                StatutVisite.ANNULE,
            ])
            Visite.objects.create(
                patient=patient,
                motif_visite=random.choice(MOTIFS),
                statut=statut,
            )

    total_visites = Visite.objects.count()
    print(f"\n✅  Seed terminé — {Patient.objects.count()} patients, {total_visites} visites créés.")


if __name__ == "__main__":
    seed()
