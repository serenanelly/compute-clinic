#!/usr/bin/env bash

# Arrêter le script dès la première erreur
set -e

echo "=== Réinitialisation complète des bases de données ==="

# 1. Flush de toutes les bases de données Django
echo "-> Nettoyage de service-personnel..."
docker exec -w /app/service_personnel fultang-personnel python manage.py flush --no-input

echo "-> Nettoyage de fultang-medical-backend..."
docker exec -w /app fultang-medical-backend python manage.py flush --no-input

echo "-> Nettoyage de fultang-infrastructure-web..."
docker exec -w /app fultang-infrastructure-web python manage.py flush --no-input

echo "-> Nettoyage de fultang-compta-financiere-backend..."
docker exec -w /app fultang-compta-financiere-backend python manage.py flush --no-input

echo "-> Nettoyage de fultang-compta-matiere-backend..."
docker exec -w /app fultang-compta-matiere-backend python manage.py flush --no-input

# 2. Peuplement de l'admin uniquement dans le service personnel
echo "-> Copie du script de peuplement admin..."
docker cp service-personnel/service_personnel/seed_admin_only.py fultang-personnel:/app/service_personnel/seed_admin_only.py

echo "-> Exécution du peuplement de l'administrateur..."
docker exec -w /app/service_personnel fultang-personnel python /app/service_personnel/seed_admin_only.py

# 3. Redémarrage des microservices pour vider les caches mémoire/sessions
echo "-> Redémarrage des conteneurs backends..."
docker restart fultang-personnel fultang-medical-backend fultang-infrastructure-web fultang-compta-financiere-backend fultang-compta-matiere-backend

echo "=== Réinitialisation et démarrage terminés avec succès ! ==="
