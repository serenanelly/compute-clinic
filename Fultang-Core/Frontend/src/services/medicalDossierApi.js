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
    const pid = String(patientId);
    return list.find((c) => String(c.patient) === pid) || null;
};

/** Payload clinique — n'envoie pas de 0 fictif pour les champs laissés vides. */
export const buildClinicalPayload = (patientId, raw = {}) => {
    const payload = { patient: patientId };
    const setIfFilled = (key, value) => {
        const trimmed = String(value ?? '').trim();
        if (trimmed) payload[key] = trimmed;
    };

    setIfFilled('poids', raw.poids);
    setIfFilled('taille', raw.taille);
    setIfFilled('pouls', raw.pouls);
    setIfFilled('taux_oxygene', raw.taux_oxygene);
    setIfFilled('groupe_sanguin', raw.groupe_sanguin);
    setIfFilled('facteur_rhesus', raw.facteur_rhesus);
    setIfFilled('electrophorese_hb', raw.electrophorese_hb);
    setIfFilled('temperature', raw.temperature);
    setIfFilled('tension_arterielle', raw.tension_arterielle);
    setIfFilled('frequence_respiratoire', raw.frequence_respiratoire);
    setIfFilled('glycemie', raw.glycemie);
    return payload;
};

export const upsertDonneesCliniques = async (patientId, raw) => {
    const existing = await findCliniqueForPatient(patientId);
    const merged = existing
        ? {
            poids: existing.poids,
            taille: existing.taille,
            pouls: existing.pouls,
            taux_oxygene: existing.taux_oxygene,
            groupe_sanguin: existing.groupe_sanguin,
            facteur_rhesus: existing.facteur_rhesus,
            electrophorese_hb: existing.electrophorese_hb,
            temperature: existing.temperature,
            tension_arterielle: existing.tension_arterielle,
            frequence_respiratoire: existing.frequence_respiratoire,
            glycemie: existing.glycemie,
            ...raw,
        }
        : raw;
    const payload = buildClinicalPayload(patientId, merged);
    const { patient: _pid, ...fields } = payload;
    const hasClinicalData = Object.values(fields).some((v) => String(v ?? '').trim() !== '');

    if (existing) {
        if (!hasClinicalData) return existing;
        const response = await axiosInstance.patch(`/patient/clinique/${existing.id}/`, fields);
        return response.data;
    }
    if (!hasClinicalData) return null;
    const response = await axiosInstance.post('/patient/clinique/', payload);
    return response.data;
};

const findAllergieForPatient = async (patientId) => {
    const response = await axiosInstance.get('/patient/allergies/');
    const list = response.data.results || response.data;
    const pid = String(patientId);
    return list.find((a) => String(a.patient) === pid) || null;
};

export const upsertAllergie = async (patientId, declencheur, manifestation, aDesAllergies = true) => {
    const existing = await findAllergieForPatient(patientId);
    if (!aDesAllergies) {
        if (existing?.id) {
            await axiosInstance.delete(`/patient/allergies/${existing.id}/`);
        }
        return null;
    }
    if (!declencheur?.trim() || !manifestation?.trim()) {
        return null;
    }
    const payload = {
        patient: patientId,
        declencheur: declencheur.trim(),
        manifestation: manifestation.trim(),
    };
    if (existing) {
        const response = await axiosInstance.put(`/patient/allergies/${existing.id}/`, payload);
        return response.data;
    }
    const response = await axiosInstance.post('/patient/allergies/', payload);
    return response.data;
};

export const createAntecedent = async (patientId, { type = 'MEDICAL', nom, date, description }) => {
    if (!nom?.trim()) return null;
    const payload = {
        patient: patientId,
        type,
        nom: nom.trim(),
        description: description?.trim() || '',
    };
    if (date?.trim()) {
        payload.date = date.trim();
    } else if (type !== 'FAMILIAL') {
        payload.date = new Date().toISOString().slice(0, 10);
    }
    const response = await axiosInstance.post('/patient/antecedents/', payload);
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
