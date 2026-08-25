import axiosInstance from "../Utils/axiosInstance.js";
import {
    upsertDonneesCliniques,
    upsertAllergie,
    createAntecedent,
} from "./medicalDossierApi.js";

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
 * Retourne un objet patient enrichi avec le champ `age` calculé.
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
 * Cache simple en mémoire pour éviter de refetcher le même patient
 * plusieurs fois dans un même cycle de chargement.
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

/**
 * Vide le cache patient (à appeler au début de chaque chargement de page).
 */
const clearPatientCache = () => {
    patientCache.clear();
};

/**
 * Récupère les rendez-vous actifs (statut PROGRAMME) créés par les rôles donnés,
 * et les met en forme comme des entrées de salle d'attente (patient enrichi).
 * Sert au routage : réception → infirmier + médecin ; infirmier → médecin.
 *
 * @param {string[]} roles - rôles auteurs à inclure (ex. ['RECEPTIONNISTE'])
 */
const fetchRendezVousWaiting = async (roles) => {
    try {
        const response = await axiosInstance.get('/patient/rendez-vous/');
        const allRdv = response.data.results || response.data || [];
        const actifs = allRdv.filter(
            r => r.statut === 'PROGRAMME' && roles.includes(r.cree_par_role || 'RECEPTIONNISTE')
        );
        const enriched = await Promise.all(actifs.map(async (rdv) => {
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
                patient,
            };
        }));
        return enriched;
    } catch (error) {
        console.warn('RDV non chargés pour la salle d\'attente:', error);
        return [];
    }
};

// ============================================================
// Service API Infirmier
// ============================================================

/**
 * Service pour gérer les requêtes API de l'infirmier.
 * Tous les appels passent par axiosInstance (JWT, baseURL configurés).
 */
export const nurseApi = {

    // --------------------------------------------------------
    // SALLE D'ATTENTE
    // --------------------------------------------------------

    /**
     * Récupérer la liste des patients dans la salle d'attente.
     * - GET /visites/ → filtre client-side sur statut EN_COURS
     * - Pour chaque visite, enrichit avec les détails patient (2e appel)
     */
    getWaitingPatients: async () => {
        try {
            clearPatientCache();
            const response = await axiosInstance.get('/visites/');
            const allVisites = response.data.results || response.data;

            // Filtrer côté client les visites en cours
            const visitesEnCours = allVisites.filter(v => v.statut === 'EN_COURS');

            // Enrichir chaque visite avec les détails du patient
            const enriched = await Promise.all(
                visitesEnCours.map(async (visite) => {
                    try {
                        const patient = await fetchPatientCached(visite.patient);
                        return {
                            ...visite,
                            patient: {
                                id: patient.id,
                                nom: patient.nom,
                                prenom: patient.prenom,
                                sexe: patient.sexe,
                                age: patient.age,
                                matricule: patient.matricule || "—"
                            }
                        };
                    } catch {
                        // Si le patient n'est pas trouvable, on affiche avec l'UUID
                        return {
                            ...visite,
                            patient: {
                                id: visite.patient,
                                nom: "Inconnu",
                                prenom: "",
                                sexe: "-",
                                age: null
                            }
                        };
                    }
                })
            );
            // Ajouter les patients ayant un RDV actif pris par la RÉCEPTION
            // (routage réception → infirmier). Dédupliqué par patient.
            const rdvItems = await fetchRendezVousWaiting(['RECEPTIONNISTE']);
            const dejaPresents = new Set(enriched.map(v => String(v.patient.id)));
            const rdvUniques = rdvItems.filter(r => !dejaPresents.has(String(r.patient.id)));

            return [...enriched, ...rdvUniques];
        } catch (error) {
            console.error("Erreur lors de la récupération de la salle d'attente:", error);
            throw error;
        }
    },

    /**
     * Créer une visite (conversion d'un RDV en visite concrète quand l'infirmier
     * commence à prendre les paramètres du patient).
     */
    createVisite: async (patientId, motif = "Consultation") => {
        const response = await axiosInstance.post('/visites/', {
            patient: patientId,
            motif_visite: motif,
        });
        return response.data;
    },

    /**
     * Clôturer un rendez-vous (statut TERMINE) après conversion en visite.
     */
    terminerRendezVous: async (rdvId) => {
        try {
            await axiosInstance.patch(`/patient/rendez-vous/${rdvId}/`, { statut: 'TERMINE' });
        } catch (error) {
            console.warn("Impossible de clôturer le RDV:", error);
        }
    },

    // --------------------------------------------------------
    // DÉTAILS PATIENT (pour prise de paramètres)
    // --------------------------------------------------------

    /**
     * Récupérer les détails complets d'un patient (dossier médical).
     * Utilise l'endpoint /patients/{id}/dossier/ qui retourne :
     * identité + donnees_cliniques + allergies + maladies + antecedents + etc.
     */
    getPatientDetails: async (patientId) => {
        try {
            const response = await axiosInstance.get(`/patients/${patientId}/dossier/`);
            const dossier = response.data;
            return {
                ...dossier,
                age: calculateAge(dossier.date_naissance)
            };
        } catch (error) {
            console.error("Erreur lors de la récupération des détails du patient:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // GESTION DES PATIENTS (liste)
    // --------------------------------------------------------

    /**
     * Récupérer la liste de tous les patients.
     * - GET /patients/?search=... pour la recherche
     * - Enrichit avec le premier contact téléphonique trouvé
     */
    getPatients: async (search = "", page = 1, pageSize = 3) => {
        try {
            const params = {};
            if (search) params.search = search;

            // On récupère tout (ou la page du backend si disponible)
            const response = await axiosInstance.get('/patients/', { params });
            const raw = response.data;

            // Support paginated (DRF) and flat array responses
            const isPaginated = raw && typeof raw === 'object' && !Array.isArray(raw) && 'results' in raw;
            let allPatients = isPaginated ? raw.results : (Array.isArray(raw) ? raw : []);
            const totalFromApi = isPaginated ? (raw.count || allPatients.length) : allPatients.length;

            // Si le backend pagine lui-même avec next/previous, on garde son comportement
            // Sinon on pagine côté frontend
            const backendPaginates = isPaginated && (raw.next || raw.previous);

            const mapped = allPatients.map(p => ({
                ...p,
                id: p.id,
                matricule: p.matricule || "—",
                telephone: p.contact_principal || p.contacts?.[0]?.numero || "—",
                derniere_visite: p.updated_at
                    ? new Date(p.updated_at).toLocaleDateString('fr-FR')
                    : "—"
            }));

            if (backendPaginates) {
                // Le backend gère la pagination — on retourne telle quelle
                const backendPageSize = mapped.length || pageSize;
                return {
                    patients: mapped,
                    count: totalFromApi,
                    totalPages: Math.ceil(totalFromApi / backendPageSize),
                    currentPage: page,
                };
            } else {
                // Pagination frontend sur la liste complète
                const count = mapped.length;
                const totalPages = Math.ceil(count / pageSize) || 1;
                const start = (page - 1) * pageSize;
                const paginated = mapped.slice(start, start + pageSize);
                return {
                    patients: paginated,
                    count,
                    totalPages,
                    currentPage: page,
                };
            }
        } catch (error) {
            console.error("Erreur lors de la récupération des patients:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // HISTORIQUE DES VISITES (Dossier Médical)
    // --------------------------------------------------------

    /**
     * Récupérer l'historique des visites d'un patient.
     */
    getPatientVisites: async (patientId) => {
        try {
            const response = await axiosInstance.get('/visites/');
            const allVisites = response.data.results || response.data;

            // Filtrer les visites de ce patient
            const patientVisites = allVisites.filter(v => v.patient === patientId);

            // Récupérer tous les soins du patient (via l'endpoint GET)
            let allSoins = [];
            try {
                const soinsResponse = await axiosInstance.get(`/patients/${patientId}/soins/`);
                allSoins = soinsResponse.data.results || soinsResponse.data;
            } catch (e) {
                console.warn("Impossible de charger les soins pour le patient", patientId, e);
            }

            // Enrichir chaque visite avec les consultations et examens
            const enriched = await Promise.all(
                patientVisites.map(async (visite) => {
                    // Récupérer les consultations de cette visite
                    let consultations = [];
                    try {
                        const consResponse = await axiosInstance.get('/consultations/', {
                            params: { visite: visite.id }
                        });
                        // Les consultations incluent déjà symptomes, diagnostics, prescriptions, examens (nested)
                        consultations = consResponse.data.results || consResponse.data;
                        // Filtrer uniquement celles de cette visite
                        consultations = consultations.filter(c => c.visite === visite.id);
                    } catch (e) {
                        console.warn("Impossible de charger les consultations pour la visite", visite.id, e);
                    }

                    // Extraire les examens depuis les consultations (déjà nested)
                    const examens = consultations.flatMap(c => c.examens || []);

                    // Uniquement les soins explicitement liés à cette visite
                    const soins = allSoins.filter(s => s.visite === visite.id);

                    return {
                        ...visite,
                        consultations,
                        examens,
                        soins
                    };
                })
            );

            // On trie les visites par date décroissante
            return enriched.sort((a, b) => new Date(b.date_heure) - new Date(a.date_heure));
        } catch (error) {
            console.error("Erreur lors de la récupération des visites:", error);
            throw error;
        }
    },

    /**
     * Récupérer les hospitalisations d'un patient
     */
    getPatientHospitalizations: async (patientId) => {
        try {
            const response = await axiosInstance.get('/hospitalisations/');
            const allHosp = response.data.results || response.data;
            return allHosp.filter(h => h.patient === patientId);
        } catch (error) {
            console.error("Erreur récupération hospitalisations patient:", error);
            throw error;
        }
    },

    /**
     * Récupérer tous les soins d'un patient (inclut les orphelins)
     */
    getPatientSoins: async (patientId) => {
        try {
            const response = await axiosInstance.get(`/patients/${patientId}/soins/`);
            return response.data.results || response.data;
        } catch (error) {
            console.error("Erreur récupération soins patient:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // RENDEZ-VOUS
    // --------------------------------------------------------

    /**
     * Récupérer la liste des rendez-vous.
     * - GET /patient/rendez-vous/
     * - Enrichit avec les détails patient (nom, prénom)
     */
    getAppointments: async () => {
        try {
            clearPatientCache();
            const response = await axiosInstance.get('/patient/rendez-vous/');
            const rdvs = response.data.results || response.data;

            // Enrichir avec les données patient
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
            console.error("Erreur lors de la récupération des rendez-vous:", error);
            throw error;
        }
    },

    /**
     * Créer un nouveau rendez-vous pour un patient.
     * - POST /patient/rendez-vous/ (même endpoint que la réception, patient dans le corps)
     */
    createAppointment: async (appointmentData) => {
        try {
            const response = await axiosInstance.post(
                '/patient/rendez-vous/',
                appointmentData
            );
            return response.data;
        } catch (error) {
            console.error("Erreur lors de la création du rendez-vous:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // SOINS
    // --------------------------------------------------------

    /**
     * Récupérer l'historique des soins d'un patient.
     * Note : Pas d'endpoint dédié "liste des soins par patient".
     * On utilise le dossier patient pour récupérer les soins si disponible,
     * sinon cette fonctionnalité reste limitée.
     */
    getPatientCare: async (patientId) => {
        try {
            // Les soins sont accessibles via le dossier patient
            const response = await axiosInstance.get(`/patients/${patientId}/dossier/`);
            // Le dossier ne contient pas directement les soins dans le PatientDossierSerializer
            // On retourne un tableau vide — à enrichir si un endpoint soins est ajouté
            return [];
        } catch (error) {
            console.error("Erreur historique soins:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // EXAMENS
    // --------------------------------------------------------

    /**
     * Récupérer la liste de tous les examens.
     * - GET /examens/
     * - Le serializer inclut déjà le résultat nested
     * - Enrichit avec les données patient (via consultation → patient)
     */
    getExams: async () => {
        try {
            clearPatientCache();
            const response = await axiosInstance.get('/examens/');
            const examens = response.data.results || response.data;

            // Enrichir avec les données patient (consultation → patient)
            const enriched = await Promise.all(
                examens.map(async (examen) => {
                    let patientData = { id: null, nom: "Inconnu", prenom: "" };
                    let datePrescription = null;

                    try {
                        // Récupérer la consultation pour obtenir le patient
                        const consResponse = await axiosInstance.get(`/consultations/${examen.consultation}/`);
                        const consultation = consResponse.data;
                        datePrescription = consultation.date_heure;

                        const patient = await fetchPatientCached(consultation.patient);
                        patientData = {
                            id: patient.id,
                            nom: patient.nom,
                            prenom: patient.prenom
                        };
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
            console.error("Erreur examens:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // HOSPITALISATIONS
    // --------------------------------------------------------

    /**
     * Récupérer les hospitalisations en cours.
     * - GET /hospitalisations/?statut=EN_COURS (filtrage côté backend supporté)
     * - Enrichit avec les données patient
     * - room_id et doctor_id restent des UUID (entités gérées par un autre service)
     */
    getHospitalizations: async () => {
        try {
            clearPatientCache();
            const response = await axiosInstance.get('/hospitalisations/', {
                params: { statut: 'EN_COURS' }
            });
            const hosps = response.data.results || response.data;

            // Enrichir avec les données patient
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
                                age: patient.age,
                                matricule: patient.matricule
                            },
                            // room_id et doctor_id restent tels quels (UUID provenant d'un autre service)
                            date_entree: hosp.date_admission
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
                            },
                            date_entree: hosp.date_admission
                        };
                    }
                })
            );
            return enriched;
        } catch (error) {
            console.error("Erreur hospitalisations:", error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // ENREGISTREMENT DE SOINS
    // --------------------------------------------------------

    /**
     * Enregistrer un soin administré à un patient.
     * - POST /patients/{patientId}/soins/
     */
    recordCare: async (careData) => {
        try {
            const { patientId, ...rest } = careData;
            const response = await axiosInstance.post(
                `/patients/${patientId}/soins/`,
                rest
            );
            return response.data;
        } catch (error) {
            console.error("Erreur enregistrement soin:", error.response ? error.response.data : error);
            throw error;
        }
    },

    // --------------------------------------------------------
    // SAUVEGARDE DES PARAMÈTRES VITAUX
    // --------------------------------------------------------

    /**
     * Sauvegarder les paramètres vitaux d'un patient.
     * - Vérifie d'abord si des données cliniques existent (GET /patient/clinique/)
     * - Si oui : PUT /patient/clinique/{id}/
     * - Si non : POST /patient/clinique/ avec patient=patientId
     * - Gère aussi l'allergie séparément si renseignée
     */
    savePatientParameters: async (patientId, parameters) => {
        try {
            const {
                allergie_declencheur,
                allergie_manifestation,
                antecedent_type,
                antecedent_nom,
                antecedent_date,
                antecedent_description,
                visiteId,
                ...clinicalData
            } = parameters;

            await upsertDonneesCliniques(patientId, clinicalData);
            await upsertAllergie(patientId, allergie_declencheur, allergie_manifestation);

            if (antecedent_nom?.trim()) {
                await createAntecedent(patientId, {
                    type: antecedent_type || 'MEDICAL',
                    nom: antecedent_nom,
                    date: antecedent_date,
                    description: antecedent_description,
                });
            }

            // Ne PAS terminer la visite ici !
            // La visite doit rester 'EN_COURS' pour que le médecin puisse
            // la voir dans sa salle d'attente et faire la consultation.
            // C'est le médecin qui terminera la visite à la fin.
            
            // HACK DE DÉVELOPPEMENT : On masque cette visite pour l'infirmier
            // en l'ajoutant dans le localStorage pour simuler qu'elle est passée au médecin.
            if (visiteId) {
                const treatedVisits = JSON.parse(localStorage.getItem('treated_visits') || '[]');
                if (!treatedVisits.includes(visiteId)) {
                    treatedVisits.push(visiteId);
                    localStorage.setItem('treated_visits', JSON.stringify(treatedVisits));
                }
            }

            return { success: true, message: "Données enregistrées avec succès" };
        } catch (error) {
            const detail = error.response?.data;
            console.error("Erreur lors de la sauvegarde des paramètres:", detail || error);
            const msg = typeof detail === 'object'
                ? Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' — ')
                : (detail || error.message);
            const err = new Error(msg);
            err.response = error.response;
            throw err;
        }
    }
};
