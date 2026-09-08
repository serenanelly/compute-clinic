"""
tests.py — Client HTTP Medical Monitoring (apps/integration/medical_client.py).

`_get()` doit transmettre X-Tenant-ID (Tenant Context courant) sur les
DEUX chemins qu'il essaie (Gateway ET repli direct SERVICE_MEDICAL_URL)
— sans ce header, un appel qui contourne la Gateway (le repli direct)
perdait silencieusement le tenant courant côté Medical-Monitoring.
"""
import uuid
from unittest.mock import MagicMock, patch

from django.test import TestCase

from apps.integration import medical_client
from config.tenant_routing.context import reset_tenant_context, set_tenant_context

TENANT_A = str(uuid.uuid4())


class MedicalClientTenantHeaderTests(TestCase):
    def setUp(self):
        self._token = set_tenant_context(None)
        self.addCleanup(lambda: set_tenant_context(None))

    def _call_get_and_capture_headers(self):
        captured = {}

        class _FakeResponse:
            def __enter__(self):
                return self
            def __exit__(self, *a):
                return False
            def read(self):
                return b'{}'

        def fake_urlopen(req, timeout=8):
            captured['headers'] = dict(req.headers)
            return _FakeResponse()

        with patch.object(medical_client, 'urlopen', side_effect=fake_urlopen):
            medical_client._get('/patients/', token='sometoken')

        return captured.get('headers', {})

    def test_header_present_when_tenant_context_set(self):
        set_tenant_context(TENANT_A)
        headers = self._call_get_and_capture_headers()
        # urllib.Request normalise les noms de header en Title-Case.
        self.assertEqual(headers.get('X-tenant-id'), TENANT_A)

    def test_header_absent_when_no_real_tenant_context(self):
        set_tenant_context(None)
        headers = self._call_get_and_capture_headers()
        self.assertNotIn('X-tenant-id', headers)

    def test_header_never_sent_as_literal_none_string(self):
        set_tenant_context(None)
        headers = self._call_get_and_capture_headers()
        self.assertNotEqual(headers.get('X-tenant-id'), 'None')
