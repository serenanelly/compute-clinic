# Documentation Technique - Backend Fultang

Ce dépôt contient les microservices du backend de l'Hôpital Fultang.

## Architecture

L'architecture est composée de :
1. **API Gateway (FastAPI)** : Point d'entrée unique (`port 8080`). Gère l'authentification JWT et le routage.
2. **Service Personnel (Django)** : Gère les ressources humaines (`port 8000`).
3. **Persistance** : SQLite (en local) ou PostgreSQL (via Docker).

---

## Guide de l'API Gateway (`http://localhost:8080`)

### Authentification

La gateway centralise l'authentification. Elle utilise des tokens JWT (Access et Refresh).

- **Login** : `POST /auth/login`
  - *Corps* : `{"email": "...", "password": "..."}`
  - *Réponse* : Contient l'Access Token, le Refresh Token et les données utilisateur.
- **Refresh** : `POST /auth/refresh`
  - *Corps* : `{"refresh_token": "..."}`
  - *Réponse* : Nouvel Access Token.

### Routage (Proxy)

Toutes les requêtes vers les microservices passent par la gateway avec le préfixe approprié :
- `/personnel/**` est redirigé vers le **Service Personnel** (`/api/**`).
  - Exemple : `GET /personnel/medecins/` -> `GET /api/medecins/` sur le service interne.

### Sécurité

- **Rate Limiting** : Limité à 5 tentatives de connexion par minute par IP.
- **Injection de Headers** : La gateway injecte automatiquement `X-User-ID` et `X-User-Roles` dans les requêtes transmises aux microservices si un token valide est présent.

---

## Guide de Test Manuel

### 1. Comptes de test disponibles
| Rôle | Email | Mot de passe |
| :--- | :--- | :--- |
| **Médecin** | `jean.dupont@fultang.local` | `password123` |
| **Admin** | `admin@fultang.local` | `adminpass` |

### 2. Procédure de test

1.  **Swagger UI** : Accédez à `http://localhost:8080/docs` pour une interface interactive.
2.  **Tester le Login** :
    ```bash
    curl -X POST http://localhost:8080/auth/login \
         -H "Content-Type: application/json" \
         -d '{"email": "admin@fultang.local", "password": "adminpass"}'
    ```
3.  **Tester l'accès aux données (via Gateway)** :
    ```bash
    curl -X GET http://localhost:8080/personnel/services/
    ```

---

## Installation Locale (Sans Docker)

1.  **Service Personnel** :
    - Aller dans `Backend/service-personnel/service_personnel`.
    - `../venv/bin/python manage.py migrate`.
    - `../venv/bin/python manage.py runserver 8000`.

2.  **API Gateway** :
    - Aller dans `Backend/api-gateway`.
    - `export SERVICE_PERSONNEL_URL=http://localhost:8000`.
    - `./venv/bin/python -m uvicorn app.main:app --port 8080`.
