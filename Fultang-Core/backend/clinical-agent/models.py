# ============================================================
# Fultang — Clinical Agent
# BD Tampon : modèles SQLAlchemy (schéma de la BD tampon)
# ============================================================
from sqlalchemy import (
    Column, String, Text, Integer, Float, JSON,
    DateTime, Date, Boolean, UniqueConstraint,
    create_engine
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

Base = declarative_base()


class CasClinique(Base):
    """
    Représentation anonymisée d'un patient dans la BD tampon.
    Identifiant stable = l'UUID du patient dans la BD centrale.
    Les données PII (nom, prénom, matricule, contacts) sont exclues.

    `tenant_id` (chantier Medical-Monitoring tenant-aware) : la BD tampon
    est PARTAGÉE entre tous les tenants (par construction — /export
    produit un flux agrégé multi-établissements vers MedTutor, ce n'est
    pas une isolation "Database per Tenant"). Contrairement aux modèles
    Medical-Monitoring (patient/visite/...), où l'isolation vient de la
    base physique du tenant, ICI il faut savoir explicitement à quel
    tenant appartient chaque cas — raison technique réelle et démontrée
    d'ajouter ce champ (voir clinical-agent/main.py::verify_export_authorization
    et sync.py, qui l'utilisent pour n'écrire QUE les cas d'un tenant
    ayant `allow_clinical_agent_export=True`).
    """
    __tablename__ = "cas_cliniques"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # --- Tenant propriétaire de ce cas (jamais NULL — un cas est toujours
    # synchronisé dans le contexte d'un tenant réel, voir sync.py) ---
    tenant_id = Column(String(36), nullable=False, index=True,
                       comment="UUID du tenant (Tenant Registry) propriétaire de ce cas")

    # --- Identifiant de référence (non-nominatif) ---
    patient_id_source = Column(String(36), nullable=False,
                               comment="UUID du patient dans la BD centrale du tenant (référence non-nominative)")

    # --- Données démographiques anonymisées ---
    age = Column(Integer, nullable=True)
    sexe = Column(String(10), nullable=True)
    statut_matrimonial = Column(String(50), nullable=True)
    nombre_enfants = Column(Integer, nullable=True)
    profession = Column(String(100), nullable=True)

    # --- Données cliniques de base ---
    groupe_sanguin = Column(String(10), nullable=True)
    facteur_rhesus = Column(String(20), nullable=True)
    electrophorese_hb = Column(String(20), nullable=True)
    poids = Column(String(20), nullable=True)
    taille = Column(String(20), nullable=True)
    pouls = Column(String(20), nullable=True)
    taux_oxygene = Column(String(20), nullable=True)
    temperature = Column(String(20), nullable=True)
    tension_arterielle = Column(String(20), nullable=True)

    # --- Antécédents et données médicales structurées (JSON) ---
    allergies = Column(JSON, nullable=True, default=list)
    maladies = Column(JSON, nullable=True, default=list)
    antecedents = Column(JSON, nullable=True, default=list)
    mode_de_vie = Column(JSON, nullable=True, default=dict)
    addictions = Column(JSON, nullable=True, default=list)
    voyages = Column(JSON, nullable=True, default=list)
    activites_physiques = Column(JSON, nullable=True, default=list)

    # --- Parcours de visites (JSON) ---
    # Chaque visite contient ses consultations, examens, hospitalisations
    visites = Column(JSON, nullable=True, default=list)

    # --- Méta-données de synchronisation ---
    cree_le = Column(DateTime, default=datetime.utcnow, nullable=False)
    mis_a_jour_le = Column(DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow, nullable=False)
    nb_visites_traitees = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        # Unicité PAR TENANT, plus seulement globale : deux tenants ne
        # doivent jamais pouvoir fusionner leurs cas même si leurs UUID
        # patient venaient un jour à se recouper (défense en profondeur —
        # en pratique impossible avec uuid4, mais jamais supposé).
        UniqueConstraint('patient_id_source', 'tenant_id', name='uq_cas_clinique_patient_tenant'),
    )

    def __repr__(self):
        return f"<CasClinique tenant={self.tenant_id} patient_source={self.patient_id_source} visites={self.nb_visites_traitees}>"


class VisiteSynced(Base):
    """
    Registre des visites déjà synchronisées dans la BD tampon.
    Évite les doublons et les re-synchronisations inutiles.

    `tenant_id` : même raison technique que `CasClinique` (voir sa
    docstring) — le registre anti-doublon doit lui aussi distinguer les
    tenants (une visite du Tenant A et une visite du Tenant B ne
    partagent jamais d'UUID, mais le registre doit le savoir
    explicitement, pas le supposer).
    """
    __tablename__ = "visites_synced"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), nullable=False, index=True,
                       comment="UUID du tenant (Tenant Registry) propriétaire de cette visite")
    visite_id_source = Column(String(36), nullable=False,
                              comment="UUID de la visite dans la BD centrale du tenant")
    patient_id_source = Column(String(36), nullable=False)
    synced_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    statut_visite = Column(String(20), nullable=True)

    __table_args__ = (
        UniqueConstraint('visite_id_source', 'tenant_id', name='uq_visite_synced_visite_tenant'),
    )

    def __repr__(self):
        return f"<VisiteSynced visite={self.visite_id_source}>"
