"""Définition et sérialisation des événements Kafka métier."""
from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

TOPIC_QUITTANCE_VALIDEE = 'quittance.validee'
TOPIC_CAISSE_FERMEE = 'caisse.fermee'
TOPIC_ORDRE_PAIEMENT_EXECUTE = 'ordre_paiement.execute'
TOPIC_PATIENT_CREE = 'patient.cree'

TOPICS_PRODUCE = [
    TOPIC_QUITTANCE_VALIDEE,
    TOPIC_CAISSE_FERMEE,
    TOPIC_ORDRE_PAIEMENT_EXECUTE,
]
TOPICS_CONSUME = [
    TOPIC_PATIENT_CREE,
    TOPIC_QUITTANCE_VALIDEE,
    TOPIC_CAISSE_FERMEE,
    TOPIC_ORDRE_PAIEMENT_EXECUTE,
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class BaseEvent:
    event_type: str = ''
    source: str = 'compta-financiere'
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class QuittanceValideeEvent(BaseEvent):
    event_type: str = TOPIC_QUITTANCE_VALIDEE
    quittance_id: int = 0
    patient_id: str | None = None
    montant: str = '0'
    date: str = field(default_factory=_now_iso)
    session_id: int | None = None


@dataclass
class CaisseFermeeEvent(BaseEvent):
    event_type: str = TOPIC_CAISSE_FERMEE
    caisse_id: int = 0
    montant_total: str = '0'
    ecart: str = '0'
    date: str = field(default_factory=lambda: datetime.now(timezone.utc).date().isoformat())
    caissier_id: int | None = None


@dataclass
class OrdrePaiementExecuteEvent(BaseEvent):
    event_type: str = TOPIC_ORDRE_PAIEMENT_EXECUTE
    ordre_id: int = 0
    beneficiaire: str = ''
    montant: str = '0'
    date: str = field(default_factory=_now_iso)


def build_event(event: BaseEvent) -> dict[str, Any]:
    return event.to_dict()


def parse_event(raw: bytes) -> dict[str, Any]:
    import json
    return json.loads(raw.decode('utf-8'))
