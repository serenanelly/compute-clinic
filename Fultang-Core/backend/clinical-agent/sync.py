# ============================================================
# Fultang — Clinical Agent
# Logique de synchronisation : BD principale → BD tampon
# ============================================================
"""
L'agent lit les données de la BD principale (Medical-Monitoring)
via des requêtes SQL brutes (lecture seule), puis les écrit dans
la BD tampon (fultang-tampon-db) sous forme de cas cliniques
anonymisés et enrichis.

Déclencheurs :
  1. Signal Django (push) : la visite passe à TERMINE → POST /sync/visite/{id}
  2. Tâche planifiée (pull) : toutes les 15 min, l'agent rattrape
     les visites TERMINE qui auraient été manquées.
"""

import logging
from datetime import date, datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from models import CasClinique, VisiteSynced

logger = logging.getLogger("agent.sync")


def _row_to_dict(row) -> dict:
    """Convertit une ligne SQLAlchemy en dict JSON-sérialisable (dates → str, UUID → str)."""
    result = {}
    for k, v in row._mapping.items():
        if isinstance(v, (date, datetime)):
            result[k] = v.isoformat()
        elif hasattr(v, "hex"):  # UUID
            result[k] = str(v)
        else:
            result[k] = v
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — lecture depuis la BD principale
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_patient(main_db: Session, patient_id: str) -> Optional[dict]:
    """Récupère les données de base d'un patient (hors PII nominatives)."""
    row = main_db.execute(text("""
        SELECT id, date_naissance, sexe, statut_matrimonial, nombre_enfants, profession
        FROM patient_patient
        WHERE id = :pid
    """), {"pid": patient_id}).fetchone()

    if not row:
        return None

    today = date.today()
    dn = row.date_naissance
    age = None
    if dn:
        age = today.year - dn.year - ((today.month, today.day) < (dn.month, dn.day))

    return {
        "patient_id_source": str(row.id),
        "age": age,
        "sexe": row.sexe,
        "statut_matrimonial": row.statut_matrimonial,
        "nombre_enfants": row.nombre_enfants,
        "profession": row.profession,
    }


def _fetch_donnees_cliniques(main_db: Session, patient_id: str) -> dict:
    """Récupère les données cliniques de base d'un patient."""
    row = main_db.execute(text("""
        SELECT groupe_sanguin, facteur_rhesus, electrophorese_hb,
               poids, taille, pouls, taux_oxygene, temperature, tension_arterielle
        FROM patient_informations_donneescliniques
        WHERE patient_id = :pid
        LIMIT 1
    """), {"pid": patient_id}).fetchone()

    if not row:
        return {}

    return {
        "groupe_sanguin": row.groupe_sanguin,
        "facteur_rhesus": row.facteur_rhesus,
        "electrophorese_hb": row.electrophorese_hb,
        "poids": str(row.poids) if row.poids else None,
        "taille": str(row.taille) if row.taille else None,
        "pouls": str(row.pouls) if row.pouls else None,
        "taux_oxygene": str(row.taux_oxygene) if row.taux_oxygene else None,
        "temperature": str(row.temperature) if row.temperature else None,
        "tension_arterielle": str(row.tension_arterielle) if row.tension_arterielle else None,
    }


def _fetch_antecedents_medicaux(main_db: Session, patient_id: str) -> dict:
    """Récupère les antécédents, allergies, maladies, mode de vie, addictions, voyages, activités physiques."""
    data = {}

    # Allergies (colonnes: manifestation, declencheur)
    rows = main_db.execute(text("""
        SELECT manifestation, declencheur
        FROM patient_informations_allergie
        WHERE patient_id = :pid
    """), {"pid": patient_id}).fetchall()
    data["allergies"] = [_row_to_dict(r) for r in rows]

    # Maladies (colonnes: nom, debut, fin, description)
    rows = main_db.execute(text("""
        SELECT nom, debut, fin, description
        FROM patient_informations_maladie
        WHERE patient_id = :pid
    """), {"pid": patient_id}).fetchall()
    data["maladies"] = [_row_to_dict(r) for r in rows]

    # Antécédents médicaux (colonnes: type, nom, date, description)
    rows = main_db.execute(text("""
        SELECT type, nom, date, description
        FROM patient_informations_antecedent
        WHERE patient_id = :pid
    """), {"pid": patient_id}).fetchall()
    data["antecedents"] = [_row_to_dict(r) for r in rows]

    # Mode de vie (toutes les colonnes disponibles)
    try:
        row = main_db.execute(text("""
            SELECT *
            FROM patient_informations_modedevie
            WHERE patient_id = :pid
            LIMIT 1
        """), {"pid": patient_id}).fetchone()
        data["mode_de_vie"] = dict(row._mapping) if row else {}
    except Exception:
        data["mode_de_vie"] = {}

    # Addictions (colonnes: nom, debut, statut)
    rows = main_db.execute(text("""
        SELECT nom, debut, statut
        FROM patient_informations_addiction
        WHERE patient_id = :pid
    """), {"pid": patient_id}).fetchall()
    data["addictions"] = [_row_to_dict(r) for r in rows]

    # Voyages (colonnes: lieu, frequence, duree)
    rows = main_db.execute(text("""
        SELECT lieu, frequence, duree
        FROM patient_informations_voyage
        WHERE patient_id = :pid
    """), {"pid": patient_id}).fetchall()
    data["voyages"] = [_row_to_dict(r) for r in rows]

    # Activités physiques (colonnes: nom, frequence)
    rows = main_db.execute(text("""
        SELECT nom, frequence
        FROM patient_informations_activitephysique
        WHERE patient_id = :pid
    """), {"pid": patient_id}).fetchall()
    data["activites_physiques"] = [_row_to_dict(r) for r in rows]

    return data


def _fetch_visite_complete(main_db: Session, visite_id: str) -> Optional[dict]:
    """Récupère une visite complète avec toutes ses consultations, examens, hospitalisations."""
    visite = main_db.execute(text("""
        SELECT id, patient_id, motif_visite, date_heure, statut
        FROM medical_workflow_visite
        WHERE id = :vid
    """), {"vid": visite_id}).fetchone()

    if not visite:
        return None

    visite_data = {
        "visite_id": str(visite.id),
        "motif_visite": visite.motif_visite,
        "date_heure": visite.date_heure.isoformat() if visite.date_heure else None,
        "statut": visite.statut,
        "consultations": [],
        "hospitalisations": [],
    }

    # Consultations de cette visite
    consultations = main_db.execute(text("""
        SELECT id, motif, date_heure, medecin_charge
        FROM medical_workflow_consultation
        WHERE visite_id = :vid
    """), {"vid": visite_id}).fetchall()

    for c in consultations:
        consult_data = {
            "consultation_id": str(c.id),
            "motif": c.motif,
            "date_heure": c.date_heure.isoformat() if c.date_heure else None,
            "symptomes": [],
            "diagnostics": [],
            "prescriptions": [],
            "examens": [],
        }

        # Symptômes
        rows = main_db.execute(text("""
            SELECT nom, localisation, date_debut, frequence, duree, evolution, activite_declencheuse
            FROM medical_workflow_symptome
            WHERE consultation_id = :cid
        """), {"cid": str(c.id)}).fetchall()
        consult_data["symptomes"] = [_row_to_dict(r) for r in rows]

        # Diagnostics
        rows = main_db.execute(text("""
            SELECT libelle, description, conclusion, niveau_certitude
            FROM medical_workflow_diagnostic
            WHERE consultation_id = :cid
        """), {"cid": str(c.id)}).fetchall()
        consult_data["diagnostics"] = [_row_to_dict(r) for r in rows]

        # Prescriptions
        rows = main_db.execute(text("""
            SELECT nom, quantite, type_medicament, posologie, statut
            FROM medical_workflow_medicamentprescrit
            WHERE consultation_id = :cid
        """), {"cid": str(c.id)}).fetchall()
        consult_data["prescriptions"] = [_row_to_dict(r) for r in rows]

        # Examens
        rows = main_db.execute(text("""
            SELECT e.nom, e.motif, e.anatomie, e.statut,
                   r.observations, r.resultats, r.interpretation
            FROM medical_workflow_examen e
            LEFT JOIN medical_workflow_resultatexamen r ON r.examen_id = e.id
            WHERE e.consultation_id = :cid
        """), {"cid": str(c.id)}).fetchall()
        consult_data["examens"] = [_row_to_dict(r) for r in rows]

        visite_data["consultations"].append(consult_data)

    # Hospitalisations de cette visite
    hosp_rows = main_db.execute(text("""
        SELECT motif, service, duree_prevue, statut
        FROM medical_workflow_hospitalisation
        WHERE visite_id = :vid
    """), {"vid": visite_id}).fetchall()
    visite_data["hospitalisations"] = [_row_to_dict(r) for r in hosp_rows]

    return visite_data, str(visite.patient_id)


# ─────────────────────────────────────────────────────────────────────────────
# Fonction principale de synchronisation
# ─────────────────────────────────────────────────────────────────────────────

def sync_visite(visite_id: str, main_db: Session, tampon_db: Session) -> dict:
    """
    Synchronise une visite terminée dans la BD tampon.
    Crée ou met à jour le cas clinique anonymisé du patient.
    Enregistre la visite dans le registre VisiteSynced pour éviter les doublons.
    """
    # 1. Vérifier si déjà synchronisée
    already = tampon_db.query(VisiteSynced).filter_by(visite_id_source=visite_id).first()
    if already:
        logger.info(f"Visite {visite_id} déjà synchronisée — ignorée.")
        return {"status": "already_synced", "visite_id": visite_id}

    # 2. Récupérer la visite complète depuis la BD principale
    result = _fetch_visite_complete(main_db, visite_id)
    if not result:
        logger.warning(f"Visite {visite_id} introuvable dans la BD principale.")
        return {"status": "not_found", "visite_id": visite_id}

    visite_data, patient_id = result

    # 3. Récupérer ou créer le cas clinique du patient dans la tampon
    cas = tampon_db.query(CasClinique).filter_by(patient_id_source=patient_id).first()

    if not cas:
        # Première visite de ce patient → créer le cas clinique
        patient_info = _fetch_patient(main_db, patient_id)
        if not patient_info:
            logger.warning(f"Patient {patient_id} introuvable — sync annulée.")
            return {"status": "patient_not_found", "visite_id": visite_id}

        donnees_cliniques = _fetch_donnees_cliniques(main_db, patient_id)
        antecedents = _fetch_antecedents_medicaux(main_db, patient_id)

        cas = CasClinique(
            **patient_info,
            **donnees_cliniques,
            **antecedents,
            visites=[visite_data],
            nb_visites_traitees=1,
        )
        tampon_db.add(cas)
    else:
        # Cas existant → enrichir avec la nouvelle visite
        visites_existantes = list(cas.visites or [])
        visites_existantes.append(visite_data)
        cas.visites = visites_existantes
        cas.nb_visites_traitees = len(visites_existantes)
        cas.mis_a_jour_le = datetime.utcnow()

        # Mettre à jour les données cliniques (peuvent évoluer)
        donnees_cliniques = _fetch_donnees_cliniques(main_db, patient_id)
        for k, v in donnees_cliniques.items():
            if v is not None:
                setattr(cas, k, v)

    # 4. Enregistrer la visite dans le registre
    synced = VisiteSynced(
        visite_id_source=visite_id,
        patient_id_source=patient_id,
        statut_visite=visite_data.get("statut"),
    )
    tampon_db.add(synced)
    tampon_db.commit()

    logger.info(f"Visite {visite_id} synchronisée avec succès pour patient {patient_id}.")
    return {
        "status": "synced",
        "visite_id": visite_id,
        "patient_id_tampon": cas.patient_id_source,
        "nb_visites_traitees": cas.nb_visites_traitees,
    }


def sync_all_completed_visits(main_db: Session, tampon_db: Session) -> dict:
    """
    Synchronise toutes les visites TERMINE de la BD principale
    qui n'ont pas encore été traitées dans la BD tampon.
    Utilisé au démarrage et par le planificateur périodique.
    """
    # Récupérer les IDs de visites déjà synchronisées
    synced_ids = {r.visite_id_source for r in tampon_db.query(VisiteSynced).all()}

    # Toutes les visites TERMINE dans la BD principale
    rows = main_db.execute(text("""
        SELECT id FROM medical_workflow_visite
        WHERE statut = 'TERMINE'
    """)).fetchall()

    pending = [str(r.id) for r in rows if str(r.id) not in synced_ids]
    logger.info(f"Rattrapage : {len(pending)} visite(s) TERMINE à synchroniser.")

    results = []
    for visite_id in pending:
        try:
            result = sync_visite(visite_id, main_db, tampon_db)
            results.append(result)
        except Exception as e:
            logger.error(f"Erreur sync visite {visite_id}: {e}")
            tampon_db.rollback()
            results.append({"status": "error", "visite_id": visite_id, "error": str(e)})

    return {
        "total_pending": len(pending),
        "results": results,
    }
