# 🔑 Identifiants de Connexion de Test — Polyclinique Fultang

Ce fichier répertorie les identifiants et mots de passe par défaut créés par le script de peuplement automatique (`seed_data.py`).

---

## 👥 Liste des Comptes Utilisateurs

| Rôle | Nom & Prénom | Adresse E-mail (Identifiant) | Mot de passe | Service Hospitalier |
| :--- | :--- | :--- | :--- | :--- |
| **Administrateur Global** | Global Admin | `admin@fultang.local` | `adminpass` | Administration |
| **Directeur Général** | Fultang Directeur | `dg@fultang.local` | `Fultang@123` | Administration |
| **Réceptionniste 1** | Biyogo Claire | `claire.b@fultang.local` | `Fultang@123` | Consultation générale |
| **Réceptionniste 2** | Nkomo Nelly | `nelly@recept.com` | `Fultang@123` | Urgences |
| **Médecin Spécialiste** | Dupont Jean | `jean.dupont@fultang.local` | `password123` | Chirurgie |
| **Médecin Spécialiste** | Mballa Sophie | `sophie.mballa@fultang.local` | `Fultang@123` | Neurologie |
| **Médecin Généraliste** | Kengne Alain | `alain.kengne@fultang.local` | `Fultang@123` | Consultation générale |
| **Infirmier / Infirmière** | Ateba Marie | `marie.ateba@fultang.local` | `Fultang@123` | Maternité |
| **Laborantin** | Kamga Luc | `luc.kamga@fultang.local` | `Fultang@123` | Laboratoire |
| **Laborantin (Nouveau)** | Tchakounté Alain | `labo.tchakounte@fultang.local` | `Fultang@123` | Laboratoire |
| **Pharmacien** | Ekani Sylvie | `sylvie.ekani@fultang.local` | `Fultang@123` | Pharmacie |
| **Pharmacien (Nouveau)** | Dupont Pierre | `pharmacien@fultang.local` | `Fultang@123` | Pharmacie |
| **Caissier** | Talla Paul | `paul.talla@fultang.local` | `Fultang@123` | Administration |
| **Comptable Financier** | Njoya Isabelle | `i.njoya@fultang.local` | `Fultang@123` | Administration |
| **Comptable Matière** | Manga Alice | `a.matiere@fultang.local` | `Fultang@123` | Administration |

---

## 💰 Module Caissier — Workflow walk-in

Le compte **Caissier** (`paul.talla@fultang.local`) se connecte avec le rôle UI **caissier** → `/cashier/*`.

Le compte **Comptable Financier** (`i.njoya@fultang.local`) se connecte avec le rôle UI **comptable_financier** → `/accountant/*`.

Le compte **Comptable Matière** (`a.matiere@fultang.local`) se connecte avec le rôle UI **compta_matiere** → `/compta-matiere/*`.

---

## 📦 Circuit achats / sorties (test E2E)

| Étape | Rôle | Email | Mot de passe | Action |
|-------|------|-------|--------------|--------|
| 1. Émettre un besoin | Comptable matière | `a.matiere@fultang.local` | `Fultang@123` | `/compta-matiere/emit-need` |
| 2. Valider le besoin | Directeur | `dg@fultang.local` | `Fultang@123` | `/director` → crée une **demande d'achat** |
| 3. Évaluer le budget | Comptable financier | `i.njoya@fultang.local` | `Fultang@123` | `/accountant/achats` → onglet **Demandes d'achat** |
| 4. Approuver la demande | Directeur | `dg@fultang.local` | `Fultang@123` | Section **Approbations achats** |
| 5. Générer + valider le BC | Comptable financier | `i.njoya@fultang.local` | `Fultang@123` | **Générer BC** → **Valider et approuver** (une seule action, plus d'intervention directeur) |
| 6. Facture + OP | Comptable financier | `i.njoya@fultang.local` | `Fultang@123` | Onglets Factures / Ordres de paiement |
| 7. Décaissement | Caissier | `paul.talla@fultang.local` | `Fultang@123` | `/cashier/decaissements` |

> Le directeur consulte les BC générés dans **`/director/reports` → Rapport des Achats** (filtre mensuel + export PDF avec synthèse financière).

**Workflow opérationnel :**

1. Le patient se présente physiquement au guichet (pas de redirection depuis la réception ou le médecin).
2. Le caissier **recherche le patient** par nom, téléphone ou numéro de dossier.
3. La **fiche encaissement** affiche : actes du jour, impayés antérieurs (anti-fraude) et quittances déjà encaissées.
4. Le caissier clique **Facturer**, choisit le mode de paiement (espèces, mobile money, chèque, carte, virement, assurance) et valide la quittance.
5. Un panneau assistant **« Impayés Medical »** (rafraîchi automatiquement) liste les patients avec des actes non soldés.

**Pages caissier :**

| Page | Route |
| :--- | :--- |
| Encaissement patients | `/cashier/consultation-list` |
| Caisse journalière | `/cashier/caisse` |
| Quittances validées | `/cashier/quittances/validees` |
| Historique financier | `/cashier/financial-history` |
| Rapport financier | `/cashier/financial-report` |
| Décaissements | `/cashier/decaissements` |

**Données de démo :** exécuter `./backend/apply_seed.sh` pour peupler l'exercice 2026 (quittances multi-modes, patients Medical).

---

## 📦 Module Comptabilité Matière — Acteurs et parcours

| Acteur | E-mail | Mot de passe | Espace après login |
|--------|--------|--------------|-------------------|
| **Comptable matière** | `a.matiere@fultang.local` | `Fultang@123` | `/compta-matiere/dashboard` |
| **Directeur** | `dg@fultang.local` | `Fultang@123` | `/director/dashboard` |
| **Pharmacien** | `sylvie.ekani@fultang.local` | `Fultang@123` | `/pharmacist/dashboard` (+ menu Stock & matière) |

**Pages comptable matière :** dashboard, besoins, livraisons, sorties, rapports, liste matériel, archives inventaire (`/compta-matiere/*`).

**Pages pharmacien (compta matière, en plus du workflow médical) :** liste médicaments, émettre besoin, ventes du jour, inventaire, rapports (`/pharmacist/medication-list`, etc.).

**Pages directeur :** validation des besoins, rapports (`/director/*`).

**Données de démo compta matière :** `apply_seed.sh` exécute `seed_demo_matiere` (matériels, besoins multi-statuts, livraisons, sorties, inventaires).

---

> [!NOTE]
> Le script de migrations et de peuplement de la base de données (`apply_seed.sh`) est lancé **automatiquement** à chaque exécution du script de démarrage global (`./start_all.sh`) à la racine du projet.
