"""
tests/test_tenant_header_propagation.py — Propagation sécurisée du contexte
tenant (X-Tenant-ID) de la Gateway vers les services métier.

Couvre spécifiquement les règles de sécurité :
  1. X-Tenant-ID n'est jamais accepté depuis le client.
  2/4. Le tenant transmis vient du JWT validé par la Gateway.
  3. La Gateway supprime toute valeur de tenant fournie par le client.
"""
from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient

from app.main import app, client, limiter

TENANT_A_ID = "11111111-1111-1111-1111-111111111111"
TENANT_B_ID = "22222222-2222-2222-2222-222222222222"

USER = {
    "id": "99999999-9999-9999-9999-999999999999",
    "email": "user@fultang.local",
    "roles": ["Medecin"],
    "nom": "Dupont",
    "prenom": "Jean",
}

test_client = TestClient(app)


async def _fake_tenant_resolve_get(url, params=None, headers=None, **kwargs):
    identifier = (params or {}).get("identifier")
    if identifier == "hopital-central":
        return httpx.Response(200, json={"id": TENANT_A_ID, "identifier": "hopital-central", "status": "ACTIVE"})
    if identifier == "clinique-paix":
        return httpx.Response(200, json={"id": TENANT_B_ID, "identifier": "clinique-paix", "status": "ACTIVE"})
    return httpx.Response(404)


async def _fake_verify_post_success(url, json=None, **kwargs):
    return httpx.Response(200, json={**USER, "tenant_id": json.get("tenant_id")})


def _reset():
    limiter.reset()


def _login(hostname: str) -> str:
    _reset()
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "post", new=AsyncMock(side_effect=_fake_verify_post_success)):
        response = test_client.post(
            "/auth/login",
            json={"email": "user@fultang.local", "password": "secret"},
            headers={"Host": hostname},
        )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_valid_token_forwards_correct_x_tenant_id_to_downstream_service():
    """2 : requête authentifiée → X-Tenant-ID correctement transmis au service métier."""
    token = _login("hopital-central.fulltang.com")

    downstream_mock = AsyncMock(return_value=httpx.Response(200, json={"ok": True}))
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "request", new=downstream_mock):
        response = test_client.get(
            "/personnel/medecins/",
            headers={"Host": "hopital-central.fulltang.com", "Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    sent_headers = downstream_mock.call_args.kwargs["headers"]
    assert sent_headers["X-Tenant-ID"] == TENANT_A_ID
    assert sent_headers["X-User-ID"] == USER["id"]
    assert sent_headers["X-User-Roles"] == "Medecin"


def test_client_supplied_x_tenant_id_is_ignored_when_anonymous():
    """1 & 3 : un client anonyme qui envoie X-Tenant-ID/X-User-ID lui-même ne doit jamais les voir transmis."""
    downstream_mock = AsyncMock(return_value=httpx.Response(200, json={"ok": True}))
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "request", new=downstream_mock):
        response = test_client.get(
            "/personnel/medecins/",
            headers={
                "Host": "hopital-central.fulltang.com",
                "X-Tenant-ID": "attacker-supplied-tenant",
                "X-User-ID": "attacker-supplied-user",
                "X-User-Roles": "PLATFORM_ADMIN",
            },
        )

    assert response.status_code == 200
    sent_headers = downstream_mock.call_args.kwargs["headers"]
    assert "X-Tenant-ID" not in sent_headers
    assert "X-User-ID" not in sent_headers
    assert "X-User-Roles" not in sent_headers


def test_client_supplied_x_tenant_id_is_overridden_by_validated_token():
    """
    1 & 3/4 : un client authentifié sur le Tenant A qui essaie de forger
    X-Tenant-ID vers le Tenant B ne doit voir passer QUE le tenant réel
    de son JWT (Tenant A), jamais sa valeur forgée.
    """
    token = _login("hopital-central.fulltang.com")

    downstream_mock = AsyncMock(return_value=httpx.Response(200, json={"ok": True}))
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "request", new=downstream_mock):
        response = test_client.get(
            "/personnel/medecins/",
            headers={
                "Host": "hopital-central.fulltang.com",
                "Authorization": f"Bearer {token}",
                "X-Tenant-ID": TENANT_B_ID,  # tentative de forge
            },
        )

    assert response.status_code == 200
    sent_headers = downstream_mock.call_args.kwargs["headers"]
    assert sent_headers["X-Tenant-ID"] == TENANT_A_ID  # jamais TENANT_B_ID


def test_no_tenant_in_token_means_no_x_tenant_id_header():
    """Un utilisateur du pool non assigné (tenant_id=None) ne doit pas produire un X-Tenant-ID vide/"None"."""
    _reset()
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "post", new=AsyncMock(side_effect=_fake_verify_post_success)):
        login_response = test_client.post(
            "/auth/login",
            json={"email": "user@fultang.local", "password": "secret"},
            headers={"Host": "localhost:8080"},
        )
    token = login_response.json()["access_token"]

    downstream_mock = AsyncMock(return_value=httpx.Response(200, json={"ok": True}))
    with patch.object(client, "get", new=AsyncMock(side_effect=_fake_tenant_resolve_get)), \
         patch.object(client, "request", new=downstream_mock):
        response = test_client.get(
            "/personnel/medecins/",
            headers={"Host": "localhost:8080", "Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    sent_headers = downstream_mock.call_args.kwargs["headers"]
    assert "X-Tenant-ID" not in sent_headers
