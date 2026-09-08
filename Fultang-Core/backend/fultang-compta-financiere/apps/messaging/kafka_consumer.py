"""Consumer Kafka en arrière-plan (thread daemon)."""
from __future__ import annotations

import logging
import sys
import threading

from django.conf import settings

from apps.messaging import events as ev
from apps.messaging.events import parse_event
from apps.messaging.patient_cache import (
    is_event_processed,
    mark_event_processed,
    upsert_patient,
)
from config.tenant_routing.context import reset_tenant_context, set_tenant_context

logger = logging.getLogger(__name__)

_consumer_thread = None
_stop_flag = threading.Event()
_handlers: dict[str, callable] = {}


def handle_patient_cree(event: dict) -> None:
    # `patient.cree` n'a aujourd'hui AUCUN producteur dans tout le dépôt
    # FullTang (vérifié) : cet événement ne portera donc jamais de
    # tenant_id réel tant qu'un service ne le produit pas correctement.
    # Écrire quand même dans PatientCache reviendrait à deviner un
    # rattachement tenant (ou à écrire silencieusement dans le pool non
    # assigné) — on refuse explicitement l'écriture plutôt que de
    # deviner, même pattern défensif que medical_workflow/signals.py
    # côté Medical-Monitoring.
    if not event.get('tenant_id'):
        logger.warning(
            "[Kafka] patient.cree reçu sans tenant_id (aucun producteur "
            "de cet événement ne le transmet encore) — écriture "
            "PatientCache ignorée: %s", event.get('patient_id'),
        )
        return
    upsert_patient(event)
    logger.info('[Kafka] PatientCache mis à jour: %s', event.get('patient_id'))


def handle_audit_from_event(event: dict) -> None:
    from apps.comptabilite.models import AuditLog

    event_type = event.get('event_type', '')
    description = f"Événement Kafka {event_type} (event_id={event.get('event_id')})"
    module = 'quittance'
    if 'caisse' in event_type:
        module = 'caisse'
    elif 'ordre_paiement' in event_type:
        module = 'ordre_paiement'

    AuditLog.log(
        action='validation',
        module=module,
        description=description,
        objet_id=event.get('quittance_id') or event.get('caisse_id') or event.get('ordre_id'),
        objet_reference=str(event.get('event_id')),
        donnees_apres=event,
    )


def _dispatch(topic: str, payload: dict) -> None:
    """
    Point d'entrée UNIQUE avant toute écriture (ou lecture) ORM
    déclenchée par un message Kafka consommé — `is_event_processed`/
    `mark_event_processed` (app `messaging`, tenant-scopée) ET le
    handler métier sont tous les deux concernés.

    Le consumer tourne dans un thread daemon séparé (voir
    `_consumer_loop`) : ce thread n'a JAMAIS hérité du Tenant Context du
    thread qui a publié l'événement (un `threading.Thread` n'hérite pas
    des contextvars du thread appelant — vérifié empiriquement lors des
    chantiers service-personnel/Medical-Monitoring, voir
    medical_workflow/signals.py côté Medical-Monitoring pour le même
    problème). Le tenant est donc rétabli explicitement ICI, à partir du
    `tenant_id` transporté dans le payload lui-même (voir events.py),
    AVANT le premier accès ORM, puis nettoyé dans un `finally` — jamais
    de fuite d'un message au suivant, même mécanisme que
    TenantContextCleanupMiddleware pour les requêtes HTTP.
    """
    event_id = payload.get('event_id')
    if not event_id:
        return

    token = set_tenant_context(payload.get('tenant_id'))
    try:
        if is_event_processed(str(event_id)):
            return
        handler = _handlers.get(topic)
        if handler:
            handler(payload)
        mark_event_processed(str(event_id), topic)
    finally:
        reset_tenant_context(token)


def register_handlers() -> None:
    _handlers[ev.TOPIC_PATIENT_CREE] = handle_patient_cree
    _handlers[ev.TOPIC_QUITTANCE_VALIDEE] = handle_audit_from_event
    _handlers[ev.TOPIC_CAISSE_FERMEE] = handle_audit_from_event
    _handlers[ev.TOPIC_ORDRE_PAIEMENT_EXECUTE] = handle_audit_from_event


def _consumer_loop():
    try:
        from kafka import KafkaConsumer
    except ImportError:
        logger.warning('[Kafka] kafka-python non installé — consumer désactivé')
        return

    broker = getattr(settings, 'KAFKA_BROKER_URL', 'fultang-kafka:9092')
    group = getattr(settings, 'KAFKA_CONSUMER_GROUP', 'compta-financiere-group')
    topics = list(getattr(settings, 'KAFKA_TOPICS_CONSUME', ev.TOPICS_CONSUME))

    while not _stop_flag.is_set():
        try:
            consumer = KafkaConsumer(
                *topics,
                bootstrap_servers=[broker],
                group_id=group,
                auto_offset_reset='earliest',
                enable_auto_commit=True,
                consumer_timeout_ms=5000,
            )
            logger.info('[Kafka] Consumer démarré topics=%s', topics)
            for message in consumer:
                if _stop_flag.is_set():
                    break
                try:
                    payload = parse_event(message.value)
                    _dispatch(message.topic, payload)
                except Exception as exc:
                    logger.warning('[Kafka] Erreur traitement message: %s', exc)
            consumer.close()
        except Exception as exc:
            logger.warning('[Kafka] Consumer reconnect dans 10s: %s', exc)
            _stop_flag.wait(10)


class KafkaConsumerService:
    def start_background(self):
        global _consumer_thread
        if _consumer_thread and _consumer_thread.is_alive():
            return
        register_handlers()
        _consumer_thread = threading.Thread(target=_consumer_loop, daemon=True, name='kafka-consumer')
        _consumer_thread.start()

    def stop(self):
        _stop_flag.set()


_consumer_service = KafkaConsumerService()


def get_consumer() -> KafkaConsumerService:
    return _consumer_service


def should_start_consumer() -> bool:
    if not getattr(settings, 'USE_KAFKA', False):
        return False
    argv = sys.argv
    if any(cmd in argv for cmd in ('migrate', 'makemigrations', 'test', 'shell')):
        return False
    return True
