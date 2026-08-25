import axiosInstance from '../Utils/axiosInstance';

const BASE_URL = '/dossiers-patients';

export const getDossierByPatientId = async (patientId) => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/`, {
            params: { id_patient: patientId }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching dossier patient:', error);
        throw error;
    }
};

export const getDossierById = async (dossierId) => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/${dossierId}/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching dossier:', error);
        throw error;
    }
};

export const createDossier = async (data) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating dossier:', error);
        throw error;
    }
};

export const updateDossier = async (dossierId, data) => {
    try {
        const response = await axiosInstance.patch(`${BASE_URL}/${dossierId}/`, data);
        return response.data;
    } catch (error) {
        console.error('Error updating dossier:', error);
        throw error;
    }
};
