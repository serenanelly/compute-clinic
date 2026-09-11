#!/usr/bin/env bash

# ==============================================================================
# Fultang Ecosystem — Script de démarrage global (Backend & Frontend Dockerisés)
# ==============================================================================

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # Pas de couleur

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   Lancement complet de l'écosystème Fultang (Docker)${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Vérification de Docker et Docker Compose
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker n'est pas installé. Veuillez l'installer avant de continuer.${NC}"
    exit 1
fi

# 2. Création du réseau partagé s'il n'existe pas
echo -e "\n${CYAN}➔ Vérification du réseau Docker partagé...${NC}"
if ! docker network inspect fultang_shared_network &> /dev/null; then
    echo -e "${CYAN}➔ Création du réseau 'fultang_shared_network'...${NC}"
    docker network create fultang_shared_network
    echo -e "${GREEN}✓ Réseau créé avec succès.${NC}"
else
    echo -e "${GREEN}✓ Réseau 'fultang_shared_network' existant.${NC}"
fi

# 3. Démarrage des microservices Backend
echo -e "\n${CYAN}➔ Démarrage des microservices backend...${NC}"
if [ -f "backend/start_all.sh" ]; then
    chmod +x backend/start_all.sh
    (cd backend && ./start_all.sh)
else
    echo -e "${RED}✗ Script backend/start_all.sh introuvable.${NC}"
    exit 1
fi

# 4. Démarrage du Frontend dans Docker
echo -e "\n${CYAN}➔ Démarrage du Frontend React/Vite (Docker)...${NC}"
if [ -d "Frontend" ] && [ -f "Frontend/docker-compose.yml" ]; then
    if (cd Frontend && docker compose build --pull=false && docker compose up -d); then
        echo -e "${GREEN}✓ Frontend démarré et servi sur le port 3000.${NC}"
    else
        echo -e "${RED}✗ Échec du démarrage du Frontend.${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Configuration Docker du Frontend introuvable.${NC}"
    exit 1
fi

# 5. Application des migrations et du seeding de la base de données
echo -e "\n${CYAN}➔ Attente de la disponibilité des bases de données (10s)...${NC}"
sleep 10
echo -e "\n${CYAN}➔ Exécution des migrations et peuplement (seeding) de la base de données...${NC}"
if [ -f "backend/apply_seed.sh" ]; then
    chmod +x backend/apply_seed.sh
    (cd backend && ./apply_seed.sh)
    echo -e "${GREEN}✓ Migrations et peuplement de la base de données terminés.${NC}"
else
    echo -e "${RED}⚠ Script backend/apply_seed.sh introuvable. Migrations ignorées.${NC}"
fi

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${GREEN}🎉 Écosystème Fultang entièrement démarré !${NC}"
echo -e "${CYAN}👉 Frontend Application : http://localhost:3000/${NC}"
echo -e "${CYAN}👉 Hub Développeur Gateway : http://localhost:8080/${NC}"
echo -e "${BLUE}======================================================${NC}"

