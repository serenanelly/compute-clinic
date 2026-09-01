"""
Phase 4 — Tenant Context Propagation.

Le service reçoit, valide et expose le tenant_id transmis par la Gateway
via X-Tenant-ID. Il ne réalise aucun filtrage métier par tenant à ce
stade (hors périmètre de cette phase).
"""
from django.test import RequestFactory, TestCase

from core.authentication import GatewayHeaderAuthentication


class GatewayHeaderAuthenticationTenantTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.auth = GatewayHeaderAuthentication()

    def test_authenticate_exposes_tenant_id_from_header(self):
        request = self.factory.get(
            "/api/materiels/",
            HTTP_X_USER_ID="9b914558-975f-4b3a-bdaa-d67e95740837",
            HTTP_X_USER_ROLES="ComptableMatiere",
            HTTP_X_TENANT_ID="11111111-1111-1111-1111-111111111111",
        )

        user, auth = self.auth.authenticate(request)

        self.assertEqual(user.id, "9b914558-975f-4b3a-bdaa-d67e95740837")
        self.assertEqual(user.roles, ["ComptableMatiere"])
        self.assertEqual(user.tenant_id, "11111111-1111-1111-1111-111111111111")
        self.assertIsNone(auth)

    def test_authenticate_without_tenant_header_leaves_tenant_id_none(self):
        """Pool non assigné (dev/legacy) : pas de X-Tenant-ID → tenant_id=None."""
        request = self.factory.get(
            "/api/materiels/",
            HTTP_X_USER_ID="9b914558-975f-4b3a-bdaa-d67e95740837",
            HTTP_X_USER_ROLES="ComptableMatiere",
        )

        user, _ = self.auth.authenticate(request)

        self.assertIsNone(user.tenant_id)

    def test_authenticate_without_user_id_returns_none(self):
        """Comportement inchangé : sans X-User-ID, pas d'authentification."""
        request = self.factory.get("/api/materiels/")
        self.assertIsNone(self.auth.authenticate(request))
