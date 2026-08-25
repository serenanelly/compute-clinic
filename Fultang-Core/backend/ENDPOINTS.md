# 📡 Documentation des Endpoints — Fultang API Gateway

> **Base URL :** `http://localhost:8080`
> **Version :** 1.0.0
> **Dernière mise à jour :** 2026-04-17

Tous les endpoints ci-dessous ont été testés et validés en conditions réelles via la Gateway.
Les endpoints protégés nécessitent un `Bearer Token` obtenu via `/auth/login`.

---

## 🔐 Authentification

### `POST /auth/login`
Authentifie un utilisateur et retourne un couple de tokens JWT.

- **Auth requise :** Non
- **Rate Limit :** 5 requêtes/minute

**Corps de la requête :**
```json
{
  "email": "admin@fultang.local",
  "password": "adminpass"
}
```

**Réponse (200 OK) :**
```json
{
  "access_token": "eyJhbGci...",
  "refresh_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "admin@fultang.local",
    "roles": ["Admin"],
    "nom": "Admin",
    "prenom": "Global"
  }
}
```

---

### `POST /auth/refresh`
Renouvelle l'access token à partir d'un refresh token valide.

- **Auth requise :** Non

**Corps de la requête :**
```json
{
  "refresh_token": "eyJhbGci..."
}
```

**Réponse (200 OK) :**
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer"
}
```

---

## 🏥 Services (Départements Hospitaliers)

> **Préfixe Gateway :** `/personnel/services/`

### `GET /personnel/services/`
Liste tous les services hospitaliers (paginée).

- **Auth requise :** Oui

**Réponse (200 OK) :**
```json
{
  "count": 4,
  "next": null,
  "previous": null,
  "results": [
    { "id_service": 1, "nom_service": "Chirurgie", "code_analytique": "CHIR-001" },
    { "id_service": 2, "nom_service": "Radiologie", "code_analytique": "RAD-002" }
  ]
}
```

---

### `POST /personnel/services/`
Crée un nouveau département hospitalier.

- **Auth requise :** Oui

**Corps de la requête :**
```json
{
  "nom_service": "Urgences",
  "code_analytique": "URG-001"
}
```

**Réponse (201 Created) :**
```json
{
  "id_service": 5,
  "nom_service": "Urgences",
  "code_analytique": "URG-001"
}
```

---

### `PATCH /personnel/services/{id}/`
Mise à jour partielle d'un service.

- **Auth requise :** Oui

**Exemple :** `PATCH /personnel/services/5/`

**Corps de la requête :**
```json
{
  "code_analytique": "URG-2024-001"
}
```

**Réponse (200 OK) :**
```json
{
  "id_service": 5,
  "nom_service": "Urgences",
  "code_analytique": "URG-2024-001"
}
```

---

### `GET /personnel/services/{id}/medecins/`
Récupère tous les médecins affectés à un service spécifique.

- **Auth requise :** Oui

**Exemple :** `GET /personnel/services/1/medecins/`

**Réponse (200 OK) :**
```json
[
  {
    "id_personnel": 1,
    "nom": "Jean",
    "prenom": "Dupont",
    "specialite": "Chirurgie Cardiaque",
    "service": 1
  }
]
```

---

## 👨‍⚕️ Médecins

> **Préfixe Gateway :** `/personnel/medecins/`

### `GET /personnel/medecins/`
Liste tous les médecins (paginée).

- **Auth requise :** Oui

**Réponse (200 OK) :**
```json
{
  "count": 1,
  "results": [
    {
      "id_personnel": 1,
      "nom": "Jean",
      "prenom": "Dupont",
      "specialite": "Chirurgie Cardiaque",
      "numero_ordre": "ORD-54321",
      "statut": "Actif",
      "service": 1
    }
  ]
}
```

---

### `POST /personnel/medecins/`
Crée le profil d'un nouveau médecin.

- **Auth requise :** Oui

**Corps de la requête :**
```json
{
  "nom": "Nkomo",
  "prenom": "Patrick",
  "date_naissance": "1985-03-20",
  "adresse": "Bastos, Yaoundé",
  "email": "p.nkomo@fultang.local",
  "contact": "+237699001122",
  "matricule": "MED-2024-002",
  "date_embauche": "2024-01-15",
  "statut": "Actif",
  "mot_de_passe": "••••••••••",
  "service": 1,
  "specialite": "Neurologie",
  "numero_ordre": "ONMC-9900-Z"
}
```

**Réponse (201 Created) :**
```json
{
  "id_personnel": 2,
  "nom": "Nkomo",
  "prenom": "Patrick",
  "specialite": "Neurologie",
  "statut": "Actif"
}
```
> ⚠️ Le champ `mot_de_passe` est **write-only** : il n'apparaît jamais dans les réponses.

---

### `GET /personnel/medecins/{id}/`
Récupère le détail d'un médecin par son ID.

- **Auth requise :** Oui

**Exemple :** `GET /personnel/medecins/2/`

**Réponse (200 OK) :**
```json
{
  "id_personnel": 2,
  "nom": "Nkomo",
  "prenom": "Patrick",
  "adresse": "Bastos, Yaoundé",
  "specialite": "Neurologie",
  "statut": "Actif",
  "service": 1
}
```

---

### `PATCH /personnel/medecins/{id}/`
Mise à jour partielle du profil d'un médecin.

- **Auth requise :** Oui

**Exemple :** `PATCH /personnel/medecins/2/`

**Corps de la requête :**
```json
{
  "adresse": "Quartier du Lac, Yaoundé"
}
```

**Réponse (200 OK) :** Retourne le profil complet mis à jour.

---

### `DELETE /personnel/medecins/{id}/`
Supprime le profil d'un médecin.

- **Auth requise :** Oui

**Exemple :** `DELETE /personnel/medecins/2/`

**Réponse :** `204 No Content`

---

## 👩‍⚕️ Infirmières

> **Préfixe Gateway :** `/personnel/infirmieres/`

### `GET /personnel/infirmieres/`
Liste toutes les infirmières (paginée).

- **Auth requise :** Oui

**Réponse (200 OK) :**
```json
{
  "count": 1,
  "results": [
    {
      "id_personnel": 1,
      "nom": "Ateba",
      "prenom": "Marie",
      "grade": "IDE",
      "statut": "Actif",
      "service": 1
    }
  ]
}
```

---

### `POST /personnel/infirmieres/`
Crée le profil d'une nouvelle infirmière.

- **Auth requise :** Oui

**Corps de la requête :**
```json
{
  "nom": "Ateba",
  "prenom": "Marie",
  "date_naissance": "1992-07-14",
  "email": "m.ateba@fultang.local",
  "matricule": "INF-2024-001",
  "date_embauche": "2024-02-01",
  "statut": "Actif",
  "mot_de_passe": "••••••••••",
  "service": 1,
  "grade": "IDE"
}
```

**Réponse (201 Created) :** Profil créé sans le mot de passe.

---

## 💊 Pharmaciens

> **Préfixe Gateway :** `/personnel/pharmaciens/`

### `POST /personnel/pharmaciens/`
Crée le profil d'un pharmacien avec son numéro de licence.

- **Auth requise :** Oui

**Corps de la requête :**
```json
{
  "nom": "Ekani",
  "prenom": "Sylvie",
  "date_naissance": "1988-04-12",
  "email": "s.ekani@fultang.local",
  "matricule": "PHA-2024-001",
  "date_embauche": "2024-01-20",
  "statut": "Actif",
  "mot_de_passe": "••••••••••",
  "service": 2,
  "numero_licence": "PH-CMR-12345"
}
```

**Réponse (201 Created) :**
```json
{
  "id_personnel": 1,
  "nom": "Ekani",
  "prenom": "Sylvie",
  "numero_licence": "PH-CMR-12345",
  "statut": "Actif",
  "service": 2
}
```

---

## ⚙️ Administration Système

> **Préfixe Gateway :** `/personnel/admins/`

### `POST /personnel/admins/`
Crée un compte Administrateur système.

- **Auth requise :** Oui

**Corps de la requête :**
```json
{
  "nom": "Mballa",
  "prenom": "Cedric",
  "date_naissance": "1994-09-18",
  "email": "c.mballa@fultang.local",
  "matricule": "ADM-2024-001",
  "date_embauche": "2024-03-01",
  "statut": "Actif",
  "mot_de_passe": "••••••••••",
  "service": 3
}
```

**Réponse (201 Created) :** Profil Admin créé, mot de passe non retourné.

---

## 📋 Tableau Récapitulatif

| # | Méthode | Endpoint | Auth | Résultat Test |
|---|---------|----------|------|--------------|
| 1 | `POST` | `/auth/login` | ❌ | ✅ 200 OK |
| 2 | `POST` | `/auth/refresh` | ❌ | ✅ 200 OK |
| 3 | `GET` | `/personnel/services/` | ✅ | ✅ 200 OK |
| 4 | `POST` | `/personnel/services/` | ✅ | ✅ 201 Created |
| 5 | `PATCH` | `/personnel/services/{id}/` | ✅ | ✅ 200 OK |
| 6 | `GET` | `/personnel/services/{id}/medecins/` | ✅ | ✅ 200 OK |
| 7 | `GET` | `/personnel/medecins/` | ✅ | ✅ 200 OK |
| 8 | `POST` | `/personnel/medecins/` | ✅ | ✅ 201 Created |
| 9 | `GET` | `/personnel/medecins/{id}/` | ✅ | ✅ 200 OK |
| 10 | `PATCH` | `/personnel/medecins/{id}/` | ✅ | ✅ 200 OK |
| 11 | `DELETE` | `/personnel/medecins/{id}/` | ✅ | ✅ 204 No Content |
| 12 | `GET` | `/personnel/infirmieres/` | ✅ | ✅ 200 OK |
| 13 | `POST` | `/personnel/infirmieres/` | ✅ | ✅ 201 Created |
| 14 | `POST` | `/personnel/pharmaciens/` | ✅ | ✅ 201 Created |
| 15 | `POST` | `/personnel/admins/` | ✅ | ✅ 201 Created |

---

## 🗺️ Autres Endpoints Disponibles (non testés ici)

| Endpoint | Description |
|----------|-------------|
| `GET/POST /personnel/receptionnistes/` | Gestion des réceptionnistes |
| `GET/POST /personnel/comptables-financiers/` | Comptabilité financière |
| `GET/POST /personnel/comptables-matieres/` | Gestion des stocks/matières |
| `GET/POST /personnel/laborantins/` | Personnel de laboratoire |
| `GET/POST /personnel/directeurs/` | Direction de l'hôpital |
| `GET /personnel/services/{id}/infirmieres/` | Infirmières d'un service |

---

> **💡 Swagger UI :** [http://localhost:8080/docs](http://localhost:8080/docs)
> **💡 Doc Personnel détaillée :** [http://localhost:8080/personnel/docs/](http://localhost:8080/personnel/docs/)
