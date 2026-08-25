# ============================================================
# Dockerfile — Backend Django (Fultang / Medical-Monitoring)
# ============================================================
# On utilise un build multi-étapes (multi-stage build) :
#   - Étape 1 "builder" : installe les dépendances Python
#   - Étape 2 "runtime" : image finale légère sans les outils
#     de build inutiles en production
# Cela réduit considérablement la taille de l'image finale.
# ============================================================


# ============================================================
# ÉTAPE 1 : Builder — installation des dépendances
# ============================================================
# On part de Python 3.13 sur Alpine Linux (image légère).
# "3.13-alpine" est la version la plus récente de Python
# disponible au moment de la rédaction.
# ============================================================
FROM python:3.13-alpine AS builder

# ------------------------------------------------------------
# Variables d'environnement de build
# ------------------------------------------------------------
# PYTHONDONTWRITEBYTECODE=1 : empêche Python de créer des
#   fichiers .pyc (bytecode compilé) — inutiles dans un
#   conteneur Docker.
# PYTHONUNBUFFERED=1 : force Python à écrire les sorties
#   stdout/stderr directement (sans buffer), ce qui permet
#   de voir les logs en temps réel dans Docker.
# ------------------------------------------------------------
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ------------------------------------------------------------
# Répertoire de travail
# ------------------------------------------------------------
# Tous les fichiers du projet seront placés dans /app.
# ------------------------------------------------------------
WORKDIR /app

# ------------------------------------------------------------
# Dépendances système nécessaires à la compilation
# ------------------------------------------------------------
# Alpine ne contient pas les outils de compilation par défaut.
# On installe uniquement ce qui est strictement nécessaire :
# - gcc, musl-dev : compilateur C pour certains packages Python
# - libffi-dev : nécessaire pour cryptography (JWT)
# - jpeg-dev, zlib-dev : nécessaires pour Pillow (images)
# - postgresql-dev : headers PostgreSQL pour psycopg2
# Le flag --no-cache évite de stocker le cache apk dans
# l'image, réduisant sa taille.
# ------------------------------------------------------------
RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    jpeg-dev \
    zlib-dev \
    postgresql-dev

# ------------------------------------------------------------
# Installation des dépendances Python
# ------------------------------------------------------------
# On copie d'abord UNIQUEMENT requirements.txt (pas le reste
# du code). Cela exploite le cache Docker : si requirements.txt
# n'a pas changé, Docker réutilise la couche en cache et ne
# réinstalle pas les packages — gain de temps considérable.
# --upgrade pip : s'assure que pip est à jour avant d'installer.
# --no-cache-dir : n'enregistre pas le cache pip dans l'image.
# --prefix=/install : installe les packages dans un dossier
#   dédié pour faciliter leur copie dans l'étape suivante.
# ------------------------------------------------------------
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ============================================================
# ÉTAPE 2 : Runtime — image finale de production
# ============================================================
# On repart d'une image Alpine propre (sans les outils de
# compilation) et on y copie uniquement les packages Python
# installés à l'étape précédente ainsi que le code source.
# ============================================================
FROM python:3.13-alpine AS runtime

# ------------------------------------------------------------
# Variables d'environnement de runtime
# ------------------------------------------------------------
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Répertoire de travail
WORKDIR /app

# ------------------------------------------------------------
# Dépendances système runtime uniquement
# ------------------------------------------------------------
# On n'installe ici que les bibliothèques dynamiques (.so)
# nécessaires à l'exécution (pas les headers de compilation) :
# - libpq : bibliothèque runtime de PostgreSQL (pour psycopg2)
# - jpeg, zlib : bibliothèques runtime pour Pillow
# ------------------------------------------------------------
RUN apk add --no-cache \
    libpq \
    postgresql-client \
    jpeg \
    zlib

# ------------------------------------------------------------
# Copie des packages Python depuis l'étape builder
# ------------------------------------------------------------
# On récupère uniquement les packages compilés/installés,
# sans les outils de compilation qui alourdiraient l'image.
# ------------------------------------------------------------
COPY --from=builder /install /usr/local

# ------------------------------------------------------------
# Copie du code source
# ------------------------------------------------------------
# On copie l'ensemble du code du backend Django dans /app.
# Le .dockerignore (à créer à la racine de backend/) exclura
# les fichiers inutiles : __pycache__, .env, .git, etc.
# ------------------------------------------------------------
COPY . .

# ------------------------------------------------------------
# Création d'un utilisateur non-root
# ------------------------------------------------------------
# Par sécurité, on ne fait jamais tourner une application en
# tant que root dans un conteneur. On crée un utilisateur
# dédié "fultang" sans shell ni répertoire home.
# ------------------------------------------------------------
RUN addgroup -S fultang && \
    adduser -S fultang -G fultang -H -s /sbin/nologin

# ------------------------------------------------------------
# Permissions sur le répertoire de travail
# ------------------------------------------------------------
RUN chown -R fultang:fultang /app

# On bascule sur l'utilisateur non-root
USER fultang

# ------------------------------------------------------------
# Port exposé
# ------------------------------------------------------------
# Gunicorn (le serveur WSGI de production) écoutera sur le
# port 8000. Ce port sera mappé dans docker-compose.yml.
# ------------------------------------------------------------
EXPOSE 8000

# ------------------------------------------------------------
# Script de démarrage
# ------------------------------------------------------------
# On utilise un script entrypoint.sh pour :
#   1. Attendre que PostgreSQL soit prêt (évite les erreurs
#      de connexion au démarrage si la BD n'est pas encore up)
#   2. Appliquer les migrations Django automatiquement
#   3. Lancer Gunicorn
# Ce script sera créé séparément.
# ------------------------------------------------------------
COPY --chown=fultang:fultang entrypoint.sh /app/entrypoint.sh

# On s'assure que le script est exécutable.
# (nécessite de repasser temporairement en root pour chmod)
USER root
RUN chmod +x /app/entrypoint.sh
USER fultang

# ------------------------------------------------------------
# Commande de démarrage
# ------------------------------------------------------------
# Au lancement du conteneur, on exécute le script entrypoint.
# ------------------------------------------------------------
ENTRYPOINT ["/app/entrypoint.sh"]