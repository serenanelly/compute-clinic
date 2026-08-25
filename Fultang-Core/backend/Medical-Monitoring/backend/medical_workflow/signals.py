# ============================================================
# Fultang — Medical Monitoring
# Signals Django : notification du Clinical Agent
# ============================================================
"""
Ce module définit un signal Django post_save sur le modèle Visite.
Lorsqu'une visite passe au statut TERMINE, l'agent de synchronisation
est notifié via une requête HTTP asynchrone (en thread séparé pour
ne pas bloquer la réponse API du médecin).

L'appel est fire-and-forget : si l'agent est temporairement
indisponible, la tâche planifiée de rattrapage (toutes les 15 min)
prendra le relais.
"""

import threading
import logging
import os

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Visite

logger = logging.getLogger("medical_workflow.signals")

CLINICAL_AGENT_URL = os.getenv(
    "CLINICAL_AGENT_URL",
    "http://fultang-clinical-agent:9000"
)


def _notify_agent(visite_id: str):
    """
    Appel HTTP vers l'agent de synchronisation (exécuté dans un thread séparé).
    La visite vient de passer à TERMINE — l'agent va l'enrichir dans la BD tampon.
    """
    try:
        import urllib.request
        import urllib.error
        url = f"{CLINICAL_AGENT_URL}/sync/visite/{visite_id}"
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info(
                f"[Signal] Agent notifié pour visite {visite_id} — "
                f"réponse HTTP {resp.status}"
            )
    except Exception as e:
        logger.warning(
            f"[Signal] Impossible de notifier l'agent pour visite {visite_id} : {e}. "
            "Le planificateur de rattrapage prendra le relais."
        )


@receiver(post_save, sender=Visite)
def on_visite_saved(sender, instance, created, **kwargs):
    """
    Signal déclenché après chaque sauvegarde d'une Visite.
    Notifie l'agent uniquement si la visite vient de passer à TERMINE.
    """
    if instance.statut == "TERMINE":
        visite_id = str(instance.id)
        logger.info(f"[Signal] Visite {visite_id} terminée — notification de l'agent en cours...")
        # Thread séparé : ne bloque pas la réponse HTTP de l'API
        thread = threading.Thread(
            target=_notify_agent,
            args=(visite_id,),
            daemon=True,
            name=f"agent-notify-{visite_id[:8]}"
        )
        thread.start()
