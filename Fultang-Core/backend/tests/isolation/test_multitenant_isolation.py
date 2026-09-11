"""
Isolation cross-tenant sur des ressources métier réelles : lecture,
modification, suppression, création de relation.

Utilise `MedecinViewSet` (service-personnel) — un ModelViewSet standard
sans restriction FunctionalService (voir audit : seul PharmacienViewSet
et le chemin générique de création sont gatés par un FunctionalService,
voir `service-personnel/service_personnel/api/views.py:106-111`) — donc
un cas d'isolation "pur", indépendant du mécanisme FunctionalService
(testé séparément dans test_functional_service_isolation.py).

L'isolation ici n'est pas un simple filtre applicatif : le Database
Router (Phase 6) route chaque tenant vers une base PostgreSQL physique
distincte (voir test_database_routing_isolation.py) — un ID de A n'existe
donc tout simplement PAS dans la base de B, d'où les 404 attendus
ci-dessous (pas des 403 : la ressource demandée n'existe pas dans CE
tenant, exactement le même principe que SERVICE_UNAVAILABLE pour les
FunctionalService désactivés).
"""
from conftest import gateway_request, unique_id


def _create_medecin(admin_token, identifier, *, suffix):
    payload = {
        "nom": f"Medecin{suffix}", "prenom": "Isolation", "email": f"medecin.{suffix}@example.test",
        "date_naissance": "1980-01-01", "specialite": "Cardiologie", "numero_ordre": f"ORD-{suffix}",
        "adresse": "Yaounde", "contact": "+237600000000", "matricule": f"MED-ISO-{suffix}-{unique_id()}",
        "date_embauche": "2020-01-01",
    }
    resp = gateway_request("POST", "/personnel/medecins/", host=f"{identifier}.localhost", token=admin_token, json=payload)
    assert resp.status_code == 201, f"Création médecin échouée : {resp.status_code} {resp.text}"
    return resp.json()


def test_read_isolation_each_tenant_sees_only_its_own_data(tenant_pair):
    a, b = tenant_pair["a"], tenant_pair["b"]
    medecin_a = _create_medecin(a["admin_token"], a["tenant"]["identifier"], suffix="A")
    medecin_b = _create_medecin(b["admin_token"], b["tenant"]["identifier"], suffix="B")

    # A lit A -> OK, avec les bonnes données.
    resp = gateway_request("GET", f"/personnel/medecins/{medecin_a['id_personnel']}/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.status_code == 200
    assert resp.json()["email"] == "medecin.A@example.test"

    # B lit B -> OK, avec les bonnes données.
    resp = gateway_request("GET", f"/personnel/medecins/{medecin_b['id_personnel']}/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"])
    assert resp.status_code == 200
    assert resp.json()["email"] == "medecin.B@example.test"

    # A ne peut pas lire B.
    resp = gateway_request("GET", f"/personnel/medecins/{medecin_b['id_personnel']}/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.status_code == 404

    # B ne peut pas lire A.
    resp = gateway_request("GET", f"/personnel/medecins/{medecin_a['id_personnel']}/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"])
    assert resp.status_code == 404


def test_write_isolation_bidirectional(tenant_pair):
    a, b = tenant_pair["a"], tenant_pair["b"]
    medecin_a = _create_medecin(a["admin_token"], a["tenant"]["identifier"], suffix="WA")
    medecin_b = _create_medecin(b["admin_token"], b["tenant"]["identifier"], suffix="WB")

    # B tente de modifier une ressource de A.
    resp = gateway_request(
        "PATCH", f"/personnel/medecins/{medecin_a['id_personnel']}/", host=f"{b['tenant']['identifier']}.localhost",
        token=b["admin_token"], json={"specialite": "Piraterie"},
    )
    assert resp.status_code == 404

    # A tente de modifier une ressource de B.
    resp = gateway_request(
        "PATCH", f"/personnel/medecins/{medecin_b['id_personnel']}/", host=f"{a['tenant']['identifier']}.localhost",
        token=a["admin_token"], json={"specialite": "Piraterie"},
    )
    assert resp.status_code == 404

    # Les deux ressources sont restées inchangées.
    resp = gateway_request("GET", f"/personnel/medecins/{medecin_a['id_personnel']}/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.json()["specialite"] == "Cardiologie"
    resp = gateway_request("GET", f"/personnel/medecins/{medecin_b['id_personnel']}/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"])
    assert resp.json()["specialite"] == "Cardiologie"


def test_delete_isolation_bidirectional(tenant_pair):
    a, b = tenant_pair["a"], tenant_pair["b"]
    medecin_a = _create_medecin(a["admin_token"], a["tenant"]["identifier"], suffix="DA")
    medecin_b = _create_medecin(b["admin_token"], b["tenant"]["identifier"], suffix="DB")

    # B tente de supprimer une ressource de A.
    resp = gateway_request("DELETE", f"/personnel/medecins/{medecin_a['id_personnel']}/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"])
    assert resp.status_code == 404

    # A tente de supprimer une ressource de B.
    resp = gateway_request("DELETE", f"/personnel/medecins/{medecin_b['id_personnel']}/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.status_code == 404

    # Les deux ressources existent toujours, pour leur propriétaire respectif.
    resp = gateway_request("GET", f"/personnel/medecins/{medecin_a['id_personnel']}/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.status_code == 200
    resp = gateway_request("GET", f"/personnel/medecins/{medecin_b['id_personnel']}/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"])
    assert resp.status_code == 200


def test_cross_tenant_relation_creation_is_refused(tenant_pair):
    """
    B tente de créer une Consultation (Medical-Monitoring) référençant un
    Patient qui appartient à A : la ligne visée n'existe simplement pas
    dans la base physique de B (même mécanisme de routage), donc la
    validation de la clé étrangère échoue — aucune relation cross-tenant
    ne peut jamais être créée.
    """
    a, b = tenant_pair["a"], tenant_pair["b"]

    resp = gateway_request(
        "POST", "/medical/patients/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"],
        json={
            "nom": "PatientRelationA", "prenom": "Test", "sexe": "M", "date_naissance": "1990-01-01",
            "lieu_naissance": "Yaounde", "profession": "Test", "statut_matrimonial": "CELIBATAIRE",
            "numero_securite_sociale": "SS-REL-A",
        },
    )
    assert resp.status_code == 201
    patient_a_id = resp.json()["id"]

    resp = gateway_request(
        "POST", "/medical/consultations/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"],
        json={"patient": patient_a_id, "motif": "Tentative cross-tenant"},
    )
    assert resp.status_code == 400, f"Une relation cross-tenant n'aurait jamais dû pouvoir être créée : {resp.status_code} {resp.text}"


# =============================================================================
# Second service (Medical-Monitoring, PatientViewSet), avec des données
# nommément identifiables (§7 de la campagne) : élimine tout faux positif
# où les deux tenants ne contiendraient simplement aucune donnée du tout.
# =============================================================================

def _create_named_patient(admin_token, identifier, *, marker: str) -> dict:
    payload = {
        "nom": marker, "prenom": "Isolation", "sexe": "F", "date_naissance": "1990-01-01",
        "lieu_naissance": "Yaounde", "profession": "Test", "statut_matrimonial": "CELIBATAIRE",
        "numero_securite_sociale": f"SS-{marker}",
    }
    resp = gateway_request("POST", "/medical/patients/", host=f"{identifier}.localhost", token=admin_token, json=payload)
    assert resp.status_code == 201, f"Création patient échouée : {resp.status_code} {resp.text}"
    return resp.json()


def test_patient_read_isolation_with_explicitly_named_data(tenant_pair):
    """
    PATIENT_TENANT_A doit être visible par A et invisible par B ;
    PATIENT_TENANT_B doit être visible par B et invisible par A — avec
    des marqueurs textuels explicites (pas seulement un id), pour exclure
    tout faux positif "les deux tenants sont vides".
    """
    a, b = tenant_pair["a"], tenant_pair["b"]
    patient_a = _create_named_patient(a["admin_token"], a["tenant"]["identifier"], marker="PATIENT_TENANT_A")
    patient_b = _create_named_patient(b["admin_token"], b["tenant"]["identifier"], marker="PATIENT_TENANT_B")

    resp = gateway_request("GET", f"/medical/patients/{patient_a['id']}/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.status_code == 200
    assert resp.json()["nom"] == "PATIENT_TENANT_A"

    resp = gateway_request("GET", f"/medical/patients/{patient_b['id']}/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"])
    assert resp.status_code == 200
    assert resp.json()["nom"] == "PATIENT_TENANT_B"

    resp = gateway_request("GET", f"/medical/patients/{patient_b['id']}/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.status_code == 404, "PATIENT_TENANT_B ne doit jamais être lisible depuis le tenant A."

    resp = gateway_request("GET", f"/medical/patients/{patient_a['id']}/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"])
    assert resp.status_code == 404, "PATIENT_TENANT_A ne doit jamais être lisible depuis le tenant B."

    # La LISTE de chaque tenant ne doit jamais non plus laisser fuiter le marqueur de l'autre.
    resp = gateway_request("GET", "/medical/patients/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.status_code == 200
    body = resp.json()
    rows = body["results"] if isinstance(body, dict) else body
    noms_a = {row["nom"] for row in rows}
    assert "PATIENT_TENANT_A" in noms_a
    assert "PATIENT_TENANT_B" not in noms_a


def test_patient_write_and_delete_isolation_bidirectional(tenant_pair):
    a, b = tenant_pair["a"], tenant_pair["b"]
    patient_a = _create_named_patient(a["admin_token"], a["tenant"]["identifier"], marker=f"PATIENT_TENANT_A_{unique_id()}")
    patient_b = _create_named_patient(b["admin_token"], b["tenant"]["identifier"], marker=f"PATIENT_TENANT_B_{unique_id()}")

    resp = gateway_request(
        "PATCH", f"/medical/patients/{patient_a['id']}/", host=f"{b['tenant']['identifier']}.localhost",
        token=b["admin_token"], json={"profession": "Piraterie"},
    )
    assert resp.status_code == 404
    resp = gateway_request(
        "PATCH", f"/medical/patients/{patient_b['id']}/", host=f"{a['tenant']['identifier']}.localhost",
        token=a["admin_token"], json={"profession": "Piraterie"},
    )
    assert resp.status_code == 404

    resp = gateway_request("DELETE", f"/medical/patients/{patient_a['id']}/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"])
    assert resp.status_code == 404
    resp = gateway_request("DELETE", f"/medical/patients/{patient_b['id']}/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.status_code == 404

    resp = gateway_request("GET", f"/medical/patients/{patient_a['id']}/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp.status_code == 200
    assert resp.json()["profession"] == "Test"
    resp = gateway_request("GET", f"/medical/patients/{patient_b['id']}/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"])
    assert resp.status_code == 200
    assert resp.json()["profession"] == "Test"
