import axiosInstance from '../Utils/axiosInstance';

/**
 * Service API pour la gestion du personnel hospitalier.
 * Centralise tous les appels API lies au personnel.
 */

const gatewayUrl = (import.meta.env.VITE_BACKEND_FULTANG_API_BASE_MEDICALSTAFF_URL || "http://localhost:8080/medical").replace(/\/medical\/?$/, '');
const BASE_URL = `${gatewayUrl}/personnel/personnel`;

/**
 * Recupere tous les personnels avec filtres optionnels.
 * 
 * @param {Object} filters - Filtres optionnels (poste, statut, service)
 * @returns {Promise} Liste des personnels
 */
export const getAllPersonnel = async (filters = {}) => {
    try {
        // Ajouter page_size pour recuperer tous les personnels (bypass pagination)
        const params = { page_size: 1000, ...filters };
        const response = await axiosInstance.get(`${BASE_URL}/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching personnel:', error);
        throw error;
    }
};

/**
 * Recupere un personnel par son ID.
 * 
 * @param {number} id - ID du personnel
 * @returns {Promise} Details du personnel
 */
export const getPersonnelById = async (id) => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching personnel ${id}:`, error);
        throw error;
    }
};

/**
 * Cree un nouveau personnel.
 * Le mot de passe est auto-genere et envoye par email.
 * 
 * @param {Object} personnelData - Donnees du personnel
 * @returns {Promise} Personnel cree
 */
export const createPersonnel = async (personnelData) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/`, personnelData);
        return response.data;
    } catch (error) {
        console.error('Error creating personnel:', error);
        throw error;
    }
};

/**
 * Met a jour un personnel existant.
 * 
 * @param {number} id - ID du personnel
 * @param {Object} personnelData - Donnees a mettre a jour
 * @returns {Promise} Personnel mis a jour
 */
export const updatePersonnel = async (id, personnelData) => {
    try {
        const response = await axiosInstance.patch(`${BASE_URL}/${id}/`, personnelData);
        return response.data;
    } catch (error) {
        console.error(`Error updating personnel ${id}:`, error);
        throw error;
    }
};

/**
 * Supprime un personnel.
 * 
 * @param {number} id - ID du personnel a supprimer
 * @returns {Promise} Confirmation de suppression
 * @throws {Error} Erreur avec message explicite si suppression impossible
 */
export const deletePersonnel = async (id) => {
    try {
        const response = await axiosInstance.delete(`${BASE_URL}/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting personnel ${id}:`, error);

        // Gestion de l'erreur ProtectedError (FK constraint)
        if (error.response?.status === 500) {
            const responseData = error.response?.data || '';
            const dataString = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);

            if (dataString.includes('ProtectedError')) {
                const customError = new Error(
                    'Ce personnel ne peut pas etre supprime car il possede des enregistrements lies ' +
                    '(sessions, consultations, rendez-vous, etc.). ' +
                    'Veuillez d\'abord supprimer ou reassigner ces enregistrements.'
                );
                customError.isProtectedError = true;
                throw customError;
            }
        }

        throw error;
    }
};

/**
 * Reinitialise le mot de passe d'un personnel (admin).
 * Un nouveau mot de passe est genere et envoye par email.
 * 
 * @param {string} email - Email du personnel
 * @returns {Promise} Confirmation
 */
export const resetPersonnelPassword = async (email) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/reset-password/`, { email });
        return response.data;
    } catch (error) {
        console.error('Error resetting password:', error);
        throw error;
    }
};

/**
 * Change le mot de passe de l'utilisateur connecte.
 * 
 * @param {Object} data - {old_password, new_password, confirm_password}
 * @returns {Promise} Confirmation
 */
export const changePassword = async (data) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/change-password/`, data);
        return response.data;
    } catch (error) {
        console.error('Error changing password:', error);
        throw error;
    }
};

/**
 * Recupere les dependances d'un personnel (objets lies).
 * Utilise pour afficher un avertissement detaille avant suppression en cascade.
 * 
 * @param {number} id - ID du personnel
 * @returns {Promise} Nombre d'objets lies par type
 */
export const getPersonnelDependencies = async (id) => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/${id}/dependencies/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching dependencies for personnel ${id}:`, error);
        throw error;
    }
};

