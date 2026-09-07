# ============================================================
# Fultang — Clinical Agent
# Connexion aux bases de données
# ============================================================
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv
from models import Base

from engine_registry import get_engine_for_tenant

load_dotenv()

# --- BD principale (Medical-Monitoring) ---
# Avant le chantier Medical-Monitoring tenant-aware : UN SEUL moteur
# fixe (`MAIN_DB_URL`) vers "la" base. Medical-Monitoring étant
# maintenant en Database per Tenant, il n'existe plus UNE base
# principale mais UNE base par tenant — voir `get_main_session_for_tenant`
# ci-dessous, qui résout le bon moteur via `engine_registry.py`
# (Tenant Registry) au lieu d'un `MAIN_DB_URL` unique codé en dur.

# --- BD tampon — lecture / écriture, PARTAGÉE entre tous les tenants ---
# (voir models.py::CasClinique pour la justification de `tenant_id` sur
# ce buffer partagé, contrairement à la base principale qui est, elle,
# isolée physiquement par tenant).
TAMPON_DB_URL = os.getenv(
    "TAMPON_DB_URL",
    "postgresql://admin:password@fultang-tampon-db:5432/tampon_clinical_cases"
)

tampon_engine = create_engine(
    TAMPON_DB_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"connect_timeout": 10}
)

TamponSession = sessionmaker(bind=tampon_engine, autocommit=False, autoflush=False)


def get_main_session_for_tenant(tenant_id: str) -> Session:
    """
    Retourne une Session SQLAlchemy vers la base Medical-Monitoring DU
    TENANT `tenant_id` (jamais "la" base principale — ce concept n'existe
    plus). Lève les mêmes exceptions que `engine_registry.get_engine_for_tenant`
    (TenantDatabaseInactiveError, TenantDatabaseNotFoundError,
    TenantRegistryUnavailableError) si la résolution échoue — jamais de
    repli vers une autre base.
    """
    engine = get_engine_for_tenant(tenant_id)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)()


def init_tampon_db():
    """Crée les tables dans la BD tampon si elles n'existent pas encore."""
    Base.metadata.create_all(bind=tampon_engine)
