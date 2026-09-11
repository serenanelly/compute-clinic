"""
test_soins_gating.py — Activation/désactivation effective du service
SOINS_INFIRMIERS (Cycle de vie du tenant, Phase 3, §12-15 "cas Infirmerie").

Seule l'action `POST /patients/{id}/soins/` (création d'un SoinAdministre,
le geste métier propre au rôle infirmier — voir patient/views.py::PatientViewSet.get_permissions)
est gatée : les endpoints généraux du ViewSet (liste, détail...), partagés
avec d'autres rôles, restent volontairement non gatés — voir la docstring
de `get_permissions` pour la justification.
"""
import uuid
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from rest_framework import status
from rest_framework.test import APITestCase

from core.tenant_routing.context import set_tenant_context
from core.tenant_routing.functional_service_client import functional_service_cache
from patient.models import Patient

TENANT_A = str(uuid.uuid4())


def _make_patient():
    return Patient.objects.using('default').create(
        matricule=f"P{uuid.uuid4().hex[:6]}",
        nom="Ateba", prenom="Marie", sexe="F",
        date_naissance="1990-01-01", lieu_naissance="Yaoundé", profession="Enseignante",
        statut_matrimonial="CELIBATAIRE", numero_securite_sociale=f"SSN-{uuid.uuid4().hex[:8]}",
    )


class SoinsGatingTests(APITestCase):
    """§12-15 : le service SOINS_INFIRMIERS bloque réellement l'action `soins`, jamais les autres."""

    def setUp(self):
        self.addCleanup(functional_service_cache.clear)
        self.addCleanup(lambda: set_tenant_context(None))
        # Les tenant_id utilisés ici ne sont enregistrés dans aucun vrai
        # Tenant Registry — on route donc vers 'default' explicitement,
        # même technique que les tests équivalents de service-personnel.
        self.alias_patch = patch('core.tenant_routing.router.ensure_connection_alias', return_value='default')
        self.alias_patch.start()
        self.addCleanup(self.alias_patch.stop)

    def _authenticated(self, tenant_id):
        set_tenant_context(tenant_id)
        return {'HTTP_X_USER_ID': 'nurse-test', 'HTTP_X_USER_ROLES': 'Infirmiere', 'HTTP_X_TENANT_ID': tenant_id or ''}

    def test_soins_action_blocked_when_soins_infirmiers_disabled(self):
        patient = _make_patient()
        headers = self._authenticated(TENANT_A)
        with patch.object(functional_service_cache, 'get', return_value=False):
            response = self.client.post(
                f'/api/medical-monitoring/patients/{patient.id}/soins/',
                {'type_soin': 'Pansement'}, format='json', **headers,
            )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['error_type'], 'SERVICE_UNAVAILABLE')

    def test_soins_action_allowed_when_soins_infirmiers_enabled(self):
        patient = _make_patient()
        headers = self._authenticated(TENANT_A)
        with patch.object(functional_service_cache, 'get', return_value=True):
            response = self.client.post(
                f'/api/medical-monitoring/patients/{patient.id}/soins/',
                {'type_soin': 'Pansement'}, format='json', **headers,
            )
        # 201 si le payload minimal suffit au serializer, 400 sur un champ
        # métier manquant — dans les deux cas, JAMAIS bloqué par le
        # contrôle de service (la preuve : pas de 404 SERVICE_UNAVAILABLE).
        self.assertNotEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_general_patient_read_is_never_blocked_by_soins_infirmiers(self):
        """Documente la limite assumée : les endpoints généraux partagés restent accessibles."""
        patient = _make_patient()
        headers = self._authenticated(TENANT_A)
        with patch.object(functional_service_cache, 'get', return_value=False):
            response = self.client.get(f'/api/medical-monitoring/patients/{patient.id}/', **headers)
        self.assertNotEqual(response.status_code, status.HTTP_404_NOT_FOUND)
