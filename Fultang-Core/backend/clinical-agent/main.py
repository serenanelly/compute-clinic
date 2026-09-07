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

from database import init_tampon_db, get_main_session_for_tenant, TamponSession
from models import CasClinique, VisiteSynced
from sync import sync_visite, sync_all_completed_visits
from engine_registry import TenantDatabaseInactiveError
from registry_client import (
    TENANT_SERVICE_INTERNAL_TOKEN,
    TenantDatabaseNotFoundError,
    TenantNotFoundError,
    TenantRegistryUnavailableError,
    get_tenant_config,
    list_active_tenant_databases,
)

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


def verify_internal_service_token(token: Optional[str]) -> None:
    """
    Protège /sync/visite/{id} et /sync/all — même mécanisme que
    IsInternalService côté tenant-service/service-personnel/Medical-Monitoring
    (jeton partagé, comparaison en temps constant). Avant le chantier
    Medical-Monitoring tenant-aware, ces endpoints n'étaient protégés que
    par l'isolation réseau Docker ; maintenant qu'ils font confiance à un
    `tenant_id` transmis par l'appelant pour choisir une base, cette
    confiance doit être vérifiable — un appel non authentifié est rejeté.
    """
    if not token or not TENANT_SERVICE_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Authentification interne requise.")
    if not hmac.compare_digest(token, TENANT_SERVICE_INTERNAL_TOKEN):
        raise HTTPException(status_code=401, detail="Jeton de service interne invalide.")


def verify_export_authorization(tenant_id: str) -> None:
    """
    Vérifie `allow_clinical_agent_export` AVANT toute lecture de données
    médicales (voir sync_visite_endpoint/sync_all_endpoint) — le refus
    intervient ici, jamais après coup. Un tenant inconnu ou un Registry
    injoignable sont traités comme un refus explicite (jamais une
    lecture "par défaut") ; ce sont des 503/404, pas des 200 silencieux.
    """
    try:
        config = get_tenant_config(tenant_id)
    except TenantNotFoundError:
        raise HTTPException(status_code=404, detail="Tenant introuvable.")
    except TenantRegistryUnavailableError:
        raise HTTPException(status_code=503, detail="Tenant Registry indisponible — synchronisation refusée par prudence.")

    if not config.allow_clinical_agent_export:
        raise HTTPException(status_code=403, detail="Ce tenant n'autorise pas l'export vers clinical-agent.")


# ─────────────────────────────────────────────────────────────────────────────
# Planificateur de rattrapage périodique (toutes les 15 min)
# ─────────────────────────────────────────────────────────────────────────────

scheduler = BackgroundScheduler()


def sync_all_known_tenants() -> dict:
    """
    Énumère EXPLICITEMENT les tenants ayant une base MEDICAL active
    (via le Tenant Registry, `resolve-active`), puis lance un rattrapage
    par tenant — jamais un parcours implicite "toutes les bases" (voir
    §10 de la tâche). Utilisé au démarrage et par le planificateur
    périodique UNIQUEMENT (jamais exposé comme endpoint public — c'est
    un usage strictement interne, énuméré et contrôlé).

    Pour chaque tenant : vérifie `allow_clinical_agent_export` AVANT
    toute lecture — un tenant désactivé pour l'export est simplement
    ignoré (pas une erreur), exactement comme le ferait un appel manuel
    à /sync/all pour ce tenant.
    """
    try:
        tenant_databases = list_active_tenant_databases()
    except TenantRegistryUnavailableError as e:
        logger.error(f"[Rattrapage global] Tenant Registry injoignable — aucun tenant énuméré : {e}")
        return {"tenants_traites": 0, "resultats": []}

    resultats = []
    for tenant_id, _info in tenant_databases:
        try:
            config = get_tenant_config(tenant_id)
        except (TenantNotFoundError, TenantRegistryUnavailableError) as e:
            logger.warning(f"[Rattrapage global] tenant_id={tenant_id} ignoré (config injoignable) : {e}")
            continue

        if not config.allow_clinical_agent_export:
            logger.info(f"[Rattrapage global] tenant_id={tenant_id} : export désactivé — ignoré.")
            resultats.append({"tenant_id": tenant_id, "status": "export_disabled"})
            continue

        try:
            main_db = get_main_session_for_tenant(tenant_id)
        except (TenantDatabaseInactiveError, TenantDatabaseNotFoundError, TenantRegistryUnavailableError) as e:
            logger.warning(f"[Rattrapage global] tenant_id={tenant_id} : base injoignable, ignoré : {e}")
            continue

        try:
            with TamponSession() as tampon_db:
                result = sync_all_completed_visits(tenant_id, main_db, tampon_db)
            resultats.append({"tenant_id": tenant_id, "status": "synced", **result})
        except Exception as e:
            logger.error(f"[Rattrapage global] Erreur pour tenant_id={tenant_id} : {e}")
            resultats.append({"tenant_id": tenant_id, "status": "error", "error": str(e)})
        finally:
            main_db.close()

    return {"tenants_traites": len(resultats), "resultats": resultats}


def scheduled_sync_job():
    """Tâche planifiée : rattrapage des visites TERMINE non synchronisées, pour chaque tenant actif."""
    logger.info("=== [PLANIFICATEUR] Démarrage du rattrapage périodique ===")
    try:
        result = sync_all_known_tenants()
        logger.info(f"[PLANIFICATEUR] Terminé : {result['tenants_traites']} tenant(s) traité(s).")
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

    logger.info("Rattrapage initial des visites TERMINE (tous les tenants actifs)...")
    try:
        sync_all_known_tenants()
    except Exception as e:
        logger.warning(f"Rattrapage initial échoué (Tenant Registry ou bases peut-être pas encore prêts) : {e}")

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
    """
    Vérifie que le service est opérationnel.

    Il n'existe plus "une" base principale à vérifier (Medical-Monitoring
    est en Database per Tenant) — `tenant_registry` remplace l'ancien
    `main_db` : si le Registry est injoignable, aucune synchronisation
    n'est possible pour AUCUN tenant, c'est le signal de santé pertinent.
    """
    try:
        with TamponSession() as db:
            db.execute(text("SELECT 1"))
        tampon_ok = True
    except Exception:
        tampon_ok = False

    try:
        list_active_tenant_databases()
        registry_ok = True
    except Exception:
        registry_ok = False

    status = "ok" if (tampon_ok and registry_ok) else "degraded"
    return {
        "status": status,
        "tampon_db": "connected" if tampon_ok else "unreachable",
        "tenant_registry": "connected" if registry_ok else "unreachable",
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
def sync_visite_endpoint(
    visite_id: str,
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    x_internal_service_token: Optional[str] = Header(None, alias="X-Internal-Service-Token"),
):
    """
    Synchronise une visite terminée dans la BD tampon, pour le tenant
    `X-Tenant-ID`. Appelé par le signal Django de Medical-Monitoring dès
    qu'une visite passe à TERMINE (le tenant est capturé et transmis
    explicitement par ce signal — voir medical_workflow/signals.py).

    Exige le jeton de service interne (protection contre le spoofing
    d'un `X-Tenant-ID` arbitraire) ET un `X-Tenant-ID` réel. Vérifie
    `allow_clinical_agent_export` AVANT toute lecture — un refus
    n'entraîne AUCUN accès à la base du tenant.
    """
    verify_internal_service_token(x_internal_service_token)
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="Le header X-Tenant-ID est requis.")

    verify_export_authorization(x_tenant_id)

    logger.info(f"Demande de synchronisation reçue pour la visite {visite_id} (tenant={x_tenant_id})")
    try:
        main_db = get_main_session_for_tenant(x_tenant_id)
    except TenantDatabaseNotFoundError:
        raise HTTPException(status_code=404, detail="Aucune base MEDICAL enregistrée pour ce tenant.")
    except TenantDatabaseInactiveError:
        raise HTTPException(status_code=503, detail="La base MEDICAL de ce tenant n'est pas active.")
    except TenantRegistryUnavailableError:
        raise HTTPException(status_code=503, detail="Tenant Registry indisponible.")

    try:
        with TamponSession() as tampon_db:
            result = sync_visite(x_tenant_id, visite_id, main_db, tampon_db)
        return result
    except Exception as e:
        logger.error(f"Erreur lors de la synchronisation de la visite {visite_id} : {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        main_db.close()


@app.post("/sync/all", tags=["Synchronisation"])
def sync_all_endpoint(
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    x_internal_service_token: Optional[str] = Header(None, alias="X-Internal-Service-Token"),
):
    """
    Synchronise toutes les visites TERMINE non encore traitées, POUR LE
    SEUL TENANT `X-Tenant-ID` — jamais un parcours implicite de tous les
    tenants (voir §10 de la tâche ; l'énumération explicite multi-tenant
    est réservée à `sync_all_known_tenants`, usage interne uniquement,
    jamais exposée ici). Utile pour un rattrapage manuel ciblé.
    """
    verify_internal_service_token(x_internal_service_token)
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="Le header X-Tenant-ID est requis.")

    verify_export_authorization(x_tenant_id)

    logger.info(f"Synchronisation globale demandée pour tenant={x_tenant_id}.")
    try:
        main_db = get_main_session_for_tenant(x_tenant_id)
    except TenantDatabaseNotFoundError:
        raise HTTPException(status_code=404, detail="Aucune base MEDICAL enregistrée pour ce tenant.")
    except TenantDatabaseInactiveError:
        raise HTTPException(status_code=503, detail="La base MEDICAL de ce tenant n'est pas active.")
    except TenantRegistryUnavailableError:
        raise HTTPException(status_code=503, detail="Tenant Registry indisponible.")

    try:
        with TamponSession() as tampon_db:
            result = sync_all_completed_visits(x_tenant_id, main_db, tampon_db)
        return result
    except Exception as e:
        logger.error(f"Erreur lors de la synchronisation globale pour tenant={x_tenant_id} : {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        main_db.close()


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