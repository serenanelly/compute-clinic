#!/usr/bin/env bash

# ==============================================================================
# Fultang Ecosystem — Script de migration vers l'Option A (UUIDs)
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
# Translate: Applying Option A: Migrating Personnel IDs to UUIDs
echo -e "${BLUE}   Application de l'Option A : Passage des IDs en UUID${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Build the updated container image
echo -e "\n${CYAN}➔ 1. Reconstruction de l'image service-personnel...${NC}"
if sudo docker compose build service-personnel; then
    echo -e "${GREEN}✓ Image reconstruite avec succès.${NC}"
else
    echo -e "${RED}✗ Échec de la reconstruction de l'image.${NC}"
    exit 1
fi

# 2. Reset database (to cleanly switch AutoField to UUIDField without DB casting errors)
echo -e "\n${CYAN}➔ 2. Réinitialisation propre de la base de données service_personnel...${NC}"
if sudo docker compose exec -T postgres psql -U admin -c "DROP DATABASE service_personnel;"; then
    echo -e "${GREEN}✓ Base de données précédente supprimée.${NC}"
else
    echo -e "${RED}⚠️ La base de données n'existait peut-être pas ou n'a pas pu être supprimée.${NC}"
fi

if sudo docker compose exec -T postgres psql -U admin -c "CREATE DATABASE service_personnel;"; then
    echo -e "${GREEN}✓ Base de données recréée à neuf.${NC}"
else
    echo -e "${RED}✗ Échec de la création de la base de données.${NC}"
    exit 1
fi

# 3. Restart the container with the newly built image
echo -e "\n${CYAN}➔ 3. Redémarrage du conteneur service-personnel...${NC}"
if sudo docker compose up -d service-personnel; then
    echo -e "${GREEN}✓ Conteneur démarré.${NC}"
else
    echo -e "${RED}✗ Échec du démarrage du conteneur.${NC}"
    exit 1
fi

# Wait a few seconds for database connection readiness
echo -e "${CYAN}Attente de 3 secondes pour l'initialisation de la DB...${NC}"
sleep 3

# 4. Run migrations inside the container
echo -e "\n${CYAN}➔ 4. Application des migrations Django (incluant le passage à UUIDField)...${NC}"
if sudo docker compose exec -T service-personnel python manage.py migrate; then
    echo -e "${GREEN}✓ Migrations appliquées avec succès.${NC}"
else
    echo -e "${RED}✗ Échec de l'application des migrations.${NC}"
    exit 1
fi

# 5. Populate database using seed_data.py
echo -e "\n${CYAN}➔ 5. Remplissage des données de test (seeding) avec des UUIDs tout neufs...${NC}"
if sudo docker compose exec -T service-personnel python seed_data.py; then
    echo -e "${GREEN}✓ Données de test insérées.${NC}"
else
    echo -e "${RED}✗ Échec de l'insertion des données de test.${NC}"
    exit 1
fi

# 6. Re-run endpoints validation script to audit the changes
echo -e "\n${CYAN}➔ 6. Lancement du script d'audit des endpoints pour valider le bon fonctionnement...${NC}"
if python3 /home/delta/.gemini/antigravity/brain/b48a973b-f2cb-4d58-a7da-66321f9caf06/scratch/verify_endpoints.py; then
    echo -e "${GREEN}✓ Audit d'API terminé et remarques.md mis à jour avec les nouveaux UUIDs !${NC}"
else
    echo -e "${RED}⚠️ Le script d'audit a signalé des erreurs.${NC}"
fi

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${GREEN}🎉 Migration réussie avec succès !${NC}"
echo -e "${CYAN}Les identifiants du Personnel sont maintenant des UUIDs universels.${NC}"
echo -e "${BLUE}======================================================${NC}"
