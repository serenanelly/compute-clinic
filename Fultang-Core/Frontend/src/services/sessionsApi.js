import axiosInstance from '../Utils/axiosInstance';

/**
 * Service API pour la gestion des sessions patient.
 * Centralise tous les appels API lies aux sessions.
 */

const BASE_URL = '/sessions';

/**
 * Recupere toutes les sessions avec filtres optionnels.
 * 
 * @param {Object} filters - Filtres optionnels (statut, id_patient, service_courant)
 * @returns {Promise} Liste des sessions
 */
export const getAllSessions = async (filters = {}) => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/`, { params: filters });
        return response.data;
    } catch (error) {
        console.error('Error fetching sessions:', error);
        throw error;
    }
};

/**
 * Recupere les sessions en cours.
 * 
 * @returns {Promise} Liste des sessions en cours
 */
export const getSessionsEnCours = async () => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/en-cours/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching sessions en cours:', error);
        throw error;
    }
};

/**
 * Ouvre une nouvelle session pour un patient.
 * 
 * @param {Object} data - {id_patient, id_service, id_personnel (optionnel)}
 * @returns {Promise} Session creee
 */
export const createSession = async (data) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating session:', error);
        throw error;
    }
};

/**
 * Termine une session.
 * 
 * @param {number} sessionId - ID de la session
 * @returns {Promise} Session terminee
 */
export const terminerSession = async (sessionId) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/${sessionId}/terminer/`);
        return response.data;
    } catch (error) {
        console.error('Error terminating session:', error);
        throw error;
    }
};

/**
 * Selectionne un patient (situation -> recu).
 * 
 * @param {number} sessionId - ID de la session
 * @returns {Promise} Session mise a jour
 */
export const selectionnerPatient = async (sessionId) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/${sessionId}/selectionner/`);
        return response.data;
    } catch (error) {
        console.error('Error selecting patient:', error);
        throw error;
    }
};

/**
 * Redirige un patient vers un service ou un personnel.
 * 
 * @param {number} sessionId - ID de la session
 * @param {Object} data - {type: 'service'|'personnel', valeur: string}
 * @returns {Promise} Session mise a jour
 */
export const rediriggerPatient = async (sessionId, data) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/${sessionId}/rediriger/`, data);
        return response.data;
    } catch (error) {
        console.error('Error redirecting patient:', error);
        throw error;
    }
};

/**
 * Recupere les patients en attente pour un poste dans un service.
 * 
 * @param {string} service - Nom du service
 * @param {string} poste - Poste du personnel (infirmier, medecin)
 * @returns {Promise} Liste des patients en attente
 */
export const getPatientsEnAttente = async (service, poste) => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/patients-attente/`, {
            params: { service, poste }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching patients en attente:', error);
        throw error;
    }
};

/**
 * Met a jour le statut d'une session.
 * 
 * @param {number} sessionId - ID de la session
 * @param {string} statut - Nouveau statut ('en attente', 'en cours', 'terminee')
 * @returns {Promise} Session mise a jour
 */
export const updateSessionStatus = async (sessionId, statut) => {
    try {
        const response = await axiosInstance.patch(`${BASE_URL}/${sessionId}/`, { statut });
        return response.data;
    } catch (error) {
        console.error('Error updating session status:', error);
        throw error;
    }
};
/**
 * Met une session en attente (Send to Cashier).
 * 
 * @param {number} sessionId - ID de la session
 * @returns {Promise} Session mise a jour
 */
export const putSessionEnAttente = async (sessionId) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/${sessionId}/mettre-en-attente/`);
        return response.data;
    } catch (error) {
        console.error('Error putting session en attente:', error);
        throw error;
    }
};
