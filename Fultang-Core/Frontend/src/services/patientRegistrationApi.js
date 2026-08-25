/**
 * Dossier patient — Medical Monitoring
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  PATIENT (identité administrative)                          │
 * │  nom, prénom, sexe, date/lieu naissance, profession, SSN…   │
 * ├─────────────────────────────────────────────────────────────┤
 * │  ADRESSE (1 par patient)     CONTACT (téléphone, WhatsApp)  │
 * │  PERSONNE À PRÉVENIR + LIEN DE PARENTÉ                      │
 * ├─────────────────────────────────────────────────────────────┤
 * │  DONNÉES CLINIQUES (infirmier) — constantes vitales           │
 * │  ALLERGIES, ANTÉCÉDENTS, MALADIES (infirmier / médecin)     │
 * ├─────────────────────────────────────────────────────────────┤
 * │  VISITE → CONSULTATION (médecin) — flux de soins            │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Réceptionniste : Patient + Adresse + Contact + Urgence
 * Infirmier      : Données cliniques + Allergies + Antécédents
 * Médecin        : Consultation (lecture du dossier agrégé /patients/{id}/dossier/)
 */
import axiosInstance from '../Utils/axiosInstance';
import { getPatientDossier } from './medicalDossierApi';

export const mapSexeToApi = (sexe) => {
    if (sexe === 'MASCULIN' || sexe === 'M') return 'M';
    if (sexe === 'FEMININ' || sexe === 'F') return 'F';
    return sexe;
};

export const mapSexeFromApi = (sexe) => (sexe === 'F' ? 'FEMININ' : 'MASCULIN');

/** Adresse API : ville et quartier sont obligatoires (CharField sans blank=True). */
export const buildAdressePayload = (formData) => ({
    pays: formData.pays?.trim() || 'Cameroun',
    ville: formData.ville?.trim() || 'Yaoundé',
    quartier: formData.quartier?.trim() || formData.ville?.trim() || 'Centre-ville',
    rue: formData.rue?.trim() || '',
    code_postal: formData.code_postal?.trim() || '',
});

/** Convertit la réponse GET /patients/{id}/dossier/ vers le formulaire réceptionniste. */
export const mapDossierToForm = (dossier) => {
    const adresse = dossier.adresse || {};
    const contact = dossier.contacts?.[0];
    const pap = dossier.personnes_a_prevenir?.[0];

    return {
        nom: dossier.nom || '',
        prenom: dossier.prenom || '',
        sexe: mapSexeFromApi(dossier.sexe),
        date_naissance: dossier.date_naissance || null,
        lieu_naissance: dossier.lieu_naissance || '',
        nationalite: 'Camerounaise',
        statut_matrimonial: dossier.statut_matrimonial || 'CELIBATAIRE',
        num_securite_sociale: dossier.numero_securite_sociale || '',
        nombre_enfants: dossier.nombre_enfants ?? 0,
        profession: dossier.profession || '',
        email: dossier.courriel || '',
        nom_proche: pap?.nom || '',
        prenom_proche: pap?.prenom || '',
        lien_parente: pap?.lien_parente || pap?.relation || 'AUTRE',
        contact_proche: pap?.contacts?.[0]?.numero || '',
        pays: adresse.pays || 'Cameroun',
        ville: adresse.ville || 'Yaoundé',
        quartier: adresse.quartier || '',
        rue: adresse.rue || '',
        code_postal: adresse.code_postal || '',
        contact: contact?.numero || '',
    };
};

/** Données minimales depuis la liste paginée /patients/. */
export const mapListPatientToForm = (p) => ({
    nom: p.nom || '',
    prenom: p.prenom || '',
    sexe: mapSexeFromApi(p.sexe),
    date_naissance: p.date_naissance || null,
    lieu_naissance: p.lieu_naissance || '',
    nationalite: 'Camerounaise',
    statut_matrimonial: p.statut_matrimonial || 'CELIBATAIRE',
    num_securite_sociale: p.numero_securite_sociale || p.num_securite_sociale || '',
    nombre_enfants: p.nombre_enfants ?? 0,
    profession: p.profession || '',
    email: p.courriel || p.email || '',
    nom_proche: '',
    prenom_proche: '',
    lien_parente: 'AUTRE',
    contact_proche: '',
    pays: 'Cameroun',
    ville: p.ville || p.adresse?.ville || 'Yaoundé',
    quartier: p.adresse?.quartier || '',
    rue: p.adresse?.rue || '',
    code_postal: '',
    contact: p.contact_principal || p.contacts?.[0]?.numero || p.contact || '',
});

export const buildPatientCreatePayload = (formData) => {
    const ssn = formData.num_securite_sociale?.trim() || `FULTANG-${Date.now()}`;
    const payload = {
        nom: formData.nom.trim(),
        prenom: formData.prenom?.trim() || '',
        sexe: mapSexeToApi(formData.sexe),
        date_naissance: formData.date_naissance?.format?.('YYYY-MM-DD') || formData.date_naissance,
        lieu_naissance: formData.lieu_naissance?.trim() || 'Non renseigné',
        profession: formData.profession?.trim() || 'Non renseignée',
        statut_matrimonial: formData.statut_matrimonial || 'CELIBATAIRE',
        numero_securite_sociale: ssn,
        nombre_enfants: Number(formData.nombre_enfants) || 0,
    };
    if (formData.email?.trim()) {
        payload.courriel = formData.email.trim();
    }
    return payload;
};

/** Convertit un data:URL base64 en objet File uploadable. */
const dataUrlToFile = (dataUrl, filename) => {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
};

export const createPatientWithDetails = async (formData) => {
    const payload = buildPatientCreatePayload(formData);
    const patientRes = await axiosInstance.post('/patients/', payload);
    const patientId = patientRes.data.id;

    // Upload de la photo en multipart/form-data (séparé du payload JSON)
    if (formData.photo) {
        try {
            const file = dataUrlToFile(formData.photo, `patient_${patientId}.png`);
            const photoForm = new FormData();
            photoForm.append('photo', file);
            await axiosInstance.patch(`/patients/${patientId}/`, photoForm, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        } catch (err) {
            console.warn('Photo non enregistrée :', err);
        }
    }

    if (formData.pays || formData.ville) {
        const adresseRes = await axiosInstance.post('/adresses/', buildAdressePayload(formData));
        await axiosInstance.patch(`/patients/${patientId}/`, { adresse: adresseRes.data.id });
    }

    if (formData.contact?.trim()) {
        await axiosInstance.post('/contacts/', {
            type: 'TELEPHONE',
            numero: formData.contact.trim(),
            patient: patientId,
        });
    }

    if (formData.nom_proche?.trim()) {
        const papRes = await axiosInstance.post('/personnes-a-prevenir/', {
            nom: formData.nom_proche.trim(),
            prenom: formData.prenom_proche?.trim() || '',
        });
        await axiosInstance.post('/liens-parente/', {
            patient: patientId,
            personne_a_prevenir: papRes.data.id,
            relation: ['PERE', 'MERE', 'FRERE_SOEUR', 'CONJOINT', 'AMI', 'AUTRE'].includes(formData.lien_parente)
                ? formData.lien_parente
                : 'AUTRE',
        });
        if (formData.contact_proche?.trim()) {
            await axiosInstance.post('/contacts/', {
                type: 'TELEPHONE',
                numero: formData.contact_proche.trim(),
                personne_a_prevenir: papRes.data.id,
            });
        }
    }

    return patientRes.data;
};

const formatDate = (formData, fallback) => {
    if (formData.date_naissance?.format) {
        return formData.date_naissance.format('YYYY-MM-DD');
    }
    if (formData.date_naissance) {
        return formData.date_naissance;
    }
    return fallback;
};

export const updatePatientWithDetails = async (patientId, formData, existingDossier = {}) => {
    const payload = {
        nom: formData.nom?.trim() || existingDossier.nom,
        prenom: formData.prenom?.trim() ?? existingDossier.prenom ?? '',
        sexe: mapSexeToApi(formData.sexe),
        date_naissance: formatDate(formData, existingDossier.date_naissance),
        lieu_naissance: formData.lieu_naissance?.trim() || existingDossier.lieu_naissance || 'Non renseigné',
        profession: formData.profession?.trim() || existingDossier.profession || 'Non renseignée',
        statut_matrimonial: formData.statut_matrimonial || existingDossier.statut_matrimonial || 'CELIBATAIRE',
        nombre_enfants: Number(formData.nombre_enfants ?? existingDossier.nombre_enfants) || 0,
    };
    if (formData.email?.trim()) {
        payload.courriel = formData.email.trim();
    }

    await axiosInstance.patch(`/patients/${patientId}/`, payload);

    const adresseObj = existingDossier.adresse;
    const adresseId = typeof adresseObj === 'object' ? adresseObj?.id : adresseObj;

    if (formData.ville || formData.pays) {
        const adressePayload = buildAdressePayload(formData);
        if (adresseId) {
            await axiosInstance.patch(`/adresses/${adresseId}/`, adressePayload);
        } else {
            const adresseRes = await axiosInstance.post('/adresses/', adressePayload);
            await axiosInstance.patch(`/patients/${patientId}/`, { adresse: adresseRes.data.id });
        }
    }

    const mainContact = existingDossier.contacts?.[0];
    if (formData.contact?.trim()) {
        if (mainContact?.id) {
            await axiosInstance.patch(`/contacts/${mainContact.id}/`, {
                type: mainContact.type || 'TELEPHONE',
                numero: formData.contact.trim(),
                patient: patientId,
            });
        } else {
            await axiosInstance.post('/contacts/', {
                type: 'TELEPHONE',
                numero: formData.contact.trim(),
                patient: patientId,
            });
        }
    }

    const pap = existingDossier.personnes_a_prevenir?.[0];
    const emergencyName = formData.nom_proche || pap?.nom;
    const VALID_RELATIONS = ['PERE', 'MERE', 'FRERE_SOEUR', 'CONJOINT', 'AMI', 'AUTRE'];
    const newRelation = VALID_RELATIONS.includes(formData.lien_parente) ? formData.lien_parente : 'AUTRE';

    if (emergencyName?.trim()) {
        let papId = pap?.id;
        if (papId) {
            // Mettre à jour nom/prénom de la PAP
            await axiosInstance.patch(`/personnes-a-prevenir/${papId}/`, {
                nom: emergencyName.trim(),
                prenom: formData.prenom_proche?.trim() ?? pap?.prenom ?? '',
            });
            // Mettre à jour la relation dans LienParente
            const lienRes = await axiosInstance.get(`/liens-parente/?patient=${patientId}&personne_a_prevenir=${papId}`);
            const lienList = lienRes.data?.results || lienRes.data || [];
            if (lienList.length > 0) {
                await axiosInstance.patch(`/liens-parente/${lienList[0].id}/`, { relation: newRelation });
            } else {
                await axiosInstance.post('/liens-parente/', {
                    patient: patientId,
                    personne_a_prevenir: papId,
                    relation: newRelation,
                });
            }
        } else {
            const papRes = await axiosInstance.post('/personnes-a-prevenir/', {
                nom: emergencyName.trim(),
                prenom: formData.prenom_proche?.trim() || '',
            });
            papId = papRes.data.id;
            await axiosInstance.post('/liens-parente/', {
                patient: patientId,
                personne_a_prevenir: papId,
                relation: newRelation,
            });
        }

        if (formData.contact_proche?.trim()) {
            const papContact = pap?.contacts?.[0];
            if (papContact?.id) {
                await axiosInstance.patch(`/contacts/${papContact.id}/`, {
                    type: papContact.type || 'TELEPHONE',
                    numero: formData.contact_proche.trim(),
                    personne_a_prevenir: papId,
                });
            } else {
                await axiosInstance.post('/contacts/', {
                    type: 'TELEPHONE',
                    numero: formData.contact_proche.trim(),
                    personne_a_prevenir: papId,
                });
            }
        }
    }

    return getPatientDossier(patientId);
};
