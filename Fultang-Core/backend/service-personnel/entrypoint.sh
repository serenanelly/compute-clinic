#!/bin/sh
# Attendre que la résolution DNS du host postgres soit disponible
echo ">>> Attente de la résolution DNS pour 'postgres'..."
MAX_RETRIES=30
i=0
until python -c "import socket; socket.getaddrinfo('postgres', 5432)" 2>/dev/null; do
    i=$((i + 1))
    if [ $i -ge $MAX_RETRIES ]; then
        echo ">>> ERREUR: DNS postgres non résolu après $MAX_RETRIES tentatives."
        exit 1
    fi
    echo ">>> DNS pas encore prêt ($i/$MAX_RETRIES) - attente 2s..."
    sleep 2
done
echo ">>> DNS résolu. Lancement des migrations..."
python manage.py migrate --no-input
echo ">>> Seeding des données..."
python seed_data.py
echo ">>> Démarrage du serveur Django..."
exec python manage.py runserver 0.0.0.0:8000
