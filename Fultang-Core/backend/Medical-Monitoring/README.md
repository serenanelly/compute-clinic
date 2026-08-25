# Medical-Monitoring — Fultang

Microservice de suivi médical des patients, développé dans le cadre du projet **Fultang**.


**Medical-Monitoring** est le microservice du projet Fultang dédié à la digitalisation complète du parcours patient au sein de l'établissement hospitalier.

## Fonctionnalités couvertes

- Enregistrement et gestion des dossiers patients
- Gestion des consultations et des diagnostics
- Prescription d'examens médicaux et enregistrement des résultats
- Prescription de médicaments
- Gestion des hospitalisations
- Administration des soins
- Planification et gestion des rendez-vous

## Acteurs du système

Réceptionniste · Médecin généraliste · Médecin spécialiste · Infirmier · Pharmacien

## Stack technique

| Composant | Technologie |
|---|---|
| Backend | Django 5.x + Django REST Framework |
| Base de données | PostgreSQL 17 |
| Conteneurisation | Docker + Docker Compose |
| Authentification | JWT (djangorestframework-simplejwt) |

## Démarrage rapide

```bash
# 1. Cloner le dépôt
git clone <url-du-depot>
cd Medical-Monitoring

# 2. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec les vraies valeurs

# 3. Lancer les conteneurs
docker compose up --build
```

L'API sera disponible sur `http://localhost:8000`.

## Structure du projet

```
Medical-Monitoring/
├── backend/        # Application Django
├── database/       # Image PostgreSQL + script d'init
├── docker-compose.yml
├── .env.example
└── README.md
```

---

*Projet réalisé au Département de Génie Informatique — École Nationale Supérieure Polytechnique de Yaoundé (ENSPY), Université de Yaoundé I.*