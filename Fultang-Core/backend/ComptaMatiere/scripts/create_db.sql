-- Script de création de la base de données pour le module Comptabilité Matière
-- Nom de la base suggéré : comptamatiere_db

-- Table : Material
CREATE TABLE comptabilite_matiere_materiel (
    "idMateriel" SERIAL PRIMARY KEY,
    code_materiel VARCHAR(50) UNIQUE NOT NULL,
    "nom_Materiel" VARCHAR(200) NOT NULL,
    prix_achat_unitaire DECIMAL(10, 2) NOT NULL CHECK (prix_achat_unitaire >= 0.01),
    quantite_stock INTEGER DEFAULT 0 NOT NULL CHECK (quantite_stock >= 0),
    date_derniere_modification TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table : Material Médical (Héritage)
CREATE TABLE comptabilite_matiere_materiel_medical (
    "idMateriel_id" INTEGER PRIMARY KEY REFERENCES comptabilite_matiere_materiel("idMateriel") ON DELETE CASCADE,
    categorie VARCHAR(20) NOT NULL,
    unite_mesure VARCHAR(50) NOT NULL,
    prix_vente_unitaire DECIMAL(10, 2) NOT NULL CHECK (prix_vente_unitaire >= 0.01)
);

-- Table : Material Durable (Héritage)
CREATE TABLE comptabilite_matiere_materiel_durable (
    "idMateriel_id" INTEGER PRIMARY KEY REFERENCES comptabilite_matiere_materiel("idMateriel") ON DELETE CASCADE,
    "Etat" VARCHAR(20) DEFAULT 'EN_BON_ETAT' NOT NULL,
    localisation VARCHAR(200) NOT NULL,
    "date_Enregistrement" DATE DEFAULT CURRENT_DATE
);

-- Table : Livraison
CREATE TABLE comptabilite_matiere_livraison (
    "idLivraison" SERIAL PRIMARY KEY,
    bon_livraison_numero VARCHAR(50) UNIQUE NOT NULL,
    nom_fournisseur VARCHAR(200) NOT NULL,
    contact_fournisseur VARCHAR(15) NOT NULL,
    date_reception TIMESTAMP WITH TIME ZONE NOT NULL,
    montant_total DECIMAL(12, 2) NOT NULL CHECK (montant_total >= 0),
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    id_personnel_receptionnaire INTEGER -- Clé primaire du personnel (migrée)
);

-- Table : Ligne de Livraison
CREATE TABLE comptabilite_matiere_lignelivraison (
    id SERIAL PRIMARY KEY,
    id_livraison_id INTEGER NOT NULL REFERENCES comptabilite_matiere_livraison("idLivraison") ON DELETE CASCADE,
    materiel_id INTEGER NOT NULL REFERENCES comptabilite_matiere_materiel("idMateriel"),
    quantite_conforme INTEGER NOT NULL,
    quantite_non_conforme INTEGER DEFAULT 0,
    type_materiel VARCHAR(20) NOT NULL
);

-- Table : Besoin (Demande)
CREATE TABLE comptabilite_matiere_besoin (
    "idBesoin" SERIAL PRIMARY KEY,
    date_creation_besoin TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    id_personnel_emetteur INTEGER NOT NULL, -- Clé primaire du personnel (migrée)
    motif TEXT NOT NULL,
    statut VARCHAR(20) DEFAULT 'NON_TRAITE' NOT NULL,
    date_traitement_directeur TIMESTAMP WITH TIME ZONE,
    commentaire_directeur TEXT
);

-- Table : Ligne de Besoin
CREATE TABLE comptabilite_matiere_lignebesoin (
    id_ligne_besoin SERIAL PRIMARY KEY,
    id_besoin_id INTEGER NOT NULL REFERENCES comptabilite_matiere_besoin("idBesoin") ON DELETE CASCADE,
    materiel_nom VARCHAR(200) NOT NULL,
    quantite_demandee INTEGER NOT NULL CHECK (quantite_demandee > 0),
    priorite VARCHAR(10) DEFAULT 'MOYENNE',
    quantite_accordee INTEGER DEFAULT 0
);

-- Table : Sortie
CREATE TABLE comptabilite_matiere_sortie (
    "idSortie" SERIAL PRIMARY KEY,
    numero_sortie VARCHAR(50) UNIQUE NOT NULL,
    date_sortie TIMESTAMP WITH TIME ZONE NOT NULL,
    motif_sortie VARCHAR(30) NOT NULL,
    "idPersonnel" INTEGER NOT NULL, -- Clé primaire du personnel (migrée)
    service_responsable VARCHAR(100),
    montant_total DECIMAL(15, 2) DEFAULT 0,
    heure_sortie TIME,
    observations TEXT
);

-- Table : Ligne de Sortie
CREATE TABLE comptabilite_matiere_lignesortie (
    id_ligne_sortie SERIAL PRIMARY KEY,
    id_sortie_id INTEGER NOT NULL REFERENCES comptabilite_matiere_sortie("idSortie") ON DELETE CASCADE,
    id_materiel_id INTEGER NOT NULL REFERENCES comptabilite_matiere_materiel("idMateriel"),
    nom_materiel VARCHAR(200) NOT NULL,
    code_materiel VARCHAR(50),
    quantite INTEGER NOT NULL CHECK (quantite > 0),
    prix_unitaire DECIMAL(10, 2),
    sous_total DECIMAL(15, 2),
    type_materiel VARCHAR(30)
);

-- Table : Archive Inventaire
CREATE TABLE comptabilite_matiere_archive_inventaire (
    id_archive SERIAL PRIMARY KEY,
    code_archive VARCHAR(20) UNIQUE NOT NULL,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    date_termine TIMESTAMP WITH TIME ZONE,
    id_responsable INTEGER NOT NULL, -- Clé primaire du personnel (migrée)
    statut VARCHAR(10) DEFAULT 'EN_COURS',
    observations TEXT,
    rapport_associe_id INTEGER
);

-- Table : Ligne Archive Inventaire
CREATE TABLE comptabilite_matiere_lignearchiveinventaire (
    id_ligne_archive SERIAL PRIMARY KEY,
    id_archive_id INTEGER NOT NULL REFERENCES comptabilite_matiere_archive_inventaire(id_archive) ON DELETE CASCADE,
    id_materiel_id INTEGER NOT NULL REFERENCES comptabilite_matiere_materiel("idMateriel"),
    nom_materiel VARCHAR(200) NOT NULL,
    code_materiel VARCHAR(50),
    quantite_ancien_stock INTEGER NOT NULL,
    quantite_nouveau_stock INTEGER NOT NULL,
    difference INTEGER,
    statut_difference VARCHAR(15)
);

-- Table : Rapport
CREATE TABLE comptabilite_matiere_rapport (
    id SERIAL PRIMARY KEY,
    code_rapport VARCHAR(20) UNIQUE,
    objet VARCHAR(255) NOT NULL,
    corps TEXT NOT NULL,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    id_personnel INTEGER, -- Clé primaire du personnel (migrée)
    id_expediteur INTEGER, -- Clé primaire du personnel (migrée)
    id_destinataire INTEGER, -- Clé primaire du personnel (migrée)
    date_envoi TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    date_lecture TIMESTAMP WITH TIME ZONE,
    est_lu BOOLEAN DEFAULT FALSE,
    type_rapport VARCHAR(15) DEFAULT 'GENERAL',
    archive_associee_id INTEGER REFERENCES comptabilite_matiere_archive_inventaire(id_archive) ON DELETE SET NULL,
    statut VARCHAR(10) DEFAULT 'non lu'
);

-- Table : Pièce Jointe Rapport
CREATE TABLE comptabilite_matiere_piecejointerapport (
    id_piece_jointe SERIAL PRIMARY KEY,
    id_rapport_id INTEGER NOT NULL REFERENCES comptabilite_matiere_rapport(id) ON DELETE CASCADE,
    type_piece VARCHAR(20),
    nom_fichier VARCHAR(255) NOT NULL,
    chemin_fichier VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ajout du lien circulaire manquant pour l'ArchiveInventaire vers Rapport
ALTER TABLE comptabilite_matiere_archive_inventaire 
ADD CONSTRAINT fk_archive_rapport FOREIGN KEY (rapport_associe_id) 
REFERENCES comptabilite_matiere_rapport(id) ON DELETE SET NULL;
