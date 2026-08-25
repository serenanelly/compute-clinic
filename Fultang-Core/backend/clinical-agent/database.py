# ============================================================
# Fultang — Clinical Agent
# Connexion aux deux bases de données
# ============================================================
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from dotenv import load_dotenv
from models import Base

load_dotenv()

# --- BD principale (Medical-Monitoring) — lecture seule ---
MAIN_DB_URL = os.getenv(
    "MAIN_DB_URL",
    "postgresql://fultang_user:fultang_password_here@fultang-medical-db-server:5432/fultang_medical_monitoring"
)

# --- BD tampon — lecture / écriture ---
TAMPON_DB_URL = os.getenv(
    "TAMPON_DB_URL",
    "postgresql://admin:password@fultang-tampon-db:5432/tampon_clinical_cases"
)

# --- Moteurs SQLAlchemy ---
main_engine = create_engine(
    MAIN_DB_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"connect_timeout": 10}
)

tampon_engine = create_engine(
    TAMPON_DB_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"connect_timeout": 10}
)

# --- Sessions ---
MainSession = sessionmaker(bind=main_engine, autocommit=False, autoflush=False)
TamponSession = sessionmaker(bind=tampon_engine, autocommit=False, autoflush=False)


def init_tampon_db():
    """Crée les tables dans la BD tampon si elles n'existent pas encore."""
    Base.metadata.create_all(bind=tampon_engine)
