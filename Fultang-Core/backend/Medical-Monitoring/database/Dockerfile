# ============================================================
# Dockerfile — Base de données PostgreSQL (Fultang / Medical-Monitoring)
# ============================================================
# On part de l'image officielle PostgreSQL, version 17 Alpine.
# "17-alpine" utilise Alpine Linux comme système hôte :
# image légère (~70 Mo), idéale pour la conteneurisation.
# ============================================================
FROM postgres:17-alpine
# ------------------------------------------------------------
# Métadonnées
# ------------------------------------------------------------
LABEL maintainer="Fultang Team — ENSPY"
LABEL description="Base de données PostgreSQL pour le microservice Medical-Monitoring"
LABEL version="1.0"
# ------------------------------------------------------------
# Script d'initialisation
# ------------------------------------------------------------
# PostgreSQL exécute automatiquement, au premier démarrage
# du conteneur, tous les fichiers .sql et .sh présents dans
# /docker-entrypoint-initdb.d/, dans l'ordre alphabétique.
#
# On utilise un fichier .sh (et non .sql) car notre script
# doit :
#   1. Créer l'utilisateur applicatif
#   2. Créer la base de données
#   3. Se reconnecter à la nouvelle BD pour y créer les
#      extensions — ce qui nécessite deux appels psql
#      distincts, impossibles dans un seul fichier .sql.
#
# Le script n'est exécuté QU'UNE SEULE FOIS : uniquement
# si le volume de données est vide (premier lancement).
# ------------------------------------------------------------
COPY init/01_init.sh /docker-entrypoint-initdb.d/01_init.sh
# Le script doit être exécutable pour que PostgreSQL
# puisse le lancer automatiquement.
RUN chmod +x /docker-entrypoint-initdb.d/01_init.sh
# ------------------------------------------------------------
# Port exposé
# ------------------------------------------------------------
# PostgreSQL écoute par défaut sur le port 5432.
# EXPOSE documente le port mais ne le publie pas sur l'hôte.
# La publication est configurée dans docker-compose.yml.
# ------------------------------------------------------------
EXPOSE 5432
# ------------------------------------------------------------
# Variables d'environnement par défaut
# ------------------------------------------------------------
# Ces valeurs sont des DÉFAUTS surchargés par .env.
# POSTGRES_USER et POSTGRES_PASSWORD définissent le
# SUPERUTILISATEUR PostgreSQL (pas l'utilisateur applicatif).
# L'utilisateur applicatif (fultang_user) et la base de
# données sont créés par le script 01_init.sh.
# ------------------------------------------------------------
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=changeme_superuser_in_env
# Variables pour l'utilisateur applicatif et la BD
# (utilisées par 01_init.sh)
ENV FULTANG_DB_USER=fultang_user
ENV FULTANG_DB_PASSWORD=changeme_appuser_in_env
ENV FULTANG_DB_NAME=fultang_medical_monitoring
# ------------------------------------------------------------
# Volume de persistance des données
# ------------------------------------------------------------
VOLUME ["/var/lib/postgresql/data"]
