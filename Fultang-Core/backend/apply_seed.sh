#!/usr/bin/env bash

# Attendre que les services soient prêts
echo "Application des migrations..."
docker exec -w /app/service_personnel fultang-personnel python manage.py migrate
docker exec -w /app fultang-medical-backend python manage.py migrate
docker exec -w /app fultang-infrastructure-web python manage.py migrate
docker exec -w /app fultang-compta-financiere-backend python manage.py migrate
docker exec -w /app fultang-compta-matiere-backend python manage.py migrate

echo "Peuplement personnel, services et compta (2025 clôturé + 2026 ouvert vide)..."
docker cp service-personnel/service_personnel/seed_data.py fultang-personnel:/app/service_personnel/seed_data.py
docker exec -w /app/service_personnel fultang-personnel python /app/service_personnel/seed_data.py
docker exec -w /app fultang-compta-financiere-backend python manage.py seed_demo --flush

echo "Peuplement comptabilité matière (matériels, besoins, stock)..."
docker exec -w /app fultang-compta-matiere-backend python manage.py seed_demo_matiere

echo "Terminé ! Exercice courant 2026 — historique 2025 dans Compta > Exercices > Historique."



