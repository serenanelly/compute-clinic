/**
 * API Service for quittances (receipts)
 * 
 * Utilise axiosInstanceCompta pour communiquer avec le microservice
 * fultang-compta-financiere via la Gateway (port 8080, préfixe /compta-financiere).
 */
import axiosInstanceCompta from '../Utils/axiosInstanceCompta';

const BASE_URL = '/quittances';

/**
 * Get all quittances for a specific patient
 * @param {number} patientId - Patient ID
 * @returns {Promise} - List of quittances
 */
export const getPatientQuittances = async (patientId) => {
    const response = await axiosInstanceCompta.get(`/caissier/${patientId}/quittances`);
    return response.data;
};

/**
 * Create a new quittance
 * @param {object} quittanceData - Quittance data
 * @returns {Promise} - Created quittance
 */
export const createQuittance = async (quittanceData) => {
    const response = await axiosInstanceCompta.post(`${BASE_URL}/`, quittanceData);
    return response.data;
};

/**
 * Valider une quittance (caissier)
 * @param {number|string} id - Quittance ID
 * @returns {Promise} - Quittance validée
 */
export const validerQuittance = async (id) => {
    const response = await axiosInstanceCompta.post(`${BASE_URL}/${id}/valider/`, {});
    return response.data;
};
/**
 * Get receipts filtered by period
 * @param {string} filter - 'day', 'week', 'month'
 * @returns {Promise} - Filtered receipts and stats
 */
export const getFilteredQuittances = async (filter) => {
    let endpoint = '';
    switch (filter) {
        case 'day':
            endpoint = '/quittances/du_jour/';
            break;
        case 'week':
            endpoint = '/quittances/de_la_semaine/';
            break;
        case 'month':
            endpoint = '/quittances/du_mois/';
            break;
        default:
            endpoint = '/quittances/';
    }
    const response = await axiosInstanceCompta.get(endpoint);
    return response.data;
};

/**
 * Get global financial statistics
 * @returns {Promise} - Global stats
 */
export const getFinancialStats = async () => {
    const response = await axiosInstanceCompta.get('/quittances/statistiques/');
    return response.data;
};
