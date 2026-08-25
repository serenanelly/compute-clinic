import { useState, useEffect } from 'react';
import axiosInstance from '../Utils/axiosInstance';
import {
  getAllExams,
  enregistrerPrelevement as apiEnregistrerPrelevement,
  enregistrerResultat as apiEnregistrerResultat,
  signalerValeurCritique as apiSignalerCritique,
  validerResultat as apiValiderResultat
} from '../services/laboratoryApi';

// ─── Cache patient en mémoire ────────────────────────────────────────────────
const patientCache = new Map();

const fetchPatientById = async (patientId) => {
  if (!patientId) return null;
  if (patientCache.has(patientId)) return patientCache.get(patientId);
  try {
    const r = await axiosInstance.get(`/patients/${patientId}/`);
    const p = r.data;
    const enriched = {
      id: p.id,
      mat: p.matricule || p.mat || p.id?.slice(0, 8),
      nom: p.nom || '',
      prenom: p.prenom || '',
      fullName: `${p.nom || ''} ${p.prenom || ''}`.trim(),
      initials: `${(p.nom || '').charAt(0)}${(p.prenom || '').charAt(0)}`.toUpperCase(),
    };
    patientCache.set(patientId, enriched);
    return enriched;
  } catch {
    return null;
  }
};

// Résoudre le patientId depuis un examen
// L'API peut retourner : exam.patient (UUID direct) ou exam.consultation (UUID) → visite → patient
const resolvePatientId = async (exam) => {
  // Cas 1 : champ patient direct
  if (exam.patient) return exam.patient;

  // Cas 2 : via la consultation
  if (exam.consultation) {
    try {
      const r = await axiosInstance.get(`/consultations/${exam.consultation}/`);
      const patientId = r.data.patient;
      if (patientId) return patientId;
      // Cas 3 : via la visite
      if (r.data.visite) {
        const v = await axiosInstance.get(`/visites/${r.data.visite}/`);
        return v.data.patient || null;
      }
    } catch { /* ignore */ }
  }

  // Cas 4 : patient_info déjà présent (serializer enrichi)
  if (exam.patient_info?.id) return exam.patient_info.id;

  return null;
};

// Couleurs avatar déterministes
const AVATAR_COLORS = ['av-blue', 'av-coral', 'av-teal', 'av-amber', 'av-purple'];
const avatarColorFor = (id) => AVATAR_COLORS[id ? id.charCodeAt(0) % AVATAR_COLORS.length : 0];

/**
 * Hook centralisé pour les données du laboratoire.
 * Cycle : EN_ATTENTE → PRELEVE → EN_COURS → REALISE → VALIDE
 */
export const useLaboratoryData = () => {
  const [patients, setPatients] = useState([]);
  const [exams, setExams] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllExams();
      const examList = Array.isArray(data) ? data : (data.results || []);

      if (examList.length === 0) {
        setPatients([]);
        setExams({});
        setIsLoading(false);
        return;
      }

      // Résoudre tous les patientIds en parallèle
      const patientIds = await Promise.all(examList.map(resolvePatientId));

      // Charger les détails patients en parallèle (cache évite les doublons)
      const uniqueIds = [...new Set(patientIds.filter(Boolean))];
      await Promise.all(uniqueIds.map(fetchPatientById));

      const patientsMap = new Map();
      const examsMap = {};

      examList.forEach((exam, idx) => {
        const patientId = patientIds[idx];
        if (!patientId) return;

        const pInfo = patientCache.get(patientId);
        if (!pInfo) return;

        // Construire / mettre à jour l'entrée patient
        if (!patientsMap.has(pInfo.id)) {
          patientsMap.set(pInfo.id, {
            id: pInfo.id,
            mat: pInfo.mat,
            nom: pInfo.nom,
            prenom: pInfo.prenom,
            fullName: pInfo.fullName,
            initials: pInfo.initials,
            avatarColor: avatarColorFor(pInfo.id),
            statut: exam.statut?.toLowerCase() || 'en_attente',
            info: `${exam.nom || '—'} · ${exam.medecin || 'Médecin inconnu'}`,
            urgency: exam.resultat?.valeur_critique || false,
            nomex: (exam.nom || '').toLowerCase(),
            prio: exam.resultat?.valeur_critique ? 'urgence' : 'standard',
          });
        }

        if (!examsMap[pInfo.id]) examsMap[pInfo.id] = [];

        examsMap[pInfo.id].push({
          id: exam.id,
          name: exam.nom || exam.name || '—',
          motif: exam.motif || '—',
          anatomie: exam.anatomie || '—',
          medecin: exam.medecin || 'Médecin inconnu',
          status: exam.statut?.toLowerCase() || 'en_attente',
          // Prélèvement
          prelevement: exam.prelevement || null,
          // Résultat
          resultats: exam.resultat?.resultats || '',
          observations: exam.resultat?.observations || '',
          interpretation: exam.resultat?.interpretation || '',
          validateur: exam.resultat?.validateur || '',
          estValide: exam.resultat?.est_valide || false,
          dateValidation: exam.resultat?.date_validation || '',
          // Valeur critique
          isWarn: exam.resultat?.valeur_critique || false,
          isDanger: exam.resultat?.valeur_critique || false,
          commentaireCritique: exam.resultat?.commentaire_critique || '',
          alerteEnvoyee: exam.resultat?.alerte_envoyee || false,
          dateAlerte: exam.resultat?.date_alerte || '',
          // Date affichage
          date: exam.resultat?.date_validation || (exam.resultat ? 'Enregistré' : ''),
        });
      });

      setPatients(Array.from(patientsMap.values()));
      setExams(examsMap);
    } catch (err) {
      console.error('Failed to fetch laboratory data', err);
      setError('Erreur lors de la récupération des données du laboratoire.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const enregistrerPrelevement = async (patientId, examId, prelevementData) => {
    try {
      await apiEnregistrerPrelevement(examId, {
        type_prelevement: prelevementData.type_echantillon || 'Sang veineux',
        laborantin_id: prelevementData.laborantin_id,
        code_barre: prelevementData.code_barre,
      });
      await fetchData();
    } catch (err) {
      console.error("Erreur enregistrement prélèvement", err);
      alert("Erreur lors de l'enregistrement du prélèvement : " + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  };

  const enregistrerResultat = async (patientId, examId, resultData) => {
    try {
      await apiEnregistrerResultat(examId, {
        resultats: resultData.resultats,
        observations: resultData.observations || '',
        interpretation: resultData.interpretation || '',
      });
      await fetchData();
    } catch (err) {
      console.error("Erreur enregistrement résultats", err);
      alert("Erreur lors de l'enregistrement des résultats : " + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  };

  const signalerCritique = async (examId, commentaire) => {
    try {
      await apiSignalerCritique(examId, commentaire, {
        valeur_mesuree: commentaire || 'Valeur critique',
        seuil_alerte: 'Seuil dépassé',
      });
      await fetchData();
    } catch (err) {
      console.error("Erreur signalement critique", err);
      alert("Erreur lors du signalement : " + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  };

  const validerResultat = async (examId, validateur) => {
    try {
      await apiValiderResultat(examId, validateur);
      await fetchData();
    } catch (err) {
      console.error("Erreur validation résultat", err);
      alert("Erreur lors de la validation : " + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  };

  // ── Listes filtrées par phase du workflow ─────────────────────────────────

  // Réception : examens EN_ATTENTE ou PRELEVE
  const receptionPatients = patients.filter(p =>
    (exams[p.id] || []).some(e => ['en_attente', 'preleve'].includes(e.status))
  );

  // Analyse : examens PRELEVE ou EN_ATTENTE (prêts pour saisie de résultat)
  const analysePatients = patients.filter(p =>
    (exams[p.id] || []).some(e => ['preleve', 'en_cours', 'en_attente'].includes(e.status))
  );

  // Résultats : examens REALISE (résultats saisis, en attente de validation)
  const resultPatients = patients.filter(p =>
    (exams[p.id] || []).some(e => e.status === 'realise')
  );

  // Historique : examens VALIDE ou REALISE
  const historiquePatients = patients.filter(p =>
    (exams[p.id] || []).some(e => ['valide', 'realise'].includes(e.status))
  );

  return {
    patients,
    exams,
    enregistrerPrelevement,
    enregistrerResultat,
    signalerCritique,
    validerResultat,
    validateExam: enregistrerResultat, // rétro-compatibilité
    receptionPatients,
    analysePatients,
    resultPatients,
    historiquePatients,
    isLoading,
    error,
    refetch: fetchData,
  };
};
