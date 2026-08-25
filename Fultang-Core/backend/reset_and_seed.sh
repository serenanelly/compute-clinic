#!/usr/bin/env bash
# Réinitialise les données de démo : personnel + compta (2025 clôturé, 2026 vide).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Migrations ==="
docker-compose -f "$ROOT/service-personnel/docker-compose.yml" exec -T backend python manage.py migrate 2>/dev/null \
  || docker-compose -f "$ROOT/docker-compose.yml" exec -T service-personnel python manage.py migrate

echo "=== Personnel & services ==="
docker cp "$ROOT/service-personnel/service_personnel/seed_data.py" fultang-personnel:/app/service_personnel/seed_data.py
docker-compose -f "$ROOT/docker-compose.yml" exec -T service-personnel python /app/service_personnel/seed_data.py

echo "=== Compta financière (flush + seed) ==="
docker-compose -f "$ROOT/fultang-compta-financiere/docker-compose.yml" exec -T backend python manage.py seed_demo --flush

echo ""
echo "✅ Terminé."
echo "   Exercice courant : 2026 (vide)"
echo "   Historique : 2025 clôturé (comparatif dans Exercices > Historique)"
echo "   Comptable/Caissier : paul.talla@fultang.local / Fultang@123"
echo "   Admin : admin@fultang.local / adminpass"
