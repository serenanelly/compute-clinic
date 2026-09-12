# Architecture Multitenant — FullTang

Documentation de référence technique. Retrace l'intégralité du travail multitenant depuis son démarrage, phase par phase, avec statut honnête de chaque brique : **Implémenté et testé**, **Partiellement implémenté**, ou **Non implémenté**.

> Convention utilisée dans tout ce document : aucune fonctionnalité n'est présentée comme terminée si elle ne l'est pas réellement. Une brique "Partiellement implémentée" signifie qu'une partie fonctionne mais qu'il manque une étape connue et documentée.

---

## Sommaire

1. [Architecture initiale](#1-architecture-initiale)
2. [Architecture multitenant retenue](#2-architecture-multitenant-retenue)
3. [Tenant Management](#3-tenant-management)
4. [Tenant Identification](#4-tenant-identification)
5. [Tenant Resolution](#5-tenant-resolution)
6. [Authentification Tenant-Aware](#6-authentification-tenant-aware)
7. [Gestion des utilisateurs](#7-gestion-des-utilisateurs)
8. [Propagation du contexte](#8-propagation-du-contexte)
9. [Bases de données](#9-bases-de-données)
10. [Provisioning](#10-provisioning)
11. [Migration](#11-migration)
12. [Service-to-Service](#12-service-to-service)
13. [Medical Monitoring / Clinical Agent](#13-medical-monitoring--clinical-agent)
14. [Configuration Tenant](#14-configuration-tenant)
15. [Sécurité](#15-sécurité)
16. [Tests et validation](#16-tests-et-validation)
17. [Historique des modifications](#17-historique-des-modifications)
18. [Ce qui a été conservé](#18-ce-qui-a-été-conservé)
19. [Ce qui reste à faire](#19-ce-qui-reste-à-faire)

---

## 1. Architecture initiale

Avant tout travail multitenant, FullTang était un système **monotenant**, organisé en microservices indépendants.

### 1.1 Organisation des services

```
                        ┌─────────────────────────┐
   Client  ───────────► │   API Gateway (FastAPI)  │  :8080
                        │   JWT + routage + rate   │
                        │   limiting               │
                        └────────────┬─────────────┘
                                     │ proxy HTTP direct (catch-all)
        ┌────────────────┬──────────┼───────────┬──────────────────┐
        ▼                ▼          ▼           ▼                  ▼
  service-personnel  Medical-   Gestion-    ComptaMatiere   fultang-compta-
  (Django/DRF)       Monitoring Infrastructures (Django)    financiere
  :8000              (Django)   (Django)                    (Django)
        │
        ▼ (DB propre à chaque service, PostgreSQL)
```

Chaque service métier possède sa **propre base PostgreSQL** (déjà "un service = une base", mais pas encore "un tenant = une base" — voir [§9](#9-bases-de-données)). `clinical-agent` (FastAPI + SQLAlchemy) communique directement avec `Medical-Monitoring` et une base tampon, hors du passage par la Gateway (voir [§12](#12-service-to-service)).

### 1.2 Authentification initiale (avant multitenant)

```
Client → POST /auth/login {email, password}
           │
           ▼
   API Gateway ── POST /api/auth/verify/ ──► service-personnel
           │                                  (cherche email dans TOUS
           │                                   les modèles de rôle,
           │                                   sans aucune notion de
           │                                   tenant)
           ▼
   JWT { sub, roles, email, nom, prenom }
           │
           ▼
Requêtes suivantes → Gateway décode le JWT → injecte
X-User-ID / X-User-Roles → service métier
```

- **JWT** : HS256, `python-jose`, access token (30 min) + refresh token (7 jours). Fichier : `api-gateway/app/auth/jwt_handler.py`.
- **Confiance Gateway → services** : chaque service Django est protégé par une classe DRF maison, `GatewayHeaderAuthentication`, qui **fait confiance aveuglément** aux headers `X-User-ID`/`X-User-Roles` qu'elle reçoit — elle ne revérifie jamais le JWT elle-même. Ce fichier est dupliqué (copié-collé, pas de librairie partagée) dans **6 services** : `service-personnel`, `tenant-service`, `Gestion-Infrastructures`, `ComptaMatiere`, `Medical-Monitoring`, `fultang-compta-financiere` — avec des variantes de style mineures (voir [§17](#17-historique-des-modifications)).

### 1.3 Organisation initiale des utilisateurs

Le modèle `Personnel` (abstrait, `service-personnel/api/models.py`) est hérité par 10 modèles concrets (`Medecin`, `Infirmiere`, `Admin`, `Directeur`, ...), **chacun sa propre table** (héritage multi-table Django). Avant le multitenant :

- `email` et `matricule` étaient **`unique=True` globalement, par table de rôle** — un `Medecin` et une `Infirmiere` pouvaient partager un email (tables distinctes), mais deux `Medecin` ne le pouvaient jamais, où qu'ils travaillent.
- **Aucune notion d'établissement** n'existait : un seul pool d'utilisateurs pour tout FullTang.

---

## 2. Architecture multitenant retenue

Décision structurante, actée dès la Phase 1 et respectée depuis :

```
Tenant (établissement de santé indépendant)
  └── Users (personnel de CET établissement uniquement)
```

**Le tenant est au-dessus de l'utilisateur.** Il n'existe aucun pool d'utilisateurs partagé entre tenants.

> **Une même personne travaillant dans deux établissements = deux comptes/utilisateurs distincts dans le système.** Pas de compte unique multi-tenant, pas de SSO cross-tenant (voir [§18](#18-ce-qui-a-été-conservé) — aucun système SSO n'a été introduit).

Direction architecturale retenue à terme : **Database per Tenant** (chaque établissement aura sa propre base de données métier). **Non implémentée à ce stade** — voir [§9](#9-bases-de-données).

Roadmap complète (12 phases) :

| # | Phase | Statut |
|---|---|---|
| 1 | Tenant Management | Partiellement implémenté |
| 2 | Tenant Identification & Resolution | Implémenté et testé |
| 3 | Tenant-Aware Authentication | Implémenté et testé |
| 4 | Tenant Context Propagation | Implémenté et testé pour les services métier classiques (4/4) ; Medical Monitoring / Clinical Agent exclus par décision architecturale, voir [§13](#13-medical-monitoring--clinical-agent) |
| 5 | Tenant Database Management | Implémenté et testé (registre logique `TenantDatabase`/`PlatformService`) — voir [§9.1](#91-phase-5--tenant-database-management-registre-logique) |
| 6 | Dynamic Database Routing | Implémenté et testé pour `service-personnel` **et Medical-Monitoring** — voir [§9.2](#92-phase-6--dynamic-database-routing), [§13.1](#131-medical-monitoring--mécanisme-tenant-aware) |
| 7 | Tenant Provisioning | Implémenté et testé pour `service-personnel` **et Medical-Monitoring** (création physique de base + migration) ; déclaratif seul (`SKIPPED`) pour les autres services — voir [§10.2](#102-phase-7--tenant-provisioning) |
| 8 | Data Migration | Non implémenté |
| 9 | Tenant Configuration | Non implémenté |
| 10 | Tenant Isolation & Security Testing | Non implémenté |
| 11 | Tenant Lifecycle Management | Non implémenté |
| 12 | Multi-Tenant Operations | Non implémenté |

---

## 3. Tenant Management

**Statut : Partiellement implémenté** (structure + CRUD complets, configuration métier non commencée).

### 3.1 Le service `tenant-service`

Nouveau microservice Django/DRF autonome, calqué sur le gabarit `Gestion-Infrastructures`, avec sa **propre base PostgreSQL dédiée** (`tenant_registry_db`) — c'est le "control plane" du multitenant. Port 8005, conteneur `fultang-tenant-web`.

```
tenant-service/
├── config/            → settings, urls, authentication (Gateway trust)
└── tenants/
    ├── models.py       → Tenant
    ├── repositories.py → TenantRepository (accès ORM pur)
    ├── services.py     → TenantService (opérations métier)
    ├── serializers.py  → TenantSerializer, TenantStatusUpdateSerializer,
    │                     TenantResolutionSerializer
    ├── permissions.py  → IsPlatformAdmin, IsInternalService
    ├── views.py        → TenantViewSet
    └── tests.py        → 21 tests
```

### 3.2 Modèle `Tenant`

```python
class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)              # nom métier affiché
    identifier = models.SlugField(max_length=100, unique=True)  # technique, stable
    status = models.CharField(choices=TenantStatus.choices, default=ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
```

Conçu pour extension ultérieure **sans refonte** : pas de configuration métier, pas de modules, pas de feature flags (volontairement, réservé à la Phase 9 — voir [§14](#14-configuration-tenant)).

### 3.3 Endpoints (CRUD)

| Méthode | Route | Autorisation | Statut |
|---|---|---|---|
| `POST` | `/api/tenants/` | `PLATFORM_ADMIN` | Implémenté et testé |
| `GET` | `/api/tenants/` | `PLATFORM_ADMIN` | Implémenté et testé |
| `GET` | `/api/tenants/{id}/` | `PLATFORM_ADMIN` | Implémenté et testé |
| `PATCH` | `/api/tenants/{id}/status/` | `PLATFORM_ADMIN` | Implémenté et testé (activation/désactivation) |
| `GET` | `/api/tenants/resolve/?identifier=` | `IsInternalService` (jeton interne) | Implémenté et testé — usage exclusif Gateway |

Exposés à travers la Gateway sous `/tenants/**` (proxy `api-gateway/app/main.py`).

### 3.4 Administration / autorisation

Distinction actée et implémentée (correction Phase 1) :

- **PLATFORM SCOPE** : `PLATFORM_ADMIN` — hors des tenants, seul rôle autorisé à gérer le Tenant Registry.
- **TENANT SCOPE** : le rôle métier `ADMIN` (administrateur d'établissement) **n'a explicitement aucun accès** au Tenant Registry — vérifié par tests (401 anonyme / 403 `ADMIN` / 200-201 `PLATFORM_ADMIN`).

### 3.5 Ce qui n'est PAS implémenté

- **Suppression/archivage de tenant** : aucun endpoint `DELETE`.
- **Configuration métier d'un tenant** (modules activés, feature flags, formulaires) — voir [§14](#14-configuration-tenant).
- **Aucun flux ne permet actuellement d'associer un utilisateur réel à un tenant via l'API** (voir [§10](#10-provisioning)).
- **Aucun compte `PLATFORM_ADMIN` réel n'existe** dans `service-personnel` — le rôle est vérifié techniquement (tests avec headers simulés) mais aucun utilisateur de ce type ne peut se connecter via le flux de login réel aujourd'hui.

---

## 4. Tenant Identification

**Statut : Implémenté et testé**, dans les limites décrites ci-dessous.

### 4.1 Information utilisée

Le **sous-domaine du hostname de la requête HTTP** :

```
https://hopital-central.fulltang.com
                 │
                 └──► identifier = "hopital-central"
```

`identifier` (≠ `name`, voir [§3.2](#32-modèle-tenant)) est l'unique information utilisée pour l'identification — stable, ne casse jamais une intégration existante même si le nom affiché change.

### 4.2 Où cela se fait

Uniquement côté **API Gateway** (`api-gateway/app/tenant/resolver.py`, méthode `TenantResolver.extract_identifier()`). Aucun autre service n'identifie un tenant par lui-même.

### 4.3 Validations effectuées

| Cas | Comportement |
|---|---|
| `<identifier>.fulltang.com` | Extraction réussie |
| `localhost`, `localhost:8080` | Hors convention → `None` (pas une erreur, dev local préservé) |
| `fulltang.com` (domaine racine seul) | Hors convention → `None` |
| `example.com` (domaine tiers) | Hors convention → `None` |
| `api.hopital-central.fulltang.com` (sous-domaine imbriqué) | Hors convention → `None` |

Domaine racine **configurable** via `TENANT_ROOT_DOMAIN` (variable d'environnement, défaut `fulltang.com`, `pydantic-settings`) — aucune valeur en dur dans le code.

### 4.4 Fiabilité

- **Fiable** : l'extraction du sous-domaine est déterministe et testée (6 tests unitaires dédiés).
- **Limite connue** : le hostname prouve uniquement *"quel tenant est visé"*, jamais *"qui a le droit d'y accéder"* — cette distinction est respectée dans tout le code (voir [§15](#15-sécurité)).
- **À améliorer** : seul le schéma `<identifier>.<root_domain>` est supporté. Domaines personnalisés (`www.hopital-central.com`) et résolution par path/header ne sont **pas implémentés** (exclus explicitement du périmètre).

---

## 5. Tenant Resolution

**Statut : Implémenté et testé** pour le flux hostname → tenant. **Non lié à l'autorisation utilisateur** (volontairement, voir [§15](#15-sécurité)).

### 5.1 Rôle et emplacement

`TenantResolver` (`api-gateway/app/tenant/resolver.py`), instancié une fois au démarrage de la Gateway (`app/main.py`), appelé dans `proxy_catch_all()` **avant** tout routage vers un microservice métier.

### 5.2 Fonctionnement

```
hostname
   │
   ▼
extract_identifier()  ──► None ──► pas de contexte tenant, requête continue (CAS 4/5)
   │
   ▼ identifier
GET tenant-service/api/tenants/resolve/?identifier=<x>
   (header X-Internal-Service-Token — voir §12)
   │
   ├── 404 ──► TenantNotFoundError  (CAS 2)
   ├── status != ACTIVE ──► TenantInactiveError  (CAS 3)
   └── 200 + ACTIVE ──► TenantContext(tenant_id, tenant_identifier, status)  (CAS 1)
```

`tenant-service` reste la **seule source de vérité** — aucune liste de tenants n'est dupliquée côté Gateway (vérifié par test : `test_resolve_uses_tenant_service_as_source_of_truth`).

### 5.3 `TenantContext`

```python
@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    tenant_identifier: str
    status: str   # toujours "ACTIVE" ici (sinon exception levée avant construction)
```

### 5.4 Cas d'erreur gérés

| Cas | Comportement HTTP (Gateway) |
|---|---|
| Hostname valide, tenant ACTIVE | Résolution réussie, requête continue |
| Hostname valide, tenant inexistant | `404`, **aucun** appel au service métier |
| Tenant existant mais INACTIVE | `403`, **aucun** appel au service métier |
| Hostname hors convention | Pas d'erreur — `tenant_context = None`, comportement pré-Phase-2 préservé |
| `tenant-service` injoignable | `503` |

### 5.5 Tests

19 tests dans `api-gateway/tests/test_tenant_resolver.py` : extraction, résolution (succès/inconnu/inactif/injoignable), non-hardcoding, jeton interne (voir [§12](#12-service-to-service)).

### 5.6 Décisions prises

- Domaine unique `<identifier>.fulltang.com` (pas de domaines personnalisés pour l'instant).
- Un hostname hors convention n'est PAS une erreur (compatibilité dev locale).
- Le endpoint `GET /tenants/resolve/` n'est PAS public — corrigé après une revue de sécurité (voir [§12](#12-service-to-service)).

---

## 6. Authentification Tenant-Aware

**Statut : Implémenté et testé.**

### 6.1 Association utilisateur ↔ tenant

`Personnel.tenant_id` (`service-personnel/api/models.py`) : `UUIDField(null=True, blank=True, editable=False, db_index=True)`, présent sur les 10 modèles concrets via l'héritage abstrait.

- **`editable=False`** : choix délibéré — DRF exclut automatiquement ce champ de l'écriture sur tous les serializers `fields = '__all__'` existants. **Aucun client ne peut jamais définir son propre `tenant_id`** via l'API CRUD (`POST /api/medecins/`, etc.), sans avoir eu à modifier un seul serializer.
- **`null=True`** : un `tenant_id` absent = compte du "pool non assigné" (comptes créés avant le multitenant, ou dev local) — voir [§11](#11-migration).

### 6.2 Contraintes d'unicité (scopées par tenant)

Avant : `email`/`matricule` étaient `unique=True` **globalement**. Ceci **empêchait physiquement** le principe "même personne dans 2 établissements = 2 comptes" — corrigé :

```python
class Meta:
    abstract = True
    constraints = [
        UniqueConstraint(fields=['tenant_id', 'email'], name='%(app_label)s_%(class)s_unique_email_per_tenant'),
        UniqueConstraint(fields=['tenant_id', 'matricule'], name='%(app_label)s_%(class)s_unique_matricule_per_tenant'),
    ]
```

Migration `service-personnel/api/migrations/0006_admin_tenant_id_comptablefinancier_tenant_id_and_more.py` : 10× `AddField(tenant_id)`, 20× `AlterField` (email/matricule), 20× `AddConstraint` — un jeu par modèle concret.

> **Limite connue** : Postgres ne considère pas deux `NULL` comme égaux — l'unicité `(tenant_id, email)` ne s'applique donc pas entre plusieurs comptes du pool non assigné. Comportement transitoire, sans impact tant que la Migration ([§11](#11-migration)) n'a pas eu lieu.

### 6.3 Recherche utilisateur par email + tenant

`AuthVerifyView.post()` (`service-personnel/api/views.py`) — `tenant_id` fourni **par la Gateway**, jamais par le client :

```python
user = model.objects.get(email=email, tenant_id=tenant_id)  # tenant_id peut être None
```

`tenant_id=None` recherche explicitement parmi le pool non assigné — comportement délibéré pour ne pas casser le login en environnement de développement local.

### 6.4 `tenant_id` dans le JWT

`api-gateway/app/main.py::login()` :

```
Host (hostname requête)
  → tenant_resolver.resolve()   [réutilisé, non modifié]
  → tenant_id (ou None si hors convention)
  → POST verify/ {email, password, tenant_id}
  → JWT { sub, tenant_id, roles, email, nom, prenom, exp, type }
```

`tenant_id` vient **exclusivement** de la résolution serveur (jamais de la réponse `verify/`, jamais du client).

### 6.5 Login — cas gérés

| Cas | Comportement |
|---|---|
| Hostname valide, tenant ACTIVE, identifiants valides pour ce tenant | `200`, JWT avec `tenant_id` correct |
| Hostname valide, tenant inexistant | `404`, **aucun** appel à `service-personnel` |
| Tenant existant mais INACTIVE | `403`, **aucun** appel à `service-personnel` |
| Utilisateur inexistant dans le tenant demandé | `401` (même si le même email existe dans un autre tenant) |
| Hostname hors convention (dev local) | `tenant_id=None`, login inchangé vs avant cette phase |

### 6.6 Refresh token

`refresh_token()` propage `tenant_id` du refresh token vers le nouvel access token — **sans re-résolution ni re-vérification du statut du tenant** (comportement identique aux autres claims comme `roles`/`email`, qui ne sont pas non plus re-vérifiés au refresh — cohérent avec l'existant, pas une régression).

### 6.7 Contrôle tenant demandé vs tenant du token

`proxy_catch_all()` (`api-gateway/app/main.py`) :

```python
user_payload = _decode_bearer_token(request)   # décodé UNE FOIS
if tenant_context is not None and user_payload is not None:
    if user_payload.get("tenant_id") != tenant_context.tenant_id:
        raise HTTPException(403, "Ce token n'est pas valide pour l'établissement demandé.")
```

| Situation | Résultat |
|---|---|
| Token Tenant A → requête sur Tenant A | Autorisée |
| Token Tenant A → requête sur Tenant B | `403` |
| Token invalide/expiré | Comportement 401 existant inchangé (pas de 403 tenant) |
| Requête anonyme | Comportement existant inchangé |
| Hostname hors convention (pas de tenant demandé) | Pas de comparaison possible, requête continue |

### 6.8 Tests réalisés

- `service-personnel/api/tests.py` : 11 tests — `AuthVerifyTenantScopingTests` (5), `PersonnelTenantUniquenessTests` (2), `GatewayHeaderAuthenticationTenantTests` (3, voir [§8](#8-propagation-du-contexte)), exécutés **dans le conteneur Docker réel, contre PostgreSQL réel**.
- `api-gateway/tests/test_login_tenant_context.py` : 10 tests (login, refresh, mismatch, tenant inconnu/inactif, utilisateur inconnu).
- **Vérification end-to-end réelle** (stack Docker complète, comptes réels créés) : login, JWT décodé et inspecté, requêtes autorisées/refusées, refresh, tous les cas confirmés en conditions réelles (pas seulement mockées).

### 6.9 Fichiers modifiés

`service-personnel/api/models.py`, `api/views.py`, `api/migrations/0006_...py`, `api/tests.py` ; `api-gateway/app/main.py`.

---

## 7. Gestion des utilisateurs

Décision : **Tenant → Users**, pas de pool global. Conséquences concrètes déjà en place :

- Les données utilisateur **ne sont pas mélangées entre tenants** au niveau de l'unicité (`UniqueConstraint(tenant_id, email)`) et de la recherche d'authentification (`get(email=, tenant_id=)`).
- **Important — nuance à ne pas ignorer** : cette séparation concerne l'**authentification**. Les endpoints CRUD métier existants (`GET /api/medecins/`, `GET /api/admins/`, ...) **ne filtrent PAS encore par tenant** — ils retournent aujourd'hui tout le contenu de leur table, tous tenants confondus. Ce n'est **pas un oubri de cette phase** : l'isolation des données métier est explicitement hors périmètre (voir [§9](#9-bases-de-données) et [§19](#19-ce-qui-reste-à-faire)).

---

## 8. Propagation du contexte

**Statut : Implémenté et testé** (cette tâche), avec un **fix de sécurité corollaire** découvert et corrigé pendant l'audit demandé.

> **Décision architecturale** — Le contexte tenant est propagé aux services métier classiques utilisant le contexte utilisateur, mais tous les services ne sont pas rendus tenant-aware de manière uniforme. Les services ayant des flux métier spécifiques, notamment Medical Monitoring et Clinical Agent, feront l'objet d'une conception tenant dédiée.

### 8.1 Flux cible

```
Client
  │  Authorization: Bearer <JWT>
  ▼
API Gateway
  │  1. decode_token(JWT) → payload { sub, tenant_id, roles, ... }   [UNE SEULE FOIS]
  │  2. tenant_resolver.resolve(hostname) → tenant_context
  │  3. si tenant_context et payload : tenant_context.tenant_id == payload.tenant_id ? sinon 403
  │  4. _strip_client_identity_headers()  → supprime tout X-User-*/X-Tenant-ID
  │     envoyé directement par le client, AVANT réinjection
  │  5. _build_user_headers() → réinjecte depuis le payload validé UNIQUEMENT
  ▼
X-User-ID: <payload.sub>
X-User-Roles: <payload.roles>
X-Tenant-ID: <payload.tenant_id>          (absent si tenant_id est None)
  ▼
Service métier (ex: service-personnel)
  │  GatewayHeaderAuthentication.authenticate()
  ▼
request.user = GatewayUser(id, roles, tenant_id)
```

### 8.2 Rôle de `GatewayUser` / `GatewayHeaderAuthentication`

`GatewayHeaderAuthentication` (classe DRF `BaseAuthentication`) fait confiance aux headers **déjà validés par la Gateway** — elle ne revérifie pas le JWT (inchangé, voir [§18](#18-ce-qui-a-été-conservé)). Elle construit un objet `GatewayUser` léger :

```python
class GatewayUser:
    def __init__(self, user_id, roles, tenant_id=None):
        self.id = user_id
        self.roles = roles
        self.tenant_id = tenant_id     # ← nouveau
        ...
```

### 8.3 Fix de sécurité corollaire — headers d'identité forgés

**Découverte pendant l'audit explicitement demandé (Partie 2 de la tâche).** Avant cette phase, `_forward()` faisait `headers = dict(request.headers)` (copie **tous** les headers du client, y compris `X-User-ID`/`X-User-Roles` si le client les envoyait lui-même), puis ne les **écrasait** que si un JWT valide était présent — sans jamais les **supprimer** en l'absence de token valide. Un client anonyme (ou avec un token invalide) pouvait donc faire transiter ses propres `X-User-ID: <uuid>` / `X-User-Roles: PLATFORM_ADMIN` / (désormais) `X-Tenant-ID: <tenant>` directement vers un service métier, qui les aurait acceptés aveuglément.

**Corrigé** par `_strip_client_identity_headers()`, appelée systématiquement dans `_forward()` avant toute réinjection — indépendamment de la présence d'un token valide.

**Vérifié en conditions réelles** (pas seulement en test mocké) :
```
curl -H "Host: hopital-central.fulltang.com" \
     -H "X-User-ID: fake-admin-id" -H "X-User-Roles: PLATFORM_ADMIN" \
     -H "X-Tenant-ID: <tenant>" http://localhost:8080/personnel/medecins/
→ 401 (headers forgés supprimés avant transmission)
```
et, avec un token légitime accompagné d'un `X-Tenant-ID` forgé dans la même requête → seul le tenant du JWT est transmis, jamais la valeur forgée (`test_client_supplied_x_tenant_id_is_overridden_by_validated_token`, confirmé en live).

### 8.4 Services mis à jour vs non mis à jour

Décision fondamentale de cette étape de finalisation : **ne pas rendre tous les services tenant-aware de manière uniforme**. Trois catégories ont été distinguées :

1. **Services métier classiques** utilisant le contexte utilisateur générique — adaptés.
2. **Medical Monitoring** — rôle métier particulier (source de données médicales, flux spécifique avec Clinical Agent), **volontairement non adapté** ici : voir [§13](#13-medical-monitoring--clinical-agent).
3. **Clinical Agent** — n'est pas un service utilisateur ; l'autorisation par tenant relève de la future Tenant Configuration, **volontairement non adapté** ici : voir [§13](#13-medical-monitoring--clinical-agent).

| Service | `GatewayUser`/`GatewayHeaderAuthentication` mis à jour (lit `X-Tenant-ID`) | Catégorie |
|---|---|---|
| `service-personnel` | **Oui** — testé (Docker + Postgres réels) | Service métier classique |
| `Gestion-Infrastructures` | **Oui** — testé (sqlite local + Docker réel) | Service métier classique |
| `ComptaMatiere` | **Oui** — testé (sqlite local) | Service métier classique |
| `fultang-compta-financiere` | **Oui** — testé (sqlite local, y compris le chemin de fallback JWT) | Service métier classique |
| `tenant-service` | Non | Cas particulier (voir ci-dessous) |
| `Medical-Monitoring` | **Non — décision volontaire** | Rôle métier spécifique, voir [§13](#13-medical-monitoring--clinical-agent) |
| `clinical-agent` | **Non — décision volontaire** | Pas un service utilisateur, voir [§13](#13-medical-monitoring--clinical-agent) |

`tenant-service` n'a pas été mis à jour : ses endpoints CRUD sont protégés par `PLATFORM_ADMIN`, un rôle de portée plateforme, transversal à tous les tenants par nature — `tenant_id` n'a pas de sens pour cette identité. Non traité par choix, pas par oubli.

**Modification par service (Phase 4, cette tâche)** — pour chacun des 4 services métier classiques, la même modification minimale et mécanique :

```python
class GatewayUser:
    def __init__(self, user_id, roles, tenant_id=None, ...):
        self.tenant_id = tenant_id   # ← seul ajout

class GatewayHeaderAuthentication(...):
    def authenticate(self, request):
        ...
        tenant_id = request.META.get("HTTP_X_TENANT_ID") or None   # ← seul ajout
        return (GatewayUser(user_id=..., roles=..., tenant_id=tenant_id), None)
```

`fultang-compta-financiere` a un second chemin (fallback JWT décodé localement quand les headers `X-User-*` sont absents) — `tenant_id` y a été ajouté de la même façon, lu depuis `payload.get('tenant_id')`.

**Aucune donnée métier, aucun modèle, aucune migration, aucun queryset touché dans ces 4 services** — uniquement la classe d'authentification.

### 8.5 Anomalie découverte pendant l'audit (Étape 1)

En exécutant les tests existants de `Gestion-Infrastructures` et `fultang-compta-financiere` pour valider la non-régression, une anomalie **préexistante et sans rapport avec cette phase** a été révélée : `InfrastructuresAPITests` (7 tests) et `QuittanceTests`/`CaisseJournaliereTests` (10 tests) échouent avec `401`/`403` — **ces tests n'envoient jamais de headers d'authentification**, alors que `GatewayHeaderAuthentication` + `IsAuthenticated` sont actifs par défaut dans ces deux services. Confirmé pré-existant par `git diff` (aucune ligne de ces tests n'a été modifiée, seuls des imports ont été ajoutés). Même symptôme déjà observé sur `service-personnel` en Phase 1. **Non corrigé** (hors périmètre de cette tâche) — signalé ici pour traçabilité.

### 8.6 Ce qui n'est PAS fait à ce stade

- Aucun service métier **n'utilise** encore `request.user.tenant_id` pour filtrer ses données (voir [§9](#9-bases-de-données)).
- Pas de vérification d'autorisation "cet utilisateur a-t-il le droit d'accéder à CETTE ressource de CE tenant" au niveau objet — seule la vérification "requête tenant == tenant du token" existe, au niveau de la Gateway.
- `Medical-Monitoring` et `clinical-agent` restent hors du mécanisme `GatewayUser.tenant_id` — voir [§13](#13-medical-monitoring--clinical-agent) pour l'analyse détaillée de pourquoi et pour la conception future.

---

## 9. Bases de données

Distinction stricte à faire, car ces notions sont **souvent confondues** :

| Notion | Statut |
|---|---|
| **Authentification tenant-aware** (login scope par tenant, JWT porte `tenant_id`) | **Implémenté et testé** |
| **Contexte tenant propagé** (`X-Tenant-ID` jusqu'au service, `GatewayUser.tenant_id`) | **Implémenté et testé** pour les 4 services métier classiques (voir [§8.4](#84-services-mis-à-jour-vs-non-mis-à-jour)) |
| **Registre logique Tenant + Service → Database** (`TenantDatabase`, Phase 5) | **Implémenté et testé** — voir §9.1 ci-dessous |
| **Isolation réelle des données métier** (un `Medecin` du Tenant A invisible au Tenant B dans les réponses API) | **Implémenté et vérifié** pour les 5 services métier persistants (service-personnel, Medical-Monitoring, fultang-compta-financiere, ComptaMatiere, Gestion-Infrastructures) — isolation par base physique séparée, pas par filtre applicatif |
| **Routage dynamique des bases de données** (une requête HTTP effectivement dirigée vers la bonne base selon le tenant) | **Implémenté et testé pour les 5 services métier persistants** — voir §9.2 (service-personnel) et §13.7 (Phase 8 finalisation : fultang-compta-financiere, ComptaMatiere, Gestion-Infrastructures) |
| **Création physique des bases PostgreSQL par tenant** | **Implémenté** pour service-personnel, Medical-Monitoring, fultang-compta-financiere, ComptaMatiere, Gestion-Infrastructures (provisioning automatisé, Phase 7 étendu en Phase 8) |

**Le database routing est maintenant implémenté pour les 5 services métier persistants de FullTang.** Une requête authentifiée pour le Tenant A utilise exclusivement la base PostgreSQL du Tenant A pour chacun de ces services ; le Tenant B, exclusivement la sienne. Seuls Clinical Agent (exception architecturale volontaire, voir §13.3) et l'intégration Kafka `patient.cree` (aucun producteur dans le dépôt, hors périmètre) dérogent à ce principe, pour des raisons documentées.

### 9.1 Phase 5 — Tenant Database Management (registre logique)

**Statut : Implémenté et testé.** Modèle retenu : **Database per Tenant per Service** — chaque microservice garde sa propre base pour chaque tenant (décision actée, non remise en question).

```
Tenant Registry (tenant-service)
        │
        ├── Tenant ──┬── TenantDatabase (tenant=A, service=PERSONNEL)      → db_A_personnel
        │            ├── TenantDatabase (tenant=A, service=INFRASTRUCTURE) → db_A_infrastructure
        │            └── TenantDatabase (tenant=A, service=COMPTA)        → db_A_compta
        │
        └── PlatformService (catalogue) : PERSONNEL, INFRASTRUCTURE, COMPTA, COMPTA_MATIERE, MEDICAL, ...
```

**`PlatformService`** — catalogue contrôlé des microservices de la plateforme (`tenant-service/tenants/models.py`) :
```python
class PlatformService(models.Model):
    code = models.CharField(max_length=50, primary_key=True, validators=[...])  # ex: PERSONNEL
    name = models.CharField(max_length=100)
    status = models.CharField(choices=PlatformServiceStatus.choices, default=ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
```
`code` est la clé primaire (stable par construction, format `MAJUSCULES_SNAKE_CASE` validé par regex). Nommé `PlatformService` (pas `Service`) pour éviter toute confusion avec les classes métier `TenantService`/`TenantDatabaseService` déjà présentes dans `services.py`. Seedé via une migration de données (`0003_seed_platform_services.py`) avec les 5 services déjà existants dans FullTang : `PERSONNEL`, `INFRASTRUCTURE`, `COMPTA`, `COMPTA_MATIERE`, `MEDICAL`. Étendre le catalogue (Pharmacie, Laboratoire, Imagerie...) se fait en ajoutant une ligne, jamais en modifiant `Tenant` ou `TenantDatabase`.

**`TenantDatabase`** — association logique Tenant + Service → Base :
```python
class TenantDatabase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='databases')
    service = models.ForeignKey(PlatformService, on_delete=models.PROTECT, related_name='tenant_databases')
    database_name = models.CharField(max_length=100)
    host = models.CharField(max_length=255)
    port = models.PositiveIntegerField(default=5432)
    status = models.CharField(choices=TenantDatabaseStatus.choices, default=PENDING)  # PENDING/ACTIVE/INACTIVE
    secret_reference = models.CharField(max_length=255)  # référence opaque, jamais un mot de passe
    created_at / updated_at

    class Meta:
        constraints = [UniqueConstraint(fields=['tenant', 'service'], name='tenant_database_unique_tenant_service')]
```
- **Pas de champs `personnel_db`/`infrastructure_db`/... sur `Tenant`** — une relation dédiée, extensible sans jamais modifier `Tenant`.
- **`service` est une vraie ForeignKey** (pas une chaîne libre) : référencer un code absent du catalogue est automatiquement rejeté (400, `PrimaryKeyRelatedField`) — impossible de créer une association vers un service inexistant.
- **`status` par défaut `PENDING`, pas `ACTIVE`** — décision délibérée : aucune base physique n'est créée à l'enregistrement, donc une entrée fraîche décrit une *intention*, pas une base confirmée utilisable. `ACTIVE`/`INACTIVE` restent des changements purement déclaratifs à ce stade (aucune action physique déclenchée).
- **`UniqueConstraint(tenant, service)`** : impossible d'avoir deux configurations concurrentes pour le même couple.
- **Sécurité credentials** : `secret_reference` est une chaîne opaque (ex: un futur chemin Vault) — **aucun champ de mot de passe n'existe sur ce modèle**. FullTang n'a pas de Secret Manager ; ce champ réserve uniquement la structure pour le brancher plus tard (non construit ici, décision explicite de la tâche).

**API** (`tenant-service`, PLATFORM_ADMIN uniquement — permission `IsPlatformAdmin` réutilisée telle quelle, aucun nouveau système RBAC) :
```
GET/POST   /api/platform-services/            → catalogue des services
GET        /api/platform-services/{code}/
GET/POST   /api/tenant-databases/             → configurations (filtrable ?tenant=&service=&status=)
GET        /api/tenant-databases/{id}/
PATCH      /api/tenant-databases/{id}/        → database_name/host/port/secret_reference UNIQUEMENT
PATCH      /api/tenant-databases/{id}/status/ → changement de statut logique
```
`tenant`/`service`/`status` sont exclus du serializer de mise à jour générale (`TenantDatabaseUpdateSerializer` dédié) : réassigner un tenant vers la configuration d'un autre, ou changer host/port/secret_reference depuis un rôle non-PLATFORM_ADMIN, est structurellement impossible — vérifié par test et en conditions réelles (voir [§16](#16-tests-et-validation)).

**Ce que la Phase 5 ne fait explicitement PAS** : routage dynamique des requêtes (Phase 6), création/suppression physique de base PostgreSQL, Docker Compose pour de nouvelles bases, provisioning automatique (Phase 7), migration de données existantes (Phase 8), activation/désactivation fonctionnelle d'un service pour un tenant (Phase 9), modification de Medical Monitoring/Clinical Agent/JWT/Tenant Resolution/`tenant_id` sur les modèles métier.

### 9.2 Phase 6 — Dynamic Database Routing

**Statut : Implémenté et testé pour `service-personnel`.** Une requête authentifiée pour le Tenant A utilise exclusivement `DB_A_personnel` ; le Tenant B, exclusivement `DB_B_personnel`. Aucune fuite possible d'un tenant vers la base d'un autre, ni vers une base "par défaut" implicite.

#### 9.2.1 Flux complet d'une requête

```
Client (JWT tenant_id=A)
   │  Authorization: Bearer <JWT>
   ▼
API Gateway (inchangé — Phase 3/4)
   │  décode JWT, compare tenant demandé (hostname) vs tenant du token,
   │  injecte X-User-ID / X-User-Roles / X-Tenant-ID (jamais depuis le client)
   ▼
service-personnel : GatewayHeaderAuthentication.authenticate()
   │  lit X-Tenant-ID → établit le Tenant Context (contextvar)
   ▼
Tenant Context = {tenant_id: A}
   ▼
Vue DRF (ex: MedecinViewSet) → Medecin.objects.filter(...)
   ▼
TenantDatabaseRouter.db_for_read(Medecin)
   │  app_label 'api' est tenant-scopé → résout l'alias pour tenant A
   ▼
pool_registry.ensure_connection_alias('A')
   │  alias déjà enregistré ? → oui : retour immédiat (chemin rapide)
   │                          → non : verrou par tenant, cache, Registry
   ▼
django.db.connections['tenant_A_personnel']  (connexion persistante, CONN_MAX_AGE)
   ▼
PostgreSQL : DB_A_personnel
   ▼
Réponse — ne contient QUE les données du Tenant A
```

À la fin de la requête, `TenantContextCleanupMiddleware` réinitialise le Tenant Context — le thread/worker qui traitera la prochaine requête (potentiellement pour le Tenant B) repart d'un état neutre.

#### 9.2.2 Tenant Context

Fichier : `service-personnel/api/tenant_routing/context.py`. Implémenté avec `contextvars.ContextVar` (pas `threading.local`) — sémantique de reset précise via un `Token`, et compatible avec une future migration vers un serveur ASGI.

Établi à DEUX endroits, jamais ailleurs :
1. **`GatewayHeaderAuthentication.authenticate()`** — pour toutes les requêtes authentifiées normales, à partir de `X-Tenant-ID` (le même header anti-spoofing de la Phase 4).
2. **`AuthVerifyView.post()`** — cas particulier : ce endpoint précède toute authentification DRF (`authentication_classes = []`, c'est lui qui établit l'identité), il reçoit donc `tenant_id` directement dans le corps de la requête (déjà résolu par la Gateway via Tenant Resolution, comme depuis la Phase 3) et l'utilise pour établir le contexte AVANT sa propre requête de vérification des identifiants.

**`tenant_id=None` est un état explicite valide** ("pool non assigné", Phase 3), pas une absence de contexte. Il route vers `'default'`. **L'absence totale de contexte** (aucun des deux mécanismes ci-dessus n'a jamais été appelé) lève `TenantContextMissingError` — voir §9.2.3.

**Isolation stricte entre requêtes** : `TenantContextCleanupMiddleware` (dernier de `MIDDLEWARE`, pour englober tout le cycle y compris l'authentification DRF qui a lieu pendant `get_response`) réinitialise le contexte dans un `finally`, y compris en cas d'exception. Vérifié par test (`test_sequential_requests_do_not_leak_context`) : une requête simulée sans tenant établi APRÈS une requête avec Tenant A ne voit jamais Tenant A.

#### 9.2.3 Réconciliation Phase 3 / Phase 6 — décision signalée

La tâche demande : *"tenant_id absent/invalide → refus explicite"*. La Phase 3 avait délibérément conservé `tenant_id=None` ("pool non assigné") comme état valide, pour la compatibilité locale/dev. Ces deux décisions semblaient en tension — résolu ainsi (signalé avant implémentation, comme demandé) :

- `tenant_id=None`, **établi explicitement** par le mécanisme d'authentification (jamais par défaut implicite) → route vers `'default'`, la base historique. Ce n'est pas une fuite : `'default'` ne contient les données d'AUCUN tenant réel, seulement le pool historique, et cette route est prévisible et documentée, pas devinée.
- **Absence totale de contexte** (bug, code exécuté hors cycle de requête) → `TenantContextMissingError`, jamais de repli.
- **`tenant_id` réel mais non routable** (tenant/DB introuvable, inactif, Registry injoignable sans cache) → exception dédiée, jamais de repli vers `'default'` ni vers la base d'un autre tenant.

#### 9.2.4 Registry client et cache

Fichiers : `registry_client.py`, `cache.py`.

`registry_client.resolve_tenant_database(tenant_id)` appelle `GET tenant-service/api/tenant-databases/resolve/?tenant=<id>&service=PERSONNEL` (nouvel endpoint Phase 6, même mécanisme `IsInternalService`/jeton partagé que `GET /tenants/resolve/` depuis la Phase 2.1 — `service-personnel` devient un second appelant de confiance du même mécanisme, aucun nouveau protocole). Utilise `urllib` (stdlib, déjà employé ailleurs dans FullTang pour ce type d'appel — Medical-Monitoring `signals.py`), pas de nouvelle dépendance.

**Cache (`TenantDatabaseCache`)** :
- **Ce qui est mis en cache** : `TenantDatabaseInfo` (database_name, host, port, status) par tenant_id.
- **Durée de vie** : `TENANT_DB_CACHE_TTL_SECONDS` (défaut 300s, configurable par environnement).
- **Création d'une entrée** : lazy, au premier accès pour un tenant — jamais de pré-chargement.
- **Invalidation** : uniquement par expiration TTL dans cette phase (pas de webhook/signal actif — limite documentée : un changement de config côté Registry met jusqu'à TTL secondes à être pris en compte ici).
- **Après redémarrage** : cache en mémoire de PROCESSUS — vidé entièrement. Non problématique : la prochaine requête de chaque tenant reconstruit son entrée depuis le Registry (source de vérité), au prix d'un aller-retour réseau une fois par tenant.
- **Si le Registry est temporairement indisponible** : décision explicite — une entrée en cache existante (même expirée) est réutilisée avec un avertissement loggué (dégradation gracieuse) ; en l'absence de toute entrée, l'appel est refusé explicitement (`TenantRegistryUnavailableError` propagée) — deviner une base ici serait le risque de fuite que cette phase élimine.

#### 9.2.5 Pools de connexions

Fichier : `pool_registry.py`. Technique : `django.db.connections.databases` est un dict mutable au runtime (vérifié empiriquement contre le code de `ConnectionHandler` — Django 6.0.3 le documente comme "conservé pour compatibilité", ce qui fonctionne exactement comme avant : y ajouter un alias au runtime le rend immédiatement utilisable, Django ne fait cette découverte qu'une fois au démarrage puis conserve le dict en mémoire).

**Ce n'est PAS un vrai pool multi-connexions.** Django + psycopg2 (pas psycopg3, pas pgbouncer dans l'infra actuelle de FullTang) n'a pas de pool natif. Le mécanisme réellement disponible et utilisé est `CONN_MAX_AGE` : une connexion persistante réutilisée par thread/alias (au lieu d'ouvrir/fermer une connexion à chaque requête), fermée après N secondes d'inactivité. Avec plusieurs workers, chacun garde SA connexion persistante par alias — dans les faits, un ensemble de connexions réutilisées par tenant, dimensionné par le nombre de workers du déploiement. Documenté honnêtement comme tel, jamais présenté comme un pool qu'il n'est pas.

**Configurable, jamais figé** : `TENANT_DB_CONN_MAX_AGE` (variable d'environnement, défaut 60s). Point d'extension explicite pour une configuration PAR TENANT en Phase 9 (ex: `TenantDatabase` porterait un champ optionnel de configuration de pool, lu par `_build_connection_settings()` — pas construit maintenant).

#### 9.2.6 Concurrence — verrouillage de création de pool

`threading.Lock()` **par tenant, par PROCESSUS PYTHON** (pas un verrou global unique — le Tenant A qui crée son pool ne bloque jamais les requêtes du Tenant B).

- **Portée assumée pour cette phase** : verrou LOCAL au processus. Le déploiement actuel de FullTang n'exécute qu'**une seule instance** de `service-personnel` (vérifié dans tous les `docker-compose*.yml` du projet — aucun mécanisme de scaling horizontal n'existe). Cette portée est donc suffisante aujourd'hui.
- **Limite explicite documentée** : si FullTang passe à plusieurs instances de `service-personnel`, ce verrou ne coordonnera PAS les instances entre elles — chaque instance enregistrerait indépendamment son propre alias vers la même base PostgreSQL. **Pas dangereux** (PostgreSQL gère nativement des connexions concurrentes depuis plusieurs clients), seulement **redondant** (travail de résolution refait par instance). Un déploiement horizontal voudrait un verrou distribué (`pg_advisory_lock` PostgreSQL, ou `SETNX` Redis) — non implémenté ici : aucune infrastructure de ce type n'existe encore dans FullTang, l'introduire maintenant serait une dépendance nouvelle non justifiée par le besoin actuel.
- **Vérifié par test** (`test_concurrent_first_access_creates_pool_only_once`) : 10 threads appelant simultanément la résolution d'un même tenant jamais encore résolu → une seule résolution effective (les 9 autres attendent le verrou puis réutilisent le résultat).

#### 9.2.7 Database Router

Fichier : `router.py`, classe `TenantDatabaseRouter`, activée via `DATABASE_ROUTERS = ['api.tenant_routing.router.TenantDatabaseRouter']`.

```python
TENANT_SCOPED_APPS = {"api"}              # seul app_label métier de ce service
ALWAYS_MIGRATABLE_APPS = {"migrations"}   # bookkeeping Django requis sur chaque alias
```

Ne connaît QUE l'app_label du modèle et le Tenant Context — jamais une chambre, un service hospitalier, ou toute spécificité métier d'un tenant :
- `db_for_read`/`db_for_write` : si `app_label != 'api'` → `None` (Django utilise `'default'`, comportement inchangé pour tout le reste, y compris `django.contrib.admin`/`auth`/`sessions`/`contenttypes` — c'est la distinction TENANT vs PLATFORM/SYSTEM CONTEXT au niveau de ce service : les tables système restent dans `'default'`, jamais dans une base tenant, et un accès "plateforme" ne donne jamais accès arbitrairement à la base d'un tenant).
- Sinon → exige un Tenant Context (`require_tenant_context()`, lève si absent) et résout l'alias correspondant.
- `allow_relation` : autorise une relation SEULEMENT si les deux objets vivent dans la même base — empêche toute jointure implicite entre bases.
- `allow_migrate` : `api`/`migrations` migrable partout où demandé explicitement (`'default'` OU un alias tenant) ; les apps système ne sont JAMAIS migrées sur un alias tenant.

**Distinction TENANT vs PLATFORM/SYSTEM CONTEXT (§6 de la tâche)** : pour ce service, "PLATFORM" ne signifie PAS "un administrateur accède à toutes les bases tenant" — cela n'existe nulle part dans le code. Cela signifie uniquement que les tables SYSTÈME de ce service lui-même (auth, admin, sessions) continuent, comme avant cette phase, à vivre dans `'default'`, indépendamment de tout tenant. Le vrai Tenant Registry et les opérations de plateforme au sens large vivent entièrement dans `tenant-service`, un service séparé.

**Décision de périmètre** : seul `service-personnel` a reçu ce router. Les 3 autres services adaptés en Phase 4 (Gestion-Infrastructures, ComptaMatiere, fultang-compta-financiere) continuent d'utiliser une base unique par service — non modifiés dans cette phase (l'objectif de la tâche était explicitement `service-personnel`). Étendre le mécanisme aux autres services suivrait exactement le même patron (`tenant_routing/` est conçu pour être copié/adapté, comme `authentication.py` l'a été en Phase 4).

#### 9.2.8 Nouvel endpoint tenant-service

`GET /api/tenant-databases/resolve/?tenant=<uuid>&service=<code>` (`tenant-service/tenants/views.py`) — réutilise `TenantDatabaseService.get_for_tenant_and_service()` (déjà écrit en Phase 5, jamais utilisé par un endpoint HTTP jusqu'ici). Protégé par `IsInternalService` (même jeton partagé que `GET /tenants/resolve/`). Réponse minimale : `{database_name, host, port, status}` — jamais `secret_reference`, `id`, `tenant`, ou `service`.

#### 9.2.9 Bases pilotes réelles

Deux tenants déjà existants dans le Registry (`hopital-central` = `57d9d34f-65cc-4b45-8b5f-0aa87c2c90b8`, `clinique-paix` = `6d480feb-887d-4778-8406-c3fb848deef3`) reçoivent chacun une base PostgreSQL PERSONNEL réellement distincte sur le serveur `fultang-postgres` déjà utilisé par `service-personnel` :

```
hopital-central → tenant_hopital_central_personnel   (alias runtime: tenant_57d9d34f65cc4b458b5f0aa87c2c90b8_personnel)
clinique-paix   → tenant_clinique_paix_personnel      (alias runtime: tenant_6d480feb887d47788406c3fb848deef3_personnel)
```

(le nom de base physique est fourni par le Registry ; l'alias de connexion Django, lui, est dérivé déterministe de l'UUID du tenant — voir `_alias_for()`). Chaque base a reçu uniquement les tables de l'app `api` (`migrate api --database=<alias>`, jamais les tables système), confirmé par `\dt api_*` directement sur PostgreSQL (11 tables identiques dans les deux bases, aucune fuite de structure).

**Preuve d'isolation réalisée en conditions réelles (pas de mock)** :
1. Insertion d'un médecin distinct dans chaque base via le Tenant Context réel (`bertrand.owona@hopital-central.local` / Tenant A, `aline.fokou@clinique-paix.local` / Tenant B).
2. Vérification directe en SQL brut (bypass complet de l'application) : chaque base ne contient que son propre médecin ; la base `default` (`service_personnel`) n'en contient aucun des deux.
3. Login réel via le flux complet Client → Gateway → service-personnel (`POST /auth/login`, `Host: hopital-central.fulltang.com` / `Host: clinique-paix.fulltang.com`) : chaque médecin obtient un JWT avec le `tenant_id` correct.
4. `GET /personnel/medecins/` via la Gateway avec chaque JWT : Tenant A ne voit que Bertrand Owona (`count: 1`), Tenant B ne voit que Aline Fokou (`count: 1`) — jamais l'un chez l'autre.
5. Scénarios d'attaque testés en conditions réelles :
   - Login avec l'email d'un médecin du Tenant A sous le hostname du Tenant B → `401 Identifiants invalides` (l'email n'existe pas dans cette base).
   - Token JWT du Tenant A réutilisé sous le hostname du Tenant B (et inversement) → `403 Ce token n'est pas valide pour l'établissement demandé` (contrôle Phase 3, réaffirmé fonctionnel après Phase 6).
   - Login sous un tenant `INACTIVE` (`clinique-fermee`) → `403 Le tenant 'clinique-fermee' est inactif` (rejeté par la Gateway avant même d'atteindre `service-personnel` — Phase 2.2, inchangé).

**Credentials** : un seul compte PostgreSQL applicatif partagé (`TENANT_DB_USER`/`TENANT_DB_PASSWORD`, mêmes valeurs par défaut que `POSTGRES_USER`/`POSTGRES_PASSWORD` existants) est utilisé pour se connecter à TOUTES les bases tenant de ce service dans cette phase — **`TenantDatabase.secret_reference` n'est PAS utilisé pour la connexion réelle** (il reste la référence opaque définie en Phase 5, non branchée sur un mécanisme fonctionnel, puisqu'aucun Secret Manager n'existe encore). C'est un pont pragmatique assumé pour permettre une démonstration réelle sans construire tout un Secret Manager dans cette tâche (explicitement hors périmètre, §6 de la tâche) — à remplacer en Phase 7 par des credentials réellement uniques par tenant.

#### 9.2.10 Limite découverte pendant la validation pilote — désactivation d'un alias déjà enregistré

**Constat (test réel, pas théorique)** : une fois qu'`ensure_connection_alias(tenant_id)` a enregistré l'alias d'un tenant dans `connections.databases` (première requête réussie pour ce tenant sur ce processus), toute requête suivante emprunte le "chemin rapide" (`pool_registry.py` ligne 140 : `if alias in connections.databases: return alias`) et ne revérifie **jamais** le statut auprès du Registry — même si le TTL du cache a expiré, même si le `TenantDatabase` est ensuite passé à `INACTIVE`.

Vérifié en conditions réelles : `clinique-paix` passé à `INACTIVE` dans `tenant-service` (+ cache local invalidé explicitement) puis requête `GET /personnel/medecins/` avec un JWT Tenant B valide → **toujours `200 OK`**, alors qu'une tentative de PREMIER accès pour un tenant `INACTIVE` est, elle, correctement refusée (`test_inactive_database_is_refused_and_not_registered`).

**Ce n'est pas une fuite inter-tenant** (Tenant B continue de voir uniquement sa propre base, jamais celle d'un autre tenant) — c'est une limite de **révocation en temps réel** : une désactivation ne prend effet, pour un tenant déjà résolu par un processus, qu'au redémarrage de ce processus (qui vide `connections.databases` et repart de `settings.DATABASES`).

**Décision** : documentée ici comme limite assumée de cette phase, non corrigée dans le code — la tâche demande explicitement de ne pas anticiper de mécanisme non requis (§8/§16 de la tâche) et aucune exigence de révocation "live" n'a été formulée. Candidate naturelle pour la Phase 7 (voir §19) : soit revérifier le statut à chaque résolution (coût : un aller-retour cache/Registry par requête, annule l'intérêt du chemin rapide), soit exposer une action explicite « invalider l'alias d'un tenant » côté administration, déclenchée au moment de la désactivation.

### 9.3 `allow_clinical_agent_export` — autorisation d'export vers Clinical Agent

**Statut : implémenté et testé.** Champ booléen sur `Tenant` (tenant-service), défaut `True`.

- **Modèle** : `Tenant.allow_clinical_agent_export = models.BooleanField(default=True)`. Nom conservé tel que proposé par la tâche — cohérent avec la convention déjà en place dans `tenant-service` (identifiants anglais : `status`, `database_name`, `secret_reference`... contrairement aux apps métier françaises comme `fultang-compta-financiere`, qui utilisent `est_*`/`actif`). C'est un champ de PLATEFORME (même statut que `status`), pas une configuration métier (Phase 9) — d'où son exposition dans `TenantResolutionSerializer`, déjà réservé aux appelants internes de confiance.
- **Migration** : `0007_tenant_allow_clinical_agent_export.py` — `AddField` pur, `default=True` appliqué à tous les tenants existants (vérifié : `hopital-central`/`clinique-paix`/tous les tenants pilotes des phases précédentes conservent `True` après migration, aucune régression de comportement).
- **API** :
  - `POST /api/tenants/` accepte le champ à la création (optionnel, défaut du modèle si omis) ;
  - `PATCH /api/tenants/{id}/` (nouveau — `TenantViewSet` gagne `UpdateModelMixin`) modifie CE SEUL champ via `TenantUpdateSerializer` (même principe que `TenantDatabaseUpdateSerializer`, Phase 5 : `name`/`identifier` restent immuables, `status` reste réservé à son action dédiée) ;
  - `GET /api/tenants/resolve/?id=<uuid>` (nouveau paramètre — `?identifier=` reste supporté pour la Gateway) l'expose aux appelants internes qui ne connaissent que l'UUID du tenant (Clinical Agent, qui reçoit `tenant_id` via `X-Tenant-ID`, jamais un hostname).
- **Consommation** : Clinical Agent (`registry_client.get_tenant_config`) le vérifie AVANT toute lecture de donnée médicale destinée à l'export (voir §13.3) — jamais `tenant-service` lui-même qui n'exécute aucune logique d'export (règle explicite de la tâche : "ne déplace pas toute la logique métier dans tenant-service").

---

## 10. Provisioning

### 10.1 Provisioning de comptes utilisateurs — toujours non implémenté

**Statut : Non implémenté** (hors périmètre de la Phase 7, qui porte exclusivement sur le provisioning des **ressources d'infrastructure** — voir §10.2).

Aucun endpoint ne permet aujourd'hui :
- de créer un utilisateur **déjà rattaché** à un tenant via l'API (le champ `tenant_id` est `editable=False`, donc jamais accepté en écriture par les serializers existants — décision de sécurité délibérée, voir [§6.1](#61-association-utilisateur--tenant)) ;
- de créer automatiquement un compte Hospital Admin initial lors du provisioning d'un tenant.

**À faire** (candidat pour une phase ultérieure, non planifiée) : un flux dédié (probablement réservé à `PLATFORM_ADMIN`) pour assigner un `tenant_id` à un compte, et/ou créer un compte directement dans le contexte d'un tenant. Actuellement, la seule façon d'assigner un `tenant_id` est un accès direct à l'ORM (shell Django, script de seed). La Phase 7 (§10.2) ne crée aucune "configuration initiale minimale" au-delà de la base de données elle-même et de son schéma : conformément à la tâche ("si aucune configuration initiale n'est actuellement nécessaire, ne l'invente pas"), aucun compte, aucune donnée de référence métier n'est créé automatiquement par le provisioning.

### 10.2 Phase 7 — Tenant Provisioning

**Statut : Implémenté et testé pour `service-personnel`.** Un `PLATFORM_ADMIN` peut déclencher, via un seul appel HTTP, la création physique réelle d'une base PostgreSQL pour un tenant + un service, l'enregistrement de son `TenantDatabase`, et l'initialisation de son schéma — automatisant ce qui, en Phase 6, se faisait entièrement à la main (voir §9.2.9, le script de pilotage manuel).

#### 10.2.1 Pourquoi ce module est nécessaire, et son rôle exact

Avant la Phase 7, faire fonctionner un nouveau tenant nécessitait, à la main : `CREATE DATABASE` sur le serveur PostgreSQL, `POST /api/tenant-databases/` sur tenant-service, `PATCH .../status/` vers `ACTIVE`, puis un accès shell à service-personnel pour lancer `migrate --database=<alias>`. La Phase 7 automatise EXACTEMENT cette séquence, sans en changer la nature :

- **Relation avec le Tenant Registry** : le provisioning COMMENCE par consulter `Tenant` (existence, statut ACTIVE) — il ne le modifie jamais, ne le duplique jamais. `tenant-service` reste l'unique source de vérité sur "qui sont les tenants".
- **Relation avec `TenantDatabase`** : le provisioning est le SEUL mécanisme (avec l'API Phase 5 manuelle, toujours disponible) qui écrit dans `TenantDatabase` — mais il réutilise le modèle et les repositories existants tels quels (voir §10.2.9), il n'introduit aucun second modèle.
- **Relation avec le Database Router (Phase 6)** : le provisioning ne route jamais une requête et ne lit jamais `TenantDatabase` pour décider où envoyer une requête métier — il ne fait que PRODUIRE une ligne `TenantDatabase` en état `ACTIVE` que le Router de la Phase 6 (`ensure_connection_alias`) sait déjà consommer sans aucune modification. Aucune logique de résolution de base n'est dupliquée entre les deux (voir §10.2.9 pour le détail de la réutilisation de code).

#### 10.2.2 Constat d'inspection — pourquoi seul PERSONNEL est physiquement automatisé

Avant d'écrire une seule ligne de code, inspection de l'infrastructure réelle des 4 services adaptés en Phase 4 :

| Service | Serveur PostgreSQL | Bases multiples par tenant ? |
|---|---|---|
| `service-personnel` | `fultang-postgres` (partagé) | **Oui** — Dynamic Database Routing, Phase 6 |
| `Gestion-Infrastructures` | `infrastructure-db` (dédié, un seul) | Non |
| `ComptaMatiere` | `compta-matiere-db` (dédié, un seul) | Non |
| `fultang-compta-financiere` | `compta-financiere-db` (dédié, un seul) | Non |

Seul `service-personnel` dispose d'une infrastructure capable d'héberger plusieurs bases par tenant (Phase 6 — `api/tenant_routing/`). Les 3 autres services ont chacun UN SEUL serveur PostgreSQL dédié à eux-mêmes, sans aucun mécanisme de routage dynamique. Créer physiquement une base "par tenant" pour eux nécessiterait d'abord de leur donner l'équivalent de la Phase 6 (`tenant_routing/`, Database Router, endpoint interne de provisioning) — **explicitement hors périmètre de cette phase** (règle §22 de la tâche : ne pas élargir le périmètre à la Phase 8/9/refonte).

**Décision (documentée, pas devinée)** : le provisioning AUTOMATISÉ (création physique + migration) n'est câblé, dans cette phase, que pour `PERSONNEL` (`PROVISIONING_CAPABLE_SERVICES` dans `tenant-service/tenants/provisioning.py`). Pour tout autre service demandé (`INFRASTRUCTURE`, `COMPTA`, `COMPTA_MATIERE`, `MEDICAL`), le provisioning renvoie un résultat `SKIPPED` explicite — **il ne crée PAS de ligne `TenantDatabase` fictive** (une entrée `PENDING` qui ne progressera jamais automatiquement serait malhonnête). Un `PLATFORM_ADMIN` qui veut déclarer une configuration pour l'un de ces services peut toujours utiliser l'API Phase 5 existante (`POST /api/tenant-databases/`), inchangée.

#### 10.2.3 Flux complet

```
PLATFORM_ADMIN
   │  POST /api/tenants/{id}/provision/  {"services": ["PERSONNEL", "INFRASTRUCTURE"]}
   ▼
tenant-service : TenantViewSet.provision()  (IsPlatformAdmin)
   │  1. Validation AMONT (refus de la demande ENTIÈRE si invalide) :
   │       tenant existe et ACTIVE ? service(s) existent et ACTIVE dans PlatformService ?
   ▼
ProvisioningOrchestrator.provision()
   │  2. Pour CHAQUE service, indépendamment :
   │       service capable de provisioning physique (PERSONNEL) ?
   │         NON → résultat SKIPPED, aucune ligne créée
   │         OUI → nom de base déterministe, get_or_create_declarative (idempotent),
   │               claim_for_provisioning (CAS atomique PENDING/FAILED → PROVISIONING)
   │                 CAS perdu (déjà en cours/fait ailleurs) → rapporte l'état actuel, s'arrête
   │                 CAS gagné → appelle le service propriétaire :
   ▼
service-personnel : POST /api/internal/provision-database/  (IsInternalService)
   │  3. pool_registry.provision_database(tenant_id) :
   │       - dérive le nom physique lui-même (jamais une chaîne reçue du réseau)
   │       - CREATE DATABASE si absente (idempotent, connexion admin autocommit)
   │       - enregistre l'alias dans connections.databases
   │       - migrate 'api' --database=<alias>
   │       - échec migration → alias désenregistré, erreur remontée (pas de DROP)
   ▼
tenant-service : mark_active() ou mark_failed(error)
   ▼
Réponse : {"results": [{"service": "PERSONNEL", "status": "ACTIVE", ...}, ...]}
```

À l'issue d'un provisioning réussi pour PERSONNEL, le Database Router de la Phase 6 (`ensure_connection_alias`, §9.2) retrouve cette association exactement comme s'il s'agissait d'un provisioning manuel — vérifié en conditions réelles avec un processus `service-personnel` **redémarré** entre le provisioning et la première requête métier (voir §10.2.10).

#### 10.2.4 Génération déterministe et sûre des noms de base (§5 de la tâche)

Le nom physique d'une base tenant est **entièrement dérivé** de deux valeurs déjà typées et déjà validées — jamais d'un texte libre :

```python
f"tenant_{tenant_id.hex}_{service_code.lower()}"
```

- `tenant_id` : un `UUID` (typé par le champ `Tenant.id`, jamais une chaîne arbitraire).
- `service_code` : déjà vérifié comme existant et `ACTIVE` dans le catalogue `PlatformService` AVANT que ce nom ne soit calculé (§10.2.3, étape de validation amont).

Résultat : `tenant_<32 caractères hexadécimaux>_<code service en minuscules>` — sans tiret, sans caractère spécial, sans collision possible entre deux tenants (UUID) ni entre deux services d'un même tenant (code différent). Encore quoté via `psycopg2.sql.Identifier` côté service-personnel avant `CREATE DATABASE` — défense en profondeur, même si la chaîne est déjà garantie sûre par construction (jamais de confiance aveugle en une chaîne SQL, même auto-générée).

**Décision volontaire** : `tenant-service` recalcule ce nom lui-même (`_deterministic_database_name`, dans `provisioning.py`) pour créer la ligne `TenantDatabase` initiale, MAIS c'est `service-personnel` qui a le dernier mot — il ignore tout nom qu'on pourrait lui envoyer et calcule le sien via `pool_registry._alias_for()` (fonction déjà existante depuis la Phase 6, réutilisée sans modification). Les deux formules sont **identiques par construction** et **doivent le rester** — un doublon assumé et documenté (deux services déployés séparément, sans bibliothèque partagée), pas un oubli. `tenant-service` persiste ensuite le nom RENVOYÉ par service-personnel comme source de vérité finale (`TenantDatabase.database_name` est mis à jour après le retour de l'appel physique).

#### 10.2.5 Idempotence (§7 de la tâche)

Deux niveaux, documentés séparément :

- **Niveau `TenantDatabase`** (tenant-service) : `get_or_create_declarative` s'appuie sur la `UniqueConstraint(tenant, service)` déjà existante (Phase 5) — un second appel pour le même couple retrouve la ligne existante, n'en crée jamais une deuxième. Un service déjà `ACTIVE` renvoie un résultat "déjà provisionné, aucune action refaite" sans déclencher le moindre appel physique.
- **Niveau base PostgreSQL** (service-personnel) : `_create_database_if_missing` vérifie l'existence (`SELECT 1 FROM pg_database ...`) AVANT toute tentative de `CREATE DATABASE` — un second appel est un no-op silencieux côté PostgreSQL, jamais une erreur `DuplicateDatabase` rattrapée après coup.
- **Niveau schéma** : `migrate` est nativement idempotent (Django ne réapplique jamais une migration déjà enregistrée) — un second appel de provisioning, même après un premier succès, ne casse rien.

Vérifié en conditions réelles (pas seulement en test) : deux appels HTTP successifs `POST /tenants/{id}/provision/` pour le même tenant renvoient le second avec `"detail": "Déjà provisionné (aucune action refaite)."`, sans second `CREATE DATABASE` ni second `migrate`.

#### 10.2.6 Concurrence (§8 de la tâche)

**Décision explicite : mécanismes PostgreSQL natifs, PAS de verrou applicatif** — à la différence du `threading.Lock()` local-process de la Phase 6 (§9.2.6, explicitement limité à un déploiement mono-instance), le provisioning utilise :

1. La `UniqueConstraint(tenant, service)` (Phase 5, inchangée) : deux créations concurrentes pour le même couple → une seule réussit, l'autre lève `IntegrityError`, rattrapée pour relire la ligne créée par l'autre.
2. Une mise à jour conditionnelle atomique (`TenantDatabase.objects.filter(id=..., status__in=[PENDING, FAILED]).update(status=PROVISIONING)`) pour "réclamer" le droit de lancer le provisioning physique — un `UPDATE ... WHERE` porté entièrement par PostgreSQL, qui ne retourne `1` (gagné) que pour EXACTEMENT un appelant, même avec plusieurs requêtes strictement simultanées.

**Ces deux mécanismes sont valides même avec plusieurs instances de `tenant-service`** (contrairement au verrou local-process de la Phase 6) : ce sont des garanties PostgreSQL, pas des garanties de processus. C'est un choix délibérément plus robuste que la Phase 6 pour cette raison précise — le provisioning est une opération plus rare et plus sensible qu'une requête de routage ordinaire, elle mérite une garantie qui survit à un futur passage à plusieurs instances de `tenant-service`.

**Vérifié en conditions réelles** (pas seulement en test) : 5 requêtes HTTP `POST /provision/` lancées simultanément (5 threads) pour un même tenant neuf → exactement UNE ligne `TenantDatabase` créée, exactement UN appel physique déclenché (résultat `ACTIVE`), les 4 autres ont vu `PROVISIONING` et n'ont déclenché aucune action (voir rapport final pour la trace complète).

**Limite non couverte** : deux appels de provisioning strictement simultanés pour le MÊME tenant mais des SERVICES DIFFÉRENTS ne se bloquent jamais entre eux (ce n'est pas nécessaire : `UniqueConstraint(tenant, service)` est par couple, pas par tenant seul) — un tenant peut voir plusieurs de ses services se provisionner en parallèle, ce qui est le comportement souhaité (§4 : chaque service est indépendant).

#### 10.2.7 Gestion des échecs partiels (§10 de la tâche)

**Deux échelles d'échec, traitées différemment, documentées séparément** :

1. **Échec de VALIDATION** (tenant/service inconnu ou inactif) : refus de la demande ENTIÈRE avant toute création — aucune ligne `TenantDatabase` touchée, aucune ambiguïté possible. Ce sont des erreurs de saisie du `PLATFORM_ADMIN`, pas des échecs d'infrastructure.
2. **Échec PHYSIQUE** (un service par ailleurs valide, mais dont la création/migration échoue) : NE bloque JAMAIS les autres services demandés dans le même appel (chacun est traité indépendamment, §10.2.3). Le service en échec passe en `FAILED` avec `TenantDatabase.last_error` renseigné (résumé technique court, jamais un secret).

**Stratégie de récupération retenue : reprise par nouvel appel (retry), PAS de rollback automatique par `DROP DATABASE`.** Justification :
- `CREATE DATABASE` et `migrate` sont TOUS DEUX naturellement idempotents (§10.2.5) — un nouvel appel de provisioning, après correction de la cause (réseau rétabli, etc.), reprend exactement là où l'échec s'est produit, sans dupliquer le travail déjà fait.
- `DROP DATABASE` est une opération destructive qu'il serait risqué d'automatiser sur la seule foi d'un échec de migration (qui peut être transitoire — verrou PostgreSQL momentané, redémarrage du service, etc.) : un `DROP` automatique pourrait détruire une base par ailleurs saine à cause d'une erreur passagère.
- Si la base a été créée mais que la migration échoue, l'ALIAS de connexion est explicitement désenregistré (`del connections.databases[alias]`) avant de relever l'erreur — une requête ordinaire sur CE MÊME processus ne peut donc jamais atteindre une base au schéma non confirmé (elle repasse par le chemin Registry normal, qui la refuse tant que `tenant-service` ne rapporte pas `ACTIVE` — voir §9.2.10).

**Vérifié en conditions réelles** (pas un test mocké) : callback pointé vers une adresse injoignable → `FAILED` avec `last_error` contenant le message d'erreur réseau réel ; callback restauré ; nouvel appel de provisioning → `ACTIVE`, `last_error` vidé. Voir rapport final pour la trace complète.

**Limite assumée** : si la création de la base RÉUSSIT mais que le processus `tenant-service` crashe avant de recevoir la réponse et d'appeler `mark_active()`, la ligne `TenantDatabase` reste en `PROVISIONING` indéfiniment (ni `ACTIVE` ni `FAILED`) alors que la base et son schéma sont en réalité prêts. Un nouvel appel de provisioning ne "reprendrait" PAS ce cas : `claim_for_provisioning` ne réclame que depuis `PENDING`/`FAILED`, jamais depuis `PROVISIONING` (il suppose qu'un autre appel est en cours). **Non résolu dans cette phase** — candidat Phase 8 : un TTL ou un mécanisme de reprise explicite pour les lignes bloquées en `PROVISIONING` (voir §19).

#### 10.2.8 Migrations (§11 de la tâche)

Le provisioning migre UNIQUEMENT l'app `api` de `service-personnel` sur la base tenant nouvellement créée (`call_command('migrate', 'api', database=alias)`) — aucune app système (`auth`, `admin`, `sessions`) n'est jamais migrée sur une base tenant (cohérent avec le Router de la Phase 6, `allow_migrate`, inchangé). Aucun système de migration de masse construit : chaque appel de provisioning migre UNE base, pour UN tenant, à la demande — exactement le périmètre demandé (§11 : "ne construis pas un système complexe de migration de masse").

#### 10.2.9 Sécurité (§14 de la tâche)

- **`POST /tenants/{id}/provision/`** (tenant-service) : réservé à `PLATFORM_ADMIN` — même permission de classe (`IsPlatformAdmin`) que le reste de `TenantViewSet`, aucun nouveau système d'autorisation introduit.
- **`POST /api/internal/provision-database/`** (service-personnel) : réservé aux appels porteurs du jeton `TENANT_SERVICE_INTERNAL_TOKEN` (nouvelle classe `api/permissions.py::IsInternalService`, symétrique — même jeton, même comparaison `hmac.compare_digest` — de celle déjà utilisée côté tenant-service). Ce endpoint ne passe jamais par `GatewayHeaderAuthentication` (comme `AuthVerifyView`) : ce n'est pas un utilisateur qui l'appelle, mais un autre service de confiance.
- **`PLATFORM_ADMIN` ne donne accès à AUCUNE donnée métier tenant** (§14 de la tâche, rappel explicite) : le provisioning crée une base VIDE (schéma seul, aucune donnée) — `PLATFORM_ADMIN` déclenche une opération d'infrastructure, il n'obtient à aucun moment un accès aux futures données métier qui y seront stockées (le Router de la Phase 6, inchangé, continue de exiger un Tenant Context applicatif pour toute lecture/écriture — un `PLATFORM_ADMIN` n'en a pas).
- **Credentials** : `tenant-service` NE CONNAÎT JAMAIS de mot de passe PostgreSQL réel — il envoie uniquement `tenant_id` à service-personnel, qui utilise SES PROPRES credentials (`TENANT_DB_USER`/`TENANT_DB_PASSWORD`, déjà configurés depuis la Phase 6) pour la connexion admin. `TenantDatabase.secret_reference` reçoit une valeur `"shared:PERSONNEL_DB_USER/PERSONNEL_DB_PASSWORD"` — une RÉFÉRENCE, jamais un secret — cohérent avec la Phase 5 (`secret_reference` n'a jamais été branché sur un mécanisme fonctionnel, ni en Phase 5, ni en Phase 6, ni ici). **Aucun mot de passe n'est jamais loggué, écrit dans le modèle, ou transmis entre tenant-service et service-personnel.**
- **Réutilisation, pas de duplication de logique de résolution** (§16 de la tâche) : `provision_database` (service-personnel) réutilise `_alias_for()` et `_build_connection_settings()`, déjà écrits en Phase 6 pour `ensure_connection_alias` — le provisioning ne réimplémente PAS sa propre construction de configuration de connexion.

#### 10.2.10 Validation pilote réelle (Docker + PostgreSQL, pas de mock)

Quatre tenants pilotes créés spécifiquement pour cette phase (`provisioning-test`, `provisioning-test-2`, `provisioning-concurrency-test`, `provisioning-failure-test`), **sans toucher aux tenants pilotes de la Phase 6** (`hopital-central`, `clinique-paix`, dont les bases et données restent intactes) :

1. `provisioning-test` : provisionné via l'API réelle (`POST /tenants/{id}/provision/` avec `services: ["PERSONNEL", "INFRASTRUCTURE"]`) → PERSONNEL réellement créé et migré (`\dt api_*` confirme les 11 tables), INFRASTRUCTURE correctement rapporté `SKIPPED`. Un médecin distinct inséré via le vrai Tenant Context ; **le conteneur `service-personnel` a été REDÉMARRÉ** (processus neuf, aucun alias résiduel en mémoire) puis un login réel via la Gateway (`Host: provisioning-test.fulltang.com`) a confirmé que le Router de la Phase 6 retrouve la base sans AUCUNE modification de son code.
2. `provisioning-test-2` : second tenant provisionné pour confirmer l'absence de collision — base physique distincte (`tenant_92ec83f5...` vs `tenant_324adb4a...`) confirmée par `SELECT datname FROM pg_database`.
3. `provisioning-concurrency-test` : 5 requêtes HTTP concurrentes (§10.2.6) → 1 seule ligne `TenantDatabase`, 1 seul provisioning physique réel, résultat final cohérent `ACTIVE`.
4. `provisioning-failure-test` : échec physique réel simulé (callback pointé vers un hôte injoignable) → `FAILED` avec message d'erreur réel capturé dans `last_error` ; callback restauré ; nouvel appel → `ACTIVE`, erreur effacée (§10.2.7).

#### 10.2.11 Décisions prises

| Décision | Détail |
|---|---|
| Provisioning physique automatisé UNIQUEMENT pour `PERSONNEL` | Seul service disposant de l'équivalent Phase 6 (Dynamic Database Routing) — voir §10.2.2 |
| Service non capable → `SKIPPED`, aucune ligne `TenantDatabase` fictive créée | Une entrée `PENDING` qui ne progresserait jamais serait malhonnête — voir §10.2.2 |
| Nom physique de base = `tenant_<uuid_hex>_<service_code>`, recalculé indépendamment par le service propriétaire (jamais une chaîne réseau de confiance aveugle) | Déterministe, sans collision, jamais dérivé d'une entrée libre — voir §10.2.4 |
| Idempotence via vérification d'existence AVANT création (jamais capture d'erreur "déjà existant" après coup) | §10.2.5 |
| Concurrence via contrainte d'unicité PostgreSQL + `UPDATE ... WHERE` conditionnel (CAS), PAS de `threading.Lock()` | Valide même multi-instance, contrairement au verrou local-process de la Phase 6 — décision consciente d'être plus robuste ici — voir §10.2.6 |
| `TenantDatabaseStatus` étendu (`PROVISIONING`, `FAILED`) plutôt qu'un second système d'état sur `Tenant` | Règle explicite de la tâche — voir §9 |
| Échec physique → `FAILED` + `last_error`, reprise par nouvel appel (retry), jamais de `DROP DATABASE` automatique | `CREATE DATABASE`/`migrate` sont nativement idempotents ; un `DROP` automatique serait risqué sur un échec potentiellement transitoire — voir §10.2.7 |
| Alias désenregistré si la migration échoue après création physique de la base | Aucun alias enregistré ne doit jamais pointer vers un schéma non confirmé — voir §10.2.7 |
| `tenant-service` ne connaît/ne transmet jamais de credential PostgreSQL réel | Cohérent avec `secret_reference` en référence opaque depuis la Phase 5 — voir §10.2.9 |
| Réutilisation stricte de `_alias_for`/`_build_connection_settings` (Phase 6) — aucune logique de résolution dupliquée | Règle explicite de la tâche (§16) — voir §10.2.9 |
| Validation tenant/service AMONT et globale (refuse la demande entière) séparée de l'exécution PAR SERVICE (indépendante, jamais bloquante entre services) | Distingue une erreur de saisie (§15 de la tâche) d'un échec d'infrastructure (§10 de la tâche) — voir §10.2.3 et §10.2.7 |

#### 10.2.12 Décisions reportées

| Décision reportée | Vers quelle phase / pourquoi |
|---|---|
| Secret Manager réel (Vault, AWS Secrets Manager, etc.) | Non planifiée — `secret_reference` reste une référence non branchée, credentials PostgreSQL partagés (hérité de la Phase 6, §12 de la tâche) |
| Provisioning physique pour INFRASTRUCTURE/COMPTA/COMPTA_MATIERE/MEDICAL | Nécessite d'abord de donner à ces services l'équivalent de la Phase 6 (Dynamic Database Routing) — hors périmètre Phase 7 (§22 de la tâche) |
| Reprise automatique d'un provisioning bloqué en `PROVISIONING` (processus crashé après création physique réussie) | Phase 8 candidate — TTL ou mécanisme de reprise explicite, voir §10.2.7 |
| Configuration métier initiale (chambres, services hospitaliers, référentiels propres à chaque établissement) | Phase 9 (Tenant Configuration) — explicitement non anticipée dans cette phase (§13 de la tâche) |
| Provisioning de comptes utilisateurs (Hospital Admin initial, etc.) | Non planifiée — voir §10.1, distinct du provisioning d'infrastructure |
| Provisioning à très grande échelle (création en masse, files d'attente, retries planifiés) | Non planifiée — cette phase ne couvre qu'un provisioning à la demande, un tenant à la fois (§22 de la tâche) |
| Verrou de création distribué (`pg_advisory_lock`/Redis) pour un futur déploiement multi-instance de `tenant-service` | Non nécessaire aujourd'hui — le CAS PostgreSQL (§10.2.6) suffit déjà pour la correction ; un verrou distribué n'ajouterait qu'une optimisation de contention, pas une garantie manquante |
| Révocation en temps réel d'un alias déjà résolu par un processus `service-personnel` | Limite héritée de la Phase 6 (§9.2.10), toujours non résolue — non traitée par cette phase |

---

## 11. Migration

**Statut : Non implémenté** (au-delà du strict nécessaire pour ne pas casser l'existant).

Tous les comptes `Personnel` créés avant l'introduction de `tenant_id` (Phase 3) — y compris les comptes seedés par `seed_data.py`/`seed_admin_only.py` (`admin@fultang.local`, `jean.dupont@fultang.local`, etc.) — ont **`tenant_id = NULL`**.

Ce N'est **pas un état corrompu** : il correspond au "pool non assigné", explicitement supporté (`tenant_id=None` reste une valeur de recherche valide dans `AuthVerifyView`, associée aux hostnames hors convention type `localhost`). Mais **ce n'est pas un état final** — ces comptes ne peuvent pas se connecter dans le contexte d'un vrai tenant tant qu'ils n'y sont pas explicitement rattachés.

**À faire, distinctement du provisioning** : une étape de migration de données qui décide, pour chaque compte `tenant_id IS NULL` existant, à quel tenant réel il doit être rattaché (ou s'il doit rester dans un pool "legacy/dev" permanent).

---

## 12. Service-to-Service

**Décision actuelle, explicitement conservée dans cette phase** :

> Les communications service-to-service restent **directes**, elles ne passent PAS par la Gateway.

Exemples déjà en place :

```
Medical Monitoring ──(HTTP direct)──► Clinical Agent
fultang-compta-financiere ──(HTTP direct, apps/integration/medical_client.py)──► Medical Monitoring
API Gateway ──(HTTP direct, jeton interne)──► tenant-service (résolution)
API Gateway ──(HTTP direct)──► service-personnel (login/verify)
```

**Seule exception sécurisée à ce jour** : `api-gateway → tenant-service` pour `GET /tenants/resolve/`, protégée par un jeton partagé (`X-Internal-Service-Token`, comparaison en temps constant `hmac.compare_digest`, vérifié côté `tenant-service` par `IsInternalService`). C'est une **mesure ponctuelle**, pas une politique généralisée de sécurisation service-to-service.

**Toutes les autres communications directes inter-services restent non authentifiées au-delà de la confiance réseau Docker** (`fultang_shared_network`). Cette architecture sera **réévaluée ultérieurement**, après étude approfondie de la sécurité et des performances des communications inter-services — **explicitement hors périmètre de cette phase**, conformément à la consigne reçue.

---

## 13. Medical Monitoring / Clinical Agent

**Statut : tenant-aware.** Medical Monitoring adopte le même patron "Database per Tenant" que service-personnel (Phase 6/7) ; Clinical Agent résout désormais une base par tenant au lieu d'une base unique, et applique `allow_clinical_agent_export` (Tenant Registry, §9.3) avant toute synchronisation.

### 13.1 Medical Monitoring — mécanisme tenant-aware

Même patron que service-personnel, dupliqué-adapté (aucune bibliothèque partagée entre projets Django de ce monorepo — c'est déjà le choix assumé pour `GatewayHeaderAuthentication`, dupliquée dans 6 services avant cette phase) :

```
API Gateway → X-Tenant-ID → GatewayHeaderAuthentication.authenticate()
   → set_tenant_context(tenant_id)
   → TenantDatabaseRouter (core/tenant_routing/router.py)
   → pool_registry.ensure_connection_alias(tenant_id)
        → registry_client.py (SERVICE_CODE="MEDICAL") → tenant-service
        → cache.py (TTL, identique à service-personnel)
   → django.db.connections[alias] → PostgreSQL du tenant
```

- **`core/tenant_routing/`** (nouveau sous-package) : `context.py`/`middleware.py`/`cache.py` sont des copies STRICTEMENT identiques à service-personnel (aucune logique spécifique au service) ; `registry_client.py` change `SERVICE_CODE` en `"MEDICAL"` ; `pool_registry.py` change le suffixe d'alias (`_medical` au lieu de `_personnel`) et le provisioning migre **sans app_label explicite** (voir §13.1.1) ; `router.py` définit `TENANT_SCOPED_APPS = {"patient", "medical_workflow", "patient_informations"}` (3 apps, contre 1 seule — `api` — pour service-personnel).
- **`core/authentication.py`** : `GatewayHeaderAuthentication` lit désormais `X-Tenant-ID` en plus de `X-User-ID`/`X-User-Roles`, et établit le Tenant Context au même endroit que service-personnel — modification strictement additive (`GatewayUser.tenant_id`, défaut `None`).
- **`core/permissions.py`** (nouveau) : `IsInternalService`, symétrique de celle de tenant-service/service-personnel — protège le nouvel endpoint de provisioning.
- **`core/views.py`** (nouveau) : `ProvisionDatabaseView`, `POST /api/medical-monitoring/internal/provision-database/` — symétrique de celle de service-personnel.
- **Aucun `tenant_id` ajouté** à `Patient`, `Visite`, `Consultation`, etc. : l'isolation vient entièrement de la base physique du tenant, exactement comme `Medecin`/`Personnel` en Phase 6.

#### 13.1.1 Provisioning multi-app (différence avec service-personnel)

service-personnel n'a qu'une app tenant-scopée (`api`), migrée explicitement (`migrate api --database=<alias>`). Medical-Monitoring en a **trois**. Plutôt que d'enchaîner 3 appels `migrate` explicites (fragile si une 4ᵉ app tenant-scopée est ajoutée plus tard), `pool_registry.provision_database()` appelle `migrate` **sans app_label** : Django parcourt alors toutes les apps installées, mais c'est `TenantDatabaseRouter.allow_migrate` qui décide RÉELLEMENT lesquelles s'appliquent sur cet alias — seules les 3 apps tenant-scopées (+ `migrations`, bookkeeping) y écrivent quoi que ce soit, exactement comme pour `default`. Aucune duplication de la liste des apps tenant-scopées entre le provisioning et le router (source unique : `router.py::TENANT_SCOPED_APPS`).

Vérifié en conditions réelles (Docker + PostgreSQL, 2 tenants pilotes) : `\dt` sur chaque base tenant confirme exactement les 32 tables des 3 apps métier + `django_migrations`, **aucune** table système (`auth_*`, `admin_*`, `django_session`).

### 13.2 Signal `Visite` → Clinical Agent (correction du problème contextvars)

**Problème identifié** (audit) : `contextvars` ne se propage PAS à un `threading.Thread` nouvellement créé (vérifié empiriquement) — le thread de notification (`medical_workflow/signals.py`) ne pouvait donc pas connaître le tenant courant en le relisant lui-même.

**Correction appliquée** : le tenant est capturé **dans le thread de la requête** (`get_current_tenant_context()`, avant `thread.start()`) et transmis **en paramètre explicite** à `_notify_agent(visite_id, tenant_id)`, qui l'envoie à Clinical Agent via le header `X-Tenant-ID` (+ le jeton de service interne partagé, voir §13.3).

**Si aucun tenant réel n'est disponible** (contexte jamais établi, ou `tenant_id=None` — pool non assigné) : la notification n'est **pas envoyée**. Un compte non rattaché à un tenant réel n'a pas de configuration `allow_clinical_agent_export` à vérifier — refuser est le seul choix qui ne devine jamais une autorisation. Seule une information technique (id de visite tronqué) est loguée, jamais de donnée médicale.

**Limite connue** : lorsque `Visite.save()` est appelé par un processus **court** (ex: `manage.py seed_tenant_demo`, voir §22) plutôt que par le serveur `runserver` qui reste actif, le thread de notification `daemon=True` peut ne pas avoir le temps de s'exécuter avant la fin du processus principal — le rattrapage périodique (ou un appel manuel à `/sync/all`) reprend alors la visite normalement. Vérifié en conditions réelles pendant la validation pilote : c'est exactement ce qui s'est produit, et le rattrapage a correctement repris les 2 visites de démonstration.

### 13.3 Clinical Agent — mécanisme tenant-aware

Avant cette phase : un seul moteur SQLAlchemy (`MAIN_DB_URL`) vers "la" base Medical-Monitoring, une BD tampon partagée sans notion de tenant, `/sync/*` sans authentification.

```
X-Tenant-ID + X-Internal-Service-Token
   → verify_internal_service_token()   (main.py — même jeton partagé que tout FullTang)
   → verify_export_authorization()     (registry_client.get_tenant_config → allow_clinical_agent_export)
        NON → 403, AUCUNE lecture de donnée médicale
        OUI → engine_registry.get_engine_for_tenant(tenant_id)
                → registry_client.resolve_tenant_database (SERVICE_CODE="MEDICAL")
                → SQLAlchemy engine mis en cache par tenant
   → sync.py::sync_visite/sync_all_completed_visits (scopés par tenant_id)
   → BD tampon : CasClinique/VisiteSynced avec tenant_id
```

- **`registry_client.py`** (nouveau) : équivalent Python pur (urllib, aucune nouvelle dépendance — `httpx` était déjà présent en dépendance mais inutilisé, `urllib` reste cohérent avec le reste de FullTang) du client de service-personnel : `resolve_tenant_database` (base MEDICAL d'un tenant), `get_tenant_config` (statut + `allow_clinical_agent_export`), `list_active_tenant_databases` (énumération explicite, réservée à l'usage interne — voir §13.3.2).
- **`engine_registry.py`** (nouveau) : un moteur SQLAlchemy PAR TENANT, mis en cache (`{tenant_id: Engine}`), verrouillé par tenant (même principe que `pool_registry.py`, structure volontairement plus simple — "un registry simple par tenant", pas de réimplémentation de `django.db.connections`). Ce n'est PAS un vrai pool applicatif au-delà de ce que SQLAlchemy fait déjà nativement par engine (`QueuePool`) — documenté honnêtement.
- **`database.py`** : `MAIN_DB_URL`/`MainSession` supprimés (il n'existe plus "une" base principale) ; `get_main_session_for_tenant(tenant_id)` les remplace. `TamponSession` (BD tampon, partagée) inchangé.
- **`/sync/visite/{id}` et `/sync/all`** exigent désormais `X-Tenant-ID` ET le jeton interne partagé — avant cette phase, ces endpoints n'avaient AUCUNE authentification (isolation réseau Docker uniquement). Un appel sans jeton, sans tenant, ou avec un tenant inexistant/inactif est rejeté explicitement (401/400/404/503), jamais un accès à une base par défaut.
- **`/sync/all` reste scopé à UN SEUL tenant** (`X-Tenant-ID`) — jamais un parcours implicite de tous les tenants (§10 de la tâche). L'énumération multi-tenant est **une fonction interne dédiée**, `sync_all_known_tenants()` (`main.py`), appelée UNIQUEMENT au démarrage et par le planificateur périodique (15 min) — jamais exposée comme endpoint public.
- **`/export` inchangé dans son mécanisme de sécurité** (`X-API-Key`, sha256 + `hmac.compare_digest`, rate limiting — vérifiés déjà corrects, aucune faille de timing constatée dans le code audité). Reste un flux **agrégé** multi-tenants vers MedTutor : aucun paramètre `tenant_id` n'est exposé au client externe (§11 de la tâche — "ne pas donner au client externe la possibilité de choisir arbitrairement un tenant"). L'isolation de `/export` est garantie EN AMONT, au moment de la synchronisation : un tenant dont `allow_clinical_agent_export=False` n'a jamais ses données écrites dans le buffer, donc jamais exposées par `/export`.

#### 13.3.1 Buffer partagé — `tenant_id` ajouté (raison technique démontrée)

`CasClinique`/`VisiteSynced` reçoivent un champ `tenant_id` (NOT NULL, indexé, contrainte d'unicité `(patient_id_source, tenant_id)` / `(visite_id_source, tenant_id)`). Ceci est l'EXCEPTION explicitement prévue par la tâche à la règle "ne pas ajouter tenant_id partout" : la BD tampon est PARTAGÉE PAR CONSTRUCTION (`/export` produit un flux agrégé multi-établissements, ce n'est pas une isolation Database-per-Tenant comme le reste) — il faut donc savoir explicitement à quel tenant appartient chaque cas pour appliquer `allow_clinical_agent_export`, contrairement à `Patient`/`Visite` où l'isolation vient déjà de la base physique.

**Migration** : les 2 tables existantes (16 cas cliniques / 26 visites, données de démonstration créées AVANT l'introduction du multitenant dans Medical-Monitoring, sans tenant possible) ont été **vidées** après confirmation explicite de l'utilisateur — aucune attribution à un tenant réel n'était possible pour ces données historiques, et la BD tampon est un cache dérivé/reconstructible (jamais la source de vérité). `init_tampon_db()` (SQLAlchemy `create_all`) a recréé les tables avec le nouveau schéma ; le rattrapage périodique a repeuplé le buffer correctement, cette fois scopé par tenant.

#### 13.3.2 `resolve-active` — nouvel endpoint tenant-service

`GET /api/tenant-databases/resolve-active/?service=<code>` (tenant-service, `IsInternalService`) énumère les configurations `ACTIVE` pour un service donné — nécessaire à `sync_all_known_tenants()` (Clinical Agent doit savoir explicitement quels tenants ont une base MEDICAL active, sans deviner ni parcourir un registre auquel il n'a pas un accès direct). Réutilise `TenantDatabaseRepository.list()` (déjà existant, Phase 5) — aucune nouvelle logique de requête.

### 13.4 Bug découvert et corrigé lors de l'inspection — `X-API-Key`

L'audit (tâche §10) demandait de revérifier un problème potentiel identifié précédemment autour de `X-API-Key`. Inspection du code actuel (`clinical-agent/main.py::verify_api_key`) : la vérification utilise déjà `hashlib.sha256(api_key).hexdigest()` comparé via `hmac.compare_digest()` à `MEDTUTOR_API_KEY_HASH` — **mécanisme déjà correct**, aucune vulnérabilité de timing constatée. Aucune modification nécessaire ; conservé tel quel.

### 13.5 Problème d'infrastructure locale découvert et corrigé (sans rapport avec le multitenant)

En rendant Clinical Agent réellement démarrable pour la première fois pendant cette phase (il ne l'était jamais dans cet environnement de développement avant), deux défauts d'infrastructure PRÉEXISTANTS et jusque-là invisibles ont été découverts :
1. **`certs/` vide** : le `Dockerfile` exige `--ssl-keyfile`/`--ssl-certfile` (TLS), jamais fournis en dev local → le conteneur ne démarrait jamais. Un certificat auto-signé de développement a été généré (`openssl req -x509 ...`) pour débloquer le développement local ; le `Dockerfile` (image de production) n'a pas été modifié.
2. **Incohérence HTTP/HTTPS** : `medical_workflow/signals.py::CLINICAL_AGENT_URL` appelle en `http://` alors que le conteneur écoutait en HTTPS — invisible tant que le conteneur ne démarrait jamais (l'appel échouait de la même façon, "connexion refusée"). Corrigé en dev : `docker-compose.yml` (racine) surcharge la commande du conteneur pour servir en HTTP simple, cohérent avec le reste de la stack locale (aucun autre appel interne de FullTang ne parle HTTPS en dev).
3. **`FULTANG_RATE_LIMIT_REQUESTS`/`_WINDOW_SECONDS` vides** : `${VAR}` sans valeur dans `docker-compose.yml` produit une chaîne VIDE (pas une absence) injectée dans le conteneur, faisant échouer `int('')` au démarrage. Corrigé avec `${VAR:-défaut}`.

Ces trois défauts sont documentés ici car ils bloquaient totalement la validation pilote — mais ils sont **indépendants** du travail de tenant-isolation lui-même (vérifié explicitement : mêmes échecs constatés en testant le code non modifié, avant toute intervention de cette phase).

### 13.6 Impact sur `fultang-compta-financiere`, `ComptaMatiere`, `Gestion-Infrastructures` (état avant Phase 8 finalisation)

Cette sous-section documente l'état constaté **au moment du chantier Medical-Monitoring/Clinical Agent** (avant la finalisation ci-dessous, §13.7) — conservée pour l'historique. **Ces trois services sont devenus tenant-aware en Phase 8 (finalisation)**, voir §13.7.

**`fultang-compta-financiere`** (`apps/integration/medical_client.py`) appelle Medical-Monitoring pour construire les profils de facturation caissier (`_fetch_medical_snapshot`) :
- **Chemin primaire (Gateway)** : forward du JWT du caissier vers `http://api-gateway:8080/medical/**`. Puisque ce JWT porte déjà `tenant_id` (Phase 3) et que la Gateway injecte `X-Tenant-ID` pour TOUTE route authentifiée (pas seulement `/personnel/**`), Medical-Monitoring devenu tenant-aware route AUTOMATIQUEMENT ce chemin vers la bonne base — **aucune modification de `medical_client.py` n'a été nécessaire** à ce stade. Vérifié en conditions réelles : `GET /compta-financiere/caissier/patients-en-attente/` avec un JWT valide → `200 OK`, données correctement renvoyées.
- **Chemin de repli (accès direct, hors Gateway)** : `_base_url()` (`SERVICE_MEDICAL_URL`) sans jamais transmettre `X-User-ID`/`X-Tenant-ID` (ces headers ne sont construits QUE par la Gateway). Ce chemin échouait **déjà** avant cette phase (`GatewayHeaderAuthentication` exige `X-User-ID`, absent ici → 401). **Corrigé en Phase 8 (finalisation)** — voir §13.7.3 : même s'il continue d'échouer la plupart du temps, il ne doit plus jamais perdre le tenant_id silencieusement s'il réussissait un jour.
- **Base propre de `fultang-compta-financiere`** : à ce stade, restait unique, non tenant-isolée. **Isolée en Phase 8 (finalisation)**, voir §13.7.

**`ComptaMatiere` et `Gestion-Infrastructures`** : à ce stade, non tenant-aware. **Devenus tenant-aware en Phase 8 (finalisation)**, voir §13.7.

### 13.7 Phase 8 (finalisation) — `fultang-compta-financiere`, `ComptaMatiere`, `Gestion-Infrastructures` deviennent tenant-aware

**Mandat** : la Phase 8 initiale (§13.1-§13.6) avait explicitement laissé ces trois services hors périmètre ("pas de refonte non nécessaire pour ce chantier"). Une mission de suivi a demandé de finaliser la fondation multi-tenant sur l'**ensemble** du périmètre fonctionnel de FullTang — ces trois services étant les derniers services métier persistants encore sur une base unique partagée, ils sont désormais alignés sur le même patron **Database-per-Tenant** que service-personnel et Medical-Monitoring.

#### 13.7.1 Mécanisme — identique au patron déjà validé

Pour chacun des 3 services, portage à l'identique du paquet `tenant_routing/` (`context.py`, `middleware.py`, `cache.py`, `registry_client.py`, `pool_registry.py`, `router.py`), de `permissions.py::IsInternalService` et de `views.py::ProvisionDatabaseView`, exactement comme Medical-Monitoring (§13.1). Aucune divergence de conception — seules les valeurs suivantes changent par service :

| Service | `SERVICE_CODE` | Alias DB | `TENANT_SCOPED_APPS` | Provisioning migré sans app_label |
|---|---|---|---|---|
| fultang-compta-financiere | `COMPTA` | `tenant_<hex>_compta` | `comptabilite`, `caisse`, `sorties`, `messaging` (4 apps) | Oui |
| ComptaMatiere | `COMPTA_MATIERE` | `tenant_<hex>_compta_matiere` | `comptabilite_matiere` (1 app) | Oui |
| Gestion-Infrastructures | `INFRASTRUCTURE` | `tenant_<hex>_infrastructure` | `infrastructures` (1 app) | Oui |

`GatewayHeaderAuthentication.authenticate()` de chacun des 3 services appelle désormais `set_tenant_context(tenant_id)` — jusque-là, `tenant_id` était lu et exposé sur `GatewayUser` mais n'avait strictement aucun effet (constaté explicitement à l'audit, §Phase 1 de cette mission). `TenantContextCleanupMiddleware` ajouté en dernière position dans `MIDDLEWARE`, comme les 2 services de référence.

**Bases existantes préservées** : conformément à la stratégie déjà validée pour service-personnel/Medical-Monitoring ("pool non assigné"), les 3 bases historiques (`fultang_compta_financiere`, `comptamatiere`, `infrastructure_db`) restent inchangées et continuent de servir tout contexte `tenant_id=None` (aucun `X-Tenant-ID` reçu). **Aucune donnée existante n'a été supprimée, migrée ou réattribuée.** Les nouvelles bases tenant sont des bases PostgreSQL physiquement distinctes, créées vides sur le même serveur, exactement comme pour service-personnel/Medical-Monitoring. Vérifié explicitement après chaque provisioning réel (comptage de lignes avant/après identique sur les 3 bases historiques).

`tenant-service/tenants/provisioning.py::PROVISIONING_CAPABLE_SERVICES` étend la liste déjà utilisée pour PERSONNEL/MEDICAL avec `COMPTA`, `COMPTA_MATIERE`, `INFRASTRUCTURE`, chacun avec son propre préfixe d'URL interne (`COMPTA_MATIERE` sous `/api/compta_matiere/`, les deux autres sous `/api/` — même vigilance que le bug déjà corrigé pour MEDICAL, voir historique Phase 7).

#### 13.7.2 Bugs de migration découverts et corrigés (spécifiques à chaque service)

Rejouer les migrations existantes sur une base tenant **fraîche** (jamais testé avant cette phase — `manage.py test` migre toujours contre `default`, qui a déjà les tables système) a révélé 3 défauts préexistants, indépendants les uns des autres, tous corrigés :

1. **`Gestion-Infrastructures/infrastructures/migrations/0004_seed_types_salle.py`** — un `RunPython` appelait `TypeSalle.objects.get_or_create(...)` sans `.using(db_alias)` : la requête passait par le nouveau `TenantDatabaseRouter`, qui exige un Tenant Context déjà établi — absent lors d'un `migrate` hors requête HTTP. **Corrigé** : `.using(schema_editor.connection.alias)`.
2. **`fultang-compta-financiere/apps/caisse/migrations/0002_quittance_est_validee_patient_id.py`** — même défaut, sur `Quittance.objects.all().update(...)`. **Corrigé** de la même manière.
3. **`fultang-compta-financiere/apps/comptabilite/management/commands/seed_initial.py`** — exécuté automatiquement au démarrage du conteneur (`CMD` du `Dockerfile` : `migrate && seed_initial && runserver`), cette commande crée le plan comptable OHADA initial via des `get_or_create` directs, hors de tout cycle de requête HTTP. **Corrigé** en appelant `set_tenant_context(None)` explicitement en début de commande — sémantiquement correct : ce seed peuple le pool non assigné (`default`), jamais un tenant réel.
4. **`ComptaMatiere` — ForeignKey historique vers `settings.AUTH_USER_MODEL`** (le plus significatif) : les migrations `0001_initial.py`, `0003_livraison_sortie.py`, `0005_rapport_id_personnel.py` et `0006_rapport_code_rapport_rapport_date_envoi_and_more.py` déclaraient à l'origine plusieurs champs (`Besoin.idPersonnel_emetteur`, `Sortie.idPersonnel`, `Rapport.id_personnel`/`destinataire`/`expediteur`, `ArchiveInventaire.responsable`) comme de VRAIES `ForeignKey` vers `auth.User`, avec contrainte `REFERENCES auth_user(id)` au niveau base. Ces contraintes ont ensuite été retirées par une migration ultérieure déjà appliquée sur `default` (`0011_remove_archiveinventaire_responsable_and_more.py`, qui convertit tout en `IntegerField` puis `0012_personnel_uuid_ids.py` en `CharField(36)` — le modèle actuel, `apps/comptabilite_matiere/models/*.py`, n'a **jamais** eu de FK vers `auth.User`). Sur `default`, aucun problème : ces migrations historiques ont déjà été rejouées il y a longtemps et `auth_user` y existe. Sur une base tenant **fraîche**, en revanche, `auth`/`admin`/`sessions`/`contenttypes` n'existent délibérément jamais (voir `allow_migrate`, §9.2/§13.1) — la création de la table échouait avec `ProgrammingError: relation "auth_user" does not exist`, bloquant tout provisioning réel pour ce service.
   **Corrigé** en réécrivant directement les 4 migrations historiques concernées pour déclarer ces champs comme `CharField(max_length=36)` dès leur création, sans `ForeignKey` ni `swappable_dependency(AUTH_USER_MODEL)` — **strictement sans effet sur `default`** (une migration déjà appliquée n'est jamais rejouée ; seul son contenu futur, pour une base qui ne l'a pas encore exécutée, change). Les migrations `AlterField` déjà existantes (0011/0012) s'appliquent ensuite normalement par-dessus, aboutissant au même état final que sur `default`. Vérifié : `makemigrations --check` → "No changes detected" après correction, `migrate` sur `default` → "No migrations to apply" (aucune régression), et un provisioning réel d'un tenant fraîchement créé aboutit désormais à un `200 OK` avec les 14 tables métier attendues.

Ce dernier point illustre une classe d'anomalie qui ne peut être détectée QUE par un vrai test de provisioning bout-en-bout contre une base neuve — ni les tests unitaires existants, ni `makemigrations --check`, ni un `migrate` classique contre `default` ne l'auraient révélée. Documenté explicitement plutôt que masqué.

#### 13.7.3 `medical_client.py` — propagation de `X-Tenant-ID` sur les deux chemins

`fultang-compta-financiere/apps/integration/medical_client.py::_get()` construisait ses headers (`Accept`, `Authorization`) sans jamais inclure `X-Tenant-ID`, sur le chemin Gateway **et** sur le chemin de repli direct (`SERVICE_MEDICAL_URL`, hors Gateway). Le chemin Gateway fonctionnait déjà correctement par héritage (la Gateway injecte `X-Tenant-ID` elle-même pour toute route proxyée, indépendamment de ce que le service appelant envoie) — mais le chemin de repli, s'il réussissait un jour (aujourd'hui il échoue le plus souvent en 401, comportement inchangé et non corrigé par choix — voir §13.6), n'aurait jamais transmis le tenant courant. **Corrigé** : `_get()` lit désormais le Tenant Context courant (`get_current_tenant_context()`) et ajoute `X-Tenant-ID` sur les deux chemins, uniquement si un tenant réel est établi (jamais la chaîne littérale `"None"`). Le chemin de repli reste volontairement conservé tel quel (fonctionnalité existante, pas supprimée sans justification) — seule la fuite de contexte potentielle est corrigée.

#### 13.7.4 Kafka — `tenant_id` ajouté aux événements et au consommateur

`fultang-compta-financiere/apps/messaging/` (producteur ET consommateur Kafka du même service, `USE_KAFKA` optionnel, **non démarré dans cet environnement de développement** — aucun conteneur `kafka`/`zookeeper` actif) présentait la même classe de bug que le signal `Visite` déjà corrigé pour Medical-Monitoring (§13.2) : `kafka_consumer._consumer_loop` tourne dans un thread daemon séparé qui n'hérite jamais du Tenant Context du thread ayant publié l'événement.
- `QuittanceValideeEvent`/`CaisseFermeeEvent`/`OrdrePaiementExecuteEvent` (`apps/messaging/events.py`) reçoivent un champ `tenant_id: str | None`, peuplé au moment de la publication (`apps/caisse/views/__init__.py`, `apps/sorties/views/__init__.py`) depuis le Tenant Context établi par la vue DRF appelante.
- `kafka_consumer._dispatch()` rétablit explicitement `set_tenant_context(payload.get('tenant_id'))` AVANT tout accès ORM (y compris `is_event_processed`/`mark_event_processed`, dans l'app `messaging`, elle aussi tenant-scopée), puis nettoie dans un `finally` — même idiome que la correction Medical-Monitoring.
- `TOPIC_PATIENT_CREE` ('patient.cree') est consommé mais **n'a aucun producteur nulle part dans le dépôt** (vérifié par recherche exhaustive) — intégration pré-existante inachevée. **Aucun producteur n'a été inventé** (règle explicite de la mission). Le handler `handle_patient_cree` reste défensif : sans `tenant_id` dans le payload, il journalise un avertissement et refuse l'écriture plutôt que de deviner un rattachement ou d'écrire silencieusement dans le pool non assigné.
- **Limite assumée et documentée explicitement** : Kafka n'étant pas démarré dans cet environnement, ce correctif est vérifié par des tests unitaires appelant `_dispatch()` directement avec un payload fabriqué (contournement complet du client Kafka réel) — **jamais par un test de bout en bout contre un vrai broker**. Aucune preuve n'est prétendue au-delà de ce qui a été réellement testé.

#### 13.7.5 Frontend — 6 points de résolution d'URL statique corrigés

Un audit complet de tous les clients HTTP du frontend (au-delà des 3 déjà corrigés lors d'un chantier précédent) a trouvé 6 points supplémentaires où une URL statique (variable d'environnement ou `localhost` en dur) contournait la résolution dynamique par sous-domaine (`getGatewayBaseUrl()`) : `src/services/medecinsApi.js`, `src/services/chambresApi.js`, `src/services/comptabiliteMatiereApi.js` (ses deux clients axios), `src/Pages/Authentication/ForgottenPassword.jsx`, `src/Pages/Receptionist/ViewPatientDetailsModal.jsx` (construction d'URL de photo patient), et `src/Utils/Provider.jsx::getCurrentUserInfos()` (fonction non appelée nulle part dans le code — corrigée par cohérence, sans impact fonctionnel réel). Tous corrigés pour utiliser `getGatewayBaseUrl()`. Aucun autre point statique trouvé après re-balayage complet (`grep` sur `VITE_BACKEND`/`localhost:8080`/`VITE_API_GATEWAY_URL` dans tout `src/`) — seuls `gatewayUrls.js` lui-même et les 2 instances déjà correctes (`axiosInstance.js`, `axiosInstanceCompta.js`, qui l'utilisent en repli) subsistent. `npm run build` et `eslint` vérifiés propres (aucune régression par rapport à l'état préexistant, confirmé par `git stash`).

**Audit de sécurité frontend (§2 de la mission de suivi)** : recherche exhaustive (`grep -rni "tenant"` sur tout `src/`) confirmant qu'aucun contrôle UI, paramètre d'URL, ou état côté client ne permet à un utilisateur ou au code applicatif de choisir arbitrairement le tenant interrogé — le seul déterminant est `window.location.hostname`, jamais une valeur manipulable à l'exécution.

#### 13.7.6 Classification finale mise à jour

| Composant | État |
|---|---|
| service-personnel (personnel, comptes) | **ISOLÉ PAR TENANT** |
| Medical-Monitoring (patients, visites, consultations, examens, prescriptions) | **ISOLÉ PAR TENANT** |
| Clinical Agent (moteur de lecture par tenant) | **ISOLÉ PAR TENANT** — exception architecturale assumée (multi-tenant dans le même processus), buffer scopé par `tenant_id` + autorisation |
| fultang-compta-financiere — appel à Medical-Monitoring (Gateway) | **ISOLÉ PAR TENANT** (hérité) |
| fultang-compta-financiere — appel à Medical-Monitoring (repli direct) | Toujours en échec la plupart du temps (401, préexistant, non corrigé par choix) — **ne perd plus le tenant s'il réussit** |
| fultang-compta-financiere — base propre (caisse, comptabilité, facturation, messaging Kafka) | **ISOLÉ PAR TENANT** (Phase 8 finalisation) |
| ComptaMatiere | **ISOLÉ PAR TENANT** (Phase 8 finalisation) |
| Gestion-Infrastructures | **ISOLÉ PAR TENANT** (Phase 8 finalisation) |
| Frontend — résolution de l'URL Gateway | **100 % dynamique par sous-domaine** — 0 point statique restant, vérifié par balayage exhaustif |
| Intégration Kafka `patient.cree` | **HORS PÉRIMÈTRE** — aucun producteur dans le dépôt, non inventé |
| ComptaMatiere / Gestion-Infrastructures — provisioning automatisé pour de vrais volumes (au-delà des tenants pilotes) | Mécanisme identique à service-personnel/Medical-Monitoring, mêmes limites déjà documentées (§10, pas de reprise auto sur crash mi-provisioning, pas de verrou distribué) |

---

## 14. Configuration Tenant — Tenant Management & Configuration (Phase 9, ce chantier)

### 14.1 AVANT

Avant ce chantier : un tenant se créait avec `name`+`identifier` uniquement (+ `allow_clinical_agent_export`, optionnel, Phase Medical-Monitoring tenant-aware). Aucune information descriptive (adresse, contact), aucune notion de "service fonctionnel activé pour cet établissement" n'existait — seul `PlatformService` (catalogue des **microservices techniques**, utilisé pour le provisioning/routage) existait, ce qui n'est PAS la même chose (voir §14.2). Le Platform Admin frontend n'avait qu'un Dashboard (stats globales) — aucune page de liste des établissements, aucun formulaire de création, aucune configuration.

| Déjà configurable (avant ce chantier) | Pas encore configurable |
|---|---|
| `identifier`, `name`, `status` (ACTIVE/INACTIVE) du tenant | Informations de profil (adresse, téléphone, email, logo) |
| Autorisation de partage des données cliniques (`allow_clinical_agent_export`) | Services fonctionnels activés par tenant |
| Domaine racine de résolution (`TENANT_ROOT_DOMAIN`, env var) | Formulaires/workflows personnalisés (hors périmètre de ce chantier) |
| Jeton interne Gateway↔tenant-service (`TENANT_SERVICE_INTERNAL_TOKEN`, env var) | Feature flags (hors périmètre) |

### 14.2 Distinction fondamentale — `PlatformService` vs `FunctionalService`

**À NE JAMAIS CONFONDRE**, cette distinction structure tout ce chantier :

| | `PlatformService` (existant, Phase 5) | `FunctionalService` (nouveau, ce chantier) |
|---|---|---|
| Représente | Un **microservice technique** de FullTang (PERSONNEL, MEDICAL, COMPTA, COMPTA_MATIERE, INFRASTRUCTURE) | Une **capacité produit** proposée par un établissement (Médecine générale, Pharmacie, Laboratoire...) |
| Sert à | Provisioning (`TenantDatabase`), routage de bases | Sélection, par établissement, des fonctionnalités disponibles |
| Granularité | 1 entrée = 1 microservice déployé séparément | 1 entrée = 1 capacité métier, plusieurs pouvant vivre dans le MÊME microservice (ex: Pharmacie et Laboratoire vivent toutes deux dans Medical-Monitoring) |
| Catalogue actuel | 5 entrées (seed Phase 5) | 9 entrées (seed ce chantier, voir §14.4) |

Le catalogue `FunctionalService` est dérivé du code EXISTANT (rôles service-personnel : Medecin/Infirmiere/Pharmacien/Laborantin/Caissier/Comptable ; apps métier de Medical-Monitoring/fultang-compta-financiere/ComptaMatiere/Gestion-Infrastructures) — pas une liste inventée.

**Situation actuelle de `service-personnel`, non modifiée par ce chantier** : ce service permet encore aujourd'hui de créer/gérer librement des objets `Service` (services hospitaliers organisationnels, ex: "Cardiologie", propres à la base de chaque tenant — une notion complètement différente de `FunctionalService`). Cette situation est connue et **évoluera dans une phase ultérieure** vers : les services fonctionnels de FullTang définis uniquement dans le code produit, la couche de configuration des tenants servant seulement à les activer/désactiver — jamais à en créer de nouveaux. **Aucun refactoring de `service-personnel` n'a été fait dans ce chantier** (délibérément hors périmètre, voir mission §10).

### 14.3 Modèles ajoutés (`tenant-service/tenants/models.py`)

```python
class Tenant(models.Model):
    # ... champs existants (id, name, identifier, status, allow_clinical_agent_export, created_at) ...
    address = models.TextField(blank=True, default='')
    phone = models.CharField(max_length=30, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    logo_url = models.URLField(blank=True, default='')  # référence, pas un upload de fichier

class FunctionalService(models.Model):
    code = models.CharField(max_length=50, primary_key=True)  # ex: PHARMACIE
    name = models.CharField(max_length=100)
    status = models.CharField(choices=FunctionalServiceStatus.choices, default=ACTIVE)
    display_order = models.PositiveIntegerField(default=0)  # ordre d'affichage IHM
    created_at = models.DateTimeField(auto_now_add=True)

class TenantFunctionalService(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    tenant = models.ForeignKey(Tenant, on_delete=CASCADE, related_name='functional_services')
    service = models.ForeignKey(FunctionalService, on_delete=PROTECT, related_name='tenant_configs')
    enabled = models.BooleanField(default=True)
    created_at / updated_at
    class Meta:
        constraints = [UniqueConstraint(fields=['tenant', 'service'], name='tenant_functional_service_unique_tenant_service')]
```

**Sémantique de l'absence de ligne** : un (tenant, service) sans ligne `TenantFunctionalService` explicite est traité comme **activé par défaut** (`enabled=True`) par la couche service (`TenantFunctionalServiceService.list_for_tenant`) — un tenant n'a pas besoin qu'on lui crée 9 lignes pour hériter d'un comportement raisonnable. Le wizard de création en crée néanmoins une ligne complète et explicite dès la création (traçabilité), via l'endpoint bulk.

**Isolation stricte** : `UniqueConstraint(tenant, service)` + `tenant` en `ForeignKey(CASCADE)` — aucune configuration n'est jamais partagée entre deux tenants, vérifié par test (`TenantFunctionalServiceServiceTests::test_configuration_is_isolated_between_tenants` et son équivalent HTTP).

### 14.4 Migrations

| Migration | Contenu |
|---|---|
| `0008_functionalservice_tenant_address_tenant_email_and_more.py` | `AddField` (address/phone/email/logo_url sur Tenant, tous `blank=True, default=''` — aucune perte de données, tenants existants héritent de chaînes vides), `CreateModel` (FunctionalService, TenantFunctionalService) |
| `0009_seed_functional_services.py` | Seed des 9 services fonctionnels (données, réversible) : MEDECINE_GENERALE(10), SOINS_INFIRMIERS(20), PHARMACIE(30), LABORATOIRE(40), CAISSE(50, "Caisse / Encaissement"), COMPTA_FINANCIERE(60), COMPTA_MATIERE(70), GESTION_PERSONNEL(80), GESTION_INFRASTRUCTURES(90) — ordre = `display_order`, les plus centraux au parcours patient en premier |

### 14.5 APIs (nouvelles et étendues)

| Méthode | URL | Rôle autorisé | Payload | Réponse | Erreurs | Scope |
|---|---|---|---|---|---|---|
| `POST` | `/tenants/` (existant, étendu) | PLATFORM_ADMIN | `{name, identifier, address?, phone?, email?, logo_url?, allow_clinical_agent_export?}` | Tenant créé (201) | 400 si `name`/`identifier` manquant ou `identifier` déjà pris | Plateforme |
| `PATCH` | `/tenants/{id}/` (existant, étendu) | PLATFORM_ADMIN | Tout sous-ensemble de `{allow_clinical_agent_export, address, phone, email, logo_url}` (partiel) | Tenant à jour (200) | 404 tenant inconnu | Plateforme |
| `POST` | `/tenants/{id}/provision/` (existant, inchangé) | PLATFORM_ADMIN | `{services: [codes PlatformService]}` | Résultat par service (200) | 404/409/400 sur demande invalide | Plateforme |
| `GET` | `/functional-services/` (nouveau) | PLATFORM_ADMIN | — | Catalogue complet, ordonné (200) | — | Plateforme |
| `GET` | `/tenants/{id}/functional-services/` (nouveau) | PLATFORM_ADMIN | — | Catalogue fusionné avec la config du tenant (200) | 404 tenant inconnu | **Scopé au tenant `{id}`** |
| `POST` | `/tenants/{id}/functional-services/bulk/` (nouveau) | PLATFORM_ADMIN | `{services: [{code, enabled}, ...]}` | Config complète à jour (200) | 400 si un code inconnu (rien n'est écrit — tout ou rien) | **Scopé au tenant `{id}`** |
| `PATCH` | `/tenants/{id}/functional-services/{code}/` (nouveau) | PLATFORM_ADMIN | `{enabled: bool}` | Config complète à jour (200) | 400 si `code` inconnu | **Scopé au tenant `{id}`** |

Toutes réservées `IsPlatformAdmin` (même mécanisme que le reste du Tenant Management, aucun nouveau système d'autorisation). Aucune route Gateway nouvelle : le préfixe `/tenants/**` proxyait déjà tout vers ce service (vérifié en conditions réelles, voir §14.7).

### 14.6 "Nombre de pools" — investigation et décision explicite

Investigation demandée par la mission avant d'exposer un contrôle : inspection de `pool_registry.py` (service-personnel/Medical-Monitoring/les 3 services Phase 8 finalisation) et de `TenantDatabase`. Constat : le "pool" de connexions est en réalité `CONN_MAX_AGE` (voir §9.2, docstring de `pool_registry.py`, honnêtement documenté comme n'étant pas un vrai pool multi-connexions), configuré par la variable d'environnement **globale** `TENANT_DB_CONN_MAX_AGE` — identique pour tous les tenants d'un même service, jamais lue depuis `TenantDatabase` ni depuis aucune configuration par tenant. Le docstring du module le dit déjà explicitement : *"Point d'extension pour une configuration PAR TENANT dans une phase ultérieure : il suffirait de lire une valeur optionnelle sur la réponse du Registry ici, sans toucher au reste du mécanisme — pas construit maintenant."*

**Décision : ce paramètre n'est PAS exposé dans le wizard.** Afficher un contrôle sans effet backend réel serait trompeur (règle explicite de la mission : "une configuration affichée dans l'interface doit toujours avoir un effet réel"). Ce qui serait nécessaire pour le rendre réellement configurable, si une future phase le souhaite :
1. Ajouter un champ optionnel à `TenantDatabase` (ex: `conn_max_age_seconds`, nullable) ;
2. L'exposer en lecture dans `TenantDatabaseResolutionSerializer` ;
3. Faire lire cette valeur par `_build_connection_settings()` de chaque service (fallback sur `settings.TENANT_DB_CONN_MAX_AGE` si absente) ;
4. L'exposer en écriture via `TenantDatabaseUpdateSerializer`.
Aucune de ces 4 étapes n'existe aujourd'hui — non implémenté, documenté honnêtement plutôt que masqué.

### 14.7 Vérification en conditions réelles

Testé via le Gateway réel (`http://localhost:8080`), avec un vrai JWT PLATFORM_ADMIN : création d'un tenant avec profil complet, listing du catalogue de services fonctionnels pour ce nouveau tenant (tous activés par défaut, confirmé), désactivation en masse de 2 services (`bulk/`), réactivation d'un seul via `PATCH .../{code}/`, et rejet propre (400) d'un code de service inexistant — tous confirmés avec les payloads/réponses exacts documentés en §14.5.

### 14.8 Frontend — architecture extensible

`Fultang-Core/Frontend/src/Pages/PlatformAdmin/` : le Dashboard existant (`PlatformAdminDashboard.jsx`) est conservé tel quel (vue globale de la plateforme), seul ajout : un lien "Voir tous les établissements →" vers la nouvelle page liste — aucune restructuration, aucune action par-tenant ajoutée au Dashboard (conforme à la consigne : le Dashboard reste la vue globale, la gestion détaillée vit ailleurs).

**Fichiers créés** :
- `Establishments/EstablishmentsListPage.jsx` — liste des tenants, recherche client (nom/identifiant), badges de statut, lien vers le détail, CTA "Créer un tenant".
- `Establishments/EstablishmentDetailPage.jsx` — en-tête tenant, "Informations générales" (name/identifier en lecture seule, address/phone/email/logo_url éditables via `updateTenant`), "Configuration technique" (case à cocher `allow_clinical_agent_export`, mise à jour optimiste avec retour arrière si échec), section "Configuration de l'établissement" pilotée par le registre de catégories.
- `Establishments/ServicesConfigSection.jsx` — enveloppe `ServicesChecklist` pour la page de détail ; chaque bascule appelle immédiatement `toggleTenantFunctionalService` (contrairement au wizard, qui regroupe tout en un seul appel `bulk` à la fin).
- `Establishments/configCategories.js` — **le registre d'extensibilité** : tableau `{key, label, description, icon, Component}`, une seule entrée aujourd'hui ("services"). Ajouter une future catégorie (workflows, formulaires, règles métier, paramètres UX...) consiste à ajouter une entrée ici — `EstablishmentDetailPage.jsx` n'a besoin d'aucune autre modification.
- `CreateTenant/CreateTenantWizard.jsx` — conteneur du wizard, state unique pour les 3 étapes (aucune perte de saisie en cas de retour arrière), orchestration `createTenant → updateTenant → provisionTenant → bulkSetTenantFunctionalServices`, gestion explicite de l'état "création partiellement incomplète" (bannière d'avertissement si une étape après la création du tenant échoue), confirmation avant abandon (`window.confirm` si des données ont été saisies).
- `CreateTenant/ProgressSteps.jsx`, `Step1BasicInfo.jsx` (auto-génération de l'identifiant depuis le nom avec dérogation manuelle, validation regex live du format slug, rendu des erreurs de champ backend), `Step2TechnicalConfig.jsx` (vraie case à cocher, libellé "Autoriser le partage des données cliniques" sans jamais mentionner Clinical Agent, aucun contrôle "nombre de pools"), `Step3ServicesConfig.jsx`, `ServicesChecklist.jsx` (partagé avec `EstablishmentDetailPage`, vraies cases à cocher, liste plate ordonnée par `display_order`, point d'extension documenté pour un futur regroupement), `ProvisioningResultsSummary.jsx` (résultat explicite par service ACTIVE/FAILED/autre, jamais un message générique).

**Fichiers modifiés** : `src/services/platformAdminApi.js` (+8 fonctions : `createTenant`, `getTenant`, `updateTenant`, `provisionTenant`, `getFunctionalServiceCatalog`, `getTenantFunctionalServices`, `bulkSetTenantFunctionalServices`, `toggleTenantFunctionalService` — même style que les 2 fonctions existantes) ; `src/Router/appRouterPaths.js` (+3 routes) ; `src/Router/AppRouter.jsx` (+3 imports lazy nommés, vérifiés correspondre exactement aux exports des nouveaux fichiers) ; `src/Pages/PlatformAdmin/platformAdminNavLink.js` (+"Établissements", +"Créer un tenant") ; `src/Pages/PlatformAdmin/PlatformAdminDashboard.jsx` (ajout minimal, voir ci-dessus).

**Vérification** : `npm run build` propre ; `eslint` sur tous les fichiers créés/modifiés : 6 erreurs préexistantes détectées dans `AppRouter.jsx`/`appRouterPaths.js` (imports lazy inutilisés et clés dupliquées déjà présents avant ce chantier), confirmées non liées à ce travail via `git diff` (aucune ligne concernée n'apparaît dans le diff) — zéro nouvelle erreur introduite. Routes vérifiées servies (200, fallback SPA) en conditions réelles sur le serveur de dev déjà actif (`localhost:5173`).

### 14.9 Phase 2 — Cycle de vie complet du tenant et configuration effective

#### AVANT

Après §14.1-14.8 : un tenant se créait, se provisionnait (bases de données) et pouvait recevoir une configuration (services, partage clinique) — mais rien de tout cela n'aboutissait à un établissement RÉELLEMENT utilisable : aucun compte administrateur, aucune URL fonctionnelle, aucune application réelle de l'activation/désactivation d'un service (uniquement du CRUD dans `tenant-service`, jamais lu ailleurs), et aucune journalisation des actions du PlatformAdmin.

#### PROBLÈME

Le cycle "créer un tenant → l'établissement est opérationnel" s'arrêtait après la création des bases de données. Un service désactivé pour un tenant restait accessible via l'API métier (seule l'IHM le masquait, jamais vérifié côté backend) — violation directe de l'exigence "le backend doit bloquer, jamais seulement le frontend".

#### MODIFICATION

**1. Compte administrateur initial (`tenant-service` ↔ `service-personnel`)**

Nouveau endpoint interne symétrique à `POST /api/internal/provision-database/` (Phase 7) :

| Élément | Détail |
|---|---|
| `POST /api/internal/create-first-admin/` (service-personnel) | `IsInternalService` (même jeton partagé). Payload `{tenant_id, nom, prenom?, email}`. Établit le Tenant Context (`set_tenant_context`) puis crée un `Admin` ordinaire — mot de passe temporaire généré par `generate_temporary_password()` (extrait de la logique déjà existante dans `reset_password`, pas un nouveau mécanisme), hashé (`make_password`). Retourne `{id, email, temporary_password}`. 409 si l'email existe déjà pour ce tenant. |
| `tenants/internal_clients.py` (nouveau, tenant-service) | Factorise l'appel HTTP interne déjà utilisé par `provisioning.py` (`_call_physical_provisioning`, refactoré pour le réutiliser) — `call_internal_service()` générique + `create_first_admin()` spécifique. |
| `POST /tenants/{id}/provision-admin/` (tenant-service, `IsPlatformAdmin`) | Payload `{nom, prenom?, email}`. Vérifie que `TenantDatabase` PERSONNEL est ACTIVE (409 sinon) → `create_first_admin()` → `send_tenant_admin_welcome_email()` → journalisation (`AdminActionLog`). Répond TOUJOURS 200 sur une requête valide, avec le détail PAR SOUS-ÉTAPE (`admin_created`, `admin_detail`, `email_sent`, `email_detail`) — jamais un succès global si l'une des deux a échoué (vérifié par test : email jamais envoyé si la création du compte a échoué). |

Le compte créé est un `Admin` (`service-personnel`) ordinaire, scopé par `tenant_id` comme tout autre compte métier — il se connecte via le flux `/auth/login` **existant, inchangé**. Isolation vérifiée par test (`test_admin_is_correctly_associated_with_its_tenant_never_cross_tenant`) : même email dans deux tenants ⇒ deux comptes distincts.

**2. Email d'accès (`tenants/emails.py`, nouveau)**

Aucune infrastructure d'email n'existait nulle part dans FullTang (audit complet : aucun `send_mail`, aucun SMTP configuré). `send_tenant_admin_welcome_email()` utilise l'API Django standard (`django.core.mail.send_mail`), backée par `EMAIL_BACKEND` — `django.core.mail.backends.console.EmailBackend` en développement (le contenu apparaît dans les logs du conteneur, vérifié en conditions réelles), configurable vers un vrai SMTP en production via variables d'environnement (`EMAIL_HOST`, `EMAIL_HOST_USER`, etc., voir `config/settings.py`) sans changement de code. Contenu : URL de l'établissement, email + mot de passe temporaire, renvoi vers le flux "mot de passe oublié" existant pour le changer — aucun nouveau mécanisme d'authentification.

**3. URL réelle de l'établissement**

La résolution hostname → tenant était déjà entièrement câblée (Gateway, `TenantResolver`, JWT cross-check — voir §5/§6) mais RIEN ne mappait `<identifier>.fulltang.com` vers l'environnement Docker local (pas de nginx/Traefik). Décision : basculer la convention de développement sur `*.localhost`, qui se résout automatiquement vers `127.0.0.1` dans les navigateurs modernes — zéro entrée `/etc/hosts` à créer (`*.fulltang.com` reste utilisable pour un environnement de démo plus proche de la production, via les mêmes variables).

| Fichier | Changement |
|---|---|
| `backend/docker-compose.yml` | `api-gateway` : `TENANT_ROOT_DOMAIN=${TENANT_ROOT_DOMAIN:-localhost}` |
| `Frontend/.env` | `VITE_TENANT_ROOT_DOMAIN=localhost` |
| `Frontend/vite.config.js` | `allowedHosts` : ajout de `.localhost` (les deux blocs `server`/`preview`) |
| `tenant-service/config/settings.py` | `TENANT_ESTABLISHMENT_URL_TEMPLATE` (env, défaut `"http://{identifier}.localhost:5173"`) |
| `tenant-service/tenants/serializers.py` | `TenantSerializer.establishment_url` (SerializerMethodField, lecture seule, présent sur CHAQUE réponse Tenant) |

Vérifié en conditions réelles (voir Tests ci-dessous) : un compte admin fraîchement créé se connecte avec succès via `POST /auth/login` avec `Host: <identifier>.localhost`, reçoit un JWT contenant le bon `tenant_id`.

**4. Activation/désactivation de service — application réelle et générique**

Avant ce chantier, `TenantFunctionalService` était du pur CRUD, jamais lu par aucun autre service (`grep` confirmé). Nouveau mécanisme générique, dupliqué dans chaque microservice consommateur (même principe déjà assumé pour `registry_client.py`/Phase 6 — services déployés séparément) :

| Élément | Détail |
|---|---|
| `GET /tenants/functional-services/resolve/?tenant=&code=` (tenant-service, `IsInternalService`) | `{"enabled": bool}`. 404 si tenant ou code inconnu. |
| `tenant_routing/functional_service_client.py` (nouveau, dupliqué dans `service-personnel` ET `Medical-Monitoring`) | Cache TTL en mémoire (`FUNCTIONAL_SERVICE_CACHE_TTL_SECONDS`, défaut 60s — volontairement plus court que le cache de résolution de base, 300s : une désactivation doit se refléter vite), même forme que `TenantDatabaseCache` (dégradation gracieuse si le Registry est momentanément injoignable et qu'une entrée existe déjà ; refus explicite sinon — jamais un accès autorisé par défaut faute de pouvoir vérifier). |
| `permissions.py::HasFunctionalServiceEnabled` (nouveau, dupliqué dans les 2 services) | Permission DRF générique, `.for_service(code)` — factory paramétrée, UN seul mécanisme réutilisable pour n'importe quel service du catalogue. `tenant_id=None` (pool non assigné) ⇒ toujours autorisé (aucune configuration de service fonctionnel ne s'y applique). |
| `service-personnel/api/views.py::POSTE_TO_FUNCTIONAL_SERVICE` | Table de correspondance `poste → code FunctionalService` (`pharmacien→PHARMACIE`, `laborantin→LABORATOIRE`, `infirmier→SOINS_INFIRMIERS`) — ajouter un poste au contrôle = une ligne dans cette table, jamais une règle spéciale par vue. Appliquée dans `PharmacienViewSet` (`permission_classes`) ET dans `PersonnelViewSet.create` (contrôle explicite avant création, seul point d'entrée générique par `poste`). |
| `Medical-Monitoring/medical_workflow/views.py` | `HasFunctionalServiceEnabled.for_service('PHARMACIE')` sur `DelivranceMedicamentViewSet`/`AnomaliePrescriptionViewSet` ; `'LABORATOIRE'` sur `PrelevementViewSet`/`ValeurCritiqueViewSet` ; `'MEDECINE_GENERALE'` sur `ConsultationViewSet` (démonstration de généricité, non testée en profondeur — non requis par la mission pour ce service). |

Bug annexe corrigé (bloquait le test bout-en-bout imposé) : `Frontend/src/services/prescriptionsApi.js` ciblait `/prescriptions-medicaments`, une route inexistante côté backend (la vraie route Medical-Monitoring est `/prescriptions`).

**5. Fiche technique**

Aucun nouvel endpoint : `GET /tenant-databases/?tenant=<id>` existait déjà (Phase 5) — seulement consommé pour la première fois côté frontend, en n'affichant que `service`/`status`/`database_name`/`updated_at` (jamais `host`/`port`/`secret_reference`, conforme à l'exigence "aucune information technique sensible").

**6. Logo — upload réel**

`Tenant.logo` (`ImageField`, `upload_to='tenants/logos/'`) ajouté à côté du `logo_url` existant (conservé comme repli pour une URL externe manuelle). `MEDIA_ROOT`/`MEDIA_URL` (stockage disque local — copié tel quel du seul précédent existant dans FullTang, `Medical-Monitoring/backend/patient/models/patient.py::photo` — aucun object storage S3/MinIO nulle part dans le dépôt). `MEDIA_URL = '/api/media/'` délibérément (et non `/media/`) : la Gateway reconstruit `/tenants/<sub>` → `/api/<sub>`, faire coïncider les deux évite un préfixe cassé. `POST`/`DELETE /tenants/{id}/logo/` (multipart, validation type/taille 2 Mo côté serveur — jamais uniquement côté client). `TenantSerializer.logo_display_url` : fichier uploadé prioritaire, sinon repli sur `logo_url` externe.

**7. Logs d'administration (`AdminActionLog`, nouveau modèle, `tenant-service`)**

| Élément | Détail |
|---|---|
| Modèle | `actor_id`, `actor_email`, `action` (10 valeurs, `AdminAction.choices`), `target_tenant_id`/`target_tenant_identifier` (dupliqués à plat, pas de FK — un log doit rester lisible indépendamment du cycle de vie de sa cible), `description`, `metadata` (JSON, jamais de secret), `created_at`. |
| Écriture | `AdminActionLogService.record(...)`, appelé explicitement depuis les 7 méthodes mutantes de `TenantViewSet` (créer, modifier profil, changer statut, provisionner, provisionner l'admin, bulk-set services, toggle service) — un seul point d'appel par action, jamais de signal/middleware générique (chaque action porte un contexte métier propre, ex: quel service a été basculé). |
| Bug de plomberie corrigé | Le Gateway envoie déjà `X-User-Email` (`_build_user_headers`) mais `tenant-service/config/authentication.py::GatewayUser` ne le lisait pas — corrigé, les logs portent maintenant un email d'acteur réel, pas seulement un id opaque. |
| Lecture | `GET /admin-logs/` (`IsPlatformAdmin`, lecture seule), filtrable `?tenant=&actor=&action=&date_from=&date_to=`. |

**8. Partage clinique (`allow_clinical_agent_export`) — vérifié, aucun nouveau code**

Investigation demandée par la mission : l'application réelle de ce champ **existait déjà**, contrairement à l'activation de service. `clinical-agent/main.py::verify_export_authorization()` (appelée avant chaque synchronisation, fail-closed : 403 si désactivé, 404 si tenant inconnu, 503 si Registry injoignable) — confirmé par lecture de code ET par un test A/B réel (voir Tests). Aucune modification de ce mécanisme, conformément à la consigne "ne pas créer un deuxième mécanisme".

**9. Confirmation avant modification + notifications courtes (frontend)**

`EstablishmentDetailPage.jsx`/`ServicesConfigSection.jsx` : la case "partage clinique" et la liste des services passent d'un enregistrement immédiat par bascule à un flux brouillon → "Enregistrer" (visible uniquement s'il y a un changement en attente) → `ConfirmationModal` (composant existant, jusqu'ici orphelin — première réutilisation) avec un résumé court → application groupée → notification via `useFeedback()` (`showSuccess`/`showError`, système déjà utilisé ailleurs dans FullTang, jamais un nouveau système visuel). Textes de roadmap supprimés de l'IHM (`Step2TechnicalConfig.jsx` : bloc "Autres paramètres techniques" ; `EstablishmentDetailPage.jsx` : "D'autres catégories apparaîtront ici.").

**10. Nouvelle page "Logs" (frontend)**

`Pages/PlatformAdmin/Logs/AdminLogsPage.jsx` — page dédiée, séparée du Dashboard (qui reste une vue globale), filtre par tenant/acteur/type d'action/date. Navigation : Dashboard → Établissements → Logs → Créer un tenant.

#### APRÈS

Le cycle complet fonctionne réellement : créer un tenant produit une URL qui résout, un compte administrateur qui se connecte, un email visible (dev) contenant les informations d'accès ; désactiver un service bloque réellement les opérations métier correspondantes côté backend (jamais seulement l'IHM) ; chaque action du PlatformAdmin est journalisée avec un acteur identifié.

#### TESTS

- `tenant-service` : 155/155 (126 précédents + 29 nouveaux — `TenantProvisionAdminEndpointTests`, `FunctionalServicesResolveInternalEndpointTests`, `TenantLogoUploadEndpointTests`, `AdminActionLogEndpointTests`, `EstablishmentUrlAndLogoDisplayTests`), incluant l'échec explicite jamais maquillé en succès (email jamais envoyé si le compte n'a pas été créé ; échec d'email reporté séparément d'une création réussie).
- `service-personnel` : 68/68 (50 précédents + 18 nouveaux — `CreateFirstAdminEndpointTests` (dont un compte créé authentifiable réellement via `check_password`, et l'isolation inter-tenant sur email identique), `HasFunctionalServiceEnabledPermissionTests` (dont la propagation de `FunctionalServiceRegistryUnavailableError`, jamais un accès silencieusement autorisé), `FunctionalServiceEnforcementEndpointTests` (blocage réel de `PharmacienViewSet` et de la création générique via `poste`, isolation totale entre deux tenants).
- `Medical-Monitoring` : 37 tests préexistants échouaient déjà AVANT ce chantier (bug de test — `setUp()` crée un `Patient` sans établir de Tenant Context, sans rapport avec ce travail) — confirmé identique par `git stash` avant/après, zéro régression introduite.
- Vérification en conditions réelles (Gateway, vrai JWT PLATFORM_ADMIN) : création d'un tenant → provisioning PERSONNEL → `provision-admin` → email visible dans les logs du conteneur avec mot de passe temporaire → connexion réussie de ce compte via `Host: <identifier>.localhost` avec JWT `tenant_id` correct → désactivation de PHARMACIE → 403 réel sur `POST /personnel/personnel/` (poste pharmacien) ET sur `GET /personnel/pharmaciens/` → réactivation → 201 réel après expiration du cache TTL.
- **Partage clinique — test A/B réel, bout en bout** : deux tenants créés (`clinical-test-a`, `allow_clinical_agent_export=true` ; `clinical-test-b`, `false` explicite), MEDICAL+PERSONNEL provisionnés pour les deux, un vrai `Patient`+`Visite` créé pour chacun via la Gateway (JWT admin tenant-scopé obtenu via le flux `provision-admin`), passage en statut `TERMINE` déclenchant le signal Django réel :
  - Tenant A : `fultang-medical-backend` notifie `clinical-agent`, qui répond 200 et synchronise — confirmé dans `tampon_clinical_cases` (tables `visites_synced` et `cas_cliniques`, âge/sexe anonymisés présents).
  - Tenant B : `fultang-medical-backend` loggue explicitement l'échec (`HTTP Error 403: Forbidden`), `clinical-agent` confirme le 403 — **aucune ligne** n'existe dans le buffer pour ce tenant.
  - Confirmation déterministe complémentaire via l'appel direct `POST clinical-agent:9000/sync/visite/{id}` (jeton interne) : 200 pour A, 403 explicite (`"Ce tenant n'autorise pas l'export vers clinical-agent."`) pour B.
  - Aucune régression, aucune donnée existante touchée, mécanisme fail-closed confirmé exactement comme conçu.

---

### 14.10 Phase 3 — Suspension effective du tenant, désactivation effective des services, double confirmation, invalidation active du cache

#### AVANT

Deux failles de sécurité concrètes, découvertes par un test réel en main (§14.9 n'avait livré que le CRUD et le blocage applicatif, jamais la garantie qu'une session déjà ouverte soit coupée) :

1. **Suspension de tenant non vérifiée en dehors de la résolution par sous-domaine.** `TenantResolver.resolve()` (Gateway) ne vérifie `Tenant.status` que lorsque le hostname suit la convention `<identifier>.<root_domain>`. Sur un hostname hors convention (`localhost`, la convention de développement retenue en §14.9.3), `resolve()` retourne `None` sans jamais interroger `tenant-service` — un JWT émis AVANT une suspension continuait de fonctionner indéfiniment après, quel que soit le nouveau statut du tenant.
2. **Désactivation d'un `FunctionalService` non appliquée immédiatement.** `HasFunctionalServiceEnabled` renvoyait `False` (403 — implique "le service existe mais vous n'y avez pas droit", contraire à l'exigence produit) et le cache TTL en mémoire (`FUNCTIONAL_SERVICE_CACHE_TTL_SECONDS`, 60s) n'était jamais invalidé activement : une désactivation pouvait rester sans effet réel jusqu'à 60 secondes (`FunctionalServiceCache.invalidate()` existait déjà mais n'était appelée que par les tests).
3. Aucune double confirmation sur les actions critiques (suspension/réactivation de tenant : aucun contrôle n'existait même en une étape ; activation/désactivation de service : un seul pop-up de résumé existait).
4. Aucun écran dédié frontend pour ces deux cas — une suspension ou un service désactivé seraient tombés dans la gestion d'erreur générique de chaque page (jamais dans le 403 historique `AccessDenied.jsx`, qui ne se déclenche que sur un contrôle de rôle côté client, mais rien de spécifique non plus).

#### MODIFICATIONS

**1. Gateway — vérification du statut à chaque requête, pas seulement à la résolution hostname**

| Fichier | Changement |
|---|---|
| `app/tenant/resolver.py` | `TenantResolver.get_tenant_status(tenant_id)` (nouveau) : `GET /api/tenants/resolve/?id=<uuid>`, **sans cache** (même philosophie que `resolve()` — un aller-retour réseau par requête proxyée est déjà accepté dans ce projet). Retourne `None` si le tenant n'existe plus, lève `TenantResolutionError` (fail-closed) si `tenant-service` est injoignable ou répond de façon inattendue. |
| `app/main.py::proxy_catch_all` | Après la vérification existante tenant-du-token vs tenant-de-l'hostname : SI `tenant_context` est `None` (hostname hors convention) ET que le JWT porte un `tenant_id`, appel à `get_tenant_status()` — 403 structuré si le statut n'est pas `ACTIVE`, 503 (jamais un accès silencieux) si `tenant-service` est injoignable. Si `tenant_context` n'est PAS `None`, aucun appel supplémentaire : son statut `ACTIVE` est déjà garanti par `resolve()`. |
| `app/main.py` | Corps d'erreur unifié sur les deux chemins de suspension (login existant + nouveau chemin JWT-only) : `{"detail": {"error_type": "TENANT_SUSPENDED", "message": "Vous avez été suspendu."}}`, 403 — pour une détection frontend fiable, quelle que soit la voie qui a déclenché le blocage. |

**2. `FunctionalService` désactivé → HTTP 404 (pas 403), sur les deux services consommateurs**

Décision produit explicite : un service désactivé doit apparaître **inexistant**, jamais "existant mais interdit". `HasFunctionalServiceEnabled.has_permission()` (`service-personnel/api/permissions.py` ET `Medical-Monitoring/core/permissions.py`, mécanisme générique dupliqué depuis §14.9, non réécrit) lève désormais `rest_framework.exceptions.NotFound(detail={"error_type": "SERVICE_UNAVAILABLE", "message": "Ce service n'existe pas pour cet établissement."})` au lieu de `return False`. Corollaire découvert en cours de route : le gestionnaire d'exceptions custom de service-personnel (`api/exceptions.py::fultang_exception_handler`) réenveloppait TOUTE exception DRF dans une forme générique `{"success": False, "error_type": exc.__class__.__name__, ...}`, ce qui aurait enterré le marqueur `SERVICE_UNAVAILABLE` — corrigé par un retour anticipé (`if 'error_type' in response.data: return response`) avant la réenveloppe générique.

**3. Invalidation active du cache (push), TTL conservé comme filet de sécurité**

| Fichier | Changement |
|---|---|
| `service-personnel/api/views.py`, `Medical-Monitoring/core/views.py` | `FunctionalServiceInvalidateView` (nouveau, un par service) : `POST /api/internal/functional-services/invalidate/` (service-personnel) / `POST /api/medical-monitoring/internal/functional-services/invalidate/` (Medical-Monitoring), protégé par `IsInternalService` (jeton interne déjà existant, aucun nouveau mécanisme d'autorisation), body `{tenant_id, code}` → `functional_service_cache.invalidate(tenant_id, code)`. |
| `tenant-service/tenants/provisioning.py` | `invalidate_functional_service_cache(tenant_id, code)` (nouveau, placé ici plutôt que dans `internal_clients.py` pour éviter un import circulaire) : boucle sur les deux services consommateurs connus (`PERSONNEL`, `MEDICAL`, via `PROVISIONING_CAPABLE_SERVICES` déjà existant), appelle chaque endpoint via `call_internal_service` déjà existant. **Best-effort** : `except InternalServiceCallError: logger.warning(...)` — un consommateur injoignable ne fait jamais échouer l'action principale (toggle/bulk-set reste 200). |
| `tenant-service/tenants/views.py` | Appel de `invalidate_functional_service_cache(tenant.id, code)` ajouté à la fin de `toggle_functional_service` et de `bulk_set_functional_services`, après l'écriture réussie et la journalisation. |

Le TTL (60s) reste en place comme filet de sécurité (dégradation gracieuse si un consommateur est injoignable au moment du push) — l'invalidation active rend la propagation quasi immédiate dans le cas nominal, elle ne le remplace pas.

**4. Gating backend concret — cas "Infirmerie" (`SOINS_INFIRMIERS`)**

Contrairement à Pharmacie/Laboratoire/Médecine générale (§14.9, ViewSets dédiés), il n'existe pas de ViewSet "infirmier seul" — les pages infirmière du frontend partagent des endpoints généraux (`Patient`, `Visite`) également utilisés par les médecins ; gater ces ViewSets entiers bloquerait aussi les médecins. Seule l'action réellement propre au rôle infirmier a été identifiée et gatée : `PatientViewSet.enregistrer_soin` (`Medical-Monitoring/backend/patient/views.py`, action `POST .../soins`, crée un `SoinAdministre`) — via `get_permissions()` conditionnel sur `self.action == 'enregistrer_soin'` (pas la classe entière), avec `HasFunctionalServiceEnabled.for_service('SOINS_INFIRMIERS')`.

**5. Double confirmation (Frontend)**

| Élément | Changement |
|---|---|
| `Pages/Modals/ConfirmAction.Modal.jsx` | `ConfirmationModal` étendu avec `confirmText`/`cancelText` optionnels (défaut `"Confirm"`/`"Cancel"`, tout appelant existant inchangé) — nécessaire pour les libellés de bouton imposés ("Oui, suspendre l'établissement", etc.). |
| `services/platformAdminApi.js` | `updateTenantStatus(id, newStatus)` (nouveau) — `PATCH /tenants/{id}/status/`. |
| `EstablishmentDetailPage.jsx` | Bouton "Suspendre l'établissement"/"Réactiver l'établissement" à côté du badge de statut. Deux `ConfirmationModal` séquentiels pilotés par un état numérique `statusConfirmStep` (0 = aucun, 1 = premier pop-up, 2 = second) : le premier `onConfirm` avance seulement à l'étape 2 (aucun appel réseau), seul le second appelle réellement le backend. Même patron `exportConfirmStep` appliqué à la case "partage clinique" (premier pop-up existant conservé tel quel, second ajouté). |
| `ServicesConfigSection.jsx` | Le premier pop-up existant (résumé court, "Confirmer la modification") est **conservé sans changement de comportement** ; un second pop-up est ajouté (`confirmStep` 0/1/2, même patron), avec un texte adapté au sens du changement (activation/désactivation/réactivation, voir décision ci-dessous), appelé uniquement après validation du second. |
| `Utils/fultangErrorEvents.js` (nouveau) | `extractFultangErrorType(error)` gère les DEUX formes de corps observées empiriquement (`data.detail.error_type` — FastAPI/Gateway — et `data.error_type` directement à la racine — DRF avec un `.detail` de type dict, vérifié via `manage.py shell` avant d'écrire ce code). `dispatchFultangErrorEvent(error)` déclenche l'un des deux `CustomEvent` globaux (`fultang:tenant-suspended` / `fultang:service-unavailable`) — aucun state manager global n'existe dans l'app, c'est le mécanisme le moins intrusif. |
| `Utils/axiosInstance.js`, `axiosInstanceCompta.js` | Nouveau contrôle, placé EN PREMIER dans le gestionnaire d'erreur de l'intercepteur de réponse (avant la logique 401/403 existante) : si `dispatchFultangErrorEvent(error)` renvoie `true`, la requête est simplement rejetée sans déclencher le refresh 401 ni aucune autre logique existante — sinon tout le comportement actuel est inchangé à l'identique. |
| `GlobalComponents/TenantSuspendedScreen.jsx`, `ServiceUnavailableScreen.jsx`, `FultangGlobalErrorOverlay.jsx` (nouveaux) | Écrans plein écran dédiés (palette/typographie FullTang, sans bouton Login/Go Back, sans détail technique) — "Vous avez été suspendu." / "Ce service n'existe pas." L'écouteur est monté UNE FOIS dans `App.jsx`, à côté de `FeedbackProvider` — ne modifie ni ne remplace `AppRoute`, ni le 403 historique `AccessDenied.jsx` (déclenché uniquement par un contrôle de rôle côté client, jamais par ce mécanisme). |

**Textes exacts appliqués** (fournis par la mission, reproduits ici pour traçabilité) :
- Tenant — suspension : "Voulez-vous suspendre cet établissement ?" / "Continuer" puis "Voulez-vous vraiment suspendre cet établissement ?" / "Cette action désactivera immédiatement l'accès à Fultang pour tous les utilisateurs de cet établissement. Les données et les bases de données seront conservées." / "Oui, suspendre l'établissement".
- Tenant — réactivation : "Voulez-vous réactiver cet établissement ?" / "Continuer" puis "Voulez-vous vraiment réactiver cet établissement ?" / "Cette action rétablira immédiatement l'accès à Fultang pour les utilisateurs de cet établissement." / "Oui, réactiver l'établissement".
- Service — désactivation : "Voulez-vous vraiment désactiver ce service ?" / "Cette action rendra immédiatement ce service indisponible pour les utilisateurs de cet établissement." / "Oui, désactiver".
- Service — réactivation : "Voulez-vous vraiment réactiver ce service ?" / "Cette action rétablira l'accès à ce service et à ses données pour les utilisateurs de cet établissement." / "Oui, réactiver".

**Décision explicite — "activer" vs "réactiver" un service** : le catalogue `TenantFunctionalService` ne porte aucun historique ("jamais activé" vs "déjà activé puis désactivé"). Comme `ServicesConfigSection.jsx` n'intervient que sur un établissement déjà en production, remettre un service à `enabled=true` y est systématiquement traité comme une RÉACTIVATION (texte mentionnant la préservation des données, cohérent avec le scénario "Infirmerie" qui a motivé cette phase) plutôt qu'une activation initiale — le libellé "activer" (sans mention de données) n'a pas d'usage identifié dans cet écran.

**Bug corrigé pendant l'implémentation de la double confirmation** : `ConfirmationModal` appelle inconditionnellement `onConfirm()` PUIS `onClose()` au clic sur le bouton de confirmation. Le premier pop-up de chaque flux (`statusConfirmStep`, `exportConfirmStep`, `confirmStep` dans `ServicesConfigSection.jsx`) faisait avancer l'étape à `2` dans `onConfirm`, mais `onClose={() => setStep(0)}` — appelé juste après dans le même gestionnaire d'événement — écrasait cette mise à jour avant le prochain rendu (React ne conserve que la dernière valeur directe posée sur un même setter dans un même batch), empêchant le second pop-up de jamais s'afficher. Corrigé en donnant à `onClose` du premier pop-up une forme fonctionnelle : `setStep((step) => (step === 1 ? 0 : step))` — un clic sur "Annuler" (où `onConfirm` n'est pas appelé) réinitialise toujours correctement à `0`, tandis qu'un clic sur "Continuer" (où `onConfirm` a déjà positionné `2`) laisse l'étape `2` intacte.

#### APRÈS

- Un JWT émis avant une suspension est bloqué (403, écran dédié) dès la requête suivante, quel que soit le hostname utilisé (convention de sous-domaine OU `localhost`) — vérifié en conditions réelles (voir Tests).
- Un `FunctionalService` désactivé pour un tenant répond 404 (pas 403) sur les endpoints gatés, et la désactivation/réactivation/bulk-set se propage de façon quasi immédiate (pas d'attente du TTL de 60s) grâce à l'invalidation active — le TTL reste un filet de sécurité pour le cas où un consommateur était injoignable au moment du push.
- Toute suspension/réactivation de tenant et toute activation/désactivation/réactivation de service depuis la fiche d'un établissement existant exige deux confirmations explicites avant tout appel backend.
- Un utilisateur suspendu ou un service inexistant pour son tenant voit un écran dédié, cohérent avec l'identité FullTang, sans détail technique — jamais le 403 historique, qui continue de fonctionner à l'identique pour tous les cas déjà couverts avant cette phase.

#### TESTS

Tous les résultats ci-dessous ont été réexécutés le jour de la rédaction (stack Docker en conditions réelles, `docker exec` dans chaque conteneur — pas de simulation) :

| Service | Résultat | Détail |
|---|---|---|
| `api-gateway` | 26/33 passants (`pytest tests/ -q`) | Les 7 échecs sont préexistants et sans rapport avec cette phase (confirmés identiques par `git stash` avant/après en cours de chantier) ; les 10 nouveaux tests de cette phase (5 `get_tenant_status` dans `test_tenant_resolver.py`, 5 scénarios de suspension dans `test_login_tenant_context.py`) passent tous. |
| `service-personnel` | 77/77 ✅ | 73 précédents + 4 nouveaux (`FunctionalServiceInvalidateEndpointTests`). Tests existants mis à jour pour le changement 403→404 (`HasFunctionalServiceEnabled`). |
| `Medical-Monitoring` | 125/131 (6 échecs) | Les 6 échecs (3 erreurs de modèle/sérialiseur `Consultation`, 3 échecs "generic endpoint removed") sont préexistants et sans rapport (confirmés identiques par `git stash` avant/après). Les 6 nouveaux tests de cette phase (`SoinsGatingTests` ×3, `FunctionalServiceInvalidateEndpointTests` ×3) passent tous. |
| `tenant-service` | 164/164 ✅ | 161 précédents + 3 nouveaux (`FunctionalServiceCacheInvalidationWiringTests` — invalidation appelée après toggle/bulk-set, best-effort confirmé : un consommateur injoignable ne fait jamais échouer la réponse). |

**Vérification bout en bout en conditions réelles (Gateway, vrais tenants, vrai JWT)**, reproduisant le scénario exact rapporté ("session déjà ouverte, l'utilisateur ne se déconnecte pas") :
1. Tenant `hopital-general` créé, compte admin provisionné, connexion réussie via `Host: localhost` (`localhost` étant la convention de développement — voir §14.9.3) → 200, JWT obtenu.
2. Le MÊME JWT réutilisé pour une requête via `Host: localhost` → 200 (accès normal confirmé avant toute suspension).
3. `PATCH /tenants/tenants/{id}/status/ {"status":"INACTIVE"}` (PlatformAdmin) → 200.
4. Le MÊME JWT (émis avant l'étape 3, jamais rafraîchi) rejoué via `Host: localhost` → **403**, corps `{"detail":{"error_type":"TENANT_SUSPENDED","message":"Vous avez été suspendu."}}` — confirme que la faille d'origine (§AVANT point 1) est bien corrigée.
5. Nouvelle tentative de connexion (`/auth/login`) sur ce même tenant → bloquée également.
6. Requête PlatformAdmin (liste des tenants) → 200, non affectée par la suspension d'un tenant qu'il administre.
7. Tenant B (`chu-yaounde`, actif) → 200, non affecté par la suspension du tenant A.
8. Réactivation (`status: ACTIVE`) → le même JWT rejoué via `Host: localhost` → 200, accès restauré.

**Vérification bout en bout complémentaire — cas "Infirmerie" (le bug explicitement rapporté qui a motivé cette phase), sur un tenant fraîchement créé (`phase3-verif`, PERSONNEL+MEDICAL provisionnés)** :
1. `SOINS_INFIRMIERS` désactivé AVANT toute création de personnel (reproduit "service jamais activé à la création") → `POST /personnel/personnel/ {poste: infirmier}` → **404** `SERVICE_UNAVAILABLE`.
2. `SOINS_INFIRMIERS` réactivé → **immédiatement** (aucune attente) la même requête de création aboutit (201, compte + mot de passe temporaire réels) → connexion réussie de ce compte (JWT `roles: ["Infirmiere"]`, `tenant_id` correct) → `POST /medical/patients/{id}/soins/` avec ce JWT → 201 (un vrai `SoinAdministre` créé).
3. `SOINS_INFIRMIERS` désactivé à nouveau → le MÊME JWT infirmier (déjà émis, jamais rafraîchi), immédiatement, sur le même `POST .../soins/` → **404** `SERVICE_UNAVAILABLE` (confirme que l'invalidation active fonctionne réellement, pas seulement en théorie) ; une lecture générale du patient (`GET /medical/patients/{id}/`) avec ce même JWT reste accessible (200) — confirme la limitation documentée ci-dessous.
4. `SOINS_INFIRMIERS` réactivé une seconde fois → le MÊME JWT infirmier, immédiatement, refait `POST .../soins/` → 201 (accès restauré sans nouvelle connexion).
5. Vérification directe en base (`SoinAdministre.objects.filter(patient_id=...)`) : **2 lignes présentes** — le soin créé à l'étape 2 ET celui de l'étape 4 — aucune donnée supprimée ni dupliquée pendant tout le cycle désactivation/réactivation.

#### LIMITATIONS

- **Invalidation de cache mono-instance.** `invalidate_functional_service_cache` pousse vers le cache en mémoire du processus courant de chaque service consommateur. Un déploiement à plusieurs instances par service nécessiterait un mécanisme distribué (pub/sub, ex. Redis) pour propager l'invalidation à toutes les instances — non construit ici, le TTL de 60s reste alors le seul filet de sécurité pour les instances non notifiées.
- **Seuls deux consommateurs connus.** L'invalidation ne cible que `PERSONNEL` et `MEDICAL` (les deux seuls services ayant un consommateur `HasFunctionalServiceEnabled` réellement câblé à ce jour) — cohérent avec l'état actuel du gating, pas une limite de l'architecture elle-même (`_FUNCTIONAL_SERVICE_CACHE_CONSUMERS` est une simple liste à étendre si un nouveau consommateur apparaît).
- **"Infirmerie" — gating partiel, assumé et documenté dans le code.** Seule l'action `enregistrer_soin` est gatée par `SOINS_INFIRMIERS`. Les endpoints généraux partagés (liste/détail des patients, des visites) restent accessibles même si ce service est désactivé, faute d'un moyen propre de distinguer "un infirmier les utilise" de "un médecin les utilise" au niveau actuel du modèle de données. La création du rôle infirmier reste, elle, entièrement bloquée par `POSTE_TO_FUNCTIONAL_SERVICE` (§14.9, inchangé).
- **Catalogue de services partiellement gaté.** Seuls PHARMACIE, LABORATOIRE, MEDECINE_GENERALE (§14.9) et SOINS_INFIRMIERS (partiel, ci-dessus) ont un point d'application backend réel. Les autres entrées du catalogue (Caisse, Comptabilité financière, Comptabilité matière, Gestion du personnel, Gestion des infrastructures) restent au stade CRUD pur — l'architecture générique (`HasFunctionalServiceEnabled.for_service(code)`) le permettrait sans nouveau mécanisme, mais câbler ces services n'était pas dans le périmètre explicite de cette phase.
- **Suite de tests d'isolation dédiée non construite comme fichier unique.** ~~Les scénarios croisés... n'a pas été réorganisée en une nomenclature de tests séparée pour cette phase.~~ **Résolu (finalisation, ci-dessous, §14.10.1) : une suite dédiée `backend/tests/isolation/` existe désormais**, avec une correspondance directe aux scénarios A-G de suspension et aux cycles FunctionalService de la mission.

#### 14.10.1 Finalisation — suite dédiée `backend/tests/isolation/`

Suite indépendante des suites unitaires de chaque service (voir son `README.md`) : elle parle en HTTP réel à la Gateway (`http://localhost:8080`) de la stack Docker déjà démarrée, sans mocker ni le Tenant Service, ni le Database Router, ni le cache FunctionalService — vrais tenants créés via l'API, vrais JWT, vrai routage physique.

Placée hors de tout service en particulier (`backend/tests/`, pas `backend/<service>/`) car un scénario cross-tenant traverse par nature quatre projets (Gateway, tenant-service, service-personnel, Medical-Monitoring) qui n'ont pas de venv commun — dupliquer ces tests dans chacun aurait recréé un mécanisme qui n'existe pas plutôt que d'en réutiliser un.

**Fichiers créés :**
- `backend/tests/isolation/conftest.py` — helpers réels : création de tenant, provisioning, création du compte admin initial (via `provision-admin`, le vrai mécanisme interne), connexion, bascule de statut/service, requête `docker exec ... psql` directe.
- `backend/tests/isolation/test_authentication_isolation.py` — mismatch JWT/hostname (`<identifier>.localhost`, convention réelle confirmée par `docker exec fultang-gateway env`), non-fuite de données cross-tenant, falsification du header `X-Tenant-ID`.
- `backend/tests/isolation/test_multitenant_isolation.py` — lecture/modification/suppression/création de relation cross-tenant, bidirectionnel A↔B, sur `MedecinViewSet` (service-personnel) et `PatientViewSet` (Medical-Monitoring, données nommément identifiables `PATIENT_TENANT_A`/`PATIENT_TENANT_B`).
- `backend/tests/isolation/test_tenant_suspension_isolation.py` — scénarios A à G de la mission, chacun avec sa propre paire de tenants (indépendance totale entre tests).
- `backend/tests/isolation/test_functional_service_isolation.py` — mécanisme générique testé sur PHARMACIE, LABORATOIRE, MEDECINE_GENERALE, SOINS_INFIRMIERS ; invalidation immédiate du cache ; préservation des données ; activation tardive d'un service jamais activé à la création.
- `backend/tests/isolation/test_database_routing_isolation.py` — vérification physique directe (requête SQL dans le conteneur Postgres de chaque service) que les données de chaque tenant vivent uniquement dans SA base.
- `backend/tests/isolation/requirements.txt`, `pytest.ini`, `README.md`, `.gitignore`.

**Correction méthodologique importante (postérieure à la rédaction initiale de cette sous-section) :** la première version de cette suite neutralisait le cas `LaborantinViewSet` par un `pytest.skip()` au motif que ce point d'entrée n'était « pas encore protégé ». C'est une erreur de méthode — un SKIP ne doit JAMAIS servir à transformer une non-conformité fonctionnelle en résultat neutre. Le test a été réécrit en assertion normale (comportement attendu défini par l'exigence, indépendamment de ce que le code actuel permet) et **échoue désormais explicitement**, ce qui est le résultat correct et recherché. Un second cas du même type a été découvert par cette correction (`ConciliationMedicamenteuseViewSet`, PHARMACIE) et traité de la même façon. Aucun test n'a été assoupli pour les faire passer — ce n'était pas l'objet de cette tâche.

**Résultat réel (`python -m pytest . -v`, stack Docker déjà démarrée) :**

```
2 failed, 37 passed in 595.45s (0:09:55)
```

**100 % des tests qui passent ne signifierait PAS que l'isolation est garantie à 100 %** — seulement que les scénarios écrits sont conformes. Ici, 2 scénarios réels sur 39 démontrent explicitement le contraire, ce qui est précisément le rôle de cette suite : les rendre visibles plutôt que de les masquer.

**Tests en échec (défauts d'isolation réels, non corrigés dans cette tâche — voir consigne « ne pas corriger les défauts de production ») :**

| Test | Comportement attendu | Comportement obtenu |
|---|---|---|
| `TestLaboratoireGenericCreationOnly::test_laborantin_viewset_listing_is_blocked_when_laboratoire_disabled` | `GET /personnel/laborantins/` → 404 `SERVICE_UNAVAILABLE` quand LABORATOIRE est désactivé pour le tenant | 200 — la liste reste pleinement accessible |
| `TestPharmacieViaMedicalMonitoring::test_conciliation_medicamenteuse_viewset_is_blocked_when_pharmacie_disabled` | `GET /medical/pharmacie/conciliations/{id}/` → 404 `SERVICE_UNAVAILABLE` quand PHARMACIE est désactivé pour le tenant | 200 — la conciliation reste pleinement accessible |

Cause identique dans les deux cas : `LaborantinViewSet` et `ConciliationMedicamenteuseViewSet` n'ont aucun `HasFunctionalServiceEnabled.for_service(...)` câblé dans leur `permission_classes`, contrairement aux autres ViewSets du même service fonctionnel.

**Couverture réellement exercée (37 PASS, à travers 8 points d'application backend distincts sur 4 services fonctionnels) :**

```
[PASS] lecture cross-tenant (2 ressources, 2 services : Medecin, Patient)
[PASS] modification cross-tenant (idem)
[PASS] suppression cross-tenant (idem)
[PASS] création de relation cross-tenant (Consultation -> Patient d'un autre tenant)
[PASS] JWT mismatch (A+hostname B, B+hostname A)
[PASS] hostname mismatch (convention réelle <identifier>.localhost)
[PASS] falsification du header X-Tenant-ID (lecture et écriture)
[PASS] database routing (vérification physique directe par requête SQL, 2 serveurs Postgres)
[PASS] cache / invalidation immédiate (PHARMACIE, MEDECINE_GENERALE, SOINS_INFIRMIERS)
[PASS] suspension avec JWT préexistant (scénarios A-G)
[PASS] réactivation tenant (même JWT, sans nouvelle connexion)
[FAIL] FunctionalService — LaborantinViewSet (LABORATOIRE) non protégé
[FAIL] FunctionalService — ConciliationMedicamenteuseViewSet (PHARMACIE) non protégé
[PASS] FunctionalService — 8 autres points d'application (Pharmacien, création générique
       pharmacien/laborantin, AnomaliePrescription, DelivranceMedicament, Prelevement,
       ValeurCritique, Consultation, enregistrer_soin)
[PASS] désactivation immédiate (pas d'attente du TTL 60s) sur les points d'application protégés
[PASS] réactivation FunctionalService (même JWT) sur les points d'application protégés
[PASS] préservation des données (personnel, patients, soins — avant/après désactivation)
[PASS] service jamais activé à la création, activé plus tard (rôle créable, connexion, action métier)
```

**Services/endpoints non couverts par cette suite** (absence de scénario, distincte des FAIL ci-dessus — voir `backend/tests/isolation/README.md` pour le détail et la justification de chaque cas) : CAISSE, COMPTA_FINANCIERE, COMPTA_MATIERE, GESTION_PERSONNEL, GESTION_INFRASTRUCTURES (aucun point d'entrée HTTP n'existe pour ces codes — rien à requêter, différent d'un défaut constaté) ; `ExamenViewSet`, `MedicamentPrescritViewSet`, `VisiteViewSet`, `HospitalisationViewSet` et les endpoints `patient/*` annexes de Medical-Monitoring ; ComptaMatiere, fultang-compta-financiere, Gestion-Infrastructures, clinical-agent.

**Correction ultérieure (postérieure à la publication du tableau ci-dessus) : les deux `[FAIL]` (`LaborantinViewSet`, `ConciliationMedicamenteuseViewSet`) ont été corrigés — voir §14.10.2 ci-dessous, qui documente également plusieurs autres chemins parallèles découverts et corrigés dans le même effort.**

#### 14.10.2 Désactivation effective des FunctionalService — chemins parallèles non gatés

**Contexte.** Un test réel (deux hôpitaux, Infirmerie) a révélé que la salle d'attente d'un hôpital où Infirmerie avait été désactivée puis réactivée restait vide/désynchronisée. L'investigation a montré que cette désynchronisation précise vient d'un mécanisme **sans rapport avec l'activation/désactivation** : `Frontend/src/Pages/Nurse/WaitingRoom.jsx` masque côté client les visites dont l'id figure dans `localStorage['treated_visits']` (une liste qui ne s'invalide et n'expire jamais) — un patient déjà "pris en charge" une fois par une infirmière reste filtré indéfiniment, réactivation ou non. **Non corrigé dans cette tâche** (explicitement hors périmètre : la réactivation sera traitée séparément, et ce mécanisme est une fonctionnalité métier existante, pas un défaut d'isolation) — documenté ici pour que la cause exacte soit connue avant la phase réactivation.

En creusant en revanche pourquoi la désactivation elle-même ne bloquait pas fiablement l'usage réel du service, l'audit a trouvé un défaut structurel bien réel, présent pour PHARMACIE, LABORATOIRE **et** MEDECINE_GENERALE (pas seulement Infirmerie) : pour chacun de ces services, un ViewSet dédié était déjà correctement gaté (`PharmacienViewSet`, `AnomaliePrescriptionViewSet`/`DelivranceMedicamentViewSet`, `PrelevementViewSet`/`ValeurCritiqueViewSet`, `ConsultationViewSet`) — **mais le frontend réel n'utilise pas toujours ces endpoints-là**. Il existe des actions parallèles, sur d'autres ViewSets non gatés, qui créent exactement les mêmes objets métier et que le frontend appelle réellement.

**AVANT — cartographie FunctionalService → pages → endpoints (état constaté)**

| FunctionalService | Pages/rôle | Endpoint gaté existant | Endpoint réellement appelé par le frontend | Gaté avant correction ? |
|---|---|---|---|---|
| MEDECINE_GENERALE | Doctor (consultation) | `POST /consultations/` (`ConsultationViewSet`) | `POST /visites/{id}/consultations/` — `doctorApi.js:326`, action `VisiteViewSet.ouvrir_consultation` | **NON** |
| PHARMACIE | Pharmacist (délivrance) | `POST /pharmacie/delivrances/` (`DelivranceMedicamentViewSet`) | `POST /prescriptions/{id}/delivrer/` — `pharmacistApi.js:51`, action `MedicamentPrescritViewSet.delivrer` | **NON** |
| PHARMACIE | Pharmacist (anomalie) | `POST /pharmacie/anomalies/` (`AnomaliePrescriptionViewSet`) | `POST /prescriptions/{id}/anomalie/` — action `MedicamentPrescritViewSet.signaler_anomalie` | **NON** |
| PHARMACIE | Pharmacist (conciliation) | — (aucun autre ViewSet équivalent) | `POST /pharmacie/conciliations/` (`ConciliationMedicamenteuseViewSet`) | **NON — aucun contrôle du tout** |
| PHARMACIE | Admin (personnel pharmacien) | `PharmacienViewSet` (classe) | `GET/POST /personnel/pharmaciens/` | déjà OUI |
| LABORATOIRE | Laboratory (prélèvement) | `POST /laboratoire/prelevements/` (`PrelevementViewSet`) | `POST /examens/{id}/prelevement/` — `laboratoryApi.js:50`, action `ExamenViewSet.prelevement` | **NON** |
| LABORATOIRE | Laboratory (résultat) | — (aucun autre ViewSet équivalent) | `POST/GET /examens/{id}/resultat/` — `laboratoryApi.js:71`, action `ExamenViewSet.resultat` | **NON — aucun contrôle du tout** |
| LABORATOIRE | Laboratory (validation) | — | `POST /examens/{id}/valider/` — `laboratoryApi.js:84`, action `ExamenViewSet.valider` | **NON — aucun contrôle du tout** |
| LABORATOIRE | Laboratory (valeur critique) | `POST /laboratoire/valeurs-critiques/` (`ValeurCritiqueViewSet`) | `POST /examens/{id}/signaler-critique/` — `laboratoryApi.js:105`, action `ExamenViewSet.signaler_critique` | **NON** |
| LABORATOIRE | Admin (personnel laborantin) | — | `GET/POST /personnel/laborantins/` (`LaborantinViewSet`) | **NON — aucun contrôle du tout** (seule la création générique via `POSTE_TO_FUNCTIONAL_SERVICE` l'était) |
| SOINS_INFIRMIERS | Nurse (salle d'attente, soins) | `POST /patients/{id}/soins/` (`PatientViewSet.enregistrer_soin`) | `POST /patients/{id}/soins/` — `nurseApi.js:584` | déjà OUI — **seul service dont le frontend utilise directement l'endpoint gaté** |

Endpoints partagés, délibérément **non gatés** (analysés, décision documentée, pas un oubli) : `HospitalisationViewSet`/`VisiteViewSet.hospitaliser` (lu par médecin, infirmier ET pharmacien — aucun FunctionalService ne le possède exclusivement) ; le CRUD de base de `MedicamentPrescritViewSet`/`ExamenViewSet`/`VisiteViewSet` (list/detail/create standard — prescrit par le médecin via les actions déjà gatées de `ConsultationViewSet`, consulté par plusieurs rôles).

**MODIFICATIONS effectuées** (backend, aucun nouvel endpoint créé — uniquement des `permission_classes`/`get_permissions()` ajoutés à des ViewSets/actions déjà existants) :

- `backend/service-personnel/service_personnel/api/views.py::LaborantinViewSet` — ajout `permission_classes = [IsAuthenticated, HasFunctionalServiceEnabled.for_service('LABORATOIRE')]` (classe entière, comme `PharmacienViewSet`).
- `backend/Medical-Monitoring/backend/medical_workflow/views.py` :
  - `ConciliationMedicamenteuseViewSet` — ajout du même `permission_classes` pour PHARMACIE.
  - `MedicamentPrescritViewSet` — ajout de `get_permissions()` gatant uniquement les actions `signaler_anomalie` et `delivrer` (PHARMACIE) ; le CRUD de base reste inchangé.
  - `ExamenViewSet` — ajout de `get_permissions()` gatant les actions `resultat`, `prelevement`, `valider`, `signaler_critique` (LABORATOIRE) ; le CRUD de base reste inchangé.
  - `VisiteViewSet` — ajout de `get_permissions()` gatant uniquement l'action `ouvrir_consultation` (MEDECINE_GENERALE) ; le reste du ViewSet (liste des visites, partagée médecin/infirmier) reste inchangé.
- Frontend (nouveau mécanisme, générique, réutilisant l'existant — voir §14.10.3) : `Frontend/src/hooks/useFunctionalServiceGate.js` (nouveau hook, réutilise `GET /tenants/tenants/functional-services/mine/`, déjà existant), appliqué via un prop optionnel `requiredFunctionalService` sur `CustomDashboard.jsx`, `Pages/Pharmacist/Components/PharmacistDashboard.jsx`, `Pages/Laboratory/Components/LaboratoryDashboard.jsx` — bloque la PAGE entière (menu, navigation compris, puisque c'est le même composant de layout qui les affiche) pour les 8 pages Nurse, 10 pages Pharmacist et 5 pages Laboratory concernées.

**Aucune modification** : aucun endpoint supprimé, aucun modèle métier touché, aucune donnée supprimée, wizard de création non touché (`Step3ServicesConfig.jsx` intact), workflows hospitaliers (consultations, prescriptions, soins, salles d'attente) strictement identiques quand le service reste activé — confirmé par la non-régression ci-dessous.

**APRÈS.** Désactiver PHARMACIE, LABORATOIRE, MEDECINE_GENERALE ou SOINS_INFIRMIERS pour un tenant bloque désormais réellement, immédiatement (même cache déjà invalidé par le mécanisme de la Phase 3 précédente), à travers TOUS les points d'entrée réellement utilisés par le frontend — pas seulement le point d'entrée "canonique" testé isolément. Réactivé, le même mécanisme s'applique symétriquement (le contrôle est un simple `enabled == True/False`, jamais un état à sens unique) — la réactivation proprement dite (synchronisation de l'UI après un cycle désactivation/réactivation, cache `treated_visits`) reste néanmoins hors périmètre de cette tâche, comme demandé.

**TESTS — non-régression**

| Suite | Résultat |
|---|---|
| `service-personnel` (`python manage.py test`) | **77/77 OK** |
| `Medical-Monitoring` (`python manage.py test`, suite complète) | **131 tests, 3 failures + 3 errors** — identiques à la baseline déjà documentée (tests "generic endpoint removed", sans rapport) |

**TESTS — bout en bout réel, deux tenants réels créés pour l'occasion**

Séquence complète (script Python + `requests`, contre la Gateway réelle, deux tenants provisionnés PERSONNEL+MEDICAL, comptes admin réels, JWT réels) :

1. **Tenant A, tout activé** : ouverture d'une consultation depuis une visite, délivrance + signalement d'anomalie d'une prescription, conciliation médicamenteuse, création d'un pharmacien, prélèvement + résultat + validation + valeur critique d'un examen, création d'un laborantin, enregistrement d'un soin infirmier, salle d'attente correctement peuplée — **12/12 PASS**.
2. **Tenant A, désactivation de MEDECINE_GENERALE + PHARMACIE + LABORATOIRE + SOINS_INFIRMIERS**, puis nouvelle tentative de CHAQUE action ci-dessus avec la session déjà ouverte (JWT jamais rafraîchi), plus une nouvelle connexion et une tentative de création d'un nouvel infirmier : **17/17 PASS**, tous 404 `SERVICE_UNAVAILABLE`. Vérifié en plus : la lecture générale des patients/visites reste accessible (limitation assumée) et aucune donnée déjà créée n'a disparu (**3/3 PASS**).
3. **Tenant B, jamais touché** : les mêmes actions (consultation, délivrance, création + connexion d'un infirmier, enregistrement d'un soin, listes pharmacien/laborantin) continuent de fonctionner normalement — **6/6 PASS**.

**Total : 35/35 PASS, 0 FAIL.**

Vérifié également : `GET /tenants/tenants/functional-services/mine/` (consommé par le nouveau hook frontend) reflète bien `enabled: false` pour les 4 services désactivés du Tenant A immédiatement après le test 2, confirmant que le garde-fou frontend recevrait la bonne information.

**LIMITATIONS (honnêtes, non corrigées dans cette tâche par choix explicite de périmètre)**

- **Réactivation non traitée.** Le désynchronisme de la salle d'attente d'infirmerie observé par l'utilisateur après un cycle désactivation/réactivation vient du filtre `localStorage['treated_visits']` de `WaitingRoom.jsx` (nurse), sans lien avec le mécanisme de FunctionalService — identifié, non corrigé (hors périmètre : logique métier existante + réactivation explicitement différée).
- **Garde frontend au montage, pas en continu.** `useFunctionalServiceGate` vérifie l'état du service à l'ouverture de la page (nouvelle navigation, rechargement, ancienne URL) — un onglet resté ouvert sans aucune navigation ni rechargement ne sera pas basculé vers l'écran dédié tant qu'aucune action réellement protégée côté backend n'est tentée (celle-ci restera, elle, bloquée immédiatement).
- **`HospitalisationViewSet`/`VisiteViewSet.hospitaliser`** restent volontairement non gatés (partagés par plusieurs rôles, aucun FunctionalService ne les possède exclusivement dans le catalogue actuel).
- **CAISSE, COMPTA_FINANCIERE, COMPTA_MATIERE, GESTION_PERSONNEL, GESTION_INFRASTRUCTURES** restent sans aucun point d'application backend (inchangé par rapport à §14.10.1) — ces FunctionalService appartiennent à des microservices (fultang-compta-financiere, ComptaMatiere, Gestion-Infrastructures) qui n'ont aucune infrastructure de gating FunctionalService à ce jour ; l'étendre représenterait un chantier propre, plus large que la correction de chemins parallèles traitée ici.
- Les pages Doctor ne sont pas gatées frontend par MEDECINE_GENERALE (contrairement à Nurse/Pharmacist/Laboratory) — le docteur utilise de très nombreuses pages, et cette extension représenterait une décision de périmètre plus large que la correction ciblée demandée ; la protection backend (`ConsultationViewSet`, `VisiteViewSet.ouvrir_consultation`) reste, elle, pleinement effective indépendamment du frontend.

#### 14.10.3 Mécanisme frontend générique de blocage de page par FunctionalService

Nouveau : `Frontend/src/hooks/useFunctionalServiceGate.js` — hook réutilisable, un seul point de vérité, consommé par trois composants de layout (un par rôle : `CustomDashboard.jsx` pour Nurse, `PharmacistDashBoard.jsx`, `LaboratoryDashboard.jsx`), chacun étendu d'un prop optionnel `requiredFunctionalService` (rétrocompatible : absent = comportement inchangé pour tous les autres rôles). Réutilise l'endpoint déjà existant (`getMyFunctionalServices()`, Phase 2) et l'écran déjà existant (`ServiceUnavailableScreen.jsx`, Phase 3) — aucun nouvel endpoint, aucun nouveau composant visuel créé.

#### 14.10.4 Finalisation — extension à CAISSE/COMPTA_FINANCIERE/COMPTA_MATIERE/GESTION_INFRASTRUCTURES, GESTION_PERSONNEL non désactivable

**AVANT.** Seuls PHARMACIE, LABORATOIRE, MEDECINE_GENERALE et SOINS_INFIRMIERS (les FunctionalService portés par service-personnel/Medical-Monitoring) avaient un mécanisme de désactivation effective. CAISSE, COMPTA_FINANCIERE, COMPTA_MATIERE et GESTION_INFRASTRUCTURES — portés par trois AUTRES microservices (`fultang-compta-financiere`, `ComptaMatiere`, `Gestion-Infrastructures`) — n'avaient strictement aucun point d'application (`grep -rn "for_service("` : zéro occurrence), documenté honnêtement comme limitation en §14.10.1/14.10.2. `GESTION_PERSONNEL` pouvait, comme n'importe quel autre service, être désactivé via le même endpoint — alors qu'il s'agit d'une fonctionnalité d'administration du tenant, pas d'un service métier optionnel.

**MODIFICATIONS.** Les trois microservices disposaient déjà de toute l'infrastructure de routage par tenant (`tenant_routing/{context,router,cache,pool_registry,registry_client}.py`, `IsInternalService`, `TENANT_SERVICE_URL`/`TENANT_SERVICE_INTERNAL_TOKEN` déjà configurés — chantier "rendre tout les services tenant-aware" antérieur à cette tâche) — seule la couche FunctionalService manquait. Ajoutée à l'identique du modèle déjà utilisé par service-personnel/Medical-Monitoring/fultang-compta-financiere, sans réinventer de mécanisme :

- **`fultang-compta-financiere`** : `config/tenant_routing/functional_service_client.py` (nouveau, copie conforme), `config/permissions.py::HasFunctionalServiceEnabled` (nouveau), `config/views.py::FunctionalServiceInvalidateView` + route (nouveau endpoint interne, nécessaire pour l'invalidation active — même famille que les 3 endpoints internes déjà existants dans ce projet). Gating class-level appliqué à :
  - CAISSE → les 6 ViewSets de `apps/caisse/` (`QuittanceViewSet`, `ChequeViewSet`, `CaisseJournaliereViewSet`, `InventaireCaisseViewSet`, `DepenseMenueViewSet`, et `CaissierViewSet` — le BFF `/api/caissier/*` réellement consommé par `Frontend/src/services/caissierApi.js`) ;
  - COMPTA_FINANCIERE → les 17 ViewSets de `apps/comptabilite/` (9) et `apps/sorties/` (8).
- **`ComptaMatiere`** : mêmes ajouts sous `core/`. COMPTA_MATIERE → les 13 ViewSets de `apps/comptabilite_matiere/views/` (répartis sur 8 fichiers).
- **`Gestion-Infrastructures`** : mêmes ajouts sous `config/`. GESTION_INFRASTRUCTURES → les 5 ViewSets de `infrastructures/views.py`.
- **`tenant-service/tenants/provisioning.py`** : `_FUNCTIONAL_SERVICE_CACHE_CONSUMERS` étendu de `("PERSONNEL", "MEDICAL")` à `("PERSONNEL", "MEDICAL", "COMPTA", "COMPTA_MATIERE", "INFRASTRUCTURE")` — invalidation active désormais poussée aux 5 services consommateurs après chaque toggle/bulk-set.
- **`GESTION_PERSONNEL` non désactivable** : `tenant-service/tenants/services.py` — nouvelle constante `NON_DISABLEABLE_FUNCTIONAL_SERVICES = frozenset({"GESTION_PERSONNEL"})` et exception `ImmutableFunctionalServiceError`, vérifiées dans `TenantFunctionalServiceService.set_service` ET `.bulk_set` (donc PATCH comme wizard de création, un seul point de vérité) — toute tentative de désactivation renvoie 400, jamais un état partiellement appliqué (le `bulk_set` reste tout-ou-rien : une tentative incluant GESTION_PERSONNEL=false rejette la requête ENTIÈRE, y compris les autres services qu'elle contenait). Frontend : `ServicesChecklist.jsx` verrouille visuellement la case (icône cadenas, toujours cochée, `disabled`) pour éviter une erreur 400 déroutante — la garantie réelle reste le 400 backend, jamais ce verrouillage visuel seul.

**Défaut réel découvert et corrigé pendant la vérification (pas un oubli silencieux)** : trois fichiers de `ComptaMatiere` (`besoin.py`, `livraison_sortie.py`, `materiel.py`, 6 classes) avaient déjà une ligne `permission_classes = [DevelopmentOrAuthenticated]` PLUS BAS dans le corps de la classe, qui écrasait silencieusement le `permission_classes` nouvellement inséré (Python ne garde que la dernière affectation d'un attribut de classe). `DevelopmentOrAuthenticated` s'est avéré être un simple alias historique d'`IsAuthenticated` (`apps/comptabilite_matiere/permissions.py`) — les deux lignes ont été fusionnées (`[DevelopmentOrAuthenticated, HasFunctionalServiceEnabled.for_service('COMPTA_MATIERE')]`) plutôt que supprimées, pour ne rien retirer d'existant. Détecté par un test réel qui échouait (`materiels` restait accessible après désactivation), pas par relecture — voir TESTS ci-dessous.

**APRÈS.** Les 4 services suivent désormais exactement le même contrat que PHARMACIE/LABORATOIRE/MEDECINE_GENERALE/SOINS_INFIRMIERS : désactivé → 404 `SERVICE_UNAVAILABLE` immédiat (cache invalidé activement), réactivé → accès restauré immédiatement, données jamais supprimées. GESTION_PERSONNEL ne peut plus jamais être désactivé, ni seul ni via un bulk-set qui l'inclurait.

**TESTS — non-régression (`python manage.py test` dans chaque conteneur, comparaison par `git stash` avant/après)**

| Service | Résultat | Régression ? |
|---|---|---|
| tenant-service | 164/164 OK | Aucune |
| fultang-compta-financiere | 104 tests, 38 failures + 7 errors | **Identique** avant/après (baseline pré-existante, confirmée par stash) |
| ComptaMatiere | Erreur de découverte des tests (`ImportError` sur le module `tests`) | **Identique** avant/après (baseline pré-existante, confirmée par stash) |
| Gestion-Infrastructures | 52 tests, 7 failures | **Identique** avant/après (baseline pré-existante, confirmée par stash) |

**TESTS — bout en bout réel (script Python + `requests`, Gateway réelle)**

*Preuve d'appel backend réel (§2 de la mission) :*
```
PATCH /tenants/tenants/{id}/functional-services/SOINS_INFIRMIERS/  {"enabled": false}
→ HTTP 200, 122 ms de round-trip réel
→ ligne TenantFunctionalService en base : enabled=False (vérifié directement, hors du chemin HTTP)
```
Cas d'échec réel : tenter de désactiver GESTION_PERSONNEL → **400**, jamais 200 — le bloc `try/await/catch` de `ServicesConfigSection.jsx::handleConfirm` ne peut physiquement appeler `showSuccess()` que sur la ligne suivant un `await` qui a réussi ; un rejet HTTP y lève une exception JS interceptée par le `catch`, qui appelle `showError()`. Le popup de succès n'est donc pas atteignable indépendamment d'une vraie réponse 2xx du backend.

*Résultats détaillés :*

| Test | Résultat |
|---|---|
| SOINS_INFIRMIERS activé avant toute action | PASS |
| PATCH toggle → 200 + service désactivé dans la réponse | PASS |
| Persistance en base (hors chemin HTTP) | PASS |
| GESTION_PERSONNEL : désactivation seule → 400 | PASS |
| Persistance après nouveau login Platform Admin (rechargement simulé) | PASS |
| Session déjà ouverte (JWT jamais rafraîchi) : `enregistrer_soin` → 404 | PASS |
| Nouvelle connexion : `enregistrer_soin` → 404 | PASS |
| Création d'un nouveau rôle infirmier → 404 | PASS |
| Tenant B (jamais touché) : `enregistrer_soin` → 201, fonctionne normalement | PASS |
| PHARMACIE désactivée : listing bloqué, compte pharmacien PAS supprimé en base | PASS |
| Pharmacien toujours visible dans la gestion générale du personnel | PASS |
| CAISSE actif → désactivé (404) → réactivé (200) | PASS ×3 |
| CAISSE désactivé n'affecte pas COMPTA_FINANCIERE (même microservice) | PASS |
| COMPTA_FINANCIERE désactivé : `comptabilite` ET `sorties` bloqués | PASS ×2 |
| COMPTA_MATIERE actif → désactivé (404) | PASS ×2 (après correction du défaut ci-dessus) |
| GESTION_INFRASTRUCTURES actif → désactivé (404) | PASS ×2 |
| GESTION_PERSONNEL : bulk-set incluant `enabled=false` → 400, tout-ou-rien réellement respecté | PASS ×2 |
| GESTION_PERSONNEL : personnel jamais impacté | PASS |

**Total : 26/26 PASS.**

**LIMITATIONS / points restants**

- Les baselines de tests pré-existantes de `fultang-compta-financiere` (38 failures + 7 erreurs), `ComptaMatiere` (erreur de découverte de tests) et `Gestion-Infrastructures` (7 failures) restent en l'état — confirmées sans rapport avec cette tâche (identiques par `git stash`), mais non corrigées (hors périmètre explicite : "ne corrige pas ce qui n'est pas nécessaire").
- Comme pour Medical-Monitoring (§14.10.2), les ViewSets de ces 3 microservices n'ont pas fait l'objet d'une chasse exhaustive aux actions personnalisées (`@action`) dupliquant une opération d'un autre ViewSet non gaté — le gating appliqué est class-level, systématique, sur TOUS les ViewSets routés de chaque app concernée (pas seulement un sous-ensemble choisi), ce qui réduit fortement ce risque par rapport à Medical-Monitoring, mais un audit ligne à ligne comparable à celui de Medical-Monitoring n'a pas été refait ici faute de temps.
- **Réactivation** : cette tâche ne corrige toujours pas la synchronisation de l'UI après un cycle désactivation/réactivation (voir §14.10.2, filtre `localStorage['treated_visits']`) — explicitement différée.

---

### 14.11 Intégration du travail de Serena (parcours patient, renommage Compuclinic, RH/primes) dans l'architecture multi-tenant

#### AVANT

Une collaboratrice (Serena) a travaillé en parallèle, à partir d'un ancien point commun de l'historique (`a298d44`, "rendre medical-monitoring tenant-aware" — 2 commits derrière la référence multi-tenant courante), sur l'amélioration métier de l'application hospitalière : renommage d'affichage Fultang → COMPUTECLINIC, refonte du formulaire de création de personnel, nouveau modèle RH `Prime`, parcours patient (paiement de visite, verrouillage infirmier, triage, orientation spécialiste, attribution de chambre, sortie médicale/financière), et un nouveau module d'interventions chirurgicales. Son travail n'avait jamais été confronté à l'architecture multi-tenant construite depuis (suspension de tenant, désactivation de `FunctionalService`, isolation par base de données par tenant).

#### DÉMARCHE

Intégration sur une branche dédiée (`integration/serena-compuclinic`, créée depuis `Multitenancy@2223406`, elle-même taguée `multitenancy-reference-before-serena-integration` comme point de retour garanti) — jamais un merge direct sur `Multitenancy`. `git merge origin/serena` a produit 13 conflits textuels réels (sur 152 fichiers touchés par Serena), tous résolus en préservant explicitement LES DEUX intentions plutôt qu'en choisissant un camp — jamais un `git checkout --theirs`/`--ours` aveugle :

| Fichier | Conflit | Résolution |
|---|---|---|
| `CustomDashboard.jsx` | son renommage `brandLabel = APP_NAME` vs mon prop `requiredFunctionalService` | les deux paramètres conservés |
| `AddPersonnelModal.jsx` | sa refonte complète du formulaire (catégories de poste, spécialité médecin, date d'embauche, `FultangDatePicker`) vs mon filtrage des postes par service désactivé + affichage du mot de passe temporaire | les deux fusionnés ; son message "un email a été envoyé" retiré (aucune infrastructure SMTP n'existe réellement — déjà remplacé par l'affichage du `temporary_password` dans une session précédente) |
| `axiosInstance.js` / nouveau `setupAuthRefresh.js` | son module de refresh JWT partagé (remplace la logique dupliquée) vs mon détecteur `TENANT_SUSPENDED`/`SERVICE_UNAVAILABLE` | détecteur déplacé À L'INTÉRIEUR de `setupAuthRefresh.js`, en première ligne de son handler — deux intercepteurs de réponse axios distincts ne se protègent pas mutuellement (le rejet de l'un n'empêche pas l'exécution de l'autre) : sans ce déplacement, un tenant suspendu (403) aurait déclenché la logique de refresh/redirection de session au lieu de `TenantSuspendedScreen` |
| `service-personnel/serializers.py`, `urls.py` | son modèle `Prime` (primes RH multi-services) | ajouté tel quel — vérifié tenant-safe par construction (app_label `api`, routé comme tout le reste par `TenantDatabaseRouter`, aucune colonne `tenant_id` nécessaire) |
| `Gestion-Infrastructures/infrastructures/views.py` | son `select_related`/`get_queryset` (filtres salle/étage/bâtiment) vs mon gating `GESTION_INFRASTRUCTURES` sur les 5 ViewSets | les deux fusionnés |
| `Medical-Monitoring` (`medical_workflow/views.py`, `patient/views.py`) | l'intégralité de ses nouvelles fonctionnalités (paiement visite, verrouillage infirmier, triage, orientation spécialiste, attribution de chambre, sortie médicale/financière, interventions chirurgicales) vs mon gating par action précise (`get_permissions`, MEDECINE_GENERALE/LABORATOIRE/SOINS_INFIRMIERS) | les deux fusionnés |
| `ComptaMatiere/{MaterialList,OutputList}.jsx` | conflit rendu illisible par une corruption de fins de ligne (CRLF→LF) introduite par mon propre script d'édition lors d'une session précédente | repartis de sa version propre (LF) plutôt que résoudre dans l'état corrompu, puis mon prop `requiredFunctionalService="COMPTA_MATIERE"` réappliqué par-dessus |
| `chambresApi.js`, `medecinsApi.js`, `ForgottenPassword.jsx` | correctifs indépendants et fonctionnellement identiques des deux côtés (résolution tenant-aware du gateway par hostname au lieu d'un env var statique) | fusion triviale |

#### ADAPTATIONS TENANT-AWARE

Audit systématique des 48 fichiers backend touchés par Serena (modèles, serializers, vues, migrations) :

- **Aucun nouveau `app_label` Django créé.** Tous les nouveaux modèles (`Prime`, `InterventionChirurgicale`, `MembreEquipeOperatoire`, champs ajoutés à `Visite`/`Hospitalisation`/`Examen`/`Patient`/`Besoin`/`Salle`/`Service`) vivent dans des apps déjà couvertes par le `TenantDatabaseRouter` de chaque service (`api`, `medical_workflow`+`patient`+`patient_informations`, `comptabilite_matiere`, `infrastructures`) — routage automatique par tenant, sans adaptation nécessaire.
- **Aucun contournement du router** (`grep` sur `.using(`, `connections['default']` dans tout le code touché : aucune occurrence).
- **Aucun nouvel appel réseau inter-services** introduit (le remaniement de `medical_client.py` ne fait que retraiter des données déjà récupérées).
- **Aucune migration de données** (`RunPython`) parmi les 13 nouvelles migrations — uniquement du schéma, donc rejouable sans risque sur une base tenant existante.
- **Toutes les nouvelles API `services/*.js` du frontend** (`infrastructureApi.js`, `medicalDossierApi.js`, `prestationsApi.js`, `primesApi.js`, `visiteApi.js`, `doctorApi.js`, `nurseApi.js`) utilisent déjà `axiosInstance`/`axiosInstanceCompta` + `getGatewayBaseUrl()` — Serena avait déjà adopté ces conventions tenant-aware, aucune correction nécessaire.
- **Point opérationnel réel identifié et traité** : les 13 nouvelles migrations ne se seraient jamais appliquées automatiquement aux tenants déjà provisionnés (`ensure_connection_alias` n'exécute `migrate` qu'à la création d'un tenant, jamais après-coup). Un script ponctuel (non committé — usage unique) a listé chaque base `tenant_*_<service>` physiquement présente sur chaque serveur Postgres et appliqué `migrate --database=<alias>` : **89 bases tenant migrées avec succès, 0 échec**, sur les 4 services concernés (Medical-Monitoring, ComptaMatiere, Gestion-Infrastructures, service-personnel + sa base pool `default`).

#### PROBLÈME SIGNALÉ, NON CORRIGÉ (rôle 11 — lister, pas cacher)

`SalleViewSet` (Gestion-Infrastructures) est gaté `GESTION_INFRASTRUCTURES` depuis une session précédente ; `getChambresDisponibles` (`medecinsApi.js`), utilisé lors de l'attribution de chambre à l'hospitalisation (un geste MEDECINE_GENERALE), interrogeait jusqu'ici une URL cassée (bug corrigé par Serena dans cette même intégration) et n'atteignait donc jamais réellement cet endpoint. **Conséquence désormais réelle** : un tenant qui désactive Gestion des Infrastructures perd la sélection de chambre à l'hospitalisation. Décision produit hors du périmètre de cette tâche — signalé, non modifié.

#### TESTS

**Non-régression** (comparaison stricte avec `origin/serena` seule, via `git worktree`, même image Docker, même base de test) :

| Service | Résultat merge | Résultat `origin/serena` seule | Écart |
|---|---|---|---|
| Medical-Monitoring | 131 tests, 6 failures + 3 erreurs | 125 tests, 6 failures + 3 erreurs (identiques) | +6 tests (mes tests `test_soins_gating.py`, tous PASS) |
| ComptaMatiere | `ImportError` à la découverte des tests | idem sur `origin/serena` seule | aucun |
| Gestion-Infrastructures | 52 tests, 7 failures | 52 tests, 7 failures (identiques) | aucun |
| fultang-compta-financiere | 104 tests, 38 failures + 7 erreurs | baseline déjà connue (session précédente), non re-touchée par Serena | aucun |

Zéro régression introduite par la fusion sur les 4 services — chaque échec pré-existe intégralement dans le travail de Serena, indépendamment de toute interaction avec le code multi-tenant.

**Live, deux tenants réels** (`e2e_serena_integration.py`, 13/13 PASS) :
- Création de médecin (endpoint refondu par Serena, champ `specialite`), création de patient (nouveau `get_queryset`/pagination de Serena) dans Tenant A.
- Isolation confirmée : patient de A invisible depuis Tenant B, visible depuis A.
- Parcours de paiement de visite (nouveau, Serena) : `ouvrir_consultation` sans paiement → 402 `PAIEMENT_REQUIS` ; `confirmer-paiement` → 200 ; nouvelle tentative → 201.
- **Composition des deux mécanismes vérifiée** : une visite en `mode_urgence=True` (contourne le paiement chez Serena) reste bloquée en 404 `SERVICE_UNAVAILABLE` dès que `MEDECINE_GENERALE` est désactivé côté tenant — le gate FunctionalService prime bien sur la logique métier, jamais l'inverse.
- Tenant B non affecté par la désactivation de A (isolation `FunctionalService` reconfirmée avec le code fusionné).

**Frontend** : `npm run build` réussi ; `eslint` sur les 10 fichiers résolus manuellement : uniquement des avertissements pré-existants dans le code de Serena (imports inutilisés, prop-types manquants), confirmés absents de toute ligne modifiée par cette intégration.

#### LIMITATIONS / points restants

- Les tenants de test créés par `e2e_serena_integration.py` (`srn-inta-*`, `srn-intb-*`) n'ont pas été supprimés — nettoyage à faire comme pour les précédents lots `iso-*`/`final-*`/`newsvc-*`.
- Dépendance croisée GESTION_INFRASTRUCTURES → sélection de chambre à l'hospitalisation (ci-dessus) : nécessite une décision produit, non traitée ici.
- `AddPersonnelModal.jsx` : le message "Un email a été envoyé avec le mot de passe" pour la création d'un médecin (chemin `createMedecin`, texte déjà présent avant l'intervention de Serena) était trompeur avant fusion (aucun SMTP n'existe) — retiré au profit de l'écran de mot de passe temporaire déjà en place pour la création de personnel générique ; non vérifié si un autre écran affiche encore ce même message ailleurs dans le code de Serena.
- Aucun audit ligne-à-ligne comparable à celui de Medical-Monitoring (recherche d'actions `@action` dupliquant une opération déjà gatée) n'a été refait pour les nouvelles actions ajoutées par Serena elle-même (`assigner-chambre`, `valider-sortie-medicale`, `valider-sortie-financiere`, module interventions chirurgicales) — ces actions ne portent aujourd'hui aucun gate `FunctionalService` (cohérent avec le fait qu'aucun service fonctionnel dédié "Chirurgie" ou "Hospitalisation" n'existe dans le référentiel actuel — pas une régression, mais un point à trancher si un tel service est créé plus tard).

---

### 14.12 Correction du mapping des rôles comptables (CAISSE / COMPTA_FINANCIERE / COMPTA_MATIERE)

#### AVANT

`POSTE_MODEL_MAP` (`service-personnel/api/views.py`) faisait pointer les postes affichés dans le formulaire Personnel vers les MAUVAIS modèles :

```python
POSTE_MODEL_MAP = {
    'caissier': ComptableFinancier,   # créait un ComptableFinancier -> rôle 'comptable_financier' -> dashboard COMPTA_FINANCIERE
    'comptable': ComptableMatiere,    # créait un ComptableMatiere -> rôle 'compta_matiere' -> dashboard COMPTA_MATIERE
    # aucune entrée ne créait jamais de personnel routé vers le dashboard Caisse
}
```

`Provider.jsx` détermine le rôle de navigation à partir du **nom de la classe Django** retournée à la connexion (`ROLE_MAP['ComptableFinancier'] = 'comptable_financier'`, etc.) — jamais à partir du champ `poste` saisi à la création. Sélectionner « Caissier » dans le formulaire créait donc un `ComptableFinancier`, et la personne atterrissait après connexion sur le dashboard Comptabilité Financière (pas Caisse) ; sélectionner « Comptable » créait un `ComptableMatiere`, menant à Comptabilité Matière. **Aucun poste ne créait de personnel routé vers CAISSE** — la seule façon d'obtenir le rôle `'caissier'` était un hack de démo par email (`EMAIL_ROLE_OVERRIDE` côté frontend, `CANONICAL_ROLES` côté backend, tous deux non liés au poste réellement choisi). `POSTE_TO_FUNCTIONAL_SERVICE` (le verrou qui bloque la création si le service est désactivé) ne connaissait par ailleurs aucun de ces trois postes.

#### MODIFICATIONS

**1. Nouveau modèle `Caissier(Personnel)`** (`service-personnel/api/models.py`) — jusqu'ici seul rôle avec dashboard dédié sans modèle Personnel propre. Migration `0008_add_caissier.py` (écrite à la main : `makemigrations` détecte un changement pré-existant et non lié sur `Service.date_creation`, non traité ici) ; appliquée sur `default` et sur les 51 bases tenant existantes.

**2. Mapping corrigé** (`POSTE_MODEL_MAP`, `POSTE_TO_FUNCTIONAL_SERVICE`, `CATEGORIE_POSTES` — `views.py`) :

| Poste | Modèle | FunctionalService | Rôle de navigation |
|---|---|---|---|
| `caissier` | `Caissier` (nouveau) | `CAISSE` | `caissier` |
| `comptable` | `ComptableFinancier` | `COMPTA_FINANCIERE` | `comptable_financier` |
| `comptable_matiere` (nouveau poste) | `ComptableMatiere` | `COMPTA_MATIERE` | `compta_matiere` |

`comptable_matiere` est un poste distinct nouvellement créé — l'ancien poste `comptable` désignait ambiguë­ment deux fonctions différentes (Financier ET Matière) ; ils sont maintenant strictement séparés, sans rien supprimer (aucun poste existant retiré).

**3. Gating backend des 3 ViewSets HR dédiés** (`CaissierViewSet`, `ComptableFinancierViewSet`, `ComptableMatiereViewSet`) avec `HasFunctionalServiceEnabled.for_service(...)`, même mécanisme que `LaborantinViewSet`/`PharmacienViewSet` — bloque aussi bien la création générique (`poste=...`) que la création directe via l'endpoint dédié (`/personnel/comptables-financiers/`, etc.), les deux chemins existants.

**4. `Caissier` ajouté à toutes les listes polymorphes** (`personnel_models` dans `AuthVerifyView`, `PersonnelViewSet`, résolution de `chef_service`) — sans quoi un Caissier n'aurait pas pu se connecter ni être désigné chef de service.

**5. Frontend** : `POSTE_TO_FUNCTIONAL_SERVICE` centralisé dans `constants/personnelPostes.js` (auparavant dupliqué localement dans `AddPersonnelModal.jsx`) — seule source de vérité frontend, utilisée maintenant à deux endroits : filtrage des postes proposés à la création (déjà existant) ET nouveau statut « Inactif » sur la liste Personnel de l'admin.

**6. Statut « Inactif » dans l'admin** (`AdminPersonnelPage.jsx`) : `getStatusTag` affiche « Inactif (service désactivé) » quand `POSTE_TO_FUNCTIONAL_SERVICE[poste]` est désactivé pour le tenant — **purement un badge d'affichage** : ne modifie jamais le champ `statut` réel en base, ne supprime rien, ne touche à aucun `User.is_active`. Redevient « Actif »/statut réel dès réactivation. Le personnel reste toujours visible (la liste passe par `PersonnelViewSet`, un ViewSet polymorphe distinct des ViewSets dédiés, jamais gaté — comportement déjà en place pour Laborantin/Pharmacien, vérifié ici).

**7. Investigation "page déjà ouverte" (COMPTA_FINANCIERE / COMPTA_MATIERE)** : les 17 + 13 ViewSets métier de ces deux services étaient déjà correctement gatés (session précédente). Testé en direct : page ouverte → désactivation → nouvelle requête GET, POST, et sur un second endpoint du même dashboard → bloqués (404) dans tous les cas, y compris avec le même token JWT que celui utilisé avant désactivation (invalidation de cache déjà effective). **Non reproduit** malgré des tests ciblés (lecture, écriture, endpoint HR direct) — possiblement déjà résolu par le travail de finalisation d'une session précédente (§14.10/§14.11).

#### TESTS

Live, deux tenants réels (`e2e_roles_mapping.py`, 32/32 PASS) : mapping poste→modèle→FunctionalService vérifié par introspection Django ; cycle complet CAISSE (créer → connecter → accéder au dashboard → désactiver → bloqué partout, y compris `/personnel/caissiers/` → réactiver → accès restauré) ; même cycle pour COMPTA_FINANCIERE et COMPTA_MATIERE avec en plus le scénario "page déjà ouverte" (lecture ET écriture) ; isolation confirmée (CAISSE désactivé sur Tenant A, toujours actif et créable sur Tenant B).

Non-régression (`service-personnel`, comparaison stricte via `git stash`) : 5 échecs déjà présents avant toute modification (payloads de test obsolètes, non liés — confirmés identiques avec/sans les changements de cette tâche).

#### LIMITATIONS / points restants

- `EMAIL_ROLE_OVERRIDE`/`CANONICAL_ROLES` (hacks de démo pré-existants pour `paul.talla@fultang.local`/`i.njoya@fultang.local`) non touchés — ces comptes de seed ne sont pas re-créés comme de vrais `Caissier` ; nouveau personnel créé via l'UI n'est pas affecté.
- Frontend non re-testé dans un navigateur réel pour cette tâche (build + lint + contenu du bundle vérifiés ; comportement API confirmé en direct via 32 tests).

---

### 14.13 Branding ComputeClinic (frontend) et identité dynamique du tenant dans les sidebars

#### AVANT

Le renommage Fultang → ComputeClinic (§14.11) avait couvert l'essentiel du code, mais 13 occurrences visibles subsistaient (dont une variante orthographique `FullTang`, non couverte par la recherche précédente) : écran « service indisponible », écran de suspension, page de connexion Platform Admin (titre, placeholder, mentions), en-tête de sidebar de 5 pages Platform Admin, email de support, placeholders de formulaires, un message d'erreur exposant un nom de container technique (`fultang-medical-backend`), et des données de démonstration statiques.

Par ailleurs, toutes les sidebars hospitalières (Réceptionniste, Médecin, Infirmier, Pharmacien, Laborantin, Caissier, Comptable...) n'affichaient que la marque générique ComputeClinic — jamais le nom ni le logo de l'établissement, alors que ces informations existent déjà (`Tenant.name`/`Tenant.logo`, gérées depuis Platform Admin → `EstablishmentDetailPage`/`LogoUploader`).

#### MODIFICATIONS

**1. Renommage** : les 13 occurrences visibles corrigées (liste complète dans le rapport donné à l'utilisateur) — jamais les identifiants techniques (clés `localStorage`, noms de composants React, variables d'environnement `VITE_BACKEND_FULTANG_*`, domaine technique de repli `fulltang.com` dans `gatewayUrls.js`), conservés à l'identique.

**2. Nouvel endpoint self-service** `GET /tenants/tenants/mine/` (`tenant-service/tenants/views.py`, `TenantViewSet.mine`) — même principe que `functional-services/mine/` déjà existant : tenant dérivé de `request.user.tenant_id` (jamais un identifiant fourni par le client), 404 pour un appelant sans tenant (Platform Admin, pool non assigné). Réutilise `TenantSerializer` tel quel — **aucun nouveau modèle, aucune nouvelle table** : `name`/`logo_display_url` existaient déjà.

**3. Mécanisme frontend réutilisable** (un seul, partagé par tous les rôles) :
   - `services/tenantConfigApi.js::getMyTenant()` — appelle l'endpoint ci-dessus.
   - `Utils/gatewayUrls.js::resolveTenantLogoUrl()` — résolution d'URL de logo, extraite de `LogoUploader.jsx` (qui l'utilisait déjà en local) pour être partagée.
   - `hooks/useTenantBranding.js` — hook `{name, logoUrl, loading}`, retombe silencieusement sur `{null, null}` en cas d'erreur/404 (jamais d'erreur visible pour une simple absence de tenant).
   - `GlobalComponents/TenantBrandHeader.jsx` — composant unique affichant logo + nom du tenant + « ComputeClinic » en repli, câblé dans les 7 sidebars hospitalières (`DashBoard.jsx`, `CustomDashboard.jsx`, `AccountantLayout.jsx`, `AccountantDashBoard.jsx` [ComptaMatiere], `DirectorDashboard.jsx`, `LaboratoryDashboard.jsx`, `PharmacistDashboard.jsx`).

**4. Platform Admin protégé explicitement** : `CustomDashboard.jsx` (partagé avec les rôles hospitaliers) reçoit un nouveau prop `showTenantIdentity` (défaut `true`) ; les 5 pages Platform Admin qui l'utilisent passent `showTenantIdentity={false}` pour garder leur libellé statique « ComputeClinic Platform » — jamais de nom d'hôpital arbitraire hors contexte tenant.

**5. Découverte incidente — bug de dépôt** : `Frontend/.gitignore` contenait un motif nu `logs` qui, combiné à `core.ignorecase=true` (courant sur système de fichiers insensible à la casse), masquait aussi `src/Pages/PlatformAdmin/Logs/` — ce répertoire de code source (page de logs Platform Admin, `AdminLogsPage.jsx`) n'avait donc **jamais été suivi par git**, dans aucune session précédente. Motif corrigé en `/logs` (ancré à la racine du projet frontend) ; le répertoire est maintenant suivi.

**6. Nouvelle landing page** (`Pages/LandingPage/LandingPageV2.jsx`, route `/nouvelle-landing`) — proposition indépendante, la landing actuelle (`/`) reste intacte et inchangée. Aucune détection de tenant, aucune dépendance à une image statique (icônes `lucide-react` uniquement, pour une fiabilité de rendu garantie). Le bouton « Se connecter » redirige vers `AppRoutesPaths.platformAdminLoginPage` (`/platform-admin/login`, déjà existant) — aucun nouveau système d'authentification.

#### TESTS

Live (`e2e_branding.py`, 7/7 PASS) : nom du tenant retourné correctement et distinctement pour deux tenants réels ; upload de logo via l'endpoint Platform Admin déjà existant (`POST /tenants/tenants/{id}/logo/`) ; logo visible dans `/mine/` pour son propre tenant ; **isolation confirmée** (le logo de A n'apparaît jamais pour B) ; Platform Admin (sans tenant) reçoit 404 sur `/mine/`, jamais un nom arbitraire.

Non-régression `tenant-service` : 164/164 (identique à la baseline connue).

Build + lint frontend propres sur tous les fichiers touchés ; bundle déployé vérifié sans occurrence de `FullTang`/`fultang` visible ; routes `/`, `/nouvelle-landing`, `/platform-admin/login` toutes accessibles (200).

#### LIMITATIONS / points restants

- Non re-testé dans un navigateur réel (rendu visuel du logo/nom en situation, responsive de la nouvelle landing) — vérifié par API + build + lint + contenu du bundle uniquement.
- Le tenant de test ayant reçu un logo (`brand-a-*`) n'a pas été nettoyé.

### 14.14 Phase 4 — Suppression DÉFINITIVE d'un tenant

#### AVANT

Seule la **suspension** (`Tenant.status = INACTIVE`, §14.10) existait : réversible, tout est conservé (tenant, 5 bases, comptes, données). Aucun mécanisme ne permettait de retirer un tenant **définitivement** du registre opérationnel — ni d'effacer physiquement ses 5 bases de données ni ses comptes utilisateurs.

#### PRINCIPE — SUSPENSION vs SUPPRESSION

| | Suspension (existant, INCHANGÉ) | Suppression définitive (nouveau) |
|---|---|---|
| Réversible | Oui (`status` → `ACTIVE`) | **Non** |
| Tenant/bases/comptes | Conservés | Détruits |
| Historique | Vivant | Uniquement dans une **archive** séparée |
| Accès | Bloqué tant que suspendu | Bloqué définitivement (tenant introuvable) |

La suspension n'a **pas été retouchée** : `TenantService.activate_tenant`/`deactivate_tenant` restent la seule voie de suspension/réactivation.

#### MODIFICATIONS

**1. Modèles** (`tenant-service/tenants/models.py`) :
- `TenantDeletionStatus` (TextChoices) : PENDING → ARCHIVING → ARCHIVED → CLEANING → COMPLETED, ou FAILED à toute étape.
- `TenantDeletionRecord` — **sans ForeignKey vers Tenant** (mêmes principes que `AdminActionLog`, §14.9 : un enregistrement de suppression doit rester lisible même une fois le tenant disparu) : `tenant_id`/`tenant_identifier`/`tenant_name` à plat, `status`, `archive_reference`, `archive_version`, `error_message`, `initiated_by_id`/`initiated_by_email`, horodatages.
- `AdminAction` étendu de 5 valeurs : `TENANT_DELETION_STARTED`/`ARCHIVED`/`CLEANED`/`COMPLETED`/`FAILED` — le journal d'audit existant (`AdminActionLog`, déjà sans FK vers Tenant) trace la suppression sans dépendre d'aucune base tenant.

**2. Archivage** (`tenant-service/tenants/archiving.py`, nouveau) — choix **`dumpdata` Django plutôt que `pg_dump`** : `pg_dump` était la première option envisagée, mais vérifié absent de 4 des 5 images de service (seul `fultang-medical-backend` l'a) — décision changée après vérification de l'infrastructure réelle, jamais supposée. `archive_tenant_data()` appelle, pour chaque service **réellement provisionné pour ce tenant** (voir point 5 ci-dessous), un nouvel endpoint interne `internal/archive-tenant-data/` (lecture seule, `IsInternalService`), écrit le dump JSON reçu + un `manifest.json` (checksums SHA-256 par fichier) sous `ARCHIVE_ROOT` (répertoire sibling du `MEDIA_ROOT` déjà bind-monté, jamais exposé par une URL). `validate_archive()` relit chaque fichier et revérifie son checksum — détecte toute corruption avant de poursuivre. Échec sur un seul service → `ArchivingError`, répertoire partiel nettoyé, **rien n'est détruit**.

**« Pool historique »** : dans service-personnel uniquement (seul service avec un pool `default` partagé significatif), `ArchiveTenantDataView` vérifie qu'aucun compte du tenant ne traîne hors de sa base dédiée avant d'archiver — si trouvé, `ArchivingError` immédiate (jamais ignoré ni supprimé à l'aveugle).

**3. Nettoyage physique** — `deprovision_database(tenant_id)` ajouté au `pool_registry.py` de **chacun des 5 services** (mécaniquement répliqué, sur le modèle exact de `provision_database` déjà existant) : ferme les connexions actives (`pg_terminate_backend`) puis `DROP DATABASE IF EXISTS` (idempotent — `dropped=False` si déjà absente n'est jamais traité comme un échec). Exposé via un nouvel endpoint interne `internal/deprovision-tenant-data/` par service.

**4. Orchestration** (`tenant-service/tenants/services.py::TenantDeletionService.delete_tenant`) — ordre **volontairement différent** d'une première intuition : **ARCHIVER → VALIDER → NETTOYER/DROP → SUPPRIMER LE TENANT EN DERNIER**. Tant que `Tenant`/`TenantDatabase` existent encore, on dispose des métadonnées nécessaires pour identifier sans ambiguïté les ressources physiques à traiter ; les supprimer trop tôt (CASCADE `TenantDatabase`) reviendrait à perdre cette carte avant d'avoir fini de s'en servir. Réutilise sans dupliquer : `TenantRepository`/`TenantDatabaseRepository`, `AdminActionLogService`, `provisioning.PROVISIONING_CAPABLE_SERVICES`/`invalidate_functional_service_cache`, `internal_clients.call_internal_service`. Exclusion mutuelle : `has_active_deletion()` refuse une seconde suppression en cours pour le même tenant. Toute exception à n'importe quelle étape → statut `FAILED`, audité, **jamais un succès partiel silencieux**.

**5. Correction en cours de test — tenants partiellement provisionnés** : la première version bouclait sur les **5 services connus de la plateforme** (`PROVISIONING_CAPABLE_SERVICES`), sans considérer que le wizard de création permet de ne provisionner qu'un sous-ensemble de services pour un tenant donné. Un tenant provisionné avec seulement PERSONNEL+MEDICAL (par exemple) ne pouvait alors **jamais** être supprimé définitivement (échec systématique : "Aucune configuration TenantDatabase" pour COMPTA/COMPTA_MATIERE/INFRASTRUCTURE). Corrigé : `delete_tenant()` calcule d'abord la liste des services **réellement provisionnés** pour ce tenant (`TenantDatabaseRepository.list(tenant_id=...)`) et la transmet explicitement à l'archivage, la validation, et le nettoyage physique — jamais la liste fixe des 5 services connus.

**6. Gateway — AUCUNE modification.** Vérifié live : `TenantResolver.get_tenant_status()` (§14.10) traite déjà "tenant absent du registre" (`None`) exactement comme "INACTIVE" pour l'accès (`api-gateway/app/main.py` ligne ~874), et `resolve()` lève déjà `TenantNotFoundError` sur un hostname disparu. La suppression bénéficie donc gratuitement du même blocage d'accès que la suspension, sans aucun changement côté Gateway.

**7. API** : `POST /tenants/tenants/{id}/delete/` (`TenantViewSet.delete_tenant_permanently`), réutilise `IsPlatformAdmin` tel quel. Synchrone (comme le provisioning existant) — limite documentée pour un tenant au volume de données très important. Idempotent côté sécurité : une seconde suppression sur un tenant déjà supprimé renvoie 404 (jamais un faux succès), une suppression déjà en cours renvoie une erreur explicite (jamais deux suppressions concurrentes sur le même tenant).

**8. Frontend** : `ConfirmationModal` (`Pages/Modals/ConfirmAction.Modal.jsx`) étendu d'un prop optionnel `requireTypedConfirmation` (aucun appelant existant ne le passe — comportement par défaut inchangé) : quand renseigné, le bouton de confirmation reste désactivé tant que la saisie ne correspond pas exactement au nom du tenant. `EstablishmentDetailPage.jsx` — nouvelle section "Zone de danger" avec bouton "Supprimer définitivement", double confirmation (résumé puis saisie du nom exact), affichant nom/identifiant/nombre de bases de données réel (`getTenantDatabases`), avis d'archivage et avertissement d'irréversibilité. `platformAdminApi.js::deleteTenantPermanently(id)` ajouté.

#### TESTS

Non-régression (`git stash`/`pop` des changements Task 4, comparaison directe) — **identique avant/après** sur les 5 services :
- `tenant-service` : 164/164 OK.
- `service-personnel` : 4 échecs + 1 erreur, **préexistants** (bug de validation de mot de passe à la création de personnel, hors périmètre de cette tâche).
- `Medical-Monitoring` : 6 échecs + 3 erreurs, **préexistants**.
- `fultang-compta-financiere` : 38 échecs + 7 erreurs, **préexistants**.
- `ComptaMatiere` : erreur de découverte de tests (`ImportError` structurel), **préexistante**.
- `Gestion-Infrastructures` : 7 échecs, **préexistants**.

Live, deux tenants réels (`e2e_tenant_deletion.py`) — **23/23 PASS** : données réelles créées puis suppression de A → 200 COMPLETED (≈2s) ; A absent du registre et de la liste Platform Admin ; ancien hostname de A refusé (tenant introuvable) ; ancien JWT de A refusé (403 `TENANT_SUSPENDED` — même traitement qu'un tenant suspendu) ; les 5 bases physiques de A confirmées absentes par requête SQL directe ; archive présente sur disque (5 fichiers + manifest) ; `AdminActionLog` contient `TENANT_DELETION_STARTED`/`ARCHIVED`/`CLEANED`/`COMPLETED` ; **isolation confirmée** — B reste présent, actif, ses données restent accessibles, ses 5 bases physiques restent intactes ; re-suppression de A déjà supprimé → 404 (jamais un faux succès).

Live, tenant partiellement provisionné (`e2e_partial_tenant_deletion.py`, nouveau) — **4/4 PASS**, validant le correctif du point 5 : tenant provisionné PERSONNEL+MEDIAL uniquement, supprimé définitivement avec succès (200 COMPLETED), absent du registre ensuite.

Corrections apportées suite aux tests (documentées honnêtement, jamais silencieuses) :
- `AdminActionLog` de l'entrée `TENANT_DELETION_COMPLETED` : après `tenant.delete()`, Django remet `tenant.pk`/`.id` à `None` — l'enregistrer avec `tenant=tenant` aurait produit un `target_tenant_id` NULL, invisible au filtre `?tenant=<uuid>` de `/tenants/admin-logs/`. Corrigé en passant un objet léger (`SimpleNamespace`) portant l'id/l'identifiant capturés juste avant la suppression.
- Bug de script de test (pas produit) : mauvais utilisateur `psql` par conteneur PostgreSQL (chaque service a son propre `POSTGRES_USER`) faisait faussement remonter "base absente" pour Tenant B — corrigé côté script uniquement.

#### CE QUI N'A PAS ÉTÉ IMPLÉMENTÉ (hors périmètre, par instruction explicite)

Restauration automatique, réactivation d'un tenant supprimé, destruction de l'archive, politique légale de rétention automatique, nouveau système d'authentification/routage.

#### LIMITATIONS

- Suppression **synchrone** — pour un tenant au volume de données très important, l'appel HTTP peut prendre plusieurs secondes (≈2s observé en test ; le timeout configurable `TENANT_DELETION_TIMEOUT_SECONDS` protège chaque appel interne).
- Champs de rétention de `TenantDeletionRecord` volontairement non exploités par une politique automatique (aucune durée codée en dur) — laissés pour un futur mécanisme de purge d'archive, non construit ici.
- Non re-testé dans un navigateur réel (flux de clic complet sur "Supprimer définitivement") — vérifié par build + lint + contenu du bundle déployé + validation complète de l'API sous-jacente.

---

## 15. Sécurité

Décisions prises et vérifiées :

| Décision | Où | Vérifié |
|---|---|---|
| `tenant_id` toujours déterminé **côté serveur** (résolution hostname), jamais par le client | `login()`, `proxy_catch_all()` | Tests + Docker réel |
| `tenant_id` porté par le **JWT signé** (HS256), jamais par un champ modifiable après coup | `jwt_handler.py` (inchangé), `login()`/`refresh_token()` | Tests |
| Comparaison **tenant demandé (hostname) vs tenant du token (JWT)** avant tout routage métier | `proxy_catch_all()` | Tests + Docker réel (403 confirmé) |
| Client **incapable de choisir librement son tenant** — ni en paramètre de login, ni en header `X-Tenant-ID` | `AuthVerifyView` (paramètre serveur), `_strip_client_identity_headers()` (header) | Tests + spoof réel testé (401) |
| `Personnel.tenant_id` **`editable=False`** — jamais accepté en écriture par l'API CRUD existante | `models.py` | Conséquence structurelle DRF, pas de test dédié nécessaire |
| Confiance Gateway → services **basée sur des headers non signés** (`X-User-ID`, `X-User-Roles`, `X-Tenant-ID`) | `GatewayHeaderAuthentication` (7 services au total ; 4 exploitent `tenant_id`, voir [§8.4](#84-services-mis-à-jour-vs-non-mis-à-jour)) | — |
| Anti-spoofing `X-Tenant-ID` vérifié pour les nouveaux services adaptés (Gestion-Infrastructures, ComptaMatiere, fultang-compta-financiere) | `GatewayHeaderAuthentication` de chaque service | Tests unitaires (`RequestFactory`) — le mécanisme de suppression est générique côté Gateway (`_strip_client_identity_headers`), donc valable pour toute route proxyfiée sans re-test par route |
| **Limite actuelle de cette confiance** : un accès réseau direct à un service métier (contournant la Gateway) permettrait d'injecter ces headers librement — la Gateway n'ajoute pas de signature, seulement une garantie qu'**elle-même** ne les laisse pas passer telles quelles depuis un client externe | Toute la chaîne | Non testé — dépend de l'isolation réseau Docker |
| Communications service-to-service **encore directes**, non authentifiées (sauf `tenant-service.resolve`) | [§12](#12-service-to-service) | — |
| Endpoint `GET /tenants/resolve/` protégé par jeton interne (`hmac.compare_digest`), pas public | `tenant-service/permissions.py` | Tests + Docker réel |
| **(Phase 6)** Tenant Context établi UNIQUEMENT par le mécanisme d'authentification (jamais décodé JWT/paramètre libre par le Router) | `GatewayHeaderAuthentication.authenticate()`, `AuthVerifyView.post()` | Tests |
| **(Phase 6)** Requête sans Tenant Context établi → refus explicite (`TenantContextMissingError`), jamais de repli vers `'default'` | `router.py::_resolve_alias` | Tests |
| **(Phase 6)** `tenant_id` réel mais non routable (introuvable/inactif/Registry indisponible sans cache) → refus explicite, jamais de repli vers une autre base | `pool_registry.py`, `cache.py` | Tests + Docker réel |
| **(Phase 6)** Endpoint `GET /tenant-databases/resolve/` protégé par le même jeton interne, jamais public | `tenant-service/permissions.py` (réutilisé) | Tests + Docker réel |
| **(Phase 6)** Isolation absolue : Tenant A ne peut jamais lire/écrire la base du Tenant B | `router.py` (alias distincts par tenant) | Tests + Docker réel avec 2 vraies bases séparées |
| **(Phase 7)** `POST /tenants/{id}/provision/` réservé à `PLATFORM_ADMIN` — même permission de classe que le reste du Tenant Management, aucun nouveau système d'autorisation | `tenant-service/tenants/views.py::TenantViewSet.provision` | Tests + Docker réel (403 confirmé pour ADMIN/anonyme) |
| **(Phase 7)** `POST /api/internal/provision-database/` réservé au jeton interne partagé, jamais accessible via `GatewayHeaderAuthentication` | `service-personnel/api/permissions.py::IsInternalService` (symétrique de celle de tenant-service) | Tests + Docker réel (403 confirmé pour jeton absent/faux) |
| **(Phase 7)** `tenant-service` ne connaît/ne transmet jamais de mot de passe PostgreSQL réel — seul `tenant_id` transite, service-personnel utilise ses propres credentials | `tenants/provisioning.py::_call_physical_provisioning` | Lecture de code + Docker réel |
| **(Phase 7)** Nom physique de base jamais dérivé d'une entrée libre — dérivé uniquement d'un `UUID` typé + d'un code de service déjà validé contre le catalogue, re-quoté via `psycopg2.sql.Identifier` avant `CREATE DATABASE` | `tenants/provisioning.py::_deterministic_database_name`, `pool_registry.py::_create_database_if_missing` | Tests + Docker réel |
| **(Phase 7)** Validation amont refuse la demande ENTIÈRE (tenant/service inconnu ou inactif) avant toute création — jamais d'état partiel dû à une erreur de saisie | `tenants/provisioning.py::ProvisioningOrchestrator.provision` | Tests + Docker réel |

### Améliorations de sécurité futures identifiées (non implémentées)

- Signature/authentification des communications service-to-service (mTLS, jetons par paire de services, ou passage systématique par la Gateway).
- Isolation réseau empêchant un accès direct aux services métier en contournant la Gateway.
- `tenant-service` (identité PLATFORM_ADMIN, transversale par nature), `Medical-Monitoring` et `clinical-agent` (conception tenant dédiée requise, voir [§13](#13-medical-monitoring--clinical-agent)) restent hors de `GatewayUser.tenant_id` — décision délibérée, pas un oubli.
- Autorisation au niveau objet (un `Medecin` du Tenant A ne doit pas être lisible/modifiable via l'API par un utilisateur du Tenant B) — actuellement absente de tous les `ModelViewSet` métier.
- **(Phase 6)** Verrou de création de pool LOCAL au processus — pas de coordination inter-instances en cas de déploiement horizontal futur (voir [§9.2.6](#926-concurrence--verrouillage-de-création-de-pool)).
- **(Phase 6)** Credentials PostgreSQL partagés entre toutes les bases tenant d'un service (pas de secret unique par tenant) — dépend de la mise en place d'un vrai Secret Manager, hors périmètre de cette phase (voir [§9.2.9](#929-bases-pilotes-réelles)).
- **(Phase 6)** Cache de résolution non invalidé activement (seulement par TTL) — un changement de configuration côté Registry met jusqu'à `TENANT_DB_CACHE_TTL_SECONDS` avant d'être pris en compte.
- **(Phase 6)** Alias de connexion déjà enregistré non revérifié auprès du Registry (chemin rapide) — désactiver un `TenantDatabase` ne révoque pas l'accès d'un processus qui a déjà résolu ce tenant, seul un redémarrage du processus applique la désactivation. Découvert et vérifié en conditions réelles pendant la validation pilote (voir [§9.2.10](#9210-limite-découverte-pendant-la-validation-pilote--désactivation-dun-alias-déjà-enregistré)).
- **(Phase 7)** Credentials PostgreSQL toujours partagés pour la création physique (même limite que la Phase 6, héritée) — pas de Secret Manager, voir [§10.2.9](#1029-sécurité-14-de-la-tâche).
- **(Phase 7)** Une ligne `TenantDatabase` bloquée en `PROVISIONING` (processus crashé après création physique réussie mais avant confirmation) n'est jamais reprise automatiquement — voir [§10.2.7](#1027-gestion-des-échecs-partiels-10-de-la-tâche), limite assumée, candidate Phase 8.

---

## 16. Tests et validation

| Fonctionnalité | Tests | Résultat | Statut |
|---|---|---|---|
| Tenant Registry CRUD | `tenant-service/tenants/tests.py` (21 tests) | 21/21 ✅ | Implémenté et testé |
| Autorisation PLATFORM_ADMIN vs ADMIN | inclus ci-dessus | ✅ | Implémenté et testé |
| Résolution `GET /tenants/resolve/` + jeton interne | inclus ci-dessus | ✅ | Implémenté et testé |
| Extraction hostname → identifier | `api-gateway/tests/test_tenant_resolver.py` | ✅ | Implémenté et testé |
| Résolution hostname → TenantContext (succès/404/403/503) | idem (19 tests) | ✅ | Implémenté et testé |
| Auth tenant-aware — login/verify scopé par tenant | `service-personnel/api/tests.py` (11 tests) | ✅ (Docker + Postgres réels) | Implémenté et testé |
| Unicité email/matricule scopée par tenant | inclus ci-dessus | ✅ | Implémenté et testé |
| Login → JWT avec `tenant_id` | `api-gateway/tests/test_login_tenant_context.py` (10 tests) | ✅ | Implémenté et testé |
| Refresh token conserve `tenant_id` | inclus ci-dessus | ✅ (+ vérifié live) | Implémenté et testé |
| Comparaison tenant demandé / tenant du token (403) | inclus ci-dessus | ✅ (+ vérifié live) | Implémenté et testé |
| Propagation `X-Tenant-ID` vers le service (service-personnel) | `api-gateway/tests/test_tenant_header_propagation.py` (4 tests) + `GatewayHeaderAuthenticationTenantTests` (3 tests, Docker réel) | ✅ | Implémenté et testé |
| Anti-spoofing `X-User-ID`/`X-User-Roles`/`X-Tenant-ID` | inclus ci-dessus + **curl live contre la Gateway réelle** | ✅ (401 confirmé) | Implémenté et testé |
| `GatewayUser.tenant_id` — Gestion-Infrastructures | `infrastructures/tests.py::GatewayHeaderAuthenticationTenantTests` (3 tests) | ✅ (sqlite local + Docker/Postgres réel) | Implémenté et testé |
| `GatewayUser.tenant_id` — ComptaMatiere | `apps/comptabilite_matiere/tests/test_gateway_authentication.py` (3 tests) | ✅ (sqlite local, exécution réelle) | Implémenté et testé |
| `GatewayUser.tenant_id` — fultang-compta-financiere (headers + fallback JWT) | `apps/caisse/tests.py::GatewayHeaderAuthenticationTenantTests` (4 tests) | ✅ (sqlite local, exécution réelle) | Implémenté et testé |
| PlatformService — catalogue plateforme (CRUD, format de code, permissions) | `tenant-service/tenants/tests.py::PlatformService{Model,API}Tests` (6 tests) | ✅ (sqlite + Docker/Postgres réel) | Implémenté et testé |
| TenantDatabase — multi-services par tenant, multi-tenants par service, unicité, service invalide, statuts, permissions, secrets | `tenant-service/tenants/tests.py::TenantDatabase{Model,API}Tests` (20 tests) | ✅ (sqlite + Docker/Postgres réel + curl live) | Implémenté et testé |
| **(Phase 6)** Tenant Context — établissement, isolation entre requêtes, refus si jamais établi, `None` = état valide | `service-personnel/api/tests.py::TenantContextTests` (5 tests) | ✅ (Docker + Postgres réel) | Implémenté et testé |
| **(Phase 6)** Cache TTL du mapping tenant → base — premier accès, expiration, invalidation, Registry indisponible (avec/sans entrée en cache) | `service-personnel/api/tests.py::TenantDatabaseCacheTests` (6 tests) | ✅ (Docker + Postgres réel) | Implémenté et testé |
| **(Phase 6)** Enregistrement d'alias de connexion — chemin rapide, refus si inactif, création concurrente (10 threads simultanés → une seule résolution) | `service-personnel/api/tests.py::PoolRegistryTests` (4 tests) | ✅ (Docker + Postgres réel) | Implémenté et testé |
| **(Phase 6)** `TenantDatabaseRouter` — apps système vs tenant, refus si contexte absent/tenant inactif/tenant inconnu, `allow_relation`/`allow_migrate` | `service-personnel/api/tests.py::TenantDatabaseRouterTests` (11 tests) | ✅ (Docker + Postgres réel) | Implémenté et testé |
| **(Phase 6)** Endpoint `GET /tenant-databases/resolve/` — jeton requis, réponse minimale (jamais `secret_reference`), 404/400 | `tenant-service/tenants/tests.py::TenantDatabaseResolveEndpointTests` (7 tests) | ✅ (sqlite + Docker/Postgres réel) | Implémenté et testé |
| **(Phase 6)** Isolation des données — Tenant A/B, 2 vraies bases PostgreSQL distinctes, login réel, JWT réel, requêtes HTTP réelles à travers la Gateway | Vérification manuelle en conditions réelles, voir [§9.2.9](#929-bases-pilotes-réelles) — pas de test automatisé dédié | ✅ (SQL brut + HTTP live, 2 bases pilotes réelles : `hopital-central`, `clinique-paix`) | Implémenté et vérifié |
| **(Phase 7)** Génération déterministe du nom de base — pas de collision entre tenants/services | `tenant-service/tenants/tests.py::DeterministicDatabaseNamingTests` (4 tests) | ✅ | Implémenté et testé |
| **(Phase 7)** `ProvisioningOrchestrator` — tenant/service inconnu ou inactif, service capable/non capable, idempotence, échec physique + retry, CAS de concurrence | `tenant-service/tenants/tests.py::ProvisioningOrchestratorTests` (11 tests) | ✅ | Implémenté et testé |
| **(Phase 7)** Endpoint `POST /tenants/{id}/provision/` — permissions, 404/409/400, réponse structurée par service | `tenant-service/tenants/tests.py::TenantProvisionEndpointTests` (7 tests) | ✅ | Implémenté et testé |
| **(Phase 7)** `IsInternalService` (service-personnel) — jeton correct/faux/absent/non configuré | `service-personnel/api/tests.py::IsInternalServicePermissionTests` (4 tests) | ✅ (Docker + Postgres réel) | Implémenté et testé |
| **(Phase 7)** Endpoint `POST /api/internal/provision-database/` — permissions, validation, délégation, 502 sur échec | `service-personnel/api/tests.py::ProvisionDatabaseEndpointTests` (5 tests) | ✅ (Docker + Postgres réel) | Implémenté et testé |
| **(Phase 7)** Création physique idempotente + nettoyage d'alias sur échec de migration | `service-personnel/api/tests.py::DatabaseProvisioningUnitTests` (4 tests) | ✅ (Docker + Postgres réel, psycopg2 mocké) | Implémenté et testé |
| **(Phase 7)** Provisioning réel de bout en bout — création physique, migration, isolation, collision, concurrence (5 requêtes simultanées), échec réel + retry, processus redémarré | Validation pilote Docker, voir [§10.2.10](#10210-validation-pilote-réelle-docker--postgresql-pas-de-mock) — pas de test automatisé dédié | ✅ (4 tenants pilotes réels, PostgreSQL réel, HTTP live à travers la Gateway) | Implémenté et vérifié |
| Création physique des bases pour l'ensemble des tenants (hors pilotes, mass provisioning) | — | — | **Non implémenté, non testé** (hors périmètre, mass provisioning volontairement exclu) |
| Provisioning physique pour INFRASTRUCTURE/COMPTA/COMPTA_MATIERE | — | — | **Non implémenté** (décision de périmètre — ces services n'ont pas l'équivalent Phase 6) |
| **(Medical-Monitoring tenant-aware)** Tenant Context, Router, Pool Registry, provisioning multi-app, authentification, endpoint interne | `Medical-Monitoring/backend/core/tests_tenant_routing.py` (42 tests) | ✅ (Docker + Postgres réel) | Implémenté et testé |
| **(Medical-Monitoring tenant-aware)** `allow_clinical_agent_export` — champ, migration, API création/modification/résolution | `tenant-service/tenants/tests.py` (18 tests supplémentaires : export, `resolve` par id, `resolve-active`) | ✅ | Implémenté et testé |
| **(Clinical Agent tenant-aware)** `registry_client`/`engine_registry` — résolution, cache d'engine par tenant, erreurs Registry | `clinical-agent/test_tenant_routing.py` (12 tests, `unittest`) | ✅ | Implémenté et testé |
| **(Clinical Agent tenant-aware)** Isolation bout-en-bout réelle — signal→sync, export autorisé/refusé/inversé, buffer scopé par tenant, `/sync/all` mono-tenant | Validation pilote Docker (voir §13, rapport final) — pas de test automatisé dédié (pas de harnais pytest préexistant dans ce service) | ✅ (2 tenants réels, PostgreSQL réel, inversion testée dans les deux sens) | Implémenté et vérifié |
| **(Phase 8 finalisation)** `tenant_routing` complet — Context/Cache/PoolRegistry/Router/Auth/Provisioning — fultang-compta-financiere | `apps/comptabilite/tests_tenant_routing.py` (~55 tests, dont Kafka/medical_client) | ✅ (Docker + Postgres réel + provisioning live réel) | Implémenté et testé |
| **(Phase 8 finalisation)** `tenant_routing` complet — ComptaMatiere | `apps/comptabilite_matiere/tests/tests_tenant_routing.py` (42 tests) | ✅ (Docker + Postgres réel + provisioning live réel, après correctif ForeignKey historique §13.7.2) | Implémenté et testé |
| **(Phase 8 finalisation)** `tenant_routing` complet — Gestion-Infrastructures | `infrastructures/tests_tenant_routing.py` (42 tests) | ✅ (Docker + Postgres réel + provisioning live réel, après correctif migration §13.7.2) | Implémenté et testé |
| **(Phase 8 finalisation)** Isolation réelle bout-en-bout — Tenant A/B, 2 vrais tenants pilotes (`hopital-central`/`clinique-paix`), provisioning réel via `ProvisioningOrchestrator`, données seedées, requêtes HTTP réelles (headers Gateway simulés) | Vérification manuelle en conditions réelles — voir §13.7, pas de test automatisé dédié | ✅ (compta-financiere, ComptaMatiere, Gestion-Infrastructures — chaque tenant ne voit jamais l'enregistrement de l'autre, PK identiques dans des bases physiques distinctes) | Implémenté et vérifié |
| **(Phase 8 finalisation)** `medical_client.py` — `X-Tenant-ID` sur chemin Gateway et chemin de repli | `apps/integration/tests.py` (3 tests) | ✅ | Implémenté et testé |
| **(Phase 8 finalisation)** Kafka — `tenant_id` sur événements + `_dispatch` rétablit/nettoie le contexte | `apps/messaging/tests.py` (8 tests, sans broker réel — voir limite §13.7.4) | ✅ (unitaire, pas de preuve broker réel) | Implémenté et testé (limite documentée) |
| **(Phase 8 finalisation)** Frontend — 6 points de résolution d'URL statique corrigés | `npm run build` + `eslint` (aucun test automatisé dédié à la résolution d'URL) | ✅ (build propre, lint inchangé par rapport à l'état préexistant) | Implémenté et vérifié |

**Total tests automatisés multitenant actuels** : 96 (tenant-service) + 33 (api-gateway) + 50 (service-personnel) + 125 (Medical-Monitoring, dont 42 tenant-aware + 83 préexistants) + 12 (clinical-agent) + 104 (fultang-compta-financiere, dont ~55 tenant-aware + 49 préexistants) + 62 (ComptaMatiere, dont 42 tenant-aware + 20 préexistants) + 52 (Gestion-Infrastructures, dont 42 tenant-aware + 10 préexistants) = **534 tests**, tous verts à l'exception des échecs préexistants documentés ci-dessous (confirmés inchangés avant/après ce chantier par comparaison `git stash`), exécutés en conditions réelles partout où c'est pertinent (Docker + PostgreSQL pour les 5 services métier, provisioning réel de bout en bout pour service-personnel/Medical-Monitoring/fultang-compta-financiere/ComptaMatiere/Gestion-Infrastructures).

> **Anomalies préexistantes non liées à cette mission** (confirmées par `git stash` — mêmes échecs avant et après toute modification) :
> - Medical-Monitoring : 6 échecs (documentés Phase 8 initiale, §13).
> - `Gestion-Infrastructures` : 7 échecs (401/403, tests n'envoyant aucun header d'authentification).
> - `fultang-compta-financiere` : 38 échecs + 7 erreurs (mêmes causes : tests métier préexistants n'envoyant pas les headers `X-User-ID`/`X-User-Roles` attendus par `GatewayHeaderAuthentication`, indépendant de tout travail multitenant — vérifié par `git stash` sur l'intégralité du service : compte de tests et d'échecs strictement identiques avant/après).
> Non corrigés — hors périmètre de cette mission (ne pas réécrire des tests métier préexistants sans lien avec la tâche demandée).

---

## 17. Historique des modifications

### Phase 1 — Tenant Management (commit `ef47eb0`)

| Fichier | Modification | Raison | Impact |
|---|---|---|---|
| `tenant-service/**` (nouveau service, ~15 fichiers) | Création complète | Nouveau microservice Tenant Registry | Aucun sur l'existant (additif) |
| `api-gateway/app/config.py` | + `SERVICE_TENANT_URL` | Router vers le nouveau service | Additif |
| `api-gateway/app/main.py` | + routage `/tenants/**` | Exposer le Tenant Registry via la Gateway | Additif |
| `start_all.sh` | + démarrage `tenant-service` | Orchestration locale | Additif |

**Correction Phase 1** (rôles PLATFORM_ADMIN) : `tenant-service/tenants/permissions.py` (+`IsPlatformAdmin`), `views.py` (permission sur `TenantViewSet`), `tests.py`.

### Phase 2.1 / 2.1-correction / 2.2 — Tenant Resolution (commit `ff14848`)

| Fichier | Modification | Raison | Impact |
|---|---|---|---|
| `api-gateway/app/tenant/resolver.py` | Création (`TenantResolver`, `TenantContext`, exceptions) | Résolution hostname → tenant | Additif |
| `api-gateway/app/main.py` | + résolution dans `proxy_catch_all`, + jeton interne | Intégrer la résolution au routage | Additif, non-régressif (hostname hors convention préservé) |
| `api-gateway/app/config.py` | + `TENANT_ROOT_DOMAIN`, `TENANT_SERVICE_INTERNAL_TOKEN` | Domaine configurable + auth interne | Additif |
| `tenant-service/tenants/{serializers,views,permissions}.py` | + endpoint `resolve/`, + `IsInternalService` | Lookup public puis sécurisé par jeton interne | `resolve/` initialement `AllowAny`, corrigé en jeton interne suite à revue |
| `api-gateway/conftest.py`, `pytest.ini`, `requirements-dev.txt` | Création | Introduire pytest (absent avant) | Additif |
| `api-gateway/tests/test_tenant_resolver.py` | Création (19 tests) | Couverture du resolver | Additif |
| `docker-compose.yml` (racine + `tenant-service`) | + `TENANT_SERVICE_INTERNAL_TOKEN` | Jeton partagé dev | Additif |

### Phase 3 — Authentification Tenant-Aware (non commité au moment de la rédaction)

| Fichier | Modification | Raison | Impact |
|---|---|---|---|
| `service-personnel/api/models.py` | + `Personnel.tenant_id` (`editable=False`), `email`/`matricule` : `unique=True` → `UniqueConstraint(tenant_id, champ)` | Rattacher un compte à un tenant ; permettre le même email dans 2 tenants | **Modification de modèle métier** — migration nécessaire ; aucune donnée existante perdue (tenant_id nullable) |
| `service-personnel/api/migrations/0006_...py` | Migration générée (`makemigrations`), vérifiée `--check` | Appliquer le changement de modèle | Appliquée avec succès sur la base réelle, seed existant intact |
| `service-personnel/api/views.py` | `AuthVerifyView` filtre par `(email, tenant_id)` | Recherche utilisateur scopée par tenant | Non-régressif : `tenant_id=None` couvre l'ancien comportement |
| `api-gateway/app/main.py` | `login()` résout le tenant + transmet `tenant_id` + l'inclut dans le JWT ; `refresh_token()` le propage ; `proxy_catch_all()` compare tenant demandé/token ; refactor `_forward`/décode JWT une fois | Authentification et autorisation tenant-aware | Additif ; comportement JWT/refresh existant conservé (mêmes claims + `tenant_id`) |
| `service-personnel/api/tests.py` | + 8 tests | Couvrir le scoping tenant | Additif |
| `api-gateway/tests/test_login_tenant_context.py` | Création (10 tests) | Couvrir login/refresh/mismatch | Additif |

### Phase 4 — Propagation du contexte (cette tâche, non commitée)

| Fichier | Modification | Raison | Impact |
|---|---|---|---|
| `api-gateway/app/main.py` | + `X-Tenant-ID` dans `_build_user_headers` ; + `_strip_client_identity_headers()` appelée dans `_forward()` | Objectif de la tâche + fix sécurité découvert pendant l'audit demandé | **Fix de sécurité** : empêche désormais la falsification de `X-User-ID`/`X-User-Roles`/`X-Tenant-ID` par le client, y compris sans token — comportement antérieur (headers client non filtrés en l'absence de JWT valide) corrigé |
| `service-personnel/api/authentication.py` | `GatewayUser` + `GatewayHeaderAuthentication` lisent `X-Tenant-ID` | Représentation interne `GatewayUser(id, roles, tenant_id)` demandée | Additif, rétrocompatible (paramètre optionnel, défaut `None`) |
| `service-personnel/api/tests.py` | + 3 tests (`GatewayHeaderAuthenticationTenantTests`) | Couvrir l'extraction `X-Tenant-ID` | Additif |
| `api-gateway/tests/test_tenant_header_propagation.py` | Création (4 tests) | Couvrir propagation + anti-spoofing | Additif |
| `MULTITENANT_ARCHITECTURE.md` | Création (ce document) | Documentation de référence demandée | Aucun impact code |

### Phase 4 (finalisation) — Extension aux services métier classiques (cette tâche, non commitée)

| Fichier | Modification | Raison | Impact |
|---|---|---|---|
| `Gestion-Infrastructures/config/authentication.py` | `GatewayUser` + `GatewayHeaderAuthentication` lisent `X-Tenant-ID` | Même contexte `GatewayUser(id, roles, tenant_id)` que service-personnel | Additif, rétrocompatible (paramètre optionnel, défaut `None`) |
| `Gestion-Infrastructures/infrastructures/tests.py` | + 3 tests (`GatewayHeaderAuthenticationTenantTests`) | Couvrir l'extraction `X-Tenant-ID` | Additif |
| `ComptaMatiere/core/authentication.py` | Idem | Idem | Idem |
| `ComptaMatiere/apps/comptabilite_matiere/tests/test_gateway_authentication.py` | Création (3 tests) | Couvrir l'extraction `X-Tenant-ID` | Additif — **placé dans le package `tests/`**, pas dans `tests.py` (voir anomalie ci-dessous) |
| `fultang-compta-financiere/config/authentication.py` | Idem, **sur les deux chemins** (headers Gateway + fallback JWT décodé localement) | Idem | Idem |
| `fultang-compta-financiere/apps/caisse/tests.py` | + 4 tests (`GatewayHeaderAuthenticationTenantTests`) | Couvrir les deux chemins d'authentification | Additif |
| `MULTITENANT_ARCHITECTURE.md` | Sections 8, 13, 15, 16, 17, 19 mises à jour | Documenter la finalisation de la Phase 4 | Aucun impact code |

**Anomalie de tooling découverte et corrigée pendant cette étape** : `ComptaMatiere/apps/comptabilite_matiere/` contient à la fois un fichier `tests.py` **et** un package `tests/` (avec `__init__.py`) au même niveau. Le package masque le fichier plat pour la découverte de tests Django (`import apps.comptabilite_matiere.tests` résout vers le package). Un premier ajout dans `tests.py` était donc du code mort, jamais exécuté — détecté en vérifiant le compte de tests exécutés, corrigé en déplaçant les tests dans le package (`tests/test_gateway_authentication.py`), `tests.py` restauré à son état d'origine (stub vide).

**Fichiers volontairement NON modifiés** :

- `api-gateway/app/auth/jwt_handler.py` — mécanisme JWT générique, aucune modification nécessaire (accepte n'importe quel `dict` de claims).
- `tenant-service/config/authentication.py` — identité `PLATFORM_ADMIN`, transversale aux tenants par nature (voir [§8.4](#84-services-mis-à-jour-vs-non-mis-à-jour)).
- `Medical-Monitoring/backend/core/authentication.py`, tout `clinical-agent/` — décision architecturale explicite : rôle métier spécifique nécessitant une conception tenant dédiée, pas la même mécanique que les services CRUD classiques (analyse complète en [§13](#13-medical-monitoring--clinical-agent)).
- Tous les `ModelViewSet` métier (`MedecinViewSet`, `PersonnelViewSet`, `SalleViewSet`, etc., dans les 4 services adaptés) — aucun filtrage par tenant ajouté (isolation des données hors périmètre, voir [§3 de la tâche/Étape 3](#9-bases-de-données)).
- Aucun modèle métier, aucune migration métier, aucun queryset, aucune relation entre entités — dans les 4 services adaptés.
- Architecture des bases de données, routage dynamique — non touchés.

### Phase 5 — Tenant Database Management (cette tâche, non commitée)

| Fichier | Modification | Raison | Impact |
|---|---|---|---|
| `tenant-service/tenants/models.py` | + `PlatformService`, `PlatformServiceStatus`, `TenantDatabase`, `TenantDatabaseStatus` | Registre logique Tenant + Service → Database | Additif — `Tenant` non modifié |
| `tenant-service/tenants/migrations/0002_platformservice_tenantdatabase.py` | Migration schéma (générée, vérifiée `--check`) | Créer les tables | Additif |
| `tenant-service/tenants/migrations/0003_seed_platform_services.py` | Migration de données (`RunPython`) | Peupler le catalogue avec les 5 services déjà existants | Additif, réversible |
| `tenant-service/tenants/repositories.py` | + `PlatformServiceRepository`, `TenantDatabaseRepository` | Accès ORM, même pattern que `TenantRepository` | Additif |
| `tenant-service/tenants/services.py` | + `PlatformServiceCatalog`, `TenantDatabaseService` | Couche métier, même pattern que `TenantService` | Additif |
| `tenant-service/tenants/serializers.py` | + `PlatformServiceSerializer`, `TenantDatabaseSerializer`, `TenantDatabaseUpdateSerializer` (dédié, sans tenant/service/status), `TenantDatabaseStatusUpdateSerializer` | Exposer les modèles ; empêcher la réassignation tenant/service via l'update général | Additif |
| `tenant-service/tenants/views.py` | + `PlatformServiceViewSet`, `TenantDatabaseViewSet` | Endpoints CRUD (PLATFORM_ADMIN) | Additif — `permissions.py` réutilisé sans modification |
| `tenant-service/tenants/urls.py` | + routes `platform-services`, `tenant-databases` | Exposer les nouveaux ViewSets | Additif |
| `tenant-service/tenants/admin.py` | + `PlatformServiceAdmin`, `TenantDatabaseAdmin` | Cohérence avec `TenantAdmin` existant | Additif |
| `tenant-service/tenants/tests.py` | + 26 tests (`PlatformService*`, `TenantDatabase*`) | Couvrir tous les cas demandés (multi-service, multi-tenant, unicité, service invalide, statuts, permissions, secrets) | Additif |
| `MULTITENANT_ARCHITECTURE.md` | §2, §9, §10, §16, §17, §19 mis à jour | Documenter la Phase 5 | Aucun impact code |

**Décision de conception notable** : `status` de `TenantDatabase` vaut `PENDING` par défaut (pas `ACTIVE`) — assumé explicitement car aucune création physique de base n'a lieu dans cette phase ; marquer `ACTIVE` à la création aurait été trompeur.

**Fichiers volontairement NON modifiés (Phase 5)** :
- `Tenant` (modèle) — aucun champ `personnel_db`/`infrastructure_db`/... ajouté, exactement comme demandé.
- `permissions.py` — `IsPlatformAdmin` réutilisée telle quelle, aucun nouveau système RBAC.
- `api-gateway/app/config.py` (routing HTTP réel des services) — reste la source pour le routing Phase 6 ; `PlatformService` est un catalogue déclaratif, pas encore branché dessus.
- Aucune base PostgreSQL physique créée, aucun Docker Compose modifié pour de nouvelles bases, aucun mécanisme de Secret Manager construit.
- Tenant Resolution, JWT, Medical Monitoring, Clinical Agent — non touchés, hors périmètre explicite.

### Phase 6 — Dynamic Database Routing (cette tâche, non commitée)

#### Fichiers créés

| Fichier | Rôle |
|---|---|
| `service-personnel/api/tenant_routing/__init__.py` | Documentation du sous-package |
| `service-personnel/api/tenant_routing/context.py` | Tenant Context (`contextvars.ContextVar`), `TenantContextMissingError` |
| `service-personnel/api/tenant_routing/registry_client.py` | Appel HTTP interne vers `tenant-service` (nouvel endpoint `resolve/`) |
| `service-personnel/api/tenant_routing/cache.py` | Cache TTL du mapping tenant → base, dégradation gracieuse |
| `service-personnel/api/tenant_routing/pool_registry.py` | Enregistrement de connexion par tenant, verrouillage de création |
| `service-personnel/api/tenant_routing/router.py` | `TenantDatabaseRouter` (le `DATABASE_ROUTERS`) |
| `service-personnel/api/tenant_routing/middleware.py` | `TenantContextCleanupMiddleware` (isolation entre requêtes) |

#### Fichiers modifiés

| Fichier | Modification | Raison | Impact |
|---|---|---|---|
| `service-personnel/service_personnel/settings.py` | + `DATABASE_ROUTERS`, + `TenantContextCleanupMiddleware` (fin de `MIDDLEWARE`), + `TENANT_SERVICE_URL`/`TENANT_SERVICE_INTERNAL_TOKEN`/`TENANT_SERVICE_TIMEOUT_SECONDS`/`TENANT_DB_CACHE_TTL_SECONDS`/`TENANT_DB_CONN_MAX_AGE`/`TENANT_DB_USER`/`TENANT_DB_PASSWORD` | Activer le routing, tout configurable par environnement | Additif — `DATABASES['default']` inchangé |
| `service-personnel/api/authentication.py` | `GatewayHeaderAuthentication.authenticate()` établit le Tenant Context juste après avoir déterminé `tenant_id` | C'est le seul endroit de confiance où `tenant_id` est connu pour une requête authentifiée normale | Additif — comportement d'authentification (headers, `GatewayUser`) inchangé |
| `service-personnel/api/views.py` | `AuthVerifyView.post()` établit explicitement le Tenant Context depuis le `tenant_id` du corps de requête, avant ses requêtes ORM | `AuthVerifyView` précède toute authentification DRF (`authentication_classes = []`), `GatewayHeaderAuthentication` ne s'exécute jamais pour lui | Nécessaire pour que le login lui-même soit routé vers la bonne base — sans ce changement, Phase 6 aurait cassé le login pour tout tenant réel |
| `service-personnel/api/exceptions.py` | `fultang_exception_handler` traduit les exceptions de routage (`TenantContextMissingError`, `TenantDatabaseInactiveError`, `TenantDatabaseNotFoundError`, `TenantRegistryUnavailableError`) en 503 explicite | Éviter un 500 générique exposant `str(exc)` ; réponse uniforme pour toutes les vues, pas seulement `AuthVerifyView` | Additif — le comportement pour les autres exceptions (404/400/403/500) est inchangé |
| `service-personnel/api/tests.py` | `_create_medecin` utilise `.using('default')` ; `AuthVerifyTenantScopingTests` neutralise `ensure_connection_alias` (→ `'default'`) en `setUp` ; + ~35 nouveaux tests Phase 6 | Les tests Phase 3/4/5 utilisent des `tenant_id` aléatoires non enregistrés dans le vrai Tenant Registry — les faire passer par le VRAI routing les casserait (appel réseau vers un tenant inexistant) alors qu'ils testent le filtrage par colonne, pas le routing physique | **Nécessaire pour la non-régression** — décision documentée en §9.2.3 et dans les docstrings des tests concernés |
| `tenant-service/tenants/views.py` | + action `resolve` sur `TenantDatabaseViewSet` (`GET /api/tenant-databases/resolve/`), réutilise `TenantDatabaseService.get_for_tenant_and_service` (Phase 5, jusqu'ici jamais exposé en HTTP) | Permettre à `service-personnel` (et tout futur service adaptant ce mécanisme) de résoudre sa base sans dupliquer la logique du Registry | Additif — CRUD `TenantDatabase`/`PlatformService` inchangé |
| `tenant-service/tenants/serializers.py` | + `TenantDatabaseResolutionSerializer` (database_name/host/port/status uniquement) | Réponse minimale pour `resolve/`, jamais `secret_reference` | Additif |
| `tenant-service/tenants/tests.py` | + 7 tests (`TenantDatabaseResolveEndpointTests`) | Couvrir permissions et cas d'erreur du nouvel endpoint | Additif |
| `MULTITENANT_ARCHITECTURE.md` | §2, §9 (+ §9.2 complet), §15, §16, §17, §19 mis à jour | Documenter la Phase 6 | Aucun impact code |

**Fichiers volontairement NON modifiés (Phase 6)** :
- `Tenant`, `TenantDatabase`, `PlatformService` (modèles Phase 1/5) — aucun champ ajouté, la Phase 6 consomme le registre existant sans le modifier.
- Les 3 autres services adaptés en Phase 4 (Gestion-Infrastructures, ComptaMatiere, fultang-compta-financiere) — aucun router, aucune base séparée pour eux dans cette phase (décision de périmètre explicite, l'objectif de la tâche était `service-personnel`).
- `Medical-Monitoring`, `clinical-agent`, `api-gateway/app/main.py` (JWT, Tenant Resolution) — non touchés, hors périmètre explicite de la tâche.
- Modèles métier (`Medecin`, `Personnel`, etc.) — aucun `tenant_id` supplémentaire ajouté, aucune relation modifiée.
- `docker-compose.yml` — aucune nouvelle base déclarée en Docker Compose ; les 2 bases pilotes sont créées manuellement (`CREATE DATABASE`) sur le serveur PostgreSQL déjà existant, pas via un nouveau service Compose (le provisioning automatisé appartient à la Phase 7).

### Phase 7 — Tenant Provisioning (cette tâche, non commitée)

#### Fichiers créés

| Fichier | Rôle |
|---|---|
| `tenant-service/tenants/provisioning.py` | `ProvisioningOrchestrator` — orchestration complète (validation, idempotence, CAS de concurrence, dispatch physique/déclaratif) |
| `service-personnel/api/permissions.py` | `IsInternalService` — symétrique de celle de tenant-service, pour l'endpoint interne de provisioning |

#### Fichiers modifiés

| Fichier | Modification | Raison | Impact |
|---|---|---|---|
| `tenant-service/tenants/models.py` | `TenantDatabaseStatus` : + `PROVISIONING`, + `FAILED` ; `TenantDatabase` : + `last_error` (CharField) | Cycle de vie du provisioning (§9 de la tâche) — réutilise le champ `status` existant plutôt que d'introduire un second système d'état sur `Tenant` (règle explicite de la tâche) | Migration nécessaire (voir ci-dessous) ; aucune donnée existante perdue (`FAILED`/`PROVISIONING` sont de nouvelles valeurs de choix, `last_error` a un défaut `''`) |
| `tenant-service/tenants/repositories.py` | `TenantDatabaseRepository` : + `get_or_create_declarative` (idempotence via `IntegrityError`), + `claim_for_provisioning` (CAS atomique), + `mark_active`, + `mark_failed` | Concurrence et idempotence portées par PostgreSQL (contrainte d'unicité + `UPDATE ... WHERE`), pas par un verrou applicatif (§8 de la tâche — explicitement plus robuste que le `threading.Lock()` de la Phase 6 face à un futur déploiement multi-instance) | Additif — méthodes existantes (`create`, `update_status`, etc.) inchangées, toujours utilisées par l'API Phase 5 |
| `tenant-service/tenants/serializers.py` | + `TenantProvisionRequestSerializer` (validation de forme du payload `{"services": [...]}`) | Payload du nouvel endpoint | Additif |
| `tenant-service/tenants/views.py` | `TenantViewSet` : + action `provision` (`POST /tenants/{id}/provision/`) | Point d'entrée HTTP du provisioning, réservé `PLATFORM_ADMIN` (permission de classe déjà en place, aucune nouvelle permission créée côté tenant-service) | Additif — CRUD `Tenant` existant inchangé |
| `tenant-service/config/settings.py` | + `PROVISIONING_SERVICE_PERSONNEL_URL`, + `PROVISIONING_TIMEOUT_SECONDS` | URL/timeout du seul service physiquement provisionnable dans cette phase, configurables par environnement (pas de valeur figée en dur) | Additif |
| `service-personnel/api/tenant_routing/pool_registry.py` | + `provision_database()`, + `_create_database_if_missing()`, + `_admin_connection_params()`, + `DatabaseProvisioningError` | Création physique réelle (`CREATE DATABASE` via psycopg2 admin, autocommit) + migration (`migrate api`), réutilisant `_alias_for`/`_build_connection_settings` de la Phase 6 sans les dupliquer | Additif — `ensure_connection_alias` (chemin de requête ordinaire, Phase 6) totalement inchangé ; `provision_database` est un chemin séparé, appelé uniquement par le nouvel endpoint interne |
| `service-personnel/api/views.py` | + `ProvisionDatabaseView` (`POST /api/internal/provision-database/`) | Endpoint interne symétrique, appelé par tenant-service | Additif — aucune vue existante modifiée |
| `service-personnel/api/urls.py` | + route `internal/provision-database/` | Exposer la nouvelle vue | Additif |
| `service-personnel/service_personnel/settings.py` | *(aucune modification — `TENANT_DB_USER`/`PASSWORD`/`DATABASES['default']` déjà présents depuis la Phase 6, réutilisés tels quels pour la connexion admin)* | — | — |
| `tenant-service/tenants/tests.py` | + `DeterministicDatabaseNamingTests` (4), + `ProvisioningOrchestratorTests` (11), + `TenantProvisionEndpointTests` (7) | Couvrir génération de nom, orchestration, endpoint HTTP | Additif |
| `service-personnel/api/tests.py` | + `IsInternalServicePermissionTests` (4), + `ProvisionDatabaseEndpointTests` (5), + `DatabaseProvisioningUnitTests` (4) | Couvrir permission, endpoint, création physique/nettoyage | Additif |
| `MULTITENANT_ARCHITECTURE.md` | §2, §10 (nouveau §10.2 complet), §15, §16, §17, §19 mis à jour | Documenter la Phase 7 | Aucun impact code |

#### Migrations

| Migration | Contenu |
|---|---|
| `tenant-service/tenants/migrations/0004_tenantdatabase_last_error_and_more.py` | `AddField(last_error)` + `AlterField(status, choices=...)` — générée par `makemigrations`, appliquée sur `tenant_registry_db` réel sans perte de données (vérifié : les 2 `TenantDatabase` existants de la Phase 6 restent `ACTIVE`, `last_error` vide par défaut) |

Aucune migration côté `service-personnel` : `provision_database` réutilise le mécanisme de migration PAR TENANT déjà existant (Phase 6, `migrate api --database=<alias>`), il n'ajoute aucun modèle ni champ à `service-personnel` lui-même.

#### Variables d'environnement ajoutées

| Variable | Service | Défaut | Rôle |
|---|---|---|---|
| `PROVISIONING_SERVICE_PERSONNEL_URL` | tenant-service | `http://fultang-personnel:8000` | URL du service PERSONNEL pour l'appel physique de provisioning |
| `PROVISIONING_TIMEOUT_SECONDS` | tenant-service | `30` | Timeout de l'appel physique (plus long que `TENANT_SERVICE_TIMEOUT_SECONDS`/5s de la Phase 6 : `CREATE DATABASE` + `migrate` prennent plus de temps qu'une simple résolution) |

**Fichiers volontairement NON modifiés (Phase 7)** :
- `Tenant` (modèle) — aucun champ de statut de provisioning ajouté ici (règle explicite de la tâche : réutiliser `TenantDatabase.status`, pas créer un second système d'état).
- `PlatformService` — catalogue consommé tel quel (existence + statut ACTIVE vérifiés), jamais modifié par le provisioning.
- Le Database Router (Phase 6, `router.py`) et `ensure_connection_alias` — le provisioning les laisse totalement intacts ; il PRODUIT une configuration qu'ils savent déjà consommer, sans qu'aucune ligne de leur code n'ait dû changer (vérifié par la validation pilote avec un processus `service-personnel` redémarré, §10.2.10).
- Gestion-Infrastructures, ComptaMatiere, fultang-compta-financiere, Medical-Monitoring, clinical-agent — aucun fichier touché ; provisioning physique non câblé pour eux dans cette phase (décision de périmètre, §10.2.2).
- `docker-compose.yml` (racine) — aucune modification : les nouveaux réglages (`PROVISIONING_SERVICE_PERSONNEL_URL`, `PROVISIONING_TIMEOUT_SECONDS`) utilisent leurs valeurs par défaut (le conteneur `tenant-service` atteint déjà `fultang-personnel` sur le réseau Docker partagé, sans variable d'environnement supplémentaire nécessaire).
- Aucun modèle métier (`Medecin`, `Personnel`, etc.), aucune donnée métier créée par le provisioning — seule une base VIDE (schéma seul) est produite (§10.1 : pas de "configuration initiale" inventée).

### Phase 8 — Medical Monitoring tenant-aware / Clinical Agent tenant-aware / `allow_clinical_agent_export` (cette tâche, non commitée)

#### Fichiers créés

| Fichier | Rôle |
|---|---|
| `Medical-Monitoring/backend/core/tenant_routing/{__init__,context,middleware,registry_client,cache,pool_registry,router}.py` | Équivalent Medical-Monitoring de `api/tenant_routing/` (service-personnel) — voir §13.1 pour les différences (3 apps tenant-scopées, migration sans app_label) |
| `Medical-Monitoring/backend/core/permissions.py` | `IsInternalService`, symétrique |
| `Medical-Monitoring/backend/core/views.py` | `ProvisionDatabaseView` (`POST /api/medical-monitoring/internal/provision-database/`) |
| `Medical-Monitoring/backend/core/tests_tenant_routing.py` | 42 tests (Tenant Context, Cache, Pool Registry, Router, Authentication, Provisioning) |
| `Medical-Monitoring/backend/medical_workflow/management/commands/seed_tenant_demo.py` | Seed reproductible : patient + visite TERMINE pour un tenant réel |
| `service-personnel/service_personnel/api/management/commands/seed_tenant_demo.py` | Seed reproductible : médecin/infirmière/réceptionniste pour un tenant réel |
| `tenant-service/tenants/migrations/0007_tenant_allow_clinical_agent_export.py` | Migration du nouveau champ |
| `clinical-agent/registry_client.py` | Client Tenant Registry (résolution base MEDICAL, config tenant, énumération active) |
| `clinical-agent/engine_registry.py` | Moteur SQLAlchemy par tenant, mis en cache, verrouillé |
| `clinical-agent/test_tenant_routing.py` | 12 tests unitaires (`unittest`, sans nouvelle dépendance) |

#### Fichiers modifiés

| Fichier | Modification | Raison | Impact |
|---|---|---|---|
| `tenant-service/tenants/models.py` | `Tenant.allow_clinical_agent_export` (BooleanField, défaut `True`) | §6 de la tâche | Additif, migration non destructive |
| `tenant-service/tenants/{serializers,services,repositories,views}.py` | Exposition du champ (création/`PATCH`/`resolve`), `TenantViewSet` gagne `UpdateModelMixin`, `resolve` accepte `?id=`, nouvelle action `resolve-active` sur `TenantDatabaseViewSet` | Rendre le champ réellement utilisable par l'API (§6 : "ne te contente pas d'ajouter le champ au modèle") + résolution/énumération nécessaires à Clinical Agent | Additif — CRUD existant inchangé |
| `tenant-service/tenants/provisioning.py` | `PROVISIONING_CAPABLE_SERVICES["MEDICAL"]` ajouté ; **correction d'un bug réel** : l'URL de callback supposait à tort un préfixe `/api/` uniforme entre services — Medical-Monitoring expose ses endpoints sous `/api/medical-monitoring/`, pas `/api/` (découvert par un vrai `404` pendant la validation pilote, jamais par relecture) | Extension du mécanisme Phase 7 existant à Medical-Monitoring, réutilisé sans réécriture | Le dict stocke désormais l'URL de base COMPLÈTE de l'API interne de chaque service, pas seulement son host racine — `PERSONNEL` continue de fonctionner (son préfixe `/api` est resté correct) |
| `tenant-service/config/settings.py` | `PROVISIONING_SERVICE_MEDICAL_URL` | Symétrique de `PROVISIONING_SERVICE_PERSONNEL_URL` | Additif |
| `Medical-Monitoring/backend/core/settings.py` | `DATABASE_ROUTERS`, middleware, variables `TENANT_SERVICE_*`/`TENANT_DB_*` | Activer le routage tenant-aware | Additif — `DATABASES['default']` inchangé |
| `Medical-Monitoring/backend/core/authentication.py` | `GatewayHeaderAuthentication` lit `X-Tenant-ID`, établit le Tenant Context | Même patron que service-personnel | Additif — comportement d'authentification existant inchangé |
| `Medical-Monitoring/backend/core/urls.py` | + route interne de provisioning | Exposer `ProvisionDatabaseView` | Additif |
| `Medical-Monitoring/backend/medical_workflow/signals.py` | Capture explicite du tenant AVANT `thread.start()`, transmission via `X-Tenant-ID` + jeton interne, refus d'envoi si aucun tenant réel | Corriger le problème contextvars/thread identifié à l'audit (§5 de la tâche) | **Comportement changé** : une visite TERMINE sans tenant réel (contexte absent ou pool non assigné) n'est plus jamais envoyée à Clinical Agent — avant cette phase, l'envoi partait sans savoir à qui appartenait la donnée |
| `Medical-Monitoring/docker-compose.yml` | `.env` créé depuis `.env.example` (`DB_HOST` corrigé : `db`→`medical-db`, désynchronisé du compose actuel) | Débloquer le démarrage du service en dev (jamais démarré dans cet environnement avant) | Correction d'un défaut de configuration préexistant, sans rapport avec le multitenant |
| `clinical-agent/models.py` | `CasClinique`/`VisiteSynced` : + `tenant_id` (NOT NULL, indexé), contraintes d'unicité recomposées `(id_source, tenant_id)` | Raison technique démontrée : buffer partagé, autorisation d'export par tenant (§9 de la tâche) | Tables `cas_cliniques`/`visites_synced` **vidées** (16+26 lignes, données pré-multitenant sans tenant possible — décision validée explicitement, voir §13.3.1) |
| `clinical-agent/database.py` | `MAIN_DB_URL`/`MainSession` supprimés, `get_main_session_for_tenant(tenant_id)` | Il n'existe plus "une" base principale | `TamponSession` (buffer partagé) inchangé |
| `clinical-agent/sync.py` | `sync_visite`/`sync_all_completed_visits` prennent `tenant_id`, toutes les requêtes buffer scopées | Isolation du buffer par tenant | Signature de fonction changée (appelants mis à jour dans le même chantier) |
| `clinical-agent/main.py` | `/sync/visite/{id}`/`/sync/all` exigent `X-Tenant-ID` + jeton interne, vérifient `allow_clinical_agent_export` AVANT lecture ; `sync_all_known_tenants()` (énumération explicite, usage interne) remplace le rattrapage global implicite ; `/health` vérifie le Tenant Registry au lieu d'"une" base principale | §7/§8/§10 de la tâche | **Comportement changé** : ces endpoints, auparavant ouverts sans authentification, refusent désormais tout appel non authentifié/sans tenant/tenant sans autorisation d'export |
| `docker-compose.yml` (racine) | `clinical-agent` : `TENANT_SERVICE_URL`/`TENANT_SERVICE_INTERNAL_TOKEN`/`TENANT_DB_USER`/`TENANT_DB_PASSWORD` ajoutés, `MAIN_DB_URL` retiré (obsolète), commande surchargée en HTTP simple (voir §13.5), `FULTANG_RATE_LIMIT_*` avec défaut `:-` | Nécessaire au fonctionnement + correction de défauts préexistants qui empêchaient totalement le démarrage | `MAIN_DB_URL` n'est plus lu par aucun code — suppression sûre |
| Frontend : `axiosInstance.js`, `axiosInstanceAccountant.js`, `axiosInstanceCompta.js` | `baseURL` résolu dynamiquement via `getGatewayBaseUrl()` au lieu d'une variable d'environnement figée | §14 de la tâche — sans cela, tous les appels Doctor/Nurse/Patient/Pharmacist/Laboratory/Cashier/Accountant partaient vers un hostname fixe quel que soit le tenant ouvert dans le navigateur | Correction directe d'un bug déjà présent avant cette phase (jamais remarqué faute de test multi-tenant réel) |

#### Migrations

| Migration | Contenu |
|---|---|
| `tenant-service/tenants/migrations/0007_tenant_allow_clinical_agent_export.py` | `AddField(allow_clinical_agent_export, default=True)` — appliquée sans perte de données, tous les tenants existants conservent le comportement d'export actuel |

Côté Medical-Monitoring : aucune migration de schéma Django nécessaire (le routage réutilise les migrations existantes de `patient`/`medical_workflow`/`patient_informations`, appliquées telles quelles sur chaque nouvelle base tenant). Côté Clinical Agent (SQLAlchemy, pas de framework de migration) : les tables `cas_cliniques`/`visites_synced` ont été recréées avec le nouveau schéma (voir §13.3.1 pour la justification et la décision validée par l'utilisateur).

**Fichiers volontairement NON modifiés (Phase 8)** :
- `Patient`, `Visite`, `Consultation`, `Examen`, `MedicamentPrescrit`, etc. (modèles métier Medical-Monitoring) — aucun `tenant_id` ajouté, l'isolation vient de la base physique.
- `clinical-agent/main.py::verify_api_key` / le mécanisme `X-API-Key` de `/export` — revérifié, déjà correct (sha256 + `hmac.compare_digest`), conservé sans modification.
- `ComptaMatiere`, `Gestion-Infrastructures` — non tenant-aware, décision de périmètre explicite (voir §13.6).
- `fultang-compta-financiere/apps/integration/medical_client.py` — aucune modification nécessaire : le chemin Gateway hérite automatiquement du tenant-awareness de Medical-Monitoring, le chemin de repli direct échouait déjà avant cette phase et continue d'échouer explicitement (voir §13.6).
- La base propre de `fultang-compta-financiere` (caisse, comptabilité) — **non isolée**, décision de ne pas élargir le périmètre à une refonte complète de ce service (voir §13.6, §19).

### Phase 8 (finalisation) — fultang-compta-financiere / ComptaMatiere / Gestion-Infrastructures tenant-aware (cette mission, non commitée)

**Mandat** : finaliser la fondation multi-tenant sur l'ensemble du périmètre fonctionnel de FullTang (pas seulement les services déjà traités), avant de commencer la couche de configuration des établissements (Phase 9, non commencée). Audit global préalable (aucune modification pendant l'audit), puis implémentation, tests d'isolation réels, documentation — voir §13.7 pour le détail technique complet.

| Fichier | Modification | Raison | Impact |
|---|---|---|---|
| `tenant-service/config/settings.py` | + `PROVISIONING_SERVICE_COMPTA_URL`/`_COMPTA_MATIERE_URL`/`_INFRASTRUCTURE_URL` | Symétrique de `PROVISIONING_SERVICE_PERSONNEL_URL`/`_MEDICAL_URL` | Additif |
| `tenant-service/tenants/provisioning.py` | `PROVISIONING_CAPABLE_SERVICES` étendu à `COMPTA`/`COMPTA_MATIERE`/`INFRASTRUCTURE`, chacun avec son propre préfixe d'URL interne | Étendre le mécanisme Phase 7 aux 3 derniers services métier persistants | Additif — `PERSONNEL`/`MEDICAL` inchangés |
| `tenant-service/tenants/tests.py` | 2 tests adaptés (`test_non_capable_service_is_skipped_and_creates_no_row`, `test_multiple_services_are_independent` utilisent désormais un code de service synthétique pour exercer le chemin `SKIPPED`, tous les codes réels étant désormais capables) + 3 nouvelles assertions de préfixe d'URL | Les 5 services du catalogue sont maintenant TOUS provisioning-capable — plus aucun code réel disponible pour tester le chemin `SKIPPED` | Aucune régression, 96/96 tests toujours verts |
| `fultang-compta-financiere/config/tenant_routing/**` (nouveau, 7 fichiers), `permissions.py`, `views.py` | Portage à l'identique de service-personnel/Medical-Monitoring, `SERVICE_CODE="COMPTA"` | Voir §13.7.1 | Additif |
| `fultang-compta-financiere/config/{authentication,settings,urls}.py` | `set_tenant_context()`, `DATABASE_ROUTERS`, middleware, variables `TENANT_SERVICE_*`/`TENANT_DB_*`, route de provisioning interne | Activer le routage tenant-aware | Additif — `DATABASES['default']` inchangé |
| `fultang-compta-financiere/apps/caisse/migrations/0002_quittance_est_validee_patient_id.py` | `.using(schema_editor.connection.alias)` sur la requête `RunPython` | Corriger un bug de migration révélé par le rejeu sur base tenant fraîche (§13.7.2) | Comportement identique sur `default` (déjà appliquée) |
| `fultang-compta-financiere/apps/comptabilite/management/commands/seed_initial.py` | `set_tenant_context(None)` explicite en début de commande | Idem — commande exécutée au démarrage du conteneur, hors cycle de requête HTTP | Comportement de seed inchangé (pool non assigné) |
| `fultang-compta-financiere/apps/integration/medical_client.py` | `_get()` transmet `X-Tenant-ID` sur les deux chemins (Gateway + repli direct) | §13.7.3 — ne jamais perdre le tenant silencieusement | Chemin Gateway déjà correct par héritage ; chemin de repli continue d'échouer (401, préexistant) mais ne perdrait plus le contexte s'il réussissait |
| `fultang-compta-financiere/apps/messaging/events.py`, `kafka_consumer.py`, vues `caisse`/`sorties` publiant des événements | `tenant_id` ajouté aux 3 dataclasses d'événements, peuplé à la publication, rétabli/nettoyé dans `_dispatch()` | §13.7.4 — même correctif que le signal `Visite` (Phase 8 initiale), appliqué à Kafka | Kafka non démarré dans cet environnement — vérifié uniquement en appelant `_dispatch()` directement (limite documentée) |
| `fultang-compta-financiere/apps/{caisse,comptabilite,sorties,messaging,integration}/tests*.py` | Nouveaux tests tenant-routing + `medical_client`/Kafka + `setUpModule`/`tearDownModule` (`set_tenant_context(None)`) dans `apps/comptabilite/tests.py`/`tests_scenarios.py`/`apps/sorties/tests.py` | Les tests métier préexistants créent des objets ORM directement en `setUp()`, hors cycle de requête — nécessitent un Tenant Context explicite pour ne pas lever `TenantContextMissingError` une fois le router actif | Additif, aucune régression (104 tests, 38 échecs + 7 erreurs = strictement identique au preexistant, confirmé par `git stash`) |
| `fultang-compta-financiere/docker-compose.yml` | + `TENANT_SERVICE_URL`/`TENANT_SERVICE_INTERNAL_TOKEN`/`TENANT_DB_USER`/`TENANT_DB_PASSWORD` | Nécessaire au fonctionnement | Additif |
| `ComptaMatiere/core/tenant_routing/**` (nouveau), `permissions.py`, `views.py`, `test_runner.py` (nouveau) | Portage identique, `SERVICE_CODE="COMPTA_MATIERE"` ; `TenantAwareTestRunner` (`set_tenant_context(None)` avant `setup_databases()`, car une migration de données préexistante s'exécute aussi lors de la création de la base de test) | Voir §13.7.1 | Additif |
| `ComptaMatiere/core/{authentication,settings,urls}.py` | Idem fultang-compta-financiere | Idem | Additif |
| `ComptaMatiere/apps/comptabilite_matiere/migrations/0001_initial.py`, `0003_livraison_sortie.py`, `0005_rapport_id_personnel.py`, `0006_rapport_code_rapport_rapport_date_envoi_and_more.py` | `ForeignKey(to=settings.AUTH_USER_MODEL)` remplacée par `CharField(max_length=36)` sur 6 champs historiques (`idPersonnel_emetteur`, `idPersonnel`, `id_personnel`, `destinataire`, `expediteur`, `responsable`) ; `swappable_dependency(AUTH_USER_MODEL)` retirée | **Bug bloquant découvert en testant un provisioning réel** (§13.7.2) — le modèle actuel n'a jamais eu ces FK (déjà retirées par une migration ultérieure, `0011`), mais les migrations historiques les recréaient à chaque rejeu, échouant sur une base tenant fraîche où `auth_user` n'existe jamais | **Aucun impact sur `default`** (migrations déjà appliquées, jamais rejouées) ; `makemigrations --check` → "No changes detected" après correction |
| `ComptaMatiere/apps/comptabilite_matiere/management/commands/seed_tenant_demo.py` (nouveau) | Commande de seed démo tenant-scopée (`Materiel`) | Reproductibilité pour les tests d'isolation | Additif |
| `ComptaMatiere/docker-compose.yml` | + variables `TENANT_*` | Nécessaire au fonctionnement | Additif |
| `Gestion-Infrastructures/config/tenant_routing/**` (nouveau), `permissions.py`, `views.py` | Portage identique, `SERVICE_CODE="INFRASTRUCTURE"` | Voir §13.7.1 | Additif |
| `Gestion-Infrastructures/config/{authentication,settings,urls}.py` | Idem | Idem | Additif |
| `Gestion-Infrastructures/infrastructures/migrations/0004_seed_types_salle.py` | `.using(schema_editor.connection.alias)` sur la requête `RunPython` | Même classe de bug que fultang-compta-financiere (§13.7.2) | Aucun impact sur `default` |
| `Gestion-Infrastructures/infrastructures/management/commands/seed_tenant_demo.py` (nouveau) | Commande de seed démo tenant-scopée (Bâtiment/Étage/Salle) | Reproductibilité pour les tests d'isolation | Additif |
| `Gestion-Infrastructures/docker-compose.yml` | + variables `TENANT_*` (style liste, cohérent avec le fichier existant) | Nécessaire au fonctionnement | Additif |
| Frontend : `medecinsApi.js`, `chambresApi.js`, `comptabiliteMatiereApi.js`, `ForgottenPassword.jsx`, `ViewPatientDetailsModal.jsx`, `Provider.jsx` | `baseURL`/URL résolue via `getGatewayBaseUrl()` au lieu d'un env var statique/`localhost` en dur | §13.7.5 — 6 points supplémentaires trouvés par audit exhaustif, au-delà des 3 déjà corrigés précédemment | Correction directe de bugs préexistants ; `Provider.jsx::getCurrentUserInfos` est du code mort (jamais appelé), corrigé par cohérence sans impact fonctionnel |

**Fichiers volontairement NON modifiés (Phase 8 finalisation)** :
- Tout modèle métier des 3 services (`Fournisseur`, `Materiel`, `Salle`, etc.) — aucun `tenant_id` ajouté, l'isolation vient de la base physique.
- `api-gateway` — déjà correct (garde anti-mismatch hostname/JWT testée, `X-Tenant-ID` toujours dérivé serveur-side, jamais du client) ; ComptaMatiere/Gestion-Infrastructures/compta-financiere étaient déjà routés. Aucune modification nécessaire.
- Clinical Agent — exception architecturale déjà correcte (Phase 8 initiale), non retouché.
- Le producteur Kafka `patient.cree` — non inventé, aucun service ne le produit dans le dépôt actuel.
- `seed_data.py`/`seed_admin_only.py`/`apply_seed.sh`/`flush_and_seed_admin.sh`/`reset_and_seed.sh`/`start_all.sh` — scripts de développement historiques opérant sur le pool non assigné (`default`), laissés tels quels ; les nouvelles commandes `seed_tenant_demo` (par service) sont le mécanisme dédié aux tenants réels.

---

## 18. Ce qui a été conservé

Explicitement, sans modification de mécanisme :

- **Gestion des JWT** : HS256, `python-jose`, `jwt_handler.py` inchangé — seul le contenu des claims (`tenant_id`) a été enrichi, jamais le mécanisme de signature/validation.
- **Refresh token** : durée de vie, structure, logique de renouvellement — inchangés, uniquement enrichis du claim `tenant_id`.
- **`TenantResolver`** existant (Phase 2) — réutilisé tel quel dans `login()`, aucune logique de résolution dupliquée ou réécrite.
- **`GatewayHeaderAuthentication`** — le principe (headers non signés, confiance en la Gateway) est conservé ; seule son extension à `tenant_id` a été ajoutée, service par service.
- **Architecture des services** — aucun microservice fusionné, séparé ou renommé.
- **Communication service-to-service directe** — décision explicitement maintenue (voir [§12](#12-service-to-service)).
- **Routage des bases des 3 autres services adaptés en Phase 4** (Gestion-Infrastructures, ComptaMatiere, fultang-compta-financiere) — **mis à jour en Phase 8 (finalisation)** : ces 3 services ont désormais le Dynamic Database Router, comme service-personnel (Phase 6) et Medical-Monitoring (Phase 8 initiale). Voir §13.7.
- **`Medical-Monitoring` et `clinical-agent`** — code, flux de synchronisation (signal Django → HTTP direct → base tampon → export), et mécanisme d'autorisation (`X-API-Key` unique) laissés tels quels ; seule une analyse a été produite ([§13](#13-medical-monitoring--clinical-agent)), aucune ligne de code modifiée.
- **Modèles métier, migrations métier, querysets, ViewSets** des 4 services adaptés — aucun filtrage ni champ ajouté au-delà de la classe d'authentification (Phase 4) / du Database Router (Phase 6, `service-personnel` uniquement).
- **`TenantDatabase`/`PlatformService`** (Phase 5) — consommés tels quels par le Dynamic Database Router (Phase 6), aucun champ ajouté.
- **Tests Phase 3/4/5 de `service-personnel`** — tous continuent de passer sans modification de leur intention (adaptation technique documentée en §9.2.3, pas de réécriture de ce qu'ils vérifient).
- **Database Router et `ensure_connection_alias`** (Phase 6) — **zéro ligne modifiée** par la Phase 7 ; le provisioning produit une configuration que ce mécanisme consomme sans le savoir, vérifié avec un processus `service-personnel` redémarré entre le provisioning et la première requête (§10.2.10).
- **`TenantDatabase`/`PlatformService`** (Phase 5) — toujours aucun champ ajouté par la Phase 7 au-delà de `last_error` (texte d'erreur, pas une donnée métier) ; le modèle `Tenant` reste totalement inchangé.
- **Tests Phase 1 à 6** — tous continuent de passer sans modification (169/169 tests multitenant verts après la Phase 7, voir [§16](#16-tests-et-validation)).

---

## 19. Ce qui reste à faire

```
FAIT
├── Tenant Management ................................ partiellement implémenté (CRUD + auth, pas de config/suppression)
├── Tenant Identification ............................. implémenté et testé
├── Tenant Resolution ................................. implémenté et testé
├── Authentification tenant-aware ..................... implémenté et testé
├── tenant_id dans le JWT .............................. implémenté et testé
├── Contrôle tenant demandé / tenant du token ......... implémenté et testé
├── Propagation du contexte (X-Tenant-ID) ............. Phase 4 CLÔTURÉE pour les services métier
│                                                         classiques (service-personnel, Gestion-
│                                                         Infrastructures, ComptaMatiere, fultang-
│                                                         compta-financiere) — 4/4 implémentés et testés.
│                                                         Medical Monitoring / Clinical Agent
│                                                         délibérément exclus (conception dédiée requise,
│                                                         voir §13) — pas un manque, une décision.
├── Tenant Database Management (registre logique) ..... Phase 5 CLÔTURÉE : catalogue PlatformService +
│                                                         association TenantDatabase (Tenant + Service →
│                                                         Database), contraintes d'unicité, permissions
│                                                         PLATFORM_ADMIN, 26 tests. Purement déclaratif —
│                                                         aucune base physique créée, aucun routage.
├── Dynamic Database Routing (Phase 6) ................. CLÔTURÉE pour les 5 services métier persistants :
│                                                         service-personnel (Phase 6), Medical-Monitoring
│                                                         (Phase 8 initiale), fultang-compta-financiere/
│                                                         ComptaMatiere/Gestion-Infrastructures (Phase 8
│                                                         finalisation, voir §13.7). Tenant Context
│                                                         (contextvars), cache TTL, verrouillage de création
│                                                         de pool, Database Router — isolation vérifiée avec
│                                                         de vraies bases PostgreSQL séparées pour chacun.
├── Tenant Provisioning (Phase 7) ...................... CLÔTURÉE pour les 5 services métier persistants :
│                                                          création physique réelle de base (psycopg2,
│                                                          idempotente) + migration automatisées via
│                                                          POST /tenants/{id}/provision/, concurrence par CAS
│                                                          PostgreSQL (pas de verrou applicatif), échec →
│                                                          FAILED + retry (pas de rollback destructif).
│                                                          INFRASTRUCTURE/COMPTA/COMPTA_MATIERE rejoignent
│                                                          PERSONNEL/MEDICAL dans PROVISIONING_CAPABLE_SERVICES
│                                                          en Phase 8 finalisation. Provisioning de comptes
│                                                          utilisateurs toujours hors périmètre (§10.1).
├── Medical Monitoring / Clinical Agent tenant-aware ... CLÔTURÉE : Medical-Monitoring adopte le patron
│                                                         Database-per-Tenant (3 apps métier, migration
│                                                         multi-app sans app_label en dur) ; signal Visite
│                                                         corrigé (capture tenant AVANT thread, transmission
│                                                         explicite) ; Clinical Agent résout un moteur
│                                                         SQLAlchemy par tenant, exige authentification interne
│                                                         + tenant sur /sync/*, applique
│                                                         allow_clinical_agent_export AVANT toute lecture ;
│                                                         buffer d'export scopé par tenant_id (raison technique
│                                                         démontrée, seule exception à "pas de tenant_id
│                                                         partout"). Isolation vérifiée en conditions réelles :
│                                                         2 tenants, patients/visites distincts, export
│                                                         autorisé/refusé/inversé dans les deux sens, buffer
│                                                         jamais mélangé.
└── Phase 8 (finalisation) — fultang-compta-financiere / ComptaMatiere / Gestion-Infrastructures
                                                          tenant-aware ... CLÔTURÉE : les 3 derniers services
                                                          métier persistants adoptent le même patron
                                                          Database-per-Tenant. 3 bugs de migration préexistants
                                                          révélés par le rejeu sur base fraîche, corrigés
                                                          (dont une ForeignKey historique vers auth_user dans
                                                          ComptaMatiere, la plus significative). medical_client.py
                                                          transmet désormais X-Tenant-ID sur son chemin de repli ;
                                                          Kafka (non démarré ici) propage tenant_id de bout en
                                                          bout dans son producteur/consommateur. 6 points d'URL
                                                          statique corrigés côté frontend (au-delà des 3 déjà
                                                          traités). Isolation vérifiée en conditions réelles :
                                                          2 tenants pilotes, provisioning réel via
                                                          ProvisioningOrchestrator, requêtes HTTP réelles —
                                                          chaque tenant ne voit jamais l'enregistrement de
                                                          l'autre, y compris avec des PK identiques dans des
                                                          bases physiques distinctes.
├── Configuration des tenants — cycle de vie et services (§14, Phases 9/2/3 de ce chantier) ... CLÔTURÉE :
│                                                         compte admin réel, URL fonctionnelle, activation/
│                                                         désactivation de service RÉELLEMENT appliquée côté
│                                                         backend (jamais seulement l'IHM), journalisation
│                                                         (§14.9) ; suspension de tenant vérifiée à CHAQUE
│                                                         requête (pas seulement à la résolution hostname —
│                                                         faille corrigée en §14.10), désactivation de service
│                                                         → 404 immédiat (invalidation active du cache, plus
│                                                         d'attente du TTL), double confirmation sur les actions
│                                                         critiques, écrans dédiés frontend (§14.10).
│
À FAIRE
├── Verrou de création de pool distribué (si passage à plusieurs instances par service — même limite
│    pour l'invalidation active du cache FunctionalService introduite en §14.10 : mono-instance)
├── Reprise automatique d'un provisioning bloqué en PROVISIONING (processus crashé après création physique
│    réussie mais avant confirmation) — voir §10.2.7, non résolu
├── Provisioning des comptes utilisateurs .............. réalisé pour le premier compte admin uniquement
│                                                          (§14.9) ; la création des comptes suivants reste
│                                                          manuelle par l'admin du tenant (hors périmètre)
├── Migration des comptes existants (tenant_id NULL) .. non implémenté
├── Gating backend étendu au reste du catalogue FunctionalService (Caisse, Comptabilité financière,
│    Comptabilité matière, Gestion du personnel, Gestion des infrastructures) — architecture générique déjà
│    prête (HasFunctionalServiceEnabled.for_service), non câblée sur ces services (voir §14.10, LIMITATIONS)
├── "Infirmerie" (SOINS_INFIRMIERS) — gating limité à l'action `soins` ; les endpoints généraux partagés
│    (liste/détail patients, visites) restent accessibles même désactivé, faute de distinction propre
│    infirmier/médecin dans le modèle de données actuel (voir §14.10, LIMITATIONS)
├── Suite de tests d'isolation dédiée et nommée 1:1 selon un scénario de test formel — la couverture réelle
│    existe (Phases 5/6, §14.10) mais n'est pas regroupée dans un fichier unique par scénario
├── Sécurisation approfondie service-to-service ....... non implémenté (accès direct à un service en
│                                                          contournant la Gateway = confiance aveugle aux
│                                                          headers, y compris X-Tenant-ID — vérifié explicitement
│                                                          identique pour Medical-Monitoring et les 4 autres
│                                                          services déjà tenant-aware, pas une régression)
├── Révocation en temps réel d'un alias déjà résolu — désactiver un TenantDatabase ne prend effet, pour
│    un processus qui a déjà résolu ce tenant, qu'à son redémarrage (voir §9.2.10, même limite pour
│    Medical-Monitoring)
├── Secret Manager réel (Vault, AWS Secrets Manager, etc.) — secret_reference reste une référence non
│    branchée, credentials PostgreSQL partagés pour toute création physique
├── Provisioning à très grande échelle (création en masse de tenants, files d'attente, retries automatiques
│    planifiés) — ne couvre qu'un provisioning à la demande, un tenant à la fois
├── Signal Visite → Clinical Agent : le thread de notification `daemon=True` peut ne pas survivre à un
│    processus court (`manage.py <commande>`) — le rattrapage périodique/`sync/all` manuel reprend
│    correctement, mais la notification temps réel n'est garantie que dans un processus long (runserver/
│    gunicorn) — voir §13.2
├── Kafka (fultang-compta-financiere) — propagation de tenant_id vérifiée uniquement en appelant
│    `_dispatch()` directement (pas de broker Kafka démarré dans cet environnement de développement) —
│    aucune preuve de bout en bout contre un vrai broker (voir §13.7.4)
├── Producteur pour le topic `patient.cree` — n'existe dans aucun service du dépôt ; le consommateur reste
│    défensif (refuse l'écriture sans tenant_id) en attendant qu'un producteur réel soit implémenté
│    (hors périmètre de cette mission — non inventé, voir §13.7.4)
└── Opérations multitenant (backup/restore par tenant, etc.)
```

---

*Document maintenu à jour à chaque phase du projet multitenant. Dernière mise à jour : §14.10 — suspension de tenant vérifiée à chaque requête (plus seulement à la résolution hostname), désactivation de FunctionalService appliquée en HTTP 404 avec invalidation active du cache, double confirmation sur les actions critiques (suspension/réactivation de tenant, activation/désactivation/réactivation de service), écrans frontend dédiés. Les 5 services métier persistants de FullTang partagent le même mécanisme Database-per-Tenant depuis la Phase 8 (finalisation) ; Clinical Agent reste l'exception architecturale volontaire. Limitations connues et périmètre restant : voir §14.10 (LIMITATIONS) et §19.*
