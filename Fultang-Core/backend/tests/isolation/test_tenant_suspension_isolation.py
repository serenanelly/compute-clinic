"""
Suspension effective d'un tenant (Cycle de vie du tenant, Phase 3).

Chaque test crée SA PROPRE paire de tenants (jamais le fixture partagé
`tenant_pair`) : la suspension mute un état global (`Tenant.status`) que
d'autres tests ne doivent jamais hériter — reproductibilité et
indépendance totale, §18/§19 de la mission.

Couvre les scénarios A à G explicitement énumérés par la mission.
"""
from conftest import build_tenant_with_admin, gateway_request, set_tenant_status


def test_a_active_tenant_logged_in_user_normal_access(platform_admin_token):
    a = build_tenant_with_admin(platform_admin_token, prefix="susp-a")
    resp = gateway_request("GET", "/personnel/personnel/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.status_code == 200


def test_b_suspend_then_existing_users_next_request_is_refused(platform_admin_token):
    """
    Le coeur de la Phase 3 : le JWT est obtenu AVANT la suspension (session
    déjà ouverte laissée ouverte), la suspension a lieu APRÈS, et la même
    requête (même token, jamais rafraîchi) doit être bloquée immédiatement.
    """
    a = build_tenant_with_admin(platform_admin_token, prefix="susp-b")
    token_obtained_before_suspension = a["admin_token"]

    resp = gateway_request("GET", "/personnel/personnel/", host=f"{a['tenant']['identifier']}.localhost", token=token_obtained_before_suspension)
    assert resp.status_code == 200

    set_tenant_status(platform_admin_token, a["tenant"]["id"], "INACTIVE")

    resp = gateway_request("GET", "/personnel/personnel/", host=f"{a['tenant']['identifier']}.localhost", token=token_obtained_before_suspension)
    assert resp.status_code == 403
    assert resp.json()["detail"]["error_type"] == "TENANT_SUSPENDED"


def test_c_inactive_tenant_new_login_attempt_is_refused(platform_admin_token):
    a = build_tenant_with_admin(platform_admin_token, prefix="susp-c")
    set_tenant_status(platform_admin_token, a["tenant"]["id"], "INACTIVE")

    resp = gateway_request(
        "POST", "/auth/login", host=f"{a['tenant']['identifier']}.localhost",
        json={"email": a["admin_email"], "password": "IsolationSuite2026!"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["error_type"] == "TENANT_SUSPENDED"


def test_d_inactive_tenant_direct_api_call_is_refused(platform_admin_token):
    """Un endpoit métier direct (pas seulement /auth/login) est bloqué."""
    a = build_tenant_with_admin(platform_admin_token, prefix="susp-d")
    token = a["admin_token"]
    set_tenant_status(platform_admin_token, a["tenant"]["id"], "INACTIVE")

    resp = gateway_request("GET", "/medical/patients/", host=f"{a['tenant']['identifier']}.localhost", token=token)
    assert resp.status_code == 403
    assert resp.json()["detail"]["error_type"] == "TENANT_SUSPENDED"


def test_e_platform_admin_can_still_consult_inactive_tenant(platform_admin_token):
    a = build_tenant_with_admin(platform_admin_token, prefix="susp-e")
    set_tenant_status(platform_admin_token, a["tenant"]["id"], "INACTIVE")

    resp = gateway_request("GET", f"/tenants/tenants/{a['tenant']['id']}/", token=platform_admin_token)
    assert resp.status_code == 200
    assert resp.json()["status"] == "INACTIVE"


def test_f_reactivate_then_user_can_work_again_without_new_login(platform_admin_token):
    a = build_tenant_with_admin(platform_admin_token, prefix="susp-f")
    token = a["admin_token"]
    set_tenant_status(platform_admin_token, a["tenant"]["id"], "INACTIVE")

    resp = gateway_request("GET", "/personnel/personnel/", host=f"{a['tenant']['identifier']}.localhost", token=token)
    assert resp.status_code == 403

    set_tenant_status(platform_admin_token, a["tenant"]["id"], "ACTIVE")

    # Le MÊME jeton (déjà émis avant la suspension) refonctionne
    # immédiatement — aucune nouvelle connexion n'est nécessaire.
    resp = gateway_request("GET", "/personnel/personnel/", host=f"{a['tenant']['identifier']}.localhost", token=token)
    assert resp.status_code == 200


def test_g_tenant_a_suspension_never_affects_tenant_b(platform_admin_token):
    a = build_tenant_with_admin(platform_admin_token, prefix="susp-ga")
    b = build_tenant_with_admin(platform_admin_token, prefix="susp-gb")

    set_tenant_status(platform_admin_token, a["tenant"]["id"], "INACTIVE")

    resp_a = gateway_request("GET", "/personnel/personnel/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp_a.status_code == 403

    resp_b = gateway_request("GET", "/personnel/personnel/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"])
    assert resp_b.status_code == 200


def test_suspension_and_reactivation_preserve_data(platform_admin_token):
    """Les données créées avant suspension sont toujours là après réactivation."""
    a = build_tenant_with_admin(platform_admin_token, prefix="susp-data")
    resp = gateway_request(
        "POST", "/personnel/medecins/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"],
        json={
            "nom": "Persistant", "prenom": "Test", "email": "persistant@example.test",
            "date_naissance": "1980-01-01", "specialite": "Cardiologie", "numero_ordre": "ORD-PERSIST",
            "adresse": "Yaounde", "contact": "+237600000000", "matricule": "MED-PERSIST",
            "date_embauche": "2020-01-01",
        },
    )
    assert resp.status_code == 201
    medecin_id = resp.json()["id_personnel"]

    set_tenant_status(platform_admin_token, a["tenant"]["id"], "INACTIVE")
    set_tenant_status(platform_admin_token, a["tenant"]["id"], "ACTIVE")

    resp = gateway_request("GET", f"/personnel/medecins/{medecin_id}/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.status_code == 200
    assert resp.json()["email"] == "persistant@example.test"
