/**
 * API Service pour l'historique patient — délègue au Medical Monitoring.
 */
import axiosInstance from '../Utils/axiosInstance';
import {
    getPatientDossier,
    updateDossierMedical,
} from './medicalDossierApi';

export { getPatientDossier };

export const getDossierPatient = getPatientDossier;

export const updateDossierPatient = async (patientId, data) => {
    return updateDossierMedical(patientId, data);
};

export const getPatientObservations = async (patientId) => {
    const response = await axiosInstance.get(`/patients/${patientId}/observations`);
    return response.data;
};

export const getPatientPrescriptionsMedicaments = async (patientId) => {
    const response = await axiosInstance.get(`/patients/${patientId}/prescriptions-medicaments`);
    return response.data;
};

export const getPatientPrescriptionsExamens = async (patientId) => {
    const response = await axiosInstance.get(`/patients/${patientId}/prescriptions-examens`);
    return response.data;
};

export const getPatientResultatsExamens = async (patientId) => {
    const response = await axiosInstance.get(`/patients/${patientId}/resultats-examens`);
    return response.data;
};

export const downloadPatientHistoryPDF = async (patientId) => {
    const response = await axiosInstance.get(`/patients/${patientId}/dossier/`, {
        responseType: 'json',
    });
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dossier_medical_${patientId}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};
