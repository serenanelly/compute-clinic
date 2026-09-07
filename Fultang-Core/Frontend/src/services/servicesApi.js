import axiosInstance from '../Utils/axiosInstance';
import { getGatewayBaseUrl } from '../Utils/gatewayUrls';

/**
 * Service API pour la gestion des services hospitaliers.
 * Centralise tous les appels API lies aux services.
 */

// getGatewayBaseUrl() cible le hostname courant (Phase 2.1 : résolution de
// tenant par sous-domaine) — voir Utils/gatewayUrls.js pour le détail.
const gatewayUrl = getGatewayBaseUrl();
const BASE_URL = `${gatewayUrl}/personnel/services`;

/**
 * Recupere tous les services de l'hopital.
 * 
 * @returns {Promise} Liste des services
 */
export const getAllServices = async () => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching services:', error);
        throw error;
    }
};

/**
 * Recupere un service par son ID.
 * 
 * @param {number} id - ID du service
 * @returns {Promise} Details du service
 */
export const getServiceById = async (id) => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching service ${id}:`, error);
        throw error;
    }
};

/**
 * Cree un nouveau service avec son chef.
 * 
 * @param {Object} serviceData - Donnees du service et du chef
 * @param {string} serviceData.nom_service - Nom du service
 * @param {string} serviceData.desc_service - Description du service
 * @param {string} serviceData.chef_nom - Nom du chef
 * @param {string} serviceData.chef_prenom - Prenom du chef
 * @param {string} serviceData.chef_date_naissance - Date de naissance du chef
 * @param {string} serviceData.chef_email - Email du chef
 * @param {string} serviceData.chef_contact - Contact du chef
 * @param {string} serviceData.chef_poste - Poste du chef
 * @param {string} [serviceData.chef_specialite] - Specialite du chef (si medecin)
 * @returns {Promise} Service cree
 */
export const createService = async (serviceData) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/`, serviceData);
        return response.data;
    } catch (error) {
        console.error('Error creating service:', error);
        throw error;
    }
};

/**
 * Met a jour un service existant.
 * 
 * @param {number} id - ID du service
 * @param {Object} serviceData - Donnees a mettre a jour
 * @param {string} [serviceData.nom_service] - Nouveau nom
 * @param {string} [serviceData.desc_service] - Nouvelle description
 * @param {string} [serviceData.chef_email] - Email du nouveau chef
 * @returns {Promise} Service mis a jour
 */
export const updateService = async (id, serviceData) => {
    try {
        const response = await axiosInstance.patch(`${BASE_URL}/${id}/`, serviceData);
        return response.data;
    } catch (error) {
        console.error(`Error updating service ${id}:`, error);
        throw error;
    }
};

/**
 * Supprime un service.
 * 
 * @param {number} id - ID du service a supprimer
 * @returns {Promise} Confirmation de suppression
 */
export const deleteService = async (id) => {
    try {
        const response = await axiosInstance.delete(`${BASE_URL}/${id}/`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting service ${id}:`, error);
        throw error;
    }
};

/**
 * Recupere la liste du personnel d'un service.
 * 
 * @param {number} id - ID du service
 * @returns {Promise} Liste du personnel
 */
export const getServicePersonnel = async (id) => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/${id}/personnel/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching personnel for service ${id}:`, error);
        throw error;
    }
};

/**
 * Recupere la liste des medecins d'un service.
 * 
 * @param {number} id - ID du service
 * @returns {Promise} Liste des medecins
 */
export const getServiceMedecins = async (id) => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/${id}/medecins/`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching medecins for service ${id}:`, error);
        throw error;
    }
};

/**
 * Recherche un service par son nom.
 * 
 * @param {string} nom - Nom du service a rechercher
 * @returns {Promise} Service trouve
 */
export const searchServiceByName = async (nom) => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/recherche/`, {
            params: { nom }
        });
        return response.data;
    } catch (error) {
        console.error(`Error searching service by name "${nom}":`, error);
        throw error;
    }
};
