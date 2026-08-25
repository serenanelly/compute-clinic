#!/bin/bash
# ============================================================
# 01_init.sh — Script d'initialisation de la base de données
# Fultang / Medical-Monitoring
# ============================================================
# Ce script est exécuté automatiquement par PostgreSQL au
# premier démarrage du conteneur (volume vide), en tant que
# superutilisateur (postgres).
#
# Pourquoi un .sh plutôt qu'un .sql ?
# ------------------------------------------------------------
# Deux raisons techniques :
#   1. CREATE DATABASE ne peut pas s'exécuter à l'intérieur
#      d'un bloc de transaction. Or, les fichiers .sql sont
#      exécutés dans une seule transaction par psql.
#      Un script shell contourne ce problème.
#   2. Pour créer les extensions dans la NOUVELLE base de
#      données, il faut s'y connecter après sa création.
#      Un script shell peut appeler psql plusieurs fois
#      avec des connexions différentes.
#
# Variables d'environnement utilisées (définies dans .env) :
#   POSTGRES_USER        → superutilisateur PostgreSQL
#   FULTANG_DB_USER      → utilisateur applicatif Django
#   FULTANG_DB_PASSWORD  → mot de passe de l'utilisateur applicatif
#   FULTANG_DB_NAME      → nom de la base de données
# ============================================================

# Arrêter le script dès la première erreur
set -e

echo ">>> [init] Démarrage de l'initialisation de la base de données..."

# ============================================================
# ÉTAPE 1 : Création de l'utilisateur applicatif et de la BD
# ============================================================
# On se connecte à la base "postgres" (base système par défaut)
# en tant que superutilisateur pour créer l'utilisateur
# applicatif et la base de données.
# ============================================================
psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname "postgres" \
     <<-EOSQL

    -- ----------------------------------------------------------
    -- Création de l'utilisateur applicatif
    -- ----------------------------------------------------------
    -- Cet utilisateur est celui que Django utilisera pour se
    -- connecter à la base de données. Il n'est PAS superuser :
    -- on applique le principe du moindre privilège.
    --   NOSUPERUSER  : ne peut pas administrer PostgreSQL
    --   NOCREATEDB   : ne peut pas créer d'autres bases
    --   NOCREATEROLE : ne peut pas créer d'autres rôles
    --   LOGIN        : peut se connecter (nécessaire !)
    -- ----------------------------------------------------------
    DO \$\$
    BEGIN
        IF NOT EXISTS (
            SELECT FROM pg_catalog.pg_roles
            WHERE rolname = '$FULTANG_DB_USER'
        ) THEN
            CREATE USER $FULTANG_DB_USER
                WITH PASSWORD '$FULTANG_DB_PASSWORD'
                NOSUPERUSER
                CREATEDB
                NOCREATEROLE
                LOGIN;
            RAISE NOTICE 'Utilisateur % créé avec succès.', '$FULTANG_DB_USER';
        ELSE
            RAISE NOTICE 'Utilisateur % existe déjà — ignoré.', '$FULTANG_DB_USER';
        END IF;
    END
    \$\$;

    -- ----------------------------------------------------------
    -- Création de la base de données
    -- ----------------------------------------------------------
    -- On vérifie d'abord si la base existe déjà (idempotence).
    -- OWNER : l'utilisateur applicatif est propriétaire de sa BD.
    -- ENCODING : UTF-8 pour supporter tous les caractères.
    -- LC_COLLATE / LC_CTYPE : ordre de tri et classification
    --   des caractères. 'C.UTF-8' est le plus portable.
    -- TEMPLATE template0 : permet de spécifier LC_COLLATE et
    --   LC_CTYPE différents du template par défaut.
    -- ----------------------------------------------------------
    SELECT 'CREATE DATABASE $FULTANG_DB_NAME
                OWNER $FULTANG_DB_USER
                ENCODING ''UTF8''
                LC_COLLATE ''C.UTF-8''
                LC_CTYPE ''C.UTF-8''
                TEMPLATE template0'
    WHERE NOT EXISTS (
        SELECT FROM pg_database WHERE datname = '$FULTANG_DB_NAME'
    )\gexec

    -- ----------------------------------------------------------
    -- Attribution de tous les privilèges sur la base de données
    -- ----------------------------------------------------------
    -- GRANT ALL PRIVILEGES donne à l'utilisateur applicatif
    -- tous les droits sur la base : CONNECT, CREATE, TEMP.
    -- C'est nécessaire pour que Django puisse créer les tables
    -- via ses migrations.
    -- ----------------------------------------------------------
    GRANT ALL PRIVILEGES ON DATABASE $FULTANG_DB_NAME TO $FULTANG_DB_USER;

EOSQL

echo ">>> [init] Utilisateur '$FULTANG_DB_USER' et base '$FULTANG_DB_NAME' créés."


# ============================================================
# ÉTAPE 2 : Configuration de la base de données
# ============================================================
# Maintenant on se connecte à la NOUVELLE base de données
# pour y créer les extensions et configurer les paramètres.
# Cette deuxième connexion est la raison pour laquelle on
# utilise un script shell plutôt qu'un fichier .sql.
# ============================================================
psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname "$FULTANG_DB_NAME" \
     <<-EOSQL

    -- ----------------------------------------------------------
    -- Extension uuid-ossp
    -- ----------------------------------------------------------
    -- Fournit la fonction uuid_generate_v4() pour générer des
    -- UUID (identifiants uniques universels) côté base de données.
    -- Utile comme type de clé primaire pour les entités métier
    -- (patients, consultations, etc.) à la place des entiers
    -- auto-incrémentés, offrant une meilleure distribution et
    -- évitant d'exposer des IDs séquentiels dans l'API.
    -- ----------------------------------------------------------
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- ----------------------------------------------------------
    -- Extension pg_trgm
    -- ----------------------------------------------------------
    -- Active la recherche par similarité trigramme (suite de 3
    -- caractères consécutifs). Permet des recherches approximatives
    -- sur les noms de patients, tolérantes aux fautes de frappe.
    -- Exemple : "Mbarga" retrouve "Mbargaa" ou "Mbarga ".
    -- Utilisée avec des index GIN ou GIST pour de meilleures
    -- performances sur les grandes tables.
    -- ----------------------------------------------------------
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";

    -- ----------------------------------------------------------
    -- Extension unaccent
    -- ----------------------------------------------------------
    -- Fournit une fonction de translittération qui supprime les
    -- accents des chaînes de caractères. Permet des recherches
    -- insensibles aux accents : chercher "Ngue" retrouve "Ngué".
    -- ----------------------------------------------------------
    CREATE EXTENSION IF NOT EXISTS "unaccent";

    -- ----------------------------------------------------------
    -- Privilèges sur le schéma public
    -- ----------------------------------------------------------
    -- En PostgreSQL 15+, les droits sur le schéma public ont
    -- été restreints. On accorde explicitement tous les droits
    -- à notre utilisateur applicatif pour qu'il puisse créer,
    -- modifier et supprimer des tables (via les migrations Django).
    -- ----------------------------------------------------------

    -- Droit de créer des objets dans le schéma public
    GRANT ALL ON SCHEMA public TO $FULTANG_DB_USER;

    -- Pour toutes les FUTURES tables créées dans public :
    -- accorder automatiquement SELECT, INSERT, UPDATE, DELETE
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT ALL ON TABLES TO $FULTANG_DB_USER;

    -- Pour toutes les FUTURES séquences (auto-increment) :
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT ALL ON SEQUENCES TO $FULTANG_DB_USER;

    -- Pour toutes les FUTURES fonctions :
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT ALL ON FUNCTIONS TO $FULTANG_DB_USER;

    -- ----------------------------------------------------------
    -- Fuseau horaire de la base de données
    -- ----------------------------------------------------------
    -- Toutes les valeurs TIMESTAMP WITH TIME ZONE seront
    -- stockées et interprétées en UTC. Django (avec USE_TZ=True)
    -- gère lui-même les conversions à l'affichage.
    -- ----------------------------------------------------------
    ALTER DATABASE $FULTANG_DB_NAME SET timezone TO 'UTC';

    -- ----------------------------------------------------------
    -- Message de confirmation
    -- ----------------------------------------------------------
    DO \$\$
    BEGIN
        RAISE NOTICE '==============================================';
        RAISE NOTICE 'Base de données % initialisée avec succès.', '$FULTANG_DB_NAME';
        RAISE NOTICE 'Extensions : uuid-ossp, pg_trgm, unaccent';
        RAISE NOTICE 'Propriétaire : %', '$FULTANG_DB_USER';
        RAISE NOTICE '==============================================';
    END \$\$;

EOSQL

echo ">>> [init] Extensions et privilèges configurés."
echo ">>> [init] Initialisation terminée avec succès."