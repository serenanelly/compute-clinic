import axiosInstance from '../Utils/axiosInstance';

/**
 * Service API pour les patients.
 */

const BASE_URL = '/patients';

/**
 * Recupere tous les patients.
 */
export const getAllPatients = async () => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching patients:', error);
        throw error;
    }
};

/**
 * Recherche des patients par nom/prenom.
 */
export const searchPatients = async (query) => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/`, { params: { search: query } });
        return response.data;
    } catch (error) {
        console.error('Error searching patients:', error);
        throw error;
    }
};

/**
 * Recupere la liste des patients hospitalises.
 */
export const getHospitalizedPatients = async () => {
    try {
        const response = await axiosInstance.get(`${BASE_URL}/hospitalises/`);
        return response.data;
    } catch (error) {
        console.error('Error fetching hospitalized patients:', error);
        throw error;
    }
};

/**
 * Cree un nouveau patient.
 */
export const createPatient = async (patientData) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/`, patientData);
        return response.data;
    } catch (error) {
        console.error('Error creating patient:', error);
        throw error;
    }
};

/**
 * Met a jour un patient.
 */
export const updatePatient = async (id, patientData) => {
    try {
        const response = await axiosInstance.patch(`${BASE_URL}/${id}/`, patientData);
        return response.data;
    } catch (error) {
        console.error('Error updating patient:', error);
        throw error;
    }
};
