"""Cache local des patients (alimenté par consumer patient.cree ou HTTP Medical)."""
from __future__ import annotations

from django.db import models


class PatientCache(models.Model):
    patient_id = models.CharField(max_length=36, primary_key=True)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100, blank=True, default='')
    matricule = models.CharField(max_length=20, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cache Patient'
        verbose_name_plural = 'Cache Patients'

    def __str__(self):
        return f'{self.nom} {self.prenom}'.strip()


class ProcessedEvent(models.Model):
    """Idempotence des consumers Kafka."""
    event_id = models.UUIDField(unique=True)
    topic = models.CharField(max_length=100)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Événement traité'
        ordering = ['-processed_at']

    def __str__(self):
        return f'{self.topic} — {self.event_id}'


def get_patient_display_name(patient_id: str | None) -> str | None:
    if not patient_id:
        return None
    try:
        p = PatientCache.objects.get(pk=str(patient_id))
        name = f'{p.nom} {p.prenom}'.strip()
        return name or None
    except PatientCache.DoesNotExist:
        return None


def upsert_patient(event: dict) -> PatientCache:
    patient_id = str(event.get('patient_id', ''))
    defaults = {
        'nom': event.get('nom', 'Inconnu'),
        'prenom': event.get('prenom', ''),
        'matricule': event.get('matricule', ''),
    }
    obj, _ = PatientCache.objects.update_or_create(
        patient_id=patient_id,
        defaults=defaults,
    )
    return obj


def is_event_processed(event_id: str) -> bool:
    return ProcessedEvent.objects.filter(event_id=event_id).exists()


def mark_event_processed(event_id: str, topic: str) -> None:
    ProcessedEvent.objects.get_or_create(event_id=event_id, defaults={'topic': topic})
