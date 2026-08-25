"""Producteur Kafka singleton — fire-and-forget, ne bloque jamais HTTP."""
from __future__ import annotations

import json
import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_producer_instance = None


class KafkaProducerService:
    def __init__(self, broker_url: str):
        self.broker_url = broker_url
        self._producer = None

    def connect(self) -> bool:
        try:
            from kafka import KafkaProducer
            self._producer = KafkaProducer(
                bootstrap_servers=[self.broker_url],
                value_serializer=lambda v: json.dumps(v, default=str).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                acks='0',
                retries=0,
                request_timeout_ms=2000,
                max_block_ms=500,
            )
            return True
        except Exception as exc:
            logger.warning('[Kafka] Connexion producteur impossible: %s', exc)
            self._producer = None
            return False

    def publish(self, topic: str, event: dict[str, Any], key: str | None = None) -> bool:
        if not self._producer:
            return False
        try:
            future = self._producer.send(topic, value=event, key=key)

            def _on_success(record_metadata):
                logger.info(
                    '[Kafka] Event publié topic=%s event_id=%s partition=%s',
                    topic, event.get('event_id'), record_metadata.partition,
                )

            def _on_error(exc):
                logger.warning('[Kafka] Échec publication topic=%s: %s', topic, exc)

            future.add_callback(_on_success)
            future.add_errback(_on_error)
            return True
        except Exception as exc:
            logger.warning('[Kafka] Échec envoi topic=%s: %s', topic, exc)
            return False

    def close(self):
        if self._producer:
            try:
                self._producer.flush(timeout=2)
                self._producer.close(timeout=2)
            except Exception:
                pass
            self._producer = None


def get_producer() -> KafkaProducerService | None:
    global _producer_instance
    if not getattr(settings, 'USE_KAFKA', False):
        return None
    if _producer_instance is None:
        broker = getattr(settings, 'KAFKA_BROKER_URL', 'fultang-kafka:9092')
        _producer_instance = KafkaProducerService(broker)
        _producer_instance.connect()
    return _producer_instance


def publish_event(topic: str, event: dict[str, Any], key: str | None = None) -> None:
    """Fire-and-forget : ne lève jamais d'exception."""
    try:
        producer = get_producer()
        if not producer:
            logger.debug('[Kafka] USE_KAFKA=False — event non publié: %s', topic)
            return
        if not producer.publish(topic, event, key=key):
            logger.warning('[Kafka] Event non publié (broker down?): %s', topic)
    except Exception as exc:
        logger.warning('[Kafka] publish_event ignoré: %s', exc)
