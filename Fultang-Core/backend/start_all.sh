#!/usr/bin/env bash

# ==============================================================================
# Fultang Ecosystem — Script de démarrage global de tous les microservices
# ==============================================================================

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # Pas de couleur

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   Lancement de l'écosystème Polyclinique Fultang${NC}"
echo -e "${BLUE}======================================================${NC}"

# Fonction d'aide pour exécuter une commande et vérifier le statut
run_compose() {
    local service_name=$1
    local compose_path=$2
    
    echo -e "\n${CYAN}➔ Démarrage du microservice : ${service_name}...${NC}"
    if docker compose -f "$compose_path" up -d; then
        echo -e "${GREEN}✓ ${service_name} démarré avec succès.${NC}"
    else
        echo -e "${RED}✗ Échec du démarrage de ${service_name}.${NC}"
        return 1
    fi
}

# Fonction d'attente Kafka
wait_for_kafka() {
    echo -e "${CYAN}➔ Attente du broker Kafka...${NC}"
    for i in $(seq 1 30); do
        if docker exec fultang-kafka kafka-broker-api-versions --bootstrap-server localhost:9092 >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Kafka prêt.${NC}"
            return 0
        fi
        sleep 2
    done
    echo -e "${RED}⚠ Kafka non disponible — compta démarrera sans events async.${NC}"
    return 1
}

# 1. Base (Postgres, Personnel, API Gateway, Kafka)
echo -e "\n${CYAN}➔ Démarrage de la Gateway, Kafka et du socle d'authentification...${NC}"
if docker compose up -d; then
    echo -e "${GREEN}✓ Socle principal démarré.${NC}"
    wait_for_kafka || true
else
    echo -e "${RED}✗ Échec du socle principal.${NC}"
fi

# 2. Medical Monitoring — créer .env si absent
if [ ! -f "Medical-Monitoring/.env" ] && [ -f "Medical-Monitoring/.env.example" ]; then
    echo -e "${CYAN}➔ Création de Medical-Monitoring/.env depuis .env.example...${NC}"
    cp Medical-Monitoring/.env.example Medical-Monitoring/.env
    # Host Docker réel du service DB (nom du service dans docker-compose.yml)
    sed -i 's|@db:5432|@medical-db:5432|g' Medical-Monitoring/.env
    sed -i 's/^DB_HOST=db$/DB_HOST=medical-db/' Medical-Monitoring/.env
fi
# On charge AUSSI l'override : il monte le code source (le service medical n'a pas
# de code bind-mounté sinon → il tournerait l'ancienne image), fixe le port DB local
# et la commande de dev. Sans lui, les correctifs de code medical ne seraient pas actifs.
echo -e "\n${CYAN}➔ Démarrage du microservice : Medical Monitoring...${NC}"
if docker compose -f Medical-Monitoring/docker-compose.yml -f Medical-Monitoring/docker-compose.override.yml up -d; then
    echo -e "${GREEN}✓ Medical Monitoring démarré avec succès.${NC}"
else
    echo -e "${RED}✗ Échec du démarrage de Medical Monitoring.${NC}"
fi

# 2b. Clinical Agent (BD tampon) — démarre après Medical Monitoring
echo -e "\n${CYAN}➔ Démarrage du Clinical Agent (BD tampon)...${NC}"
if docker compose up -d clinical-agent; then
    echo -e "${GREEN}✓ Clinical Agent démarré (port 9000).${NC}"
else
    echo -e "${RED}⚠ Clinical Agent non démarré — l'export médical sera indisponible.${NC}"
fi

# 3. Gestion Infrastructures
run_compose "Gestion Infrastructures" "Gestion-Infrastructures/docker-compose.yml"

# 4. Comptabilité Financière
run_compose "Comptabilité Financière" "fultang-compta-financiere/docker-compose.yml"

# 5. Comptabilité Matière
run_compose "Comptabilité Matière" "ComptaMatiere/docker-compose.yml"

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${GREEN}🎉 Tous les microservices ont été lancés !${NC}"
echo -e "${CYAN}👉 Hub Développeur : http://localhost:8080/${NC}"
echo -e "${BLUE}======================================================${NC}"
