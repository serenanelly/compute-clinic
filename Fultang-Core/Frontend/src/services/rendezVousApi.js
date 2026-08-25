import axiosInstance from '../Utils/axiosInstance';

/**
 * Service API pour la gestion des rendez-vous
 */

/**
 * RÃ©cupÃ¨re tous les rendez-vous
 */
export const getAllRendezVous = async () => {
    const response = await axiosInstance.get('/rendez-vous/');
    return response.data;
};

/**
 * RÃ©cupÃ¨re tous les rendez-vous d'un mÃ©decin spÃ©cifique
 * @param {number} medecinId - ID du mÃ©decin
 */
export const getRendezVousByMedecin = async (medecinId) => {
    const response = await axiosInstance.get(`/rendez-vous/medecin/${medecinId}/`);
    return response.data;
};

/**
 * CrÃ©e un nouveau rendez-vous
 * @param {Object} rendezVousData - DonnÃ©es du rendez-vous (id_medecin, id_patient, date_heure)
 */
export const createRendezVous = async (rendezVousData) => {
    const response = await axiosInstance.post('/rendez-vous/', rendezVousData);
    return response.data;
};

/**
 * RÃ©cupÃ¨re un rendez-vous par son ID
 * @param {number} id - ID du rendez-vous
 */
export const getRendezVousById = async (id) => {
    const response = await axiosInstance.get(`/rendez-vous/${id}/`);
    return response.data;
};

/**
 * Met Ã  jour un rendez-vous
 * @param {number} id - ID du rendez-vous
 * @param {Object} rendezVousData - DonnÃ©es Ã  mettre Ã  jour
 */
export const updateRendezVous = async (id, rendezVousData) => {
    const response = await axiosInstance.patch(`/rendez-vous/${id}/`, rendezVousData);
    return response.data;
};

/**
 * Supprime un rendez-vous
 * @param {number} id - ID du rendez-vous
 */
export const deleteRendezVous = async (id) => {
    const response = await axiosInstance.delete(`/rendez-vous/${id}/`);
    return response.data;
};
