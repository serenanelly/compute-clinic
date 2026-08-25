# ============================================================
# Fultang — Clinical Agent
# API FastAPI : point d'entrée du service
# ============================================================
"""
Endpoints exposés :

  POST /sync/visite/{visite_id}
      Déclenché par le signal Django de Medical-Monitoring
      lorsqu'une visite passe au statut TERMINE.

  POST /sync/all
      Synchronise toutes les visites TERMINE non encore traitées.
      Appelé au démarrage et par le planificateur (toutes les 15 min).

  GET  /export
      Retourne les cas cliniques anonymisés depuis la BD tampon.
      C'est ici que les systèmes externes viennent chercher les données.

  GET  /health
      Vérification de santé du service.

  GET  /stats
      Statistiques sur la BD tampon (nb cas, nb visites, etc.).
"""

import logging
import os
import hashlib
import time
import threading
import hmac
from contextlib import asynccontextmanager
from typing import Optional
from datetime import datetime
from collections import defaultdict, deque

from fastapi import FastAPI, HTTPException, Query, Header 
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text

from database import init_tampon_db, MainSession, TamponSession
from models import CasClinique, VisiteSynced
from sync import sync_visite, sync_all_completed_visits

# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("agent.main")
MEDTUTOR_API_KEY_HASH = os.getenv("MEDTUTOR_API_KEY_HASH") 

if not MEDTUTOR_API_KEY_HASH:
    logger.warning("MEDTUTOR_API_KEY_HASH n'est pas configurée.")

# ============================================================
# RATE LIMITING
# ============================================================

FULTANG_RATE_LIMIT_REQUESTS = int(
    os.getenv("FULTANG_RATE_LIMIT_REQUESTS", "10")
)

FULTANG_RATE_LIMIT_WINDOW_SECONDS = int(
    os.getenv("FULTANG_RATE_LIMIT_WINDOW_SECONDS", "60")
)

_rate_limit_requests = defaultdict(deque)
_rate_limit_lock = threading.Lock()


def check_rate_limit(client_id: str) -> tuple[bool, int]:
    """
    Limite le nombre de requêtes /export par client authentifié.

    Retourne :
        (True, 0)  -> requête autorisée
        (False, n) -> requête refusée, n secondes avant retry
    """
    now = time.monotonic()

    with _rate_limit_lock:
        timestamps = _rate_limit_requests[client_id]

        # Supprime les requêtes sorties de la fenêtre
        while timestamps and (
            now - timestamps[0] >= FULTANG_RATE_LIMIT_WINDOW_SECONDS
        ):
            timestamps.popleft()

        # Limite atteinte
        if len(timestamps) >= FULTANG_RATE_LIMIT_REQUESTS:
            retry_after = int(
                max(
                    1,
                    FULTANG_RATE_LIMIT_WINDOW_SECONDS
                    - (now - timestamps[0])
                )
            )

            return False, retry_after

        # Nouvelle requête autorisée
        timestamps.append(now)

        return True, 0

# fonction de vérification de l'API key 

def verify_api_key(api_key: Optional[str]) -> None:
    if not api_key or not MEDTUTOR_API_KEY_HASH:
        raise HTTPException(
            status_code=401,
            detail = "Authentification requise",
        )
    received_hash = hashlib.sha256(api_key.encode()).hexdigest()
    if not hmac.compare_digest(received_hash, MEDTUTOR_API_KEY_HASH):
        raise HTTPException(
            status_code=401,
            detail = "Clé API invalide",
        )
                   

# ─────────────────────────────────────────────────────────────────────────────
# Planificateur de rattrapage périodique (toutes les 15 min)
# ─────────────────────────────────────────────────────────────────────────────

scheduler = BackgroundScheduler()


def scheduled_sync_job():
    """Tâche planifiée : rattrapage des visites TERMINE non synchronisées."""
    logger.info("=== [PLANIFICATEUR] Démarrage du rattrapage périodique ===")
    try:
        with MainSession() as main_db, TamponSession() as tampon_db:
            result = sync_all_completed_visits(main_db, tampon_db)
        logger.info(f"[PLANIFICATEUR] Terminé : {result['total_pending']} visite(s) traitées.")
    except Exception as e:
        logger.error(f"[PLANIFICATEUR] Erreur : {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Lifecycle FastAPI
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Démarrage
    logger.info("Initialisation de la BD tampon...")
    init_tampon_db()

    logger.info("Rattrapage initial des visites TERMINE...")
    try:
        with MainSession() as main_db, TamponSession() as tampon_db:
            sync_all_completed_visits(main_db, tampon_db)
    except Exception as e:
        logger.warning(f"Rattrapage initial échoué (BD principale peut-être pas encore prête) : {e}")

    # Planificateur toutes les 15 minutes
    scheduler.add_job(scheduled_sync_job, "interval", minutes=15, id="periodic_sync")
    scheduler.start()
    logger.info("Planificateur démarré (toutes les 15 minutes).")

    yield

    # Arrêt
    scheduler.shutdown()
    logger.info("Planificateur arrêté.")


# ─────────────────────────────────────────────────────────────────────────────
# Application
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Fultang — Clinical Agent",
    description=(
        "Agent de synchronisation entre la BD principale Medical-Monitoring "
        "et la BD tampon des cas cliniques anonymisés. "
        "Les systèmes externes consomment l'endpoint /export sans affecter le système central."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Infra"])
def health():
    """Vérifie que le service est opérationnel."""
    try:
        with TamponSession() as db:
            db.execute(text("SELECT 1"))
        tampon_ok = True
    except Exception:
        tampon_ok = False

    try:
        with MainSession() as db:
            db.execute(text("SELECT 1"))
        main_ok = True
    except Exception:
        main_ok = False

    status = "ok" if (tampon_ok and main_ok) else "degraded"
    return {
        "status": status,
        "tampon_db": "connected" if tampon_ok else "unreachable",
        "main_db": "connected" if main_ok else "unreachable",
    }


@app.get("/stats", tags=["Infra"])
def stats():
    """Statistiques sur la BD tampon."""
    with TamponSession() as db:
        nb_cas = db.query(CasClinique).count()
        nb_visites = db.query(VisiteSynced).count()

    return {
        "cas_cliniques": nb_cas,
        "visites_synchronisees": nb_visites,
    }


@app.post("/sync/visite/{visite_id}", tags=["Synchronisation"])
def sync_visite_endpoint(visite_id: str):
    """
    Synchronise une visite terminée dans la BD tampon.
    Appelé par le signal Django de Medical-Monitoring dès qu'une visite passe à TERMINE.
    """
    logger.info(f"Demande de synchronisation reçue pour la visite : {visite_id}")
    try:
        with MainSession() as main_db, TamponSession() as tampon_db:
            result = sync_visite(visite_id, main_db, tampon_db)
        return result
    except Exception as e:
        logger.error(f"Erreur lors de la synchronisation de la visite {visite_id} : {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sync/all", tags=["Synchronisation"])
def sync_all_endpoint():
    """
    Synchronise toutes les visites TERMINE non encore traitées.
    Utile pour le rattrapage manuel ou après une panne.
    """
    logger.info("Synchronisation globale demandée.")
    try:
        with MainSession() as main_db, TamponSession() as tampon_db:
            result = sync_all_completed_visits(main_db, tampon_db)
        return result
    except Exception as e:
        logger.error(f"Erreur lors de la synchronisation globale : {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/export", tags=["Export"])
def export_cas_cliniques(
    skip: int = Query(
        0,
        ge=0,
        description="Nombre de cas à ignorer (pagination)"
    ),
    limit: int = Query(
        100,
        ge=1,
        le=1000,
        description="Nombre maximum de cas à retourner"
    ),
    updated_since: Optional[datetime] = Query(
        None,
        description=(
            "Retourne uniquement les cas dont la date de mise à jour "
            "est postérieure à cette date"
        )
    ),
    sexe: Optional[str] = Query(
        None,
        description="Filtrer par sexe (M / F)"
    ),
    groupe_sanguin: Optional[str] = Query(
        None,
        description="Filtrer par groupe sanguin"
    ),
    age_min: Optional[int] = Query(
        None,
        ge=0,
        description="Âge minimum"
    ),
    age_max: Optional[int] = Query(
        None,
        ge=0,
        description="Âge maximum"
    ),
    x_api_key: Optional[str] = Header(
        None,
        alias="X-API-Key"
    ),
):
    """
    Exporte les cas cliniques anonymisés depuis la BD tampon.

    Sans updated_since :
        export complet avec pagination.

    Avec updated_since :
        export uniquement des cas créés ou modifiés
        depuis la date indiquée.

    Les systèmes externes consomment cet endpoint sans
    accéder directement à la BD centrale.
    """

    verify_api_key(x_api_key)

    # Rate limiting après authentification : seules les requêtes
    # provenant d'un client authentifié consomment le quota.
    client_id = hashlib.sha256(x_api_key.encode()).hexdigest()

    allowed, retry_after = check_rate_limit(client_id)

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Trop de requêtes. Veuillez réessayer plus tard.",
            headers={
                "Retry-After": str(retry_after)
            },
        )

    with TamponSession() as db:
        query = db.query(CasClinique)

        # Synchronisation incrémentale :
        # uniquement les cas créés ou modifiés après
        # le dernier point de synchronisation fourni.
        if updated_since:
            query = query.filter(
                CasClinique.mis_a_jour_le > updated_since
            )

        # Filtres optionnels
        if sexe:
            query = query.filter(
                CasClinique.sexe == sexe.upper()
            )

        if groupe_sanguin:
            query = query.filter(
                CasClinique.groupe_sanguin == groupe_sanguin.upper()
            )

        if age_min is not None:
            query = query.filter(
                CasClinique.age >= age_min
            )

        if age_max is not None:
            query = query.filter(
                CasClinique.age <= age_max
            )

        # Total après application de tous les filtres
        total = query.count()

        # Pagination déterministe
        cas_list = (
            query
            .order_by(CasClinique.mis_a_jour_le, CasClinique.id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "updated_since": (
            updated_since.isoformat()
            if updated_since
            else None
        ),
        "cas_cliniques": [
            {
                "id": c.id,
                "age": c.age,
                "sexe": c.sexe,
                "statut_matrimonial": c.statut_matrimonial,
                "nombre_enfants": c.nombre_enfants,
                "profession": c.profession,

                "donnees_cliniques": {
                    "groupe_sanguin": c.groupe_sanguin,
                    "facteur_rhesus": c.facteur_rhesus,
                    "electrophorese_hb": c.electrophorese_hb,
                    "poids": c.poids,
                    "taille": c.taille,
                    "pouls": c.pouls,
                    "taux_oxygene": c.taux_oxygene,
                    "temperature": c.temperature,
                    "tension_arterielle": c.tension_arterielle,
                },

                "allergies": c.allergies or [],
                "maladies": c.maladies or [],
                "antecedents": c.antecedents or [],
                "mode_de_vie": c.mode_de_vie or {},
                "addictions": c.addictions or [],
                "voyages": c.voyages or [],
                "activites_physiques": c.activites_physiques or [],
                "visites": c.visites or [],
                "nb_visites_traitees": c.nb_visites_traitees,

                "cree_le": (
                    c.cree_le.isoformat()
                    if c.cree_le
                    else None
                ),
                "mis_a_jour_le": (
                    c.mis_a_jour_le.isoformat()
                    if c.mis_a_jour_le
                    else None
                ),
            }
            for c in cas_list
        ],
    }