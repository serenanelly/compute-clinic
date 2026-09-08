"""
tests.py — App Messaging (Kafka).

Kafka n'est PAS démarré dans cet environnement de développement (aucun
conteneur kafka/zookeeper actif) : ces tests appellent directement les
fonctions de dispatch/handler avec un dict fabriqué (bypass complet du
client Kafka réel) — ils ne constituent donc jamais une preuve
end-to-end contre un vrai broker, seulement une preuve unitaire du
comportement de propagation du Tenant Context.

Contexte : `apps.messaging.kafka_consumer._consumer_loop` tourne dans un
thread daemon séparé, qui n'hérite JAMAIS du Tenant Context du thread
qui a publié l'événement (contextvars ne traversent pas les frontières
de threading.Thread — voir config/tenant_routing/context.py et
medical_workflow/signals.py côté Medical-Monitoring pour le même
problème déjà rencontré). `_dispatch()` rétablit donc explicitement le
Tenant Context à partir du `tenant_id` transporté dans le payload,
AVANT tout accès ORM (y compris `is_event_processed`/`mark_event_processed`,
qui vivent dans l'app `messaging`, elle aussi tenant-scopée), puis le
nettoie dans un `finally`.
"""
import uuid
from unittest.mock import patch

from django.test import TestCase

from apps.messaging import kafka_consumer
from apps.messaging.events import TOPIC_PATIENT_CREE, TOPIC_QUITTANCE_VALIDEE
from apps.messaging.patient_cache import PatientCache, ProcessedEvent
from config.tenant_routing.context import set_tenant_context

TENANT_A = str(uuid.uuid4())


class DispatchTenantContextTests(TestCase):
    """`_dispatch` doit rétablir puis nettoyer le Tenant Context autour de CHAQUE message."""

    def setUp(self):
        kafka_consumer.register_handlers()
        self.addCleanup(lambda: set_tenant_context(None))

    def test_dispatch_establishes_tenant_context_before_orm_write(self):
        """Le handler métier doit voir le tenant_id transporté par le payload."""
        seen = {}

        def fake_handler(payload):
            from config.tenant_routing.context import require_tenant_context
            seen['tenant_id'] = require_tenant_context().tenant_id

        # TENANT_A est un UUID fabriqué, jamais enregistré dans le Tenant
        # Registry — sans ce mock, `_dispatch` (via is_event_processed,
        # lecture ORM sur l'app messaging, tenant-scopée) déclencherait un
        # vrai appel réseau vers tenant-service et échouerait avec
        # TenantDatabaseNotFoundError. On redirige l'alias résolu vers
        # 'default' (seule base réellement présente en environnement de
        # test) : seul le Tenant Context observé par le handler est
        # examiné ici, pas la base physique choisie.
        with patch.dict(kafka_consumer._handlers, {'fake.topic': fake_handler}), \
                patch('config.tenant_routing.router.ensure_connection_alias', return_value='default'):
            kafka_consumer._dispatch('fake.topic', {'event_id': str(uuid.uuid4()), 'tenant_id': TENANT_A})

        self.assertEqual(seen['tenant_id'], TENANT_A)

    def test_dispatch_resets_context_after_processing(self):
        set_tenant_context(None)
        with patch.dict(kafka_consumer._handlers, {'fake.topic': lambda payload: None}), \
                patch('config.tenant_routing.router.ensure_connection_alias', return_value='default'):
            kafka_consumer._dispatch('fake.topic', {'event_id': str(uuid.uuid4()), 'tenant_id': TENANT_A})

        from config.tenant_routing.context import require_tenant_context
        # Le contexte est revenu à l'état antérieur (None), pas resté sur TENANT_A.
        self.assertIsNone(require_tenant_context().tenant_id)

    def test_dispatch_resets_context_even_if_handler_raises(self):
        set_tenant_context(None)

        def boom(payload):
            raise RuntimeError("boom")

        with patch.dict(kafka_consumer._handlers, {'fake.topic': boom}), \
                patch('config.tenant_routing.router.ensure_connection_alias', return_value='default'):
            with self.assertRaises(RuntimeError):
                kafka_consumer._dispatch('fake.topic', {'event_id': str(uuid.uuid4()), 'tenant_id': TENANT_A})

        from config.tenant_routing.context import require_tenant_context
        self.assertIsNone(require_tenant_context().tenant_id)

    def test_dispatch_marks_event_processed_within_tenant_context(self):
        event_id = str(uuid.uuid4())
        with patch.dict(kafka_consumer._handlers, {'fake.topic': lambda payload: None}):
            kafka_consumer._dispatch('fake.topic', {'event_id': event_id, 'tenant_id': None})

        self.assertTrue(ProcessedEvent.objects.using('default').filter(event_id=event_id).exists())

    def test_dispatch_is_idempotent_for_already_processed_event(self):
        event_id = str(uuid.uuid4())
        calls = []

        def fake_handler(payload):
            calls.append(payload)

        with patch.dict(kafka_consumer._handlers, {'fake.topic': fake_handler}):
            kafka_consumer._dispatch('fake.topic', {'event_id': event_id, 'tenant_id': None})
            kafka_consumer._dispatch('fake.topic', {'event_id': event_id, 'tenant_id': None})

        self.assertEqual(len(calls), 1)

    def test_dispatch_real_quittance_validee_handler_writes_auditlog_in_tenant_context(self):
        """Intégration légère : le vrai handler audit passe bien par le Tenant Context établi."""
        set_tenant_context(None)
        payload = {
            'event_id': str(uuid.uuid4()),
            'event_type': TOPIC_QUITTANCE_VALIDEE,
            'quittance_id': 1,
            'tenant_id': None,
        }
        kafka_consumer._dispatch(TOPIC_QUITTANCE_VALIDEE, payload)

        from apps.comptabilite.models import AuditLog
        self.assertTrue(
            AuditLog.objects.using('default').filter(objet_reference=str(payload['event_id'])).exists()
        )


class HandlePatientCreeDefensiveTests(TestCase):
    """
    `patient.cree` n'a aujourd'hui aucun producteur dans le dépôt : tant
    qu'un service ne le produit pas avec un vrai tenant_id, la sécurité
    consiste à REFUSER l'écriture plutôt que de deviner un rattachement
    tenant (ou d'écrire silencieusement dans le pool non assigné).
    """

    def setUp(self):
        # Ces tests appellent le handler DIRECTEMENT (hors `_dispatch`,
        # qui établirait normalement le Tenant Context lui-même) — on le
        # simule ici pour le cas où le handler écrit réellement en base
        # (pool non assigné, tenant_id=None est un état valide).
        self._token = set_tenant_context(None)
        self.addCleanup(lambda: set_tenant_context(None))

    def test_missing_tenant_id_is_skipped_with_warning(self):
        with self.assertLogs('apps.messaging.kafka_consumer', level='WARNING'):
            kafka_consumer.handle_patient_cree({'patient_id': 'p1', 'nom': 'Doe'})

        self.assertFalse(PatientCache.objects.using('default').filter(patient_id='p1').exists())

    def test_present_tenant_id_allows_the_write(self):
        kafka_consumer.handle_patient_cree({
            'patient_id': 'p2', 'nom': 'Doe', 'prenom': 'Jane', 'tenant_id': TENANT_A,
        })
        self.assertTrue(PatientCache.objects.using('default').filter(patient_id='p2').exists())
