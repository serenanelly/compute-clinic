/**
 * API dossier médical — Medical Monitoring (via gateway /medical).
 */
import axiosInstance from '../Utils/axiosInstance';

export const getPatientDossier = async (patientId) => {
    const response = await axiosInstance.get(`/patients/${patientId}/dossier/`);
    return response.data;
};

const findCliniqueForPatient = async (patientId) => {
    const response = await axiosInstance.get('/patient/clinique/');
    const list = response.data.results || response.data;
    return list.find((c) => c.patient === patientId) || null;
};

/** Valeurs par défaut : le modèle backend exige tous les champs cliniques. */
export const buildClinicalPayload = (patientId, raw = {}) => ({
    patient: patientId,
    groupe_sanguin: raw.groupe_sanguin || 'O',
    facteur_rhesus: raw.facteur_rhesus || 'POSITIF',
    electrophorese_hb: raw.electrophorese_hb || 'Non renseignée',
    poids: String(raw.poids ?? '').trim() || '0',
    taille: String(raw.taille ?? '').trim() || '0',
    pouls: String(raw.pouls ?? '').trim() || '0',
    taux_oxygene: String(raw.taux_oxygene ?? '').trim() || '0',
    temperature: String(raw.temperature ?? '').trim(),
    tension_arterielle: String(raw.tension_arterielle ?? '').trim(),
});

export const upsertDonneesCliniques = async (patientId, raw) => {
    const payload = buildClinicalPayload(patientId, raw);
    const existing = await findCliniqueForPatient(patientId);
    if (existing) {
        const response = await axiosInstance.put(`/patient/clinique/${existing.id}/`, payload);
        return response.data;
    }
    const response = await axiosInstance.post('/patient/clinique/', payload);
    return response.data;
};

const findAllergieForPatient = async (patientId) => {
    const response = await axiosInstance.get('/patient/allergies/');
    const list = response.data.results || response.data;
    return list.find((a) => a.patient === patientId) || null;
};

export const upsertAllergie = async (patientId, declencheur, manifestation) => {
    if (!declencheur?.trim() || !manifestation?.trim()) return null;
    const payload = {
        patient: patientId,
        declencheur: declencheur.trim(),
        manifestation: manifestation.trim(),
    };
    const existing = await findAllergieForPatient(patientId);
    if (existing) {
        const response = await axiosInstance.put(`/patient/allergies/${existing.id}/`, payload);
        return response.data;
    }
    const response = await axiosInstance.post('/patient/allergies/', payload);
    return response.data;
};

export const createAntecedent = async (patientId, { type = 'MEDICAL', nom, date, description }) => {
    if (!nom?.trim()) return null;
    const response = await axiosInstance.post('/patient/antecedents/', {
        patient: patientId,
        type,
        nom: nom.trim(),
        date: date || new Date().toISOString().slice(0, 10),
        description: description?.trim() || '',
    });
    return response.data;
};

export const updateAntecedent = async (antecedentId, data) => {
    const response = await axiosInstance.patch(`/patient/antecedents/${antecedentId}/`, data);
    return response.data;
};

/**
 * Mise à jour dossier (constantes + allergies + antécédent texte optionnel).
 */
export const updateDossierMedical = async (patientId, data) => {
    const {
        allergie_declencheur,
        allergie_manifestation,
        antecedent_nom,
        antecedent_type,
        antecedent_date,
        antecedent_description,
        antecedents,
        ...clinicalFields
    } = data;

    await upsertDonneesCliniques(patientId, clinicalFields);
    await upsertAllergie(patientId, allergie_declencheur, allergie_manifestation);

    if (antecedent_nom?.trim()) {
        await createAntecedent(patientId, {
            type: antecedent_type || 'MEDICAL',
            nom: antecedent_nom,
            date: antecedent_date,
            description: antecedent_description,
        });
    }

    return getPatientDossier(patientId);
};
