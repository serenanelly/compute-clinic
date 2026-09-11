"""
Routage physique des données (Database Router, Phase 6).

Contrairement aux tests unitaires de `TenantDatabaseRouterTests`
(service-personnel), qui mockent délibérément `ensure_connection_alias`
pour isoler la LOGIQUE du router (voir sa docstring), ce fichier vérifie
le résultat physique réel : après création via l'API, la ligne existe
UNIQUEMENT dans la base PostgreSQL réelle du tenant concerné — jamais
dans celle de l'autre tenant, ni dans une base par défaut partagée.

Convention de nommage réelle (lue directement dans le code, jamais
supposée) :
    service-personnel : `tenant_{tenant_id_sans_tirets}_personnel`
        (service-personnel/service_personnel/api/tenant_routing/pool_registry.py:78)
    Medical-Monitoring : `tenant_{tenant_id_sans_tirets}_medical`
        (Medical-Monitoring/backend/core/tenant_routing/pool_registry.py:64)

Les deux services utilisent CHACUN leur propre serveur PostgreSQL
physique (conteneurs `fultang-postgres` et `fultang-medical-db-server`,
confirmé par `docker-compose.yml` — deux services Postgres distincts, pas
un seul serveur partagé par tout Fultang).
"""
from conftest import create_patient, docker_exec_sql, gateway_request, unique_id


def _personnel_db_name(tenant_id: str) -> str:
    return f"tenant_{tenant_id.replace('-', '')}_personnel"


def _medical_db_name(tenant_id: str) -> str:
    return f"tenant_{tenant_id.replace('-', '')}_medical"


def test_personnel_data_is_physically_routed_to_the_correct_tenant_database(tenant_pair):
    a, b = tenant_pair["a"], tenant_pair["b"]

    resp = gateway_request(
        "POST", "/personnel/medecins/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"],
        json={"nom": "RoutageA", "prenom": "Test", "email": "routage.a@example.test", "date_naissance": "1980-01-01", "specialite": "Cardiologie", "numero_ordre": "ORD-ROUTE-A", "adresse": "Yaounde", "contact": "+237600000000", "matricule": f"MED-RA-{unique_id()}", "date_embauche": "2020-01-01"},
    )
    assert resp.status_code == 201
    resp = gateway_request(
        "POST", "/personnel/medecins/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"],
        json={"nom": "RoutageB", "prenom": "Test", "email": "routage.b@example.test", "date_naissance": "1980-01-01", "specialite": "Cardiologie", "numero_ordre": "ORD-ROUTE-B", "adresse": "Yaounde", "contact": "+237600000000", "matricule": f"MED-RB-{unique_id()}", "date_embauche": "2020-01-01"},
    )
    assert resp.status_code == 201

    db_a = _personnel_db_name(a["tenant"]["id"])
    db_b = _personnel_db_name(b["tenant"]["id"])

    emails_in_db_a = docker_exec_sql("fultang-postgres", db=db_a, user="admin", password="password", sql="SELECT email FROM api_medecin;")
    emails_in_db_b = docker_exec_sql("fultang-postgres", db=db_b, user="admin", password="password", sql="SELECT email FROM api_medecin;")

    assert "routage.a@example.test" in emails_in_db_a
    assert "routage.b@example.test" not in emails_in_db_a

    assert "routage.b@example.test" in emails_in_db_b
    assert "routage.a@example.test" not in emails_in_db_b


def test_medical_data_is_physically_routed_to_the_correct_tenant_database(tenant_pair):
    a, b = tenant_pair["a"], tenant_pair["b"]

    patient_a = create_patient(a["admin_token"], a["tenant"]["identifier"], nom_suffix="RouteA")
    patient_b = create_patient(b["admin_token"], b["tenant"]["identifier"], nom_suffix="RouteB")

    db_a = _medical_db_name(a["tenant"]["id"])
    db_b = _medical_db_name(b["tenant"]["id"])

    ids_in_db_a = docker_exec_sql("fultang-medical-db-server", db=db_a, user="fultang_user", password="fultang_password_here", sql="SELECT id FROM patient_patient;")
    ids_in_db_b = docker_exec_sql("fultang-medical-db-server", db=db_b, user="fultang_user", password="fultang_password_here", sql="SELECT id FROM patient_patient;")

    assert patient_a["id"] in ids_in_db_a
    assert patient_b["id"] not in ids_in_db_a

    assert patient_b["id"] in ids_in_db_b
    assert patient_a["id"] not in ids_in_db_b


def test_a_context_request_can_never_be_routed_to_b_database(tenant_pair):
    """
    Reformulation directe du §9 de la mission : une requête effectuée
    dans le contexte de A (JWT+hostname de A) ne peut, par construction du
    Database Router, jamais lire/écrire dans la base de B — déjà démontré
    fonctionnellement par l'isolation de lecture (test_multitenant_isolation.py)
    et ici physiquement, en constatant qu'aucune ligne écrite par A n'atterrit
    jamais dans la base physique de B, quelle que soit la requête envoyée.
    """
    a, b = tenant_pair["a"], tenant_pair["b"]
    for _ in range(3):
        gateway_request(
            "POST", "/personnel/medecins/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"],
            json={"nom": "Bruit", "prenom": "A", "email": f"bruit.a.{_}@example.test", "date_naissance": "1980-01-01", "specialite": "X", "numero_ordre": f"ORD-BRUIT-{_}", "adresse": "Yaounde", "contact": "+237600000000", "matricule": f"MED-BRUIT-{unique_id()}", "date_embauche": "2020-01-01"},
        )

    db_b = _personnel_db_name(b["tenant"]["id"])
    emails_in_db_b = docker_exec_sql("fultang-postgres", db=db_b, user="admin", password="password", sql="SELECT email FROM api_medecin;")
    assert "bruit.a" not in emails_in_db_b
