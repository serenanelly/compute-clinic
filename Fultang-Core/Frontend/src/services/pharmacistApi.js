import axiosInstance from '../Utils/axiosInstance';

/**
 * API service pour le Pharmacien (Consultations, Prescriptions, Hospitalisations)
 */

// Prescriptions
export const getPrescriptions = async (filters = {}) => {
    try {
        const params = new URLSearchParams(filters).toString();
        const url = params ? `/prescriptions/?${params}` : `/prescriptions/`;
        const response = await axiosInstance.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        throw error;
    }
};

export const updatePrescriptionState = async (prescriptionId, statut) => {
    try {
        const response = await axiosInstance.patch(`/prescriptions/${prescriptionId}/`, { statut });
        return response.data;
    } catch (error) {
        console.error('Error updating prescription state:', error);
        throw error;
    }
};

/**
 * Valider une prescription (statut → VALIDEE)
 * Appelé depuis la page Prescriptions avant la délivrance.
 */
export const validerPrescription = async (prescriptionId) => {
    try {
        const response = await axiosInstance.patch(`/prescriptions/${prescriptionId}/`, { statut: 'VALIDEE' });
        return response.data;
    } catch (error) {
        console.error('Error validating prescription:', error);
        throw error;
    }
};

/**
 * Délivrer un médicament (statut → DELIVREE) et décrémenter le stock.
 * quantite_delivree : nombre d'unités délivrées (défaut 1 côté serveur si absent).
 */
export const delivrerMedicament = async (prescriptionId, quantite_delivree) => {
    try {
        const payload = { quantite_delivree: quantite_delivree ?? 1 };
        const response = await axiosInstance.post(`/prescriptions/${prescriptionId}/delivrer/`, payload);
        return response.data;
    } catch (error) {
        console.error('Error delivering medicament:', error);
        throw error;
    }
};

/**
 * Récupérer les allergies d'un patient.
 */
export const getPatientAllergies = async (patientId) => {
    try {
        const response = await axiosInstance.get(`/patients/${patientId}/allergies/`);
        return response.data;
    } catch (error) {
        // Les allergies peuvent ne pas être disponibles — retourner tableau vide
        console.warn('Could not fetch patient allergies:', error);
        return [];
    }
};

/**
 * Vérifier si un médicament existe en stock (par nom ou id).
 * Retourne true si disponible, false sinon.
 */
export const checkMedicamentEnStock = async (nomMedicament) => {
    try {
        const response = await axiosInstance.get(`/medicaments/?search=${encodeURIComponent(nomMedicament)}`);
        const results = response.data?.results ?? response.data ?? [];
        return Array.isArray(results) && results.length > 0;
    } catch (error) {
        console.warn('Could not check medicament stock:', error);
        return null; // null = inconnu (ne pas bloquer)
    }
};

// Hospitalisations (Sorties)
export const getHospitalisations = async (statut = '') => {
    try {
        const url = statut ? `/hospitalisations/?statut=${statut}` : `/hospitalisations/`;
        const response = await axiosInstance.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching hospitalisations:', error);
        throw error;
    }
};

// Consultations / Patient Dossier
export const getPatientConsultations = async (patientId) => {
    try {
        const response = await axiosInstance.get(`/consultations/?patient=${patientId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching patient consultations:', error);
        throw error;
    }
};

// Dossier Clinique Patient
export const getPatientData = async (patientId) => {
    try {
        const patientRes = await axiosInstance.get(`/patients/${patientId}/`);
        return patientRes.data;
    } catch (error) {
        console.error('Error fetching patient data:', error);
        throw error;
    }
};

export const getAllPatients = async () => {
    try {
        const response = await axiosInstance.get('/patients/');
        return response.data;
    } catch (error) {
        console.error('Error fetching patients:', error);
        throw error;
    }
};
