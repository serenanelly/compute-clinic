# Suite d'isolation multitenant

## Objectif de la campagne

Cette suite ne cherche PAS à confirmer que « tout fonctionne ». Elle
existe pour détecter les endroits où l'isolation multitenant de Fultang
**ne respecte pas encore** les exigences attendues d'une architecture
multi-tenant — et pour les rendre visibles, reproductibles, et
traçables dans le temps.

**100 % des tests qui passent ne signifie pas que l'isolation est
garantie à 100 % sur toute la plateforme.** Cela signifie uniquement :
« tous les scénarios actuellement écrits sont conformes ». Un service ou
un endpoint qui n'a pas encore de scénario dédié n'est pas couvert — pas
« prouvé isolé ». La section *Services couverts / non couverts*
ci-dessous liste explicitement ce qui n'est pas testé, et pourquoi.

## Principes de test

1. **Le scénario vient de l'exigence, jamais de l'implémentation.** Un
   scénario est écrit à partir de ce que le système DOIT garantir dans
   une architecture multi-tenant. L'implémentation actuelle ne
   détermine jamais si un scénario est exécuté ou non.
2. **Aucun SKIP pour masquer une non-conformité.** Si une fonctionnalité
   devrait être isolée mais ne l'est pas, le test correspondant DOIT
   échouer — jamais neutralisé par `pytest.skip()`/`xfail`. Un SKIP
   n'est légitime que pour une seule raison : le scénario est
   **techniquement impossible à préparer** (aucun endpoint n'existe pour
   l'exercer du tout — voir CAISSE/COMPTA_FINANCIERE/etc. plus bas). Dès
   qu'un endpoint réel existe, même partiellement protégé, un test réel
   est écrit et son résultat (PASS ou FAIL) est rapporté tel quel.
3. **Deux tenants réels minimum par scénario d'isolation**, avec des
   données distinctes et explicitement identifiables (ex. le champ
   `nom` d'un patient vaut littéralement `PATIENT_TENANT_A` /
   `PATIENT_TENANT_B`) — pour exclure tout faux positif où les deux
   tenants seraient simplement vides.
4. **Comportemental, pas structurel.** Aucun test ne vérifie qu'une
   classe/permission/décorateur existe dans le code — chaque test
   exerce un vrai appel HTTP à travers la Gateway et vérifie la réponse
   ET les données retournées.
5. **Tout est réel.** Vrais tenants créés via l'API publique, vrais JWT
   obtenus par une vraie connexion, vrai routage vers des bases
   PostgreSQL physiques distinctes, vraie invalidation de cache. Rien
   n'est mocké — ni le Tenant Service, ni le Database Router, ni le
   cache FunctionalService.

## Comment les tenants sont créés

`conftest.py::build_tenant_with_admin()` exécute le vrai pipeline de
bout en bout : création du tenant (API Platform Admin) → provisioning
des bases techniques PERSONNEL + MEDICAL → création du compte admin
initial via le vrai mécanisme interne (`provision-admin`, qui envoie un
vrai email SMTP) → mot de passe rendu déterministe pour la
reproductibilité (voir docstring de `set_known_admin_password` : la
création elle-même n'est jamais simulée, seule cette dernière étape
substitue une valeur connue à un mot de passe qui ne serait sinon
communiqué que par email) → connexion réelle → JWT réel.

Chaque tenant reçoit un identifiant unique (`iso-<préfixe>-<8 hex>`) —
aucun scénario ne dépend d'un tenant pré-existant ni d'un ordre
d'exécution.

## Comment l'isolation des données est vérifiée

Selon le scénario :
- **Réponse HTTP** : code de statut ET contenu (jamais le code seul —
  un test vérifie explicitement que le champ `nom`/`email` retourné est
  bien celui attendu, jamais juste que le status est 200).
- **Base physique** : requête SQL directe (`docker exec ... psql`) dans
  le conteneur Postgres réel de chaque service, pour confirmer qu'une
  ligne créée par A n'existe tout simplement pas dans la base de B (pas
  seulement qu'elle n'est pas retournée par l'API).

## Exécution

```bash
cd backend/tests/isolation
python3 -m venv .venv          # une fois
source .venv/bin/activate
pip install -r requirements.txt   # une fois

python -m pytest .                                       # toute la suite
python -m pytest test_functional_service_isolation.py    # un fichier
python -m pytest -k laborantin                            # par mot-clé
python -m pytest -v                                        # détail par test
```

Prérequis : la stack Docker complète tourne déjà (`./start_all.sh`
depuis `backend/`).

## Signification de PASS / FAIL / SKIP

| Résultat | Signification |
|---|---|
| **PASS** | Le comportement observé est conforme à l'exigence d'isolation testée. |
| **FAIL** | Le comportement observé N'EST PAS conforme — **résultat attendu et utile**, pas un défaut de la suite. Chaque échec identifie précisément quel endpoint/service ne respecte pas encore l'isolation, avec le comportement attendu et le comportement obtenu dans le message d'assertion. Un FAIL ne doit jamais être « corrigé » en modifiant le test — seule une vraie correction du code de production le ferait passer, ce qui est hors périmètre de cette suite. |
| **SKIP** | Réservé aux scénarios **techniquement impossibles à préparer** (aucun endpoint n'existe pour l'exercer) — jamais utilisé pour neutraliser une non-conformité fonctionnelle constatable. Voir la liste des services non couverts ci-dessous : ceux-ci n'ont même pas de test SKIP dédié, car il n'y a littéralement rien à requêter — ils sont juste absents de la suite, documentés ici plutôt que simulés. |

## Scénarios couverts

### A. Isolation des données (`test_multitenant_isolation.py`)
Lecture / modification / suppression / création de relation cross-tenant,
bidirectionnel A↔B, sur deux ressources distinctes de deux services
différents (`Medecin` — service-personnel ; `Patient` — Medical-Monitoring,
avec marqueurs `PATIENT_TENANT_A`/`PATIENT_TENANT_B` explicitement
vérifiés dans le contenu de la réponse, pas seulement le statut HTTP).

### B. Authentification / identité tenant (`test_authentication_isolation.py`)
JWT(A)+hostname(A), JWT(B)+hostname(B), JWT(A)+hostname(B) refusé,
JWT(B)+hostname(A) refusé, hostname hors convention (`localhost`) avec
JWT valide, non-fuite de données cross-tenant sur une liste, et
**falsification du header `X-Tenant-ID`** côté client (lecture et
écriture) — vérifie que ce header, injecté normalement par la Gateway à
partir du JWT signé, ne peut jamais être détourné par le client pour
accéder aux données d'un autre tenant.

### C. Routage base de données (`test_database_routing_isolation.py`)
Vérification physique directe (requête SQL dans le conteneur Postgres
réel de chaque service, pas seulement la réponse HTTP) que les données
de chaque tenant vivent uniquement dans SA base — deux serveurs
PostgreSQL distincts couverts (service-personnel et Medical-Monitoring).

### D. Cache (`test_functional_service_isolation.py`)
Activation/désactivation d'un service pour A, prise en compte
immédiate (sans attendre le TTL de 60s), absence d'impact sur B —
vérifié sur plusieurs services (PHARMACIE, MEDECINE_GENERALE,
SOINS_INFIRMIERS).

### E. Suspension (`test_tenant_suspension_isolation.py`)
Scénarios A à G : accès normal, suspension avec JWT déjà émis avant la
suspension (refusé après), nouvelle tentative de connexion refusée,
appel API direct refusé, PlatformAdmin toujours capable de consulter,
réactivation restaurant l'accès sans nouvelle connexion, non-affectation
d'un second tenant actif, préservation des données après un cycle
suspension/réactivation.

### F. Services fonctionnels (`test_functional_service_isolation.py`)
Mécanisme générique testé sur **quatre services réels distincts**
(PHARMACIE, LABORATOIRE, MEDECINE_GENERALE, SOINS_INFIRMIERS), à travers
**huit points d'application backend réels** répartis sur deux
microservices :

| Service | Point d'application | Résultat actuel |
|---|---|---|
| PHARMACIE | `PharmacienViewSet` (service-personnel) | PASS |
| PHARMACIE | création générique de personnel, poste=pharmacien | PASS |
| PHARMACIE | `AnomaliePrescriptionViewSet` (Medical-Monitoring) | PASS |
| PHARMACIE | `DelivranceMedicamentViewSet` (Medical-Monitoring) | PASS |
| PHARMACIE | `ConciliationMedicamenteuseViewSet` (Medical-Monitoring) | **FAIL — non gaté** |
| LABORATOIRE | création générique de personnel, poste=laborantin | PASS |
| LABORATOIRE | `LaborantinViewSet` (service-personnel) | **FAIL — non gaté** |
| LABORATOIRE | `PrelevementViewSet` (Medical-Monitoring) | PASS |
| LABORATOIRE | `ValeurCritiqueViewSet` (Medical-Monitoring) | PASS |
| MEDECINE_GENERALE | `ConsultationViewSet` (Medical-Monitoring) | PASS |
| SOINS_INFIRMIERS | `PatientViewSet.enregistrer_soin` (action seule) | PASS |

Couvre aussi : préservation des données à travers un cycle
désactivation/réactivation, et activation d'un service jamais activé à
la création du tenant (rôle devient créable, connexion et action métier
fonctionnent, sans recréer le tenant).

## Services / endpoints NON couverts

**Non couverts par manque de scénario réellement exécutable (aucun
endpoint n'existe pour ces codes — zéro occurrence de `for_service(...)`
dans tout le backend) :** CAISSE, COMPTA_FINANCIERE, COMPTA_MATIERE,
GESTION_PERSONNEL, GESTION_INFRASTRUCTURES. Il n'y a littéralement rien à
requêter pour construire un scénario d'isolation — ce n'est pas une
non-conformité constatée, c'est une fonctionnalité qui n'existe pas
encore. Différent du cas Laborantin/Conciliation ci-dessus, où
l'endpoint existe réellement mais n'est pas protégé (→ FAIL, pas
absence de test).

**Non couverts par manque de scénario écrit à ce jour** (endpoints
existants, non exercés par cette suite — à ajouter, pas une conformité
supposée) : `ExamenViewSet`, `MedicamentPrescritViewSet`,
`VisiteViewSet`, `HospitalisationViewSet`, et l'ensemble des endpoints
`patient/*` annexes (antécédents, allergies, traitements, etc.) de
Medical-Monitoring ; les microservices ComptaMatiere,
fultang-compta-financiere, Gestion-Infrastructures, clinical-agent ne
sont couverts par AUCUN test de cette suite.

## Résultat réel le plus récent

Voir la sortie de la dernière exécution de `python -m pytest . -v` — ne
jamais recopier ici un résultat qui n'a pas été réellement observé.
