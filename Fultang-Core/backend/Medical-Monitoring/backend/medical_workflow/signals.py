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

Chantier Medical-Monitoring tenant-aware — point d'attention documenté
dans core/tenant_routing/context.py : un `threading.Thread` N'HÉRITE PAS
du `contextvars` du thread appelant (vérifié empiriquement). Le tenant
courant est donc capturé ICI, dans le thread de la requête (où le Tenant
Context est garanti établi par GatewayHeaderAuthentication), AVANT de
créer le thread de notification — jamais recalculé/deviné à l'intérieur
de ce thread. Il est ensuite transmis explicitement à clinical-agent via
le header `X-Tenant-ID`, avec le jeton de service interne partagé (même
mécanisme que tenant-service ↔ service-personnel/Medical-Monitoring).

Si aucun tenant n'est disponible (context jamais établi, ou explicitement
`tenant_id=None` — pool non assigné) : la notification n'est PAS envoyée.
Un compte non rattaché à un tenant réel n'a pas de configuration
`allow_clinical_agent_export` à vérifier — nier l'envoi est le seul choix
qui ne devine jamais une autorisation. Seule une information technique
(id de visite tronqué, jamais de donnée médicale) est loguée.
"""

import threading
import logging
import os

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from core.tenant_routing.context import get_current_tenant_context
from .models import Visite

logger = logging.getLogger("medical_workflow.signals")

CLINICAL_AGENT_URL = os.getenv(
    "CLINICAL_AGENT_URL",
    "http://fultang-clinical-agent:9000"
)


def _notify_agent(visite_id: str, tenant_id: str):
    """
    Appel HTTP vers l'agent de synchronisation (exécuté dans un thread séparé).
    La visite vient de passer à TERMINE — l'agent va l'enrichir dans la BD tampon.

    `tenant_id` est reçu en PARAMÈTRE explicite (capturé par l'appelant
    dans le thread de requête) — ce thread ne lit jamais le Tenant
    Context lui-même, il ne l'aurait de toute façon pas hérité.
    """
    try:
        import urllib.request
        import urllib.error
        url = f"{CLINICAL_AGENT_URL}/sync/visite/{visite_id}"
        headers = {
            "X-Tenant-ID": tenant_id,
            "X-Internal-Service-Token": settings.TENANT_SERVICE_INTERNAL_TOKEN,
        }
        req = urllib.request.Request(url, method="POST", headers=headers)
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
    Notifie l'agent uniquement si la visite vient de passer à TERMINE
    ET qu'un tenant réel est associé à la requête courante.
    """
    if instance.statut != "TERMINE":
        return

    visite_id = str(instance.id)

    # Capture EXPLICITE, dans CE thread (celui de la requête), avant de
    # créer le thread de notification — voir docstring de module.
    tenant_context = get_current_tenant_context()

    if tenant_context is None or tenant_context.tenant_id is None:
        logger.warning(
            "[Signal] Visite %s terminée sans tenant réel associé à la requête "
            "(contexte absent ou pool non assigné) — notification NON envoyée : "
            "aucune configuration d'autorisation d'export n'existe pour cet état.",
            visite_id[:8],
        )
        return

    tenant_id = tenant_context.tenant_id
    logger.info(f"[Signal] Visite {visite_id[:8]} terminée (tenant={tenant_id}) — notification de l'agent en cours...")

    # Thread séparé : ne bloque pas la réponse HTTP de l'API. tenant_id
    # est passé en argument explicite (voir _notify_agent).
    thread = threading.Thread(
        target=_notify_agent,
        args=(visite_id, tenant_id),
        daemon=True,
        name=f"agent-notify-{visite_id[:8]}"
    )
    thread.start()
