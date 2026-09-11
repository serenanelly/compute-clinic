import axiosInstance from "../Utils/axiosInstance.js";

// ============================================================
// Fonctions utilitaires internes
// ============================================================

/**
 * Calcule l'âge à partir d'une date de naissance.
 */
const calculateAge = (dateNaissance) => {
    if (!dateNaissance) return null;
    const birth = new Date(dateNaissance);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
};

/**
 * Récupère les détails d'un patient par son UUID.
 */
const fetchPatientById = async (patientId) => {
    const response = await axiosInstance.get(`/patients/${patientId}/`);
    const patient = response.data;
    return {
        ...patient,
        age: calculateAge(patient.date_naissance)
    };
};

/**
 * Cache simple en mémoire pour éviter de refetcher le même patient.
 */
const patientCache = new Map();

const fetchPatientCached = async (patientId) => {
    if (patientCache.has(patientId)) {
        return patientCache.get(patientId);
    }
    const patient = await fetchPatientById(patientId);
    patientCache.set(patientId, patient);
    return patient;
};

const clearPatientCache = () => {
    patientCache.clear();
};

/**
 * Rendez-vous actifs (statut PROGRAMME) créés par les rôles donnés, mis en forme
 * comme des entrées de salle d'attente. Côté médecin : réception + infirmier arrivent.
 */
const fetchRendezVousWaiting = async (roles) => {
    try {
        const response = await axiosInstance.get('/patient/rendez-vous/');
        const allRdv = response.data.results || response.data || [];
        const actifs = allRdv.filter(
            r => r.statut === 'PROGRAMME' && roles.includes(r.cree_par_role || 'RECEPTIONNISTE')
        );
        return await Promise.all(actifs.map(async (rdv) => {
            let patient;
            try {
                const p = await fetchPatientCached(rdv.patient);
                patient = { id: p.id, nom: p.nom, prenom: p.prenom, sexe: p.sexe, age: p.age, matricule: p.matricule };
            } catch {
                patient = { id: rdv.patient, nom: 'Inconnu', prenom: '', sexe: '-', age: null };
            }
            return {
                id: `rdv-${rdv.id}`,
                rdvId: rdv.id,
                source: 'rdv',
                statut: rdv.statut,
                cree_par_role: rdv.cree_par_role,
                personnel_concerne: rdv.personnel_concerne,
                motif_visite: rdv.motif,
                date_heure: rdv.date_heure,
                donnees_cliniques: null,
                patient,
            };
        }));
    } catch (error) {
        console.warn('RDV non chargés pour la salle d\'attente médecin:', error);
        return [];
    }
};

// ============================================================
// Service API Médecin
// ============================================================

/**
 * Service pour gérer les requêtes API du médecin.
 * Tous les appels passent par axiosInstance (JWT, baseURL configurés).
 */
export const doctorApi = {

    // --------------------------------------------------------
    // SALLE D'ATTENTE
    // --------------------------------------------------------

    /**
     * Récupérer la liste des patients dans la salle d'attente.
     * - GET /visites/ → filtre client-side sur statut EN_COURS
     * - Pour chaque visite, enrichit avec les détails patient
     * - Récupère également les dernières données cliniques du patient
     */
    getWaitingPatients: async () => {
        try {
            clearPatientCache();
            const medecinId = localStorage.getItem('personnel_id');
            const response = await axiosInstance.get('/visites/');
            const allVisites = response.data.results || response.data;

            // CORR-A3-004/011 : triage OK ou urgence ; paiement sauf urgence ; médecin orienté
            const visitesEnCours = allVisites.filter((v) => {
                if (v.statut !== 'EN_COURS') return false;
                if (medecinId && v.medecin_oriente_id && String(v.medecin_oriente_id) !== String(medecinId)) {
                    return false;
                }
                if (!v.parametres_complets && !v.mode_urgence) return false;
                if (v.mode_urgence) return true;
                return v.paiement_actif === true || (v.paiement_valide === true && v.paiement_actif !== false);
            });

            // Enrichir chaque visite avec les détails du patient et les données cliniques
            const enriched = await Promise.all(
                visitesEnCours.map(async (visite) => {
                    try {
                        const patient = await fetchPatientCached(visite.patient);

                        // Récupérer les données cliniques du patient (paramètres vitaux)
                        let donneesCliniques = null;
                        try {
                            const cliniqueResponse = await axiosInstance.get('/patient/clinique/');
                            const allCliniques = cliniqueResponse.data.results || cliniqueResponse.data;
                            donneesCliniques = allCliniques.find(c => c.patient === visite.patient) || null;
                        } catch (e) {
                            // pas grave, les paramètres ne sont pas encore pris
                        }

                        return {
                            ...visite,
                            patient: {
                                id: patient.id,
                                nom: patient.nom,
                                prenom: patient.prenom,
                                sexe: patient.sexe,
                                age: patient.age,
                                matricule: patient.matricule
                            },
                            donnees_cliniques: donneesCliniques
                        };
                    } catch {
                        return {
                            ...visite,
                            patient: {
                                id: visite.patient,
                                nom: "Inconnu",
                                prenom: "",
                                sexe: "-",
                                age: null
                            },
                            donnees_cliniques: null
                        };
                    }
                })
            );

            // RDV non payés exclus : la réception doit ouvrir une visite et encaisser avant le médecin.
            return enriched;
        } catch (error) {
            console.error("Erreur lors de la récupération de la salle d'attente (médecin):", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // PATIENTS
    // --------------------------------------------------------

    /**
     * Récupérer la liste de tous les patients.
     */
    getPatients: async (search = "") => {
        try {
            const params = {};
            if (search) params.search = search;
            const response = await axiosInstance.get('/patients/', { params });
            const patients = response.data.results || response.data;
            return patients.map(p => ({
                ...p,
                id: p.id,
                telephone: p.contact_principal || p.contacts?.[0]?.numero || "—",
                derniere_visite: p.updated_at
                    ? new Date(p.updated_at).toLocaleDateString('fr-FR')
                    : "—"
            }));
        } catch (error) {
            console.error("Erreur récupération patients:", error);
            throw error;
        }
    },

    /**
     * Récupérer le dossier médical complet d'un patient.
     */
    getPatientDossier: async (patientId) => {
        try {
            const response = await axiosInstance.get(`/patients/${patientId}/dossier/`);
            const dossier = response.data;
            return {
                ...dossier,
                age: calculateAge(dossier.date_naissance)
            };
        } catch (error) {
            console.error("Erreur récupération dossier patient:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // CONSULTATIONS
    // --------------------------------------------------------

    /**
     * Récupérer les consultations (avec filtres optionnels).
     */
    getConsultationByVisite: async (visiteId) => {
        if (!visiteId) return null;
        try {
            const response = await axiosInstance.get('/consultations/', {
                params: { visite: visiteId },
            });
            const consultations = response.data.results || response.data;
            if (!Array.isArray(consultations) || consultations.length === 0) return null;
            const vid = String(visiteId);
            const matches = consultations.filter((c) => String(c.visite) === vid);
            if (matches.length === 0) return null;
            return matches.sort(
                (a, b) => new Date(b.date_heure || 0) - new Date(a.date_heure || 0)
            )[0];
        } catch (error) {
            console.error('Erreur consultation par visite:', error);
            throw error;
        }
    },

    getConsultations: async (params = {}) => {
        try {
            clearPatientCache();
            const response = await axiosInstance.get('/consultations/', { params });
            const consultations = response.data.results || response.data;

            // Enrichir avec les données patient et la date
            const enriched = await Promise.all(
                consultations.map(async (consultation) => {
                    let patientData = { id: null, nom: "Inconnu", prenom: "" };
                    let dateHeure = consultation.date_heure || null;

                    try {
                        if (consultation.patient) {
                            const patient = await fetchPatientCached(consultation.patient);
                            patientData = {
                                id: patient.id,
                                nom: patient.nom,
                                prenom: patient.prenom,
                                sexe: patient.sexe,
                                age: patient.age
                            };
                        } else if (consultation.visite) {
                            // Récupérer la visite pour obtenir le patient ET la date
                            try {
                                const visiteResp = await axiosInstance.get(`/visites/${consultation.visite}/`);
                                const visiteData = visiteResp.data;
                                if (!dateHeure) dateHeure = visiteData.date_heure;
                                const visitePatientId = visiteData.patient;
                                if (visitePatientId) {
                                    const patient = await fetchPatientCached(visitePatientId);
                                    patientData = {
                                        id: patient.id,
                                        nom: patient.nom,
                                        prenom: patient.prenom,
                                        sexe: patient.sexe,
                                        age: patient.age
                                    };
                                }
                            } catch (e) {
                                console.warn("Impossible de récupérer patient via visite", consultation.visite, e);
                            }
                        }
                    } catch (e) {
                        console.warn("Impossible de récupérer le patient pour la consultation", consultation.id, e);
                    }
                    return {
                        ...consultation,
                        date_heure: dateHeure,
                        patientDetails: patientData
                    };
                })
            );
            return enriched;
        } catch (error) {
            console.error("Erreur récupération consultations:", error);
            throw error;
        }
    },

    /**
     * Récupérer les détails d'une consultation.
     */
    getConsultationDetail: async (consultationId) => {
        try {
            const response = await axiosInstance.get(`/consultations/${consultationId}/`);
            return response.data;
        } catch (error) {
            console.error("Erreur détail consultation:", error);
            throw error;
        }
    },

    /**
     * Créer une visite (patient physiquement présent). Sert à convertir un
     * RDV en visite concrète au moment où le médecin démarre la consultation.
     */
    createVisite: async (patientId, motif = "Consultation") => {
        const response = await axiosInstance.post('/visites/', {
            patient: patientId,
            motif_visite: motif,
        });
        return response.data;
    },

    /**
     * Clôturer un rendez-vous (statut TERMINE) — après conversion en visite,
     * pour éviter qu'il reste dans les salles d'attente.
     */
    terminerRendezVous: async (rdvId) => {
        try {
            await axiosInstance.patch(`/patient/rendez-vous/${rdvId}/`, { statut: 'TERMINE' });
        } catch (error) {
            console.warn("Impossible de clôturer le RDV:", error);
        }
    },

    /**
     * Créer une consultation pour une visite.
     */
    createConsultation: async (visiteId, data) => {
        try {
            const response = await axiosInstance.post(`/visites/${visiteId}/consultations/`, data);
            return response.data;
        } catch (error) {
            console.error("Erreur création consultation:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // SYMPTÔMES / DIAGNOSTICS / PRESCRIPTIONS / EXAMENS
    // --------------------------------------------------------

    addSymptome: async (consultationId, data) => {
        try {
            const response = await axiosInstance.post(`/consultations/${consultationId}/symptomes/`, data);
            return response.data;
        } catch (error) {
            console.error("Erreur ajout symptôme:", error);
            throw error;
        }
    },

    updateConsultation: async (consultationId, data) => {
        const response = await axiosInstance.patch(`/consultations/${consultationId}/`, data);
        return response.data;
    },

    addDiagnostic: async (consultationId, data) => {
        try {
            const response = await axiosInstance.post(`/consultations/${consultationId}/diagnostics/`, data);
            return response.data;
        } catch (error) {
            console.error("Erreur ajout diagnostic:", error);
            throw error;
        }
    },

    addPrescription: async (consultationId, data) => {
        try {
            const response = await axiosInstance.post(`/consultations/${consultationId}/prescriptions/`, data);
            return response.data;
        } catch (error) {
            console.error("Erreur ajout prescription:", error);
            throw error;
        }
    },

    prescribeExam: async (consultationId, data) => {
        try {
            const response = await axiosInstance.post(`/consultations/${consultationId}/examens/`, data);
            return response.data;
        } catch (error) {
            console.error("Erreur prescription examen:", error);
            throw error;
        }
    },

    addOrientation: async (consultationId, data) => {
        const response = await axiosInstance.post(`/consultations/${consultationId}/orientations/`, data);
        return response.data;
    },

    saveExamResult: async (examenId, { resultats, observations = '', interpretation = '', doctor_id }) => {
        const response = await axiosInstance.post(`/examens/${examenId}/resultat/`, {
            resultats,
            observations,
            interpretation,
            doctor_id: doctor_id || '00000000-0000-0000-0000-000000000001',
        });
        return response.data;
    },

    // --------------------------------------------------------
    // EXAMENS (liste globale)
    // --------------------------------------------------------

    getExamens: async (params = {}) => {
        try {
            clearPatientCache();
            const response = await axiosInstance.get('/examens/', { params });
            const examens = response.data.results || response.data;

            const enriched = await Promise.all(
                examens.map(async (examen) => {
                    let patientData = { id: null, nom: "Inconnu", prenom: "" };
                    let datePrescription = null;

                    try {
                        const consResponse = await axiosInstance.get(`/consultations/${examen.consultation}/`);
                        const consultation = consResponse.data;
                        datePrescription = consultation.date_heure;

                        if (consultation.patient) {
                            const patient = await fetchPatientCached(consultation.patient);
                            patientData = {
                                id: patient.id,
                                nom: patient.nom,
                                prenom: patient.prenom
                            };
                        }
                    } catch (e) {
                        console.warn("Impossible de récupérer le patient pour l'examen", examen.id, e);
                    }

                    return {
                        ...examen,
                        patient: patientData,
                        date_prescription: datePrescription
                    };
                })
            );
            return enriched;
        } catch (error) {
            console.error("Erreur récupération examens:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // HOSPITALISATIONS
    // --------------------------------------------------------

    getHospitalisations: async (params = {}) => {
        try {
            clearPatientCache();
            const response = await axiosInstance.get('/hospitalisations/', { params });
            const hosps = response.data.results || response.data;

            const enriched = await Promise.all(
                hosps.map(async (hosp) => {
                    try {
                        const patient = await fetchPatientCached(hosp.patient);
                        return {
                            ...hosp,
                            patient: {
                                id: patient.id,
                                nom: patient.nom,
                                prenom: patient.prenom,
                                sexe: patient.sexe,
                                age: patient.age
                            }
                        };
                    } catch {
                        return {
                            ...hosp,
                            patient: {
                                id: hosp.patient,
                                nom: "Inconnu",
                                prenom: "",
                                sexe: "-",
                                age: null
                            }
                        };
                    }
                })
            );
            return enriched;
        } catch (error) {
            console.error("Erreur récupération hospitalisations:", error);
            throw error;
        }
    },

    createHospitalisation: async (visiteId, data) => {
        try {
            const response = await axiosInstance.post(`/visites/${visiteId}/hospitalisations/`, data);
            return response.data;
        } catch (error) {
            console.error("Erreur création hospitalisation:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // RENDEZ-VOUS
    // --------------------------------------------------------

    getAppointments: async () => {
        try {
            clearPatientCache();
            const response = await axiosInstance.get('/patient/rendez-vous/');
            const rdvs = response.data.results || response.data;

            const enriched = await Promise.all(
                rdvs.map(async (rdv) => {
                    try {
                        const patient = await fetchPatientCached(rdv.patient);
                        return {
                            ...rdv,
                            patient: {
                                id: patient.id,
                                nom: patient.nom,
                                prenom: patient.prenom
                            }
                        };
                    } catch {
                        return {
                            ...rdv,
                            patient: {
                                id: rdv.patient,
                                nom: "Inconnu",
                                prenom: ""
                            }
                        };
                    }
                })
            );
            return enriched;
        } catch (error) {
            console.error("Erreur récupération rendez-vous:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // VISITES
    // --------------------------------------------------------

    /**
     * Récupérer l'historique des visites d'un patient.
     */
    getPatientVisites: async (patientId) => {
        try {
            const response = await axiosInstance.get('/visites/');
            const allVisites = response.data.results || response.data;
            const patientVisites = allVisites.filter(v => v.patient === patientId);

            const enriched = await Promise.all(
                patientVisites.map(async (visite) => {
                    let consultations = [];
                    try {
                        const consResponse = await axiosInstance.get('/consultations/', {
                            params: { visite: visite.id }
                        });
                        consultations = consResponse.data.results || consResponse.data;
                        consultations = consultations.filter(c => c.visite === visite.id);
                    } catch (e) {
                        console.warn("Impossible de charger les consultations pour la visite", visite.id, e);
                    }

                    const examens = consultations.flatMap(c => c.examens || []);

                    return {
                        ...visite,
                        consultations,
                        examens
                    };
                })
            );

            return enriched.sort((a, b) => new Date(b.date_heure) - new Date(a.date_heure));
        } catch (error) {
            console.error("Erreur récupération visites patient:", error);
            throw error;
        }
    },

    /**
     * Mettre à jour le statut d'une visite (ex: terminer la consultation).
     */
    updateVisiteStatus: async (visiteId, statut) => {
        try {
            const response = await axiosInstance.patch(`/visites/${visiteId}/`, { statut });
            return response.data;
        } catch (error) {
            console.error("Erreur mise à jour statut visite:", error);
            throw error;
        }
    },
};
