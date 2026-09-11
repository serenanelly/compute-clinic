"""
Isolation au niveau authentification : mismatch JWT/tenant demandé et
mismatch hostname/JWT.

Vérifie le contrôle réel de la Gateway (`api-gateway/app/main.py::proxy_catch_all`,
bloc "Tenant-Aware Authentication") : le tenant du JWT (émis à la
connexion) doit toujours correspondre au tenant que le hostname désigne.
Convention réelle de l'environnement (confirmée via
`docker exec fultang-gateway env | grep TENANT_ROOT_DOMAIN` → `localhost`) :
`<identifier>.localhost`, jamais une valeur supposée.
"""
from conftest import GATEWAY, gateway_request


def test_jwt_a_plus_hostname_a_is_authorized(tenant_pair):
    a = tenant_pair["a"]
    resp = gateway_request(
        "GET", "/personnel/personnel/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"],
    )
    assert resp.status_code == 200


def test_jwt_b_plus_hostname_b_is_authorized(tenant_pair):
    b = tenant_pair["b"]
    resp = gateway_request(
        "GET", "/personnel/personnel/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"],
    )
    assert resp.status_code == 200


def test_jwt_a_plus_hostname_b_is_refused(tenant_pair):
    a, b = tenant_pair["a"], tenant_pair["b"]
    resp = gateway_request(
        "GET", "/personnel/personnel/", host=f"{b['tenant']['identifier']}.localhost", token=a["admin_token"],
    )
    assert resp.status_code == 403
    assert "établissement demandé" in resp.json()["detail"]


def test_jwt_b_plus_hostname_a_is_refused(tenant_pair):
    a, b = tenant_pair["a"], tenant_pair["b"]
    resp = gateway_request(
        "GET", "/personnel/personnel/", host=f"{a['tenant']['identifier']}.localhost", token=b["admin_token"],
    )
    assert resp.status_code == 403
    assert "établissement demandé" in resp.json()["detail"]


def test_jwt_a_on_localhost_off_convention_host_is_still_authorized_for_its_own_tenant(tenant_pair):
    """
    `localhost` (sans sous-domaine) est hors convention : la Gateway ne
    résout alors aucun `tenant_context` par hostname (voir docstring de
    `proxy_catch_all`) — mais le JWT reste valide pour SON tenant tant
    que celui-ci est ACTIF (le contrôle de suspension hors-convention,
    lui, est testé dans test_tenant_suspension_isolation.py).
    """
    a = tenant_pair["a"]
    resp = gateway_request("GET", "/personnel/personnel/", host="localhost", token=a["admin_token"])
    assert resp.status_code == 200


def test_cross_tenant_data_is_not_returned_even_when_request_is_authorized(tenant_pair):
    """
    Un mismatch JWT/hostname est déjà refusé (403) — ici on vérifie en
    plus que, une fois correctement authentifié sur SON tenant, la
    liste retournée ne contient jamais l'admin de l'AUTRE tenant (même
    si les deux comptes partagent le même modèle Admin/Personnel).
    """
    a, b = tenant_pair["a"], tenant_pair["b"]
    resp_a = gateway_request(
        "GET", "/personnel/admins/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"],
    )
    assert resp_a.status_code == 200
    emails_in_a = {row["email"] for row in resp_a.json()["results"]}
    assert a["admin_email"] in emails_in_a
    assert b["admin_email"] not in emails_in_a

    resp_b = gateway_request(
        "GET", "/personnel/admins/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"],
    )
    assert resp_b.status_code == 200
    emails_in_b = {row["email"] for row in resp_b.json()["results"]}
    assert b["admin_email"] in emails_in_b
    assert a["admin_email"] not in emails_in_b


def test_spoofed_x_tenant_id_header_never_grants_access_to_another_tenant(tenant_pair):
    """
    EXIGENCE : `X-Tenant-ID` est un header INTERNE injecté par la Gateway
    à partir du JWT déjà validé (voir `_build_user_headers`/
    `_strip_client_identity_headers`, `api-gateway/app/main.py`) — jamais
    une valeur que le client est censé pouvoir fournir. Un client qui
    envoie quand même ce header en essayant d'usurper le tenant B ne doit
    jamais obtenir l'effet visé : soit il est purement ignoré (le tenant
    effectif reste celui du JWT, A), soit son incohérence avec le hostname
    déclenche un refus — dans tous les cas, aucune donnée de B ne doit
    jamais être exposée à A par ce biais.
    """
    a, b = tenant_pair["a"], tenant_pair["b"]
    resp = gateway_request(
        "GET", "/personnel/admins/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"],
        headers={"X-Tenant-ID": b["tenant"]["id"]},
    )
    if resp.status_code == 200:
        emails = {row["email"] for row in resp.json()["results"]}
        assert b["admin_email"] not in emails, (
            "FAILLE : un X-Tenant-ID falsifié par le client a permis de lire des données de B "
            "alors que le JWT/hostname utilisés étaient ceux de A."
        )
        assert a["admin_email"] in emails
    else:
        assert resp.status_code in (401, 403)


def test_spoofed_x_tenant_id_header_cannot_redirect_a_write_to_another_tenant(tenant_pair):
    """Même exigence que ci-dessus, mais en écriture : une création avec
    un X-Tenant-ID falsifié vers B ne doit jamais écrire dans la base de B."""
    a, b = tenant_pair["a"], tenant_pair["b"]
    resp = gateway_request(
        "POST", "/personnel/medecins/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"],
        headers={"X-Tenant-ID": b["tenant"]["id"]},
        json={
            "nom": "Spoof", "prenom": "Test", "email": "spoof.xtenant@example.test",
            "date_naissance": "1980-01-01", "specialite": "X", "numero_ordre": "ORD-SPOOF",
            "adresse": "Yaounde", "contact": "+237600000000", "matricule": f"MED-SPOOF-{a['tenant']['identifier']}",
            "date_embauche": "2020-01-01",
        },
    )
    assert resp.status_code == 201, resp.text

    resp_b = gateway_request(
        "GET", "/personnel/medecins/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"],
    )
    assert resp_b.status_code == 200
    emails_in_b = {row["email"] for row in resp_b.json()["results"]}
    assert "spoof.xtenant@example.test" not in emails_in_b, (
        "FAILLE : une écriture avec un X-Tenant-ID falsifié a atterri dans la base de B."
    )
