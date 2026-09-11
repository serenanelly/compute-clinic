"""
Mécanisme GÉNÉRIQUE FunctionalService — activation/désactivation/
réactivation, invalidation active du cache, préservation des données,
et "service jamais activé à la création puis activé plus tard".

Infirmerie n'est PAS traitée à part : chaque test paramètre le service
réellement testé, en utilisant le même mécanisme
(`HasFunctionalServiceEnabled.for_service(code)`, voir
`service-personnel/service_personnel/api/permissions.py` et son
équivalent Medical-Monitoring) et le même point d'entrée de bascule
(`PATCH /tenants/tenants/{id}/functional-services/{code}/`).

Audit du catalogue réel (`docker exec fultang-tenant-web python manage.py
shell -c "... FunctionalService.objects.all() ..."`) et des points
d'application réellement câblés (`grep -rn "for_service(" ...`) :

    MEDECINE_GENERALE    -> Medical-Monitoring: ConsultationViewSet (classe entière)
    SOINS_INFIRMIERS     -> Medical-Monitoring: PatientViewSet.enregistrer_soin (action seule)
    PHARMACIE            -> service-personnel: PharmacienViewSet (classe entière)
                             + création générique de personnel (poste='pharmacien')
                          -> Medical-Monitoring: AnomaliePrescriptionViewSet,
                             DelivranceMedicamentViewSet (gatés) ;
                             ConciliationMedicamenteuseViewSet (registré sous
                             pharmacie/conciliations mais SANS
                             HasFunctionalServiceEnabled câblé — testé
                             ci-dessous, PAS masqué : ce test échoue tant que
                             ce n'est pas corrigé, voir TestPharmacieViaMedicalMonitoring).
    LABORATOIRE          -> service-personnel: création générique de personnel
                             (poste='laborantin') — gaté ; LaborantinViewSet
                             (liste/lecture du personnel déjà créé) n'a AUCUN
                             HasFunctionalServiceEnabled câblé — testé
                             explicitement ci-dessous et non skippé : ce test
                             échoue tant que cette lacune n'est pas corrigée.
                          -> Medical-Monitoring: PrelevementViewSet,
                             ValeurCritiqueViewSet (gatés, testés ci-dessous).
    CAISSE, COMPTA_FINANCIERE, COMPTA_MATIERE, GESTION_PERSONNEL,
    GESTION_INFRASTRUCTURES -> AUCUN point d'entrée HTTP existant du tout
                             dans le code (zéro ViewSet/route lié à ces
                             codes, zéro occurrence de for_service(<ce
                             code>)) : il n'y a littéralement rien à
                             requêter pour construire un scénario
                             d'isolation (contrairement à Laborantin/
                             Conciliation ci-dessus, où un endpoint RÉEL
                             existe mais n'est pas encore protégé). Ce cas
                             relève du §5 (« scénario techniquement
                             impossible à exécuter », pas d'une non-
                             conformité fonctionnelle) — documenté
                             honnêtement plutôt que simulé par un faux test.
"""
import uuid

from conftest import (
    build_tenant_with_admin, create_consultation, create_examen, create_patient,
    create_prescription, create_resultat_examen_via_orm, gateway_request,
    set_functional_service, unique_id,
)


def _create_pharmacien(admin_token, identifier, *, suffix):
    payload = {
        "nom": f"Pharmacien{suffix}", "prenom": "Isolation", "email": f"pharmacien.{suffix}@example.test",
        "date_naissance": "1985-01-01", "numero_licence": f"LIC-{suffix}",
        "adresse": "Yaounde", "contact": "+237600000000", "matricule": f"PHARM-{suffix}-{unique_id()}",
        "date_embauche": "2020-01-01",
    }
    return gateway_request("POST", "/personnel/pharmaciens/", host=f"{identifier}.localhost", token=admin_token, json=payload)


class TestPharmacieCycle:
    """Cycle complet ACTIVE -> DISABLED -> ACTIVE sur PharmacienViewSet (classe entière gatée)."""

    def test_active_then_disabled_then_reenabled(self, platform_admin_token):
        t = build_tenant_with_admin(platform_admin_token, prefix="fs-pharma")
        identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]

        # ACTIVE (catalogue par défaut) : la création fonctionne.
        resp = _create_pharmacien(token, identifier, suffix="1")
        assert resp.status_code == 201, resp.text
        pharmacien_id = resp.json()["id_personnel"]

        # DISABLED -> blocage IMMÉDIAT (pas d'attente du TTL de 60s) sur
        # une requête déjà prête à être rejouée, y compris la simple lecture.
        set_functional_service(platform_admin_token, tenant_id, "PHARMACIE", False)
        resp = gateway_request("GET", "/personnel/pharmaciens/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 404
        assert resp.json()["error_type"] == "SERVICE_UNAVAILABLE"

        # La donnée créée avant désactivation existe toujours en base
        # (vérifié directement, hors du chemin bloqué par la permission).
        # -> confirmé dans test_functional_service_data_preserved_across_disable_cycle.

        # RÉACTIVÉ -> immédiatement de nouveau disponible, même jeton.
        set_functional_service(platform_admin_token, tenant_id, "PHARMACIE", True)
        resp = gateway_request("GET", f"/personnel/pharmaciens/{pharmacien_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 200
        assert resp.json()["email"] == "pharmacien.1@example.test"

    def test_generic_personnel_creation_for_pharmacien_poste_is_also_gated(self, platform_admin_token):
        t = build_tenant_with_admin(platform_admin_token, prefix="fs-pharma-generic")
        identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]
        payload = {
            "poste": "pharmacien", "nom": "Generic", "prenom": "Test",
            "email": "pharmacien.generic@example.test", "date_naissance": "1990-01-01",
        }

        set_functional_service(platform_admin_token, tenant_id, "PHARMACIE", False)
        resp = gateway_request("POST", "/personnel/personnel/", host=f"{identifier}.localhost", token=token, json=payload)
        assert resp.status_code == 404

        set_functional_service(platform_admin_token, tenant_id, "PHARMACIE", True)
        resp = gateway_request("POST", "/personnel/personnel/", host=f"{identifier}.localhost", token=token, json=payload)
        assert resp.status_code == 201


class TestLaboratoireGenericCreationOnly:
    def test_generic_personnel_creation_for_laborantin_poste(self, platform_admin_token):
        t = build_tenant_with_admin(platform_admin_token, prefix="fs-labo")
        identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]
        payload = {
            "poste": "laborantin", "nom": "Labo", "prenom": "Test",
            "email": "laborantin.generic@example.test", "date_naissance": "1990-01-01",
        }

        set_functional_service(platform_admin_token, tenant_id, "LABORATOIRE", False)
        resp = gateway_request("POST", "/personnel/personnel/", host=f"{identifier}.localhost", token=token, json=payload)
        assert resp.status_code == 404

        set_functional_service(platform_admin_token, tenant_id, "LABORATOIRE", True)
        resp = gateway_request("POST", "/personnel/personnel/", host=f"{identifier}.localhost", token=token, json=payload)
        assert resp.status_code == 201

    def test_laborantin_viewset_listing_is_blocked_when_laboratoire_disabled(self, platform_admin_token):
        """
        EXIGENCE : si LABORATOIRE est désactivé pour un tenant, AUCUNE
        fonctionnalité liée au laboratoire ne doit rester utilisable pour
        ce tenant — pas seulement la création de personnel, mais aussi la
        consultation du personnel de laboratoire déjà existant
        (`LaborantinViewSet`, le point d'entrée qu'un laborantin ou un
        administrateur utilise réellement pour voir/gérer l'équipe).

        Ce test définit l'exigence indépendamment de l'implémentation
        actuelle : il DOIT échouer si le système ne la respecte pas
        encore, plutôt que d'être neutralisé par un skip. Ne pas
        transformer ce FAIL en skip/xfail pour le faire "passer" —
        c'est précisément le signal que cette suite doit produire.
        """
        t = build_tenant_with_admin(platform_admin_token, prefix="fs-labo-view")
        identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]

        resp = gateway_request(
            "POST", "/personnel/laborantins/", host=f"{identifier}.localhost", token=token,
            json={
                "nom": "LaboExistant", "prenom": "Test", "email": "labo.existant@example.test",
                "date_naissance": "1990-01-01", "specialite_labo": "HEMATOLOGIE",
                "adresse": "Yaounde", "contact": "+237600000000", "matricule": f"LABO-{unique_id()}",
                "date_embauche": "2020-01-01",
            },
        )
        assert resp.status_code == 201, resp.text

        set_functional_service(platform_admin_token, tenant_id, "LABORATOIRE", False)
        resp = gateway_request("GET", "/personnel/laborantins/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 404, (
            "EXIGENCE NON RESPECTÉE : LaborantinViewSet reste accessible "
            f"(status={resp.status_code}) alors que LABORATOIRE est désactivé pour ce tenant. "
            "Seul le point d'entrée générique de création de personnel est réellement gaté "
            "pour ce service — LaborantinViewSet (liste/lecture/gestion du personnel déjà "
            "créé) n'a aucun HasFunctionalServiceEnabled câblé (confirmé par lecture du code, "
            "service-personnel/service_personnel/api/views.py::LaborantinViewSet)."
        )


class TestLaboratoireViaMedicalMonitoring:
    """
    LABORATOIRE, second point d'application réel : `PrelevementViewSet` et
    `ValeurCritiqueViewSet` (Medical-Monitoring). Chaîne de données réelle
    Patient -> Consultation -> Examen -> (Prélèvement | Résultat -> Valeur
    critique) construite via les vrais endpoints publics (sauf
    `ResultatExamen`, qui n'a aucun endpoint public — voir
    `conftest.py::create_resultat_examen_via_orm`).
    """

    def test_prelevement_viewset_full_cycle(self, platform_admin_token):
        t = build_tenant_with_admin(platform_admin_token, prefix="fs-labo-prel")
        identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]
        patient = create_patient(token, identifier, nom_suffix="LaboPrel")
        consultation = create_consultation(token, identifier, patient_id=patient["id"], motif="Suspicion infection")
        examen = create_examen(token, identifier, consultation_id=consultation["id"], nom="NFS")

        resp = gateway_request(
            "POST", "/medical/laboratoire/prelevements/", host=f"{identifier}.localhost", token=token,
            json={"examen": examen["id"], "laborantin_id": str(uuid.uuid4()), "type_prelevement": "Sang"},
        )
        assert resp.status_code == 201, resp.text
        prelevement_id = resp.json()["id"]

        set_functional_service(platform_admin_token, tenant_id, "LABORATOIRE", False)
        resp = gateway_request("GET", f"/medical/laboratoire/prelevements/{prelevement_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 404
        assert resp.json()["error_type"] == "SERVICE_UNAVAILABLE"

        set_functional_service(platform_admin_token, tenant_id, "LABORATOIRE", True)
        resp = gateway_request("GET", f"/medical/laboratoire/prelevements/{prelevement_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 200
        assert resp.json()["type_prelevement"] == "Sang"

    def test_valeur_critique_viewset_full_cycle(self, platform_admin_token):
        t = build_tenant_with_admin(platform_admin_token, prefix="fs-labo-vc")
        identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]
        patient = create_patient(token, identifier, nom_suffix="LaboVC")
        consultation = create_consultation(token, identifier, patient_id=patient["id"], motif="Suivi")
        examen = create_examen(token, identifier, consultation_id=consultation["id"], nom="Glycémie")
        resultat_id = create_resultat_examen_via_orm(tenant_id, examen["id"])

        resp = gateway_request(
            "POST", "/medical/laboratoire/valeurs-critiques/", host=f"{identifier}.localhost", token=token,
            json={"resultat": resultat_id, "laborantin_id": str(uuid.uuid4()), "valeur_mesuree": "0.35 g/L", "seuil_alerte": "0.4 g/L"},
        )
        assert resp.status_code == 201, resp.text
        valeur_id = resp.json()["id"]

        set_functional_service(platform_admin_token, tenant_id, "LABORATOIRE", False)
        resp = gateway_request("GET", f"/medical/laboratoire/valeurs-critiques/{valeur_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 404
        assert resp.json()["error_type"] == "SERVICE_UNAVAILABLE"

        set_functional_service(platform_admin_token, tenant_id, "LABORATOIRE", True)
        resp = gateway_request("GET", f"/medical/laboratoire/valeurs-critiques/{valeur_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 200


class TestPharmacieViaMedicalMonitoring:
    """
    PHARMACIE, second point d'application réel : `AnomaliePrescriptionViewSet`
    et `DelivranceMedicamentViewSet` (gatés) ; `ConciliationMedicamenteuseViewSet`
    (registré sous `pharmacie/conciliations/`, donc présenté comme un
    endpoint « Pharmacie » comme les deux autres) mais SANS
    `HasFunctionalServiceEnabled` câblé — l'EXIGENCE (désactiver PHARMACIE
    doit rendre indisponible TOUTE fonctionnalité de la pharmacie, pas
    seulement certains endpoints) est testée telle quelle : ce dernier
    test échoue tant que ce n'est pas corrigé.
    """

    def test_anomalie_prescription_viewset_full_cycle(self, platform_admin_token):
        t = build_tenant_with_admin(platform_admin_token, prefix="fs-pharma-anom")
        identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]
        patient = create_patient(token, identifier, nom_suffix="PharmaAnom")
        consultation = create_consultation(token, identifier, patient_id=patient["id"], motif="Douleur")
        prescription = create_prescription(token, identifier, consultation_id=consultation["id"], nom="Paracétamol")

        resp = gateway_request(
            "POST", "/medical/pharmacie/anomalies/", host=f"{identifier}.localhost", token=token,
            json={"medicament": prescription["id"], "pharmacien_id": str(uuid.uuid4()), "commentaire": "Dosage incohérent"},
        )
        assert resp.status_code == 201, resp.text
        anomalie_id = resp.json()["id"]

        set_functional_service(platform_admin_token, tenant_id, "PHARMACIE", False)
        resp = gateway_request("GET", f"/medical/pharmacie/anomalies/{anomalie_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 404
        assert resp.json()["error_type"] == "SERVICE_UNAVAILABLE"

        set_functional_service(platform_admin_token, tenant_id, "PHARMACIE", True)
        resp = gateway_request("GET", f"/medical/pharmacie/anomalies/{anomalie_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 200

    def test_delivrance_medicament_viewset_full_cycle(self, platform_admin_token):
        t = build_tenant_with_admin(platform_admin_token, prefix="fs-pharma-deliv")
        identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]
        patient = create_patient(token, identifier, nom_suffix="PharmaDeliv")
        consultation = create_consultation(token, identifier, patient_id=patient["id"], motif="Douleur")
        prescription = create_prescription(token, identifier, consultation_id=consultation["id"], nom="Ibuprofène")

        resp = gateway_request(
            "POST", "/medical/pharmacie/delivrances/", host=f"{identifier}.localhost", token=token,
            json={"medicament": prescription["id"], "pharmacien_id": str(uuid.uuid4()), "quantite_delivree": "1 boîte"},
        )
        assert resp.status_code == 201, resp.text
        delivrance_id = resp.json()["id"]

        set_functional_service(platform_admin_token, tenant_id, "PHARMACIE", False)
        resp = gateway_request("GET", f"/medical/pharmacie/delivrances/{delivrance_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 404
        assert resp.json()["error_type"] == "SERVICE_UNAVAILABLE"

        set_functional_service(platform_admin_token, tenant_id, "PHARMACIE", True)
        resp = gateway_request("GET", f"/medical/pharmacie/delivrances/{delivrance_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 200

    def test_conciliation_medicamenteuse_viewset_is_blocked_when_pharmacie_disabled(self, platform_admin_token):
        """
        EXIGENCE indépendante de l'implémentation actuelle (voir docstring
        de la classe) : ce test DOIT échouer tant que
        `ConciliationMedicamenteuseViewSet` n'a pas de
        `HasFunctionalServiceEnabled.for_service('PHARMACIE')` câblé.
        Ne pas neutraliser cet échec par un skip/xfail.
        """
        t = build_tenant_with_admin(platform_admin_token, prefix="fs-pharma-concil")
        identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]
        patient = create_patient(token, identifier, nom_suffix="PharmaConcil")

        resp = gateway_request(
            "POST", "/medical/pharmacie/conciliations/", host=f"{identifier}.localhost", token=token,
            json={"patient": patient["id"], "pharmacien_id": str(uuid.uuid4()), "type_conciliation": "ADMISSION", "liste_medicaments": "Aucun traitement en cours"},
        )
        assert resp.status_code == 201, resp.text
        conciliation_id = resp.json()["id"]

        set_functional_service(platform_admin_token, tenant_id, "PHARMACIE", False)
        resp = gateway_request("GET", f"/medical/pharmacie/conciliations/{conciliation_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 404, (
            "EXIGENCE NON RESPECTÉE : ConciliationMedicamenteuseViewSet reste accessible "
            f"(status={resp.status_code}) alors que PHARMACIE est désactivé pour ce tenant. "
            "Ce ViewSet est enregistré sous pharmacie/conciliations/ mais n'a aucun "
            "HasFunctionalServiceEnabled câblé (confirmé par lecture du code, "
            "Medical-Monitoring/backend/medical_workflow/views.py::ConciliationMedicamenteuseViewSet)."
        )


class TestMedecineGeneraleCycle:
    """ConsultationViewSet (classe entière) — démontre que le mécanisme n'est pas spécifique à l'Infirmerie."""

    def test_full_cycle_with_data_preservation(self, platform_admin_token):
        t = build_tenant_with_admin(platform_admin_token, prefix="fs-medgen")
        identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]
        patient = create_patient(token, identifier, nom_suffix="MedGen")

        resp = gateway_request(
            "POST", "/medical/consultations/", host=f"{identifier}.localhost", token=token,
            json={"patient": patient["id"], "motif": "Contrôle initial"},
        )
        assert resp.status_code == 201
        consultation_id = resp.json()["id"]

        set_functional_service(platform_admin_token, tenant_id, "MEDECINE_GENERALE", False)
        resp = gateway_request("GET", f"/medical/consultations/{consultation_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 404
        assert resp.json()["error_type"] == "SERVICE_UNAVAILABLE"

        set_functional_service(platform_admin_token, tenant_id, "MEDECINE_GENERALE", True)
        resp = gateway_request("GET", f"/medical/consultations/{consultation_id}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 200
        assert resp.json()["motif"] == "Contrôle initial"


class TestSoinsInfirmiersCycle:
    """
    Le scénario "Infirmerie" original (bug réel rapporté qui a motivé
    cette phase) — action `soins` uniquement, voir la limitation
    documentée dans `patient/views.py::PatientViewSet.get_permissions`
    (les lectures générales de patients restent accessibles, testé
    explicitement ci-dessous plutôt que passé sous silence).
    """

    def test_full_cycle_including_old_jwt_and_general_reads_unaffected(self, platform_admin_token):
        t = build_tenant_with_admin(platform_admin_token, prefix="fs-soins")
        identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]
        patient = create_patient(token, identifier, nom_suffix="Soins")

        soin_payload = {"nom": "Pansement", "motif": "Test", "type_soin": "CURATIF", "responsible_person_id": "00000000-0000-0000-0000-000000000000"}

        resp = gateway_request("POST", f"/medical/patients/{patient['id']}/soins/", host=f"{identifier}.localhost", token=token, json=soin_payload)
        assert resp.status_code == 201, resp.text

        set_functional_service(platform_admin_token, tenant_id, "SOINS_INFIRMIERS", False)

        # Le MÊME jeton, immédiatement, ne peut plus enregistrer de soin.
        resp = gateway_request("POST", f"/medical/patients/{patient['id']}/soins/", host=f"{identifier}.localhost", token=token, json=soin_payload)
        assert resp.status_code == 404
        assert resp.json()["error_type"] == "SERVICE_UNAVAILABLE"

        # Mais une lecture générale du patient reste accessible (limitation
        # honnêtement documentée, pas un oubli) : PatientViewSet lui-même
        # n'est gaté que sur son action 'soins'.
        resp = gateway_request("GET", f"/medical/patients/{patient['id']}/", host=f"{identifier}.localhost", token=token)
        assert resp.status_code == 200

        set_functional_service(platform_admin_token, tenant_id, "SOINS_INFIRMIERS", True)
        resp = gateway_request("POST", f"/medical/patients/{patient['id']}/soins/", host=f"{identifier}.localhost", token=token, json=soin_payload)
        assert resp.status_code == 201


def test_functional_service_data_preserved_across_disable_cycle(platform_admin_token):
    """§13 de la mission, dédié : une donnée créée avant désactivation
    n'est ni supprimée ni recréée, et redevient visible telle quelle."""
    t = build_tenant_with_admin(platform_admin_token, prefix="fs-preserve")
    identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]

    resp = _create_pharmacien(token, identifier, suffix="preserve")
    assert resp.status_code == 201
    pharmacien_id = resp.json()["id_personnel"]
    pharmacien_email = resp.json()["email"]

    set_functional_service(platform_admin_token, tenant_id, "PHARMACIE", False)
    resp = gateway_request("GET", f"/personnel/pharmaciens/{pharmacien_id}/", host=f"{identifier}.localhost", token=token)
    assert resp.status_code == 404  # inaccessible...

    set_functional_service(platform_admin_token, tenant_id, "PHARMACIE", True)
    resp = gateway_request("GET", f"/personnel/pharmaciens/{pharmacien_id}/", host=f"{identifier}.localhost", token=token)
    assert resp.status_code == 200  # ...mais jamais supprimée : même id, même email.
    assert resp.json()["email"] == pharmacien_email


def test_service_never_activated_at_creation_then_activated_later(platform_admin_token):
    """
    §14 de la mission : un tenant créé SANS Infirmerie active, puis
    activée plus tard — doit devenir pleinement fonctionnelle sans
    aucune recréation de tenant ou de base.
    """
    t = build_tenant_with_admin(platform_admin_token, prefix="fs-late")
    identifier, token, tenant_id = t["tenant"]["identifier"], t["admin_token"], t["tenant"]["id"]

    # Désactivé dès le départ (jamais activé "à la création").
    set_functional_service(platform_admin_token, tenant_id, "SOINS_INFIRMIERS", False)

    payload = {
        "poste": "infirmier", "nom": "Nurse", "prenom": "Late",
        "email": "nurse.late@example.test", "date_naissance": "1990-01-01", "sexe": "F",
    }
    resp = gateway_request("POST", "/personnel/personnel/", host=f"{identifier}.localhost", token=token, json=payload)
    assert resp.status_code == 404

    # Activé après coup : le rôle devient créable, sans recréer le tenant.
    set_functional_service(platform_admin_token, tenant_id, "SOINS_INFIRMIERS", True)
    resp = gateway_request("POST", "/personnel/personnel/", host=f"{identifier}.localhost", token=token, json=payload)
    assert resp.status_code == 201
    nurse_password = resp.json()["temporary_password"]

    # Connexion réelle du nouveau compte, et action métier réellement gatée fonctionnelle.
    resp = gateway_request("POST", "/auth/login", host=f"{identifier}.localhost", json={"email": "nurse.late@example.test", "password": nurse_password})
    assert resp.status_code == 200
    nurse_token = resp.json()["access_token"]

    patient = create_patient(token, identifier, nom_suffix="Late")
    resp = gateway_request(
        "POST", f"/medical/patients/{patient['id']}/soins/", host=f"{identifier}.localhost", token=nurse_token,
        json={"nom": "Soin", "motif": "Test", "type_soin": "CURATIF", "responsible_person_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 201


def test_disabling_one_service_never_affects_another_tenant(platform_admin_token):
    """Isolation cache/FunctionalService entre tenants : désactiver PHARMACIE pour A n'affecte jamais B."""
    a = build_tenant_with_admin(platform_admin_token, prefix="fs-isoa")
    b = build_tenant_with_admin(platform_admin_token, prefix="fs-isob")

    set_functional_service(platform_admin_token, a["tenant"]["id"], "PHARMACIE", False)

    resp_a = gateway_request("GET", "/personnel/pharmaciens/", host=f"{a['tenant']['identifier']}.localhost", token=a["admin_token"])
    assert resp_a.status_code == 404

    resp_b = gateway_request("GET", "/personnel/pharmaciens/", host=f"{b['tenant']['identifier']}.localhost", token=b["admin_token"])
    assert resp_b.status_code == 200
