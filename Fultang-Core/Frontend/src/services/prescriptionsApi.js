/**
 * API service pour les prescriptions (pharmacien)
 */
import axiosInstance from '../Utils/axiosInstance';

const BASE_URL = '/prescriptions-medicaments';

/**
 * Récupère toutes les prescriptions en attente avec les informations patient
 * @returns {Promise} Liste des prescriptions en attente
 */
export const getPendingPrescriptions = async () => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/pending/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching pending prescriptions:', error);
        throw error;
    }
};

/**
 * Récupère toutes les prescriptions
 * @param {Object} filters - Filtres optionnels (state, id_medecin, id_session)
 * @returns {Promise} Liste des prescriptions
 */
export const getAllPrescriptions = async (filters = {}) => {
    try {
        const params = new URLSearchParams(filters).toString();
        const url = params ? `${BASE_URL}/?${params}` : `${BASE_URL}/`;
        const response = await axiosInstance.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        throw error;
    }
};

/**
 * Met à jour l'état d'une prescription
 * @param {number} prescriptionId - ID de la prescription
 * @param {string} state - Nouvel état ('en attente' ou 'effectuee')
 * @returns {Promise} Prescription mise à jour
 */
export const updatePrescriptionState = async (prescriptionId, state) => {
    try {
        const response = await axiosInstance.patch(`${BASE_URL}/${prescriptionId}/`, { state });
        return response.data;
    } catch (error) {
        console.error('Error updating prescription state:', error);
        throw error;
    }
};

/**
 * Marque une prescription comme effectuée
 * @param {number} prescriptionId - ID de la prescription
 * @returns {Promise} Prescription mise à jour
 */
export const markPrescriptionAsCompleted = async (prescriptionId) => {
    return updatePrescriptionState(prescriptionId, 'effectuee');
};
