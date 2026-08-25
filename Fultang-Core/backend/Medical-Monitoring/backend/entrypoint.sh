#!/bin/sh

# ============================================================
# entrypoint.sh — Fultang Medical-Monitoring (Backend)
# ============================================================
# Ce script assure que la base de données est prête avant de
# lancer les commandes Django (migrations, etc.)
# ============================================================

# Arrêter le script dès la première erreur
set -e

echo ">>> [Entrypoint] Attente de la base de données PostgreSQL ($DB_HOST:$DB_PORT)..."

# On attend que PostgreSQL soit prêt à accepter les connexions.
# pg_isready est fourni par le paquet 'postgresql-client'.
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$FULTANG_DB_USER"
do
  echo ">>> [Entrypoint] PostgreSQL n'est pas prêt - attente de 2 secondes..."
  sleep 2
done

echo ">>> [Entrypoint] PostgreSQL est prêt !"

# ------------------------------------------------------------
# ÉTAPE 1 : Appliquer les migrations Django
# ------------------------------------------------------------
# On ne lance les migrations que si manage.py n'est pas vide
if [ -s manage.py ]; then
    echo ">>> [Entrypoint] Application des migrations..."
    python manage.py migrate --no-input
else
    echo ">>> [Entrypoint] ATTENTION : manage.py est vide ou introuvable. Migrations ignorées."
fi

# ------------------------------------------------------------
# ÉTAPE 2 : Collecter les fichiers statiques
# ------------------------------------------------------------
if [ -s manage.py ]; then
    echo ">>> [Entrypoint] Collecte des fichiers statiques..."
    # Non bloquant : en dev, un échec de collectstatic (ex. permissions sur un
    # volume monté) ne doit pas empêcher l'API de démarrer.
    python manage.py collectstatic --no-input || echo ">>> [Entrypoint] AVERTISSEMENT : collectstatic a échoué (permissions ?). On continue."
fi

# ------------------------------------------------------------
# ÉTAPE 3 : Lancer le serveur
# ------------------------------------------------------------
# Si une commande est passée (ex: par docker-compose override), on l'exécute.
# Sinon, on tente de lancer gunicorn.
if [ $# -gt 0 ]; then
    echo ">>> [Entrypoint] Exécution de la commande spécifique : $@"
    exec "$@"
else
    # Si le projet n'est pas encore initialisé, on lance un serveur de secours
    # ou on affiche une erreur explicite.
    if [ -s manage.py ]; then
        echo ">>> [Entrypoint] Lancement de Gunicorn..."
        # NOTE : Remplacez 'config.wsgi' par le nom réel de votre projet si nécessaire.
        # Par défaut, on cherche un dossier contenant wsgi.py
        WSGI_MODULE=$(find . -maxdepth 2 -name wsgi.py | cut -d/ -f2)
        if [ -z "$WSGI_MODULE" ]; then
            WSGI_MODULE="config" # Fallback
        fi
        exec gunicorn --bind 0.0.0.0:8000 --workers 3 "${WSGI_MODULE}.wsgi:application"
    else
        echo ">>> [Entrypoint] ERREUR : Aucun projet Django détecté. Le conteneur va rester en veille."
        tail -f /dev/null
    fi
fi
