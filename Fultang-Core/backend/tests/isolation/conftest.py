"""
Suite dédiée d'isolation multitenant (Phase 3 — finalisation).

Contrairement aux suites unitaires de chaque service (Django TestCase,
souvent avec le contexte tenant simulé ou le router mocké — voir par ex.
`service-personnel/service_personnel/api/tests.py::FunctionalServiceEnforcementEndpointTests`),
cette suite parle en HTTP réel à la stack Docker Compose déjà démarrée
(`./start_all.sh`), via le SEUL point d'entrée public : la Gateway
(`http://localhost:8080`). Elle ne mocke ni le Tenant Service, ni le
Database Router, ni le cache FunctionalService : les tenants, les JWT,
le routage et les bases physiques sont réels.

Elle vit hors de tout service en particulier (`backend/tests/`, pas
`backend/<service>/`) car un scénario cross-tenant traverse par nature
la Gateway + le Tenant Service + Service Personnel + Medical-Monitoring
— aucun des quatre projets Django/FastAPI existants n'a de venv commun
aux trois autres, et dupliquer ces tests dans chacun aurait recréé un
mécanisme qui n'existe pas encore plutôt que d'en réutiliser un.

Prérequis : la stack complète tourne déjà (`docker ps` doit montrer
fultang-gateway, fultang-tenant-web, fultang-personnel,
fultang-medical-backend, fultang-postgres, fultang-medical-db-server).
Voir README.md de ce dossier pour la commande d'exécution.
"""
import subprocess
import time
import uuid

import pytest
import requests

GATEWAY = "http://localhost:8080"

# Compte seedé par la migration `tenant-service/tenants/migrations/0006_seed_platform_admin.py`
# — pas un identifiant inventé pour cette suite.
PLATFORM_ADMIN_EMAIL = "platform-admin@fultang.local"
PLATFORM_ADMIN_PASSWORD = "PlatformAdmin2026!"

# Mot de passe utilisé pour CHAQUE compte admin de tenant créé par cette
# suite (voir `set_known_admin_password`) — jamais le mot de passe
# temporaire réel (celui-ci n'est communiqué que par email, cf.
# `TenantViewSet.provision_admin`, testé séparément et manuellement dans
# MULTITENANT_ARCHITECTURE.md §14.10 ; cette suite ne re-teste pas
# l'envoi d'email, hors sujet de l'isolation).
KNOWN_ADMIN_PASSWORD = "IsolationSuite2026!"


def unique_id() -> str:
    return uuid.uuid4().hex[:8]


def gateway_request(method, path, *, host=None, token=None, **kwargs):
    headers = kwargs.pop("headers", {}) or {}
    if host:
        headers["Host"] = host
    if token:
        headers["Authorization"] = f"Bearer {token}"
    timeout = kwargs.pop("timeout", 15)
    return requests.request(method, f"{GATEWAY}{path}", headers=headers, timeout=timeout, **kwargs)


@pytest.fixture(scope="session")
def platform_admin_token():
    resp = requests.post(
        f"{GATEWAY}/auth/platform-admin/login",
        json={"email": PLATFORM_ADMIN_EMAIL, "password": PLATFORM_ADMIN_PASSWORD},
        timeout=15,
    )
    assert resp.status_code == 200, f"Login PLATFORM_ADMIN impossible (setup requis) : {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


def set_known_admin_password(tenant_id: str, email: str, password: str = KNOWN_ADMIN_PASSWORD):
    """
    Le compte admin initial d'un tenant reçoit un mot de passe temporaire
    RÉEL, mais uniquement par email (`provision_admin`, voir docstring
    de ce fichier) — pas dans la réponse HTTP, pour ne jamais l'exposer
    en clair côté API. Pour rendre cette suite reproductible sans lire
    une vraie boîte mail, on réutilise le VRAI mécanisme de hachage de
    mot de passe (`django.contrib.auth.hashers.make_password`, le même
    que celui utilisé par la création normale d'un compte) pour fixer un
    mot de passe connu sur le compte réellement créé par
    `provision_admin` — la création elle-même (routage interne,
    provisioning de base, écriture en base réelle) n'est pas simulée.
    """
    script = (
        "from api.tenant_routing.context import set_tenant_context\n"
        "from api.models import Admin\n"
        "from django.contrib.auth.hashers import make_password\n"
        f"set_tenant_context('{tenant_id}')\n"
        f"a = Admin.objects.get(email='{email}')\n"
        f"a.mot_de_passe = make_password('{password}')\n"
        "a.save()\n"
    )
    result = subprocess.run(
        ["docker", "exec", "fultang-personnel", "python", "manage.py", "shell", "-c", script],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, f"Échec de la préparation du mot de passe de test : {result.stderr}"


def create_tenant(platform_admin_token: str, *, prefix: str) -> dict:
    identifier = f"iso-{prefix}-{unique_id()}"
    resp = gateway_request(
        "POST", "/tenants/tenants/", token=platform_admin_token,
        json={"name": f"Isolation {identifier}", "identifier": identifier},
    )
    assert resp.status_code == 201, f"Création tenant échouée : {resp.status_code} {resp.text}"
    return resp.json()


def provision_services(platform_admin_token: str, tenant_id: str, services=("PERSONNEL", "MEDICAL")):
    resp = gateway_request(
        "POST", f"/tenants/tenants/{tenant_id}/provision/", token=platform_admin_token,
        json={"services": list(services)},
    )
    assert resp.status_code in (200, 201), f"Provisioning échoué : {resp.status_code} {resp.text}"
    return resp.json()


def provision_admin(platform_admin_token: str, tenant_id: str, *, email: str, nom="Admin", prenom="Isolation") -> dict:
    """
    Timeout plus large que le défaut (`gateway_request`, 15s) : cet
    endpoint envoie un VRAI email (SMTP Gmail réel, voir
    MULTITENANT_ARCHITECTURE.md) de façon synchrone avant de répondre —
    une latence occasionnelle > 15s est une caractéristique connue de
    l'infrastructure de test réelle (§5 : problème d'environnement, pas
    un défaut du scénario testé), pas un signe d'isolation défaillante.
    """
    resp = gateway_request(
        "POST", f"/tenants/tenants/{tenant_id}/provision-admin/", token=platform_admin_token,
        json={"nom": nom, "prenom": prenom, "email": email}, timeout=45,
    )
    assert resp.status_code == 200, f"provision-admin échoué : {resp.status_code} {resp.text}"
    body = resp.json()
    assert body["admin_created"] is True, f"Admin non créé : {body}"
    return body


def login(identifier: str, email: str, password: str = KNOWN_ADMIN_PASSWORD) -> dict:
    """
    `POST /auth/login` est réellement limité à 5/minute par IP côté
    Gateway (`slowapi.Limiter`, voir `api-gateway/app/main.py`) — une
    vraie protection anti-bruteforce qu'il est hors de question
    d'affaiblir ou de contourner pour cette suite. Comme cette suite crée
    de nombreux tenants (donc de nombreuses connexions réelles) depuis la
    même IP, elle RESPECTE la limite en patientant jusqu'à la réouverture
    de la fenêtre plutôt que de la désactiver.
    """
    for attempt in range(4):
        resp = gateway_request(
            "POST", "/auth/login", host=f"{identifier}.localhost",
            json={"email": email, "password": password},
        )
        if resp.status_code != 429:
            break
        time.sleep(61)
    assert resp.status_code == 200, f"Login échoué pour {email}@{identifier} : {resp.status_code} {resp.text}"
    return resp.json()


def build_tenant_with_admin(platform_admin_token: str, *, prefix: str) -> dict:
    """
    Pipeline complet, 100% réel : création tenant → provisioning des deux
    bases techniques (PERSONNEL, MEDICAL) → création du compte admin
    initial via le vrai mécanisme interne → mot de passe rendu
    déterministe pour la suite → connexion réelle → JWT réel.
    """
    tenant = create_tenant(platform_admin_token, prefix=prefix)
    provision_services(platform_admin_token, tenant["id"])
    admin_email = f"admin.{tenant['identifier']}@example.test"
    provision_admin(platform_admin_token, tenant["id"], email=admin_email)
    set_known_admin_password(tenant["id"], admin_email)
    tokens = login(tenant["identifier"], admin_email)
    return {
        "tenant": tenant,
        "admin_email": admin_email,
        "admin_token": tokens["access_token"],
        "admin_refresh_token": tokens.get("refresh_token"),
    }


@pytest.fixture(scope="module")
def tenant_pair(platform_admin_token):
    """
    Deux tenants réels et distincts (A, B), chacun avec son propre admin
    connecté (JWT réel). Scope "module" : partagé par les tests en
    lecture seule d'un même fichier (moins d'aller-retours réseau), mais
    jamais partagé ENTRE fichiers (chaque fichier de test obtient sa
    propre paire, donc aucune dépendance d'ordre entre fichiers — §18).
    """
    tenant_a = build_tenant_with_admin(platform_admin_token, prefix="a")
    tenant_b = build_tenant_with_admin(platform_admin_token, prefix="b")
    return {"a": tenant_a, "b": tenant_b}


def set_functional_service(platform_admin_token: str, tenant_id: str, code: str, enabled: bool):
    resp = gateway_request(
        "PATCH", f"/tenants/tenants/{tenant_id}/functional-services/{code}/",
        token=platform_admin_token, json={"enabled": enabled},
    )
    assert resp.status_code == 200, f"Toggle {code}={enabled} échoué : {resp.status_code} {resp.text}"
    return resp.json()


def set_tenant_status(platform_admin_token: str, tenant_id: str, status: str):
    resp = gateway_request(
        "PATCH", f"/tenants/tenants/{tenant_id}/status/", token=platform_admin_token, json={"status": status},
    )
    assert resp.status_code == 200, f"Changement de statut échoué : {resp.status_code} {resp.text}"
    return resp.json()


def create_patient(admin_token: str, identifier: str, *, nom_suffix: str) -> dict:
    payload = {
        "nom": f"Patient{nom_suffix}", "prenom": "Isolation", "sexe": "M",
        "date_naissance": "1985-05-05", "lieu_naissance": "Yaounde", "profession": "Test",
        "statut_matrimonial": "CELIBATAIRE", "numero_securite_sociale": f"SS-{unique_id()}",
    }
    resp = gateway_request("POST", "/medical/patients/", host=f"{identifier}.localhost", token=admin_token, json=payload)
    assert resp.status_code == 201, f"Création patient échouée : {resp.status_code} {resp.text}"
    return resp.json()


def create_consultation(admin_token: str, identifier: str, *, patient_id: str, motif: str) -> dict:
    resp = gateway_request(
        "POST", "/medical/consultations/", host=f"{identifier}.localhost", token=admin_token,
        json={"patient": patient_id, "motif": motif},
    )
    assert resp.status_code == 201, f"Création consultation échouée : {resp.status_code} {resp.text}"
    return resp.json()


def create_prescription(admin_token: str, identifier: str, *, consultation_id: str, nom: str) -> dict:
    resp = gateway_request(
        "POST", "/medical/prescriptions/", host=f"{identifier}.localhost", token=admin_token,
        json={"consultation": consultation_id, "nom": nom, "quantite": "1 boîte", "type_medicament": "Comprimé", "posologie": "1x/jour"},
    )
    assert resp.status_code == 201, f"Création prescription échouée : {resp.status_code} {resp.text}"
    return resp.json()


def create_examen(admin_token: str, identifier: str, *, consultation_id: str, nom: str) -> dict:
    resp = gateway_request(
        "POST", "/medical/examens/", host=f"{identifier}.localhost", token=admin_token,
        json={"consultation": consultation_id, "nom": nom, "motif": "Bilan de routine"},
    )
    assert resp.status_code == 201, f"Création examen échouée : {resp.status_code} {resp.text}"
    return resp.json()


def create_resultat_examen_via_orm(tenant_id: str, examen_id: str) -> str:
    """
    Aucun endpoint public n'existe pour créer un `ResultatExamen` (absent
    des routes enregistrées dans `Medical-Monitoring/backend/core/api.py`)
    — seule sa lecture est exposée (imbriquée dans `ExamenSerializer`).
    C'est une préparation de donnée de test légitime (§5 : problème
    d'environnement/préparation, pas un contournement du comportement
    testé) : ce qui est réellement exercé par le test est la protection
    de `ValeurCritiqueViewSet`, pas la création du `ResultatExamen`
    lui-même.
    """
    script = (
        "import uuid\n"
        "from core.tenant_routing.context import set_tenant_context\n"
        "from medical_workflow.models import ResultatExamen\n"
        f"set_tenant_context('{tenant_id}')\n"
        f"r = ResultatExamen.objects.create(examen_id='{examen_id}', doctor_id=uuid.uuid4(), resultats='RAS')\n"
        "print(r.id)\n"
    )
    result = subprocess.run(
        ["docker", "exec", "fultang-medical-backend", "python", "manage.py", "shell", "-c", script],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, f"Échec de la préparation du ResultatExamen de test : {result.stderr}"
    lines = [line.strip() for line in result.stdout.strip().splitlines() if line.strip()]
    return lines[-1]


def docker_exec_sql(container: str, *, db: str, user: str, password: str, sql: str) -> str:
    result = subprocess.run(
        ["docker", "exec", "-e", f"PGPASSWORD={password}", container,
         "psql", "-U", user, "-d", db, "-t", "-A", "-c", sql],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, f"psql a échoué sur {container}/{db} : {result.stderr}"
    return result.stdout.strip()


def wait_until(predicate, *, timeout=10, interval=0.5):
    """Attente courte et bornée — utilisée UNIQUEMENT pour laisser une
    opération asynchrone connue (ex. provisioning) se terminer, jamais
    pour contourner un vrai problème de timing du cache (celui-ci doit
    être immédiat, voir test_functional_service_isolation.py)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False
