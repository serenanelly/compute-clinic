import axiosInstance from '../Utils/axiosInstance';

const BASE_URL = '/examens';

// UUID fallback pour le laborantin (remplacé par l'ID réel si dispo depuis le JWT)
const LABORANTIN_FALLBACK = '00000000-0000-0000-0000-000000000000';
const DOCTOR_FALLBACK = '00000000-0000-0000-0000-000000000001';

/**
 * Décoder le JWT pour extraire l'ID utilisateur
 */
const getUserIdFromToken = () => {
    try {
        const token = localStorage.getItem('token_key_fultang');
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.user_id || payload.sub || payload.id || null;
    } catch {
        return null;
    }
};

/**
 * Récupère tous les examens
 */
export const getAllExams = async (filters = {}) => {
    try {
        const params = {};
        Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
        const response = await axiosInstance.get(`${BASE_URL}/`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching exams:', error);
        throw error;
    }
};

/**
 * Enregistre un prélèvement pour un examen
 * Backend attend : laborantin_id (UUID), type_prelevement, code_barre (optionnel)
 */
export const enregistrerPrelevement = async (examId, data = {}) => {
    try {
        const userId = getUserIdFromToken() || LABORANTIN_FALLBACK;
        const payload = {
            laborantin_id: data.laborantin_id || userId,
            type_prelevement: data.type_prelevement || data.type_echantillon || 'Sang veineux',
            ...(data.code_barre ? { code_barre: data.code_barre } : {}),
        };
        const response = await axiosInstance.post(`${BASE_URL}/${examId}/prelevement/`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error registering prelevement for exam ${examId}:`, error.response?.data || error);
        throw error;
    }
};

/**
 * Enregistre les résultats d'un examen
 * Backend attend : doctor_id (UUID), resultats (obligatoire), observations, interpretation
 */
export const enregistrerResultat = async (examId, data = {}) => {
    try {
        const userId = getUserIdFromToken() || DOCTOR_FALLBACK;
        const payload = {
            doctor_id: data.doctor_id || userId,
            resultats: data.resultats || '',
            observations: data.observations || '',
            interpretation: data.interpretation || '',
        };
        const response = await axiosInstance.post(`${BASE_URL}/${examId}/resultat/`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error submitting result for exam ${examId}:`, error.response?.data || error);
        throw error;
    }
};

/**
 * Valide formellement les résultats (aucun payload requis)
 */
export const validerResultat = async (examId, validateur = '') => {
    try {
        const response = await axiosInstance.post(`${BASE_URL}/${examId}/valider/`, {});
        return response.data;
    } catch (error) {
        console.error(`Error validating result for exam ${examId}:`, error.response?.data || error);
        throw error;
    }
};

/**
 * Signale une valeur critique
 * Backend attend : laborantin_id, valeur_mesuree, seuil_alerte, commentaire
 */
export const signalerValeurCritique = async (examId, commentaire = '', data = {}) => {
    try {
        const userId = getUserIdFromToken() || LABORANTIN_FALLBACK;
        const payload = {
            laborantin_id: data.laborantin_id || userId,
            valeur_mesuree: data.valeur_mesuree || commentaire || 'Valeur critique',
            seuil_alerte: data.seuil_alerte || 'Seuil dépassé',
            commentaire: commentaire || data.commentaire || '',
        };
        const response = await axiosInstance.post(`${BASE_URL}/${examId}/signaler-critique/`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error signaling critical value for exam ${examId}:`, error.response?.data || error);
        throw error;
    }
};

// Rétro-compatibilité
export const validateExam = enregistrerResultat;
