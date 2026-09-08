"""
Tests unitaires — App Caisse.
"""
from datetime import date
from django.test import RequestFactory, TestCase
from rest_framework.test import APIClient
from rest_framework import status

from apps.comptabilite.models import CompteComptable, Journal, ExerciceComptable
from apps.caisse.models import Quittance, CaisseJournaliere
from config.authentication import GatewayHeaderAuthentication
from config.tenant_routing.context import reset_tenant_context, set_tenant_context

_tenant_context_token = None


def setUpModule():
    """Voir apps/comptabilite/tests.py::setUpModule pour l'explication complète."""
    global _tenant_context_token
    _tenant_context_token = set_tenant_context(None)


def tearDownModule():
    reset_tenant_context(_tenant_context_token)


def setup_base():
    compte = CompteComptable.objects.get_or_create(
        numero_compte='571', defaults={'libelle': 'Caisse', 'classe': '5', 'type_compte': 'tresorerie'}
    )[0]
    journal = Journal.objects.get_or_create(
        code='JC', defaults={'libelle': 'Journal de Caisse', 'compte_contrepartie': compte}
    )[0]
    exercice = ExerciceComptable.objects.get_or_create(
        annee=2026, defaults={'date_debut': date(2026, 1, 1), 'date_fin': date(2026, 12, 31), 'statut': 'ouvert'}
    )[0]
    return compte, journal, exercice


class QuittanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        setup_base()

    def test_create_quittance(self):
        r = self.client.post('/api/quittances/', {
            'montant': '15000.00', 'motif': 'Consultation',
            'type_recette': 'consultation', 'mode_paiement': 'especes',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(r.data['numero'].startswith('QT-'))
        self.assertTrue(r.data['est_validee'])

    def test_list_quittances(self):
        r = self.client.get('/api/quittances/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_detail_quittance(self):
        r = self.client.post('/api/quittances/', {
            'montant': '5000.00', 'motif': 'Labo',
            'type_recette': 'laboratoire', 'mode_paiement': 'mobile_money',
        }, format='json')
        qid = r.data['id']
        r2 = self.client.get(f'/api/quittances/{qid}/')
        self.assertEqual(r2.status_code, status.HTTP_200_OK)

    def test_quittance_assurance_calcul_parts(self):
        """RÈGLE MÉTIER : calcul automatique part patient / part assurance."""
        r = self.client.post('/api/quittances/', {
            'montant': '20000.00', 'motif': 'Consultation assuré',
            'type_recette': 'consultation', 'mode_paiement': 'assurance',
            'est_assure': True, 'taux_couverture': '80.00',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(float(r.data['montant_assurance']), 16000.0)
        self.assertEqual(float(r.data['montant_patient']), 4000.0)

    def test_du_jour(self):
        r = self.client.get('/api/quittances/du_jour/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('total', r.data)

    def test_a_comptabiliser(self):
        r = self.client.get('/api/quittances/a_comptabiliser/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


class CaisseJournaliereTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_ouvrir_caisse(self):
        r = self.client.post('/api/caisse-journaliere/ouvrir/', {
            'solde_ouverture': '100000.00'
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['statut'], 'ouverte')

    def test_double_ouverture_meme_jour_retourne_400(self):
        """RÈGLE MÉTIER : une seule caisse par jour."""
        self.client.post('/api/caisse-journaliere/ouvrir/', {'solde_ouverture': '100000'}, format='json')
        r = self.client.post('/api/caisse-journaliere/ouvrir/', {'solde_ouverture': '50000'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_caisses(self):
        r = self.client.get('/api/caisse-journaliere/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_fermer_caisse(self):
        r = self.client.post('/api/caisse-journaliere/ouvrir/', {'solde_ouverture': '100000'}, format='json')
        cid = r.data['id']
        r2 = self.client.patch(f'/api/caisse-journaliere/{cid}/fermer/', {'solde_physique': '98000'}, format='json')
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.data['statut'], 'fermee')


class GatewayHeaderAuthenticationTenantTests(TestCase):
    """
    Phase 4 — Tenant Context Propagation.

    Le service reçoit, valide et expose le tenant_id transmis par la
    Gateway, via X-Tenant-ID (headers injectés) OU via le JWT décodé
    localement (fallback sans headers) — les deux chemins de
    GatewayHeaderAuthentication doivent porter tenant_id. Aucun filtrage
    métier par tenant n'est ajouté à ce stade (hors périmètre).
    """

    def setUp(self):
        self.factory = RequestFactory()
        self.auth = GatewayHeaderAuthentication()
        # authenticate() est appelé ici directement (hors cycle de
        # requête HTTP réel), donc sans TenantContextCleanupMiddleware
        # pour nettoyer le Tenant Context qu'il établit désormais —
        # on le fait nous-mêmes pour ne jamais laisser fuir un tenant_id
        # de test vers les classes de test suivantes du même module
        # (ex: CaisseJournaliereTests/QuittanceTests, qui créent des
        # objets en base hors requête et attendent le contexte neutre
        # de setUpModule).
        self.addCleanup(lambda: set_tenant_context(None))

    def test_authenticate_exposes_tenant_id_from_header(self):
        request = self.factory.get(
            "/api/quittances/",
            HTTP_X_USER_ID="9b914558-975f-4b3a-bdaa-d67e95740837",
            HTTP_X_USER_ROLES="ComptableFinancier",
            HTTP_X_TENANT_ID="11111111-1111-1111-1111-111111111111",
        )

        user, auth = self.auth.authenticate(request)

        self.assertEqual(user.tenant_id, "11111111-1111-1111-1111-111111111111")
        self.assertIsNone(auth)

    def test_authenticate_without_tenant_header_leaves_tenant_id_none(self):
        request = self.factory.get(
            "/api/quittances/",
            HTTP_X_USER_ID="9b914558-975f-4b3a-bdaa-d67e95740837",
            HTTP_X_USER_ROLES="ComptableFinancier",
        )

        user, _ = self.auth.authenticate(request)

        self.assertIsNone(user.tenant_id)

    def test_authenticate_without_user_id_returns_none(self):
        request = self.factory.get("/api/quittances/")
        self.assertIsNone(self.auth.authenticate(request))

    def test_jwt_fallback_path_also_exposes_tenant_id(self):
        """Sans headers X-User-*, un Bearer JWT Gateway est décodé localement — doit aussi porter tenant_id."""
        import jwt
        from django.conf import settings

        token = jwt.encode(
            {
                "sub": "9b914558-975f-4b3a-bdaa-d67e95740837",
                "roles": ["ComptableFinancier"],
                "tenant_id": "11111111-1111-1111-1111-111111111111",
            },
            settings.GATEWAY_JWT_SECRET,
            algorithm="HS256",
        )
        request = self.factory.get("/api/quittances/", HTTP_AUTHORIZATION=f"Bearer {token}")

        user, _ = self.auth.authenticate(request)

        self.assertIsNotNone(user)
        self.assertEqual(user.tenant_id, "11111111-1111-1111-1111-111111111111")
