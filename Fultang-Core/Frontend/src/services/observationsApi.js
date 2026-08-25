import axiosInstance from '../Utils/axiosInstance';

const BASE_URL = '/infirmier';

export const createObservation = async (data) => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/observations/`, data);
        return response.data;
    } catch (error) {
        console.error('Error creating observation:', error);
        throw error;
    }
};

export const getObservationsBySession = async (sessionId) => {
    try {
        const response = await axiosInstance.get(`/observations-medicales/`, {
            params: { id_session: sessionId }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching observations:', error);
        throw error;
    }
};
