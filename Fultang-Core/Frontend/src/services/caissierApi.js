/**
 * API Service pour le caissier — BFF compta-financiere /caissier/*
 */
import axiosInstanceCompta from '../Utils/axiosInstanceCompta';

const BASE_URL = '/caissier';

export const getPatientsEnAttente = async () => {
    const response = await axiosInstanceCompta.get(`${BASE_URL}/patients-en-attente/`);
    return response.data;
};

export const searchPatientsForHistory = async (query) => {
    const response = await axiosInstanceCompta.get(
        `${BASE_URL}/rechercher-patients/`,
        { params: { q: query } },
    );
    return response.data;
};

export const getFicheEncaissement = async (patientId, date) => {
    const params = date ? { date } : {};
    const response = await axiosInstanceCompta.get(
        `${BASE_URL}/${patientId}/fiche-encaissement/`,
        { params },
    );
    return response.data;
};

export const getCaisseOuverte = async () => {
    const response = await axiosInstanceCompta.get('/caisse-journaliere/ouverte/');
    return response.data;
};

export const getHistoriqueFlux = async (filters = {}) => {
    const response = await axiosInstanceCompta.get(`${BASE_URL}/historique-flux/`, { params: filters });
    return response.data;
};

export const getRapportCaisse = async (filters = {}) => {
    const response = await axiosInstanceCompta.get(`${BASE_URL}/rapport-caisse/`, { params: filters });
    return response.data;
};
