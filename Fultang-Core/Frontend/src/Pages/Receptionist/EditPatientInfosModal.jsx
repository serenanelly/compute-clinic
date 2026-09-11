import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
    updatePatientWithDetails,
    mapDossierToForm,
    mapListPatientToForm,
} from "../../services/patientRegistrationApi.js";
import { getPatientDossier } from "../../services/medicalDossierApi.js";
import { XIcon, Save, User, Hash, Briefcase, Users, MapPin, Loader2 } from "lucide-react";
import { Alert, DatePicker, ConfigProvider } from "antd";
import frFR from "antd/locale/fr_FR";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import ProfessionSelect from "../../GlobalComponents/ProfessionSelect.jsx";
import { validateProfessionFields } from "../../constants/patientProfessions.js";

dayjs.locale("fr");

const CITIES = ["Yaoundé", "Douala", "Garoua", "Bamenda", "Bafoussam", "Ngaoundéré", "Bertoua", "Ebolowa", "Maroua", "Kribi", "Autre"];

const toDayjs = (value) => {
    if (!value) return null;
    if (dayjs.isDayjs(value)) return value;
    return dayjs(value);
};

const mapToFormState = (raw) => ({
    ...raw,
    date_naissance: toDayjs(raw.date_naissance),
});

export function EditPatientInfosModal({
    isOpen,
    onClose,
    setCanOpenSuccessModal,
    setSuccessMessage,
    setIsLoading,
    patientData,
    onUpdateSuccess,
}) {
    const [formData, setFormData] = useState(mapToFormState(mapListPatientToForm({})));
    const [dossierSnapshot, setDossierSnapshot] = useState(null);
    const [loadingDossier, setLoadingDossier] = useState(false);
    const [errors, setErrors] = useState({});
    const [apiError, setApiError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen || !patientData?.id) return;

        let cancelled = false;
        const load = async () => {
            setLoadingDossier(true);
            setApiError("");
            try {
                const dossier = await getPatientDossier(patientData.id);
                if (cancelled) return;
                setDossierSnapshot(dossier);
                setFormData(mapToFormState(mapDossierToForm(dossier)));
            } catch (err) {
                console.warn("Dossier complet indisponible, données liste utilisées:", err);
                if (!cancelled) {
                    setDossierSnapshot(null);
                    setFormData(mapToFormState(mapListPatientToForm(patientData)));
                }
            } finally {
                if (!cancelled) setLoadingDossier(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [patientData?.id, isOpen]);

    // Noms : lettres/espaces/tirets/apostrophes. Téléphones : 9 chiffres max.
    const NAME_FIELDS = ['nom', 'prenom', 'nom_proche', 'prenom_proche'];
    const PHONE_FIELDS = ['contact', 'contact_proche'];

    const handleChange = (e) => {
        const { name } = e.target;
        let value = e.target.value;
        if (NAME_FIELDS.includes(name)) {
            value = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'-]/g, '');
        } else if (PHONE_FIELDS.includes(name)) {
            value = value.replace(/\D/g, '').slice(0, 9);
        }
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    };

    const handleDateChange = (date) => {
        setFormData((prev) => ({ ...prev, date_naissance: date }));
        if (errors.date_naissance) setErrors((prev) => ({ ...prev, date_naissance: null }));
    };

    const phoneRegex = /^6\d{8}$/;

    const validatePhone = (value) => {
        if (!value?.trim()) return null; // optionnel
        const digits = value.replace(/[\s+]/g, '');
        if (!phoneRegex.test(digits)) {
            return "Numéro invalide : 9 chiffres commençant par 6 (ex: 6XXXXXXXX)";
        }
        return null;
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.nom?.trim()) newErrors.nom = "Le nom est obligatoire";
        if (!formData.date_naissance) newErrors.date_naissance = "La date de naissance est obligatoire";
        if (!formData.lieu_naissance?.trim()) newErrors.lieu_naissance = "Le lieu de naissance est obligatoire";
        Object.assign(newErrors, validateProfessionFields(formData));

        const contactErr = validatePhone(formData.contact);
        if (contactErr) newErrors.contact = contactErr;

        const contactProcheErr = validatePhone(formData.contact_proche);
        if (contactProcheErr) newErrors.contact_proche = contactProcheErr;

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        setIsLoading(true);
        setApiError("");

        try {
            await updatePatientWithDetails(
                patientData.id,
                formData,
                dossierSnapshot || patientData
            );
            setSuccessMessage("Informations patient enregistrées.");
            setCanOpenSuccessModal(true);
            if (onUpdateSuccess) await onUpdateSuccess();
            onClose();
        } catch (error) {
            console.error("Erreur mise à jour patient:", error.response?.data || error);
            const data = error.response?.data;
            let message = "Erreur lors de la mise à jour.";
            if (typeof data === "object" && data !== null) {
                message = Object.entries(data)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                    .join(" — ");
            }
            setApiError(message);
        } finally {
            setIsSubmitting(false);
            setIsLoading(false);
        }
    };

    if (!isOpen || !patientData) return null;

    const inputClass = (name) =>
        `w-full px-4 py-2.5 border rounded-xl transition-all duration-200 focus:ring-2 focus:ring-primary-end outline-none ${
            errors[name] ? "border-red-500 bg-red-50" : "border-gray-200 focus:border-primary-end"
        }`;
    const labelClass = "block text-sm font-semibold text-gray-700 mb-2";

    return (
        <ConfigProvider locale={frFR}>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-gray-800">
                <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-gradient-to-r from-primary-start to-primary-end p-6 flex justify-between items-center text-white">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Modifier Patient</h3>
                                <p className="text-blue-50/80 text-sm">
                                    Dossier administratif (identité, contact, urgence)
                                </p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 bg-white">
                        {loadingDossier && (
                            <div className="flex items-center gap-2 text-gray-500 mb-4">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Chargement du dossier…
                            </div>
                        )}
                        {apiError && (
                            <Alert message={apiError} type="error" showIcon className="mb-6 rounded-xl" />
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                            <div className="lg:col-span-2 space-y-8">
                                <section>
                                    <h4 className="text-lg font-bold text-secondary border-b pb-2 mb-6 flex items-center gap-2">
                                        <Hash className="w-5 h-5" /> Identité
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className={labelClass}>
                                                Nom <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                name="nom"
                                                value={formData.nom}
                                                onChange={handleChange}
                                                className={inputClass("nom")}
                                                disabled={loadingDossier || isSubmitting}
                                            />
                                            {errors.nom && (
                                                <p className="text-red-500 text-xs mt-1">{errors.nom}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className={labelClass}>Prénom(s)</label>
                                            <input
                                                name="prenom"
                                                value={formData.prenom}
                                                onChange={handleChange}
                                                className={inputClass()}
                                                disabled={loadingDossier || isSubmitting}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>
                                                Date de naissance <span className="text-red-500">*</span>
                                            </label>
                                            <DatePicker
                                                className={`w-full py-2.5 rounded-xl ${
                                                    errors.date_naissance ? "border-red-500" : ""
                                                }`}
                                                onChange={handleDateChange}
                                                value={formData.date_naissance}
                                                format="DD/MM/YYYY"
                                                disabled={loadingDossier || isSubmitting}
                                            />
                                            {errors.date_naissance && (
                                                <p className="text-red-500 text-xs mt-1">{errors.date_naissance}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className={labelClass}>
                                                Lieu de naissance <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                name="lieu_naissance"
                                                value={formData.lieu_naissance}
                                                onChange={handleChange}
                                                className={inputClass("lieu_naissance")}
                                                disabled={loadingDossier || isSubmitting}
                                            />
                                            {errors.lieu_naissance && (
                                                <p className="text-red-500 text-xs mt-1">{errors.lieu_naissance}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className={labelClass}>Sexe</label>
                                            <select
                                                name="sexe"
                                                value={formData.sexe}
                                                onChange={handleChange}
                                                className={inputClass()}
                                                disabled={loadingDossier || isSubmitting}
                                            >
                                                <option value="MASCULIN">Masculin</option>
                                                <option value="FEMININ">Féminin</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-lg font-bold text-secondary border-b pb-2 mb-6 flex items-center gap-2">
                                        <Briefcase className="w-5 h-5" /> Informations sociales
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <ProfessionSelect
                                                professionSelect={formData.profession_select}
                                                professionAutre={formData.profession_autre}
                                                onSelectChange={handleChange}
                                                onAutreChange={handleChange}
                                                errors={errors}
                                                required
                                                disabled={loadingDossier || isSubmitting}
                                                inputClass={inputClass()}
                                                idPrefix="edit_profession"
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Statut matrimonial</label>
                                            <select
                                                name="statut_matrimonial"
                                                value={formData.statut_matrimonial}
                                                onChange={handleChange}
                                                className={inputClass()}
                                                disabled={loadingDossier || isSubmitting}
                                            >
                                                <option value="CELIBATAIRE">Célibataire</option>
                                                <option value="MARIE">Marié(e)</option>
                                                <option value="VEUF">Veuf(ve)</option>
                                                <option value="DIVORCE">Divorcé(e)</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="space-y-8">
                                <section className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                                    <h4 className="text-md font-bold text-primary-start mb-4 flex items-center gap-2">
                                        <MapPin className="w-4 h-4" /> Localisation
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={labelClass}>Téléphone</label>
                                            <input
                                                name="contact"
                                                value={formData.contact}
                                                onChange={handleChange}
                                                className={inputClass('contact')}
                                                placeholder="Ex: 6XXXXXXXX"
                                                disabled={loadingDossier || isSubmitting}
                                            />
                                            {errors.contact && (
                                                <p className="text-red-500 text-xs mt-1">{errors.contact}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className={labelClass}>Ville</label>
                                            <select
                                                name="ville"
                                                value={formData.ville}
                                                onChange={handleChange}
                                                className={inputClass()}
                                                disabled={loadingDossier || isSubmitting}
                                            >
                                                {CITIES.map((v) => (
                                                    <option key={v} value={v}>
                                                        {v}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Quartier</label>
                                            <input
                                                name="quartier"
                                                value={formData.quartier}
                                                onChange={handleChange}
                                                className={inputClass()}
                                                placeholder="Ex: Bastos, Akwa…"
                                                disabled={loadingDossier || isSubmitting}
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className="bg-secondary/5 p-6 rounded-3xl border border-secondary/10">
                                    <h4 className="text-md font-bold text-secondary mb-4 flex items-center gap-2">
                                        <Users className="w-4 h-4" /> Urgence
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={labelClass}>Nom du proche</label>
                                            <input
                                                name="nom_proche"
                                                value={formData.nom_proche}
                                                onChange={handleChange}
                                                className={inputClass()}
                                                disabled={loadingDossier || isSubmitting}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Prénom du proche</label>
                                            <input
                                                name="prenom_proche"
                                                value={formData.prenom_proche}
                                                onChange={handleChange}
                                                className={inputClass()}
                                                disabled={loadingDossier || isSubmitting}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Téléphone proche</label>
                                            <input
                                                name="contact_proche"
                                                value={formData.contact_proche}
                                                onChange={handleChange}
                                                className={inputClass('contact_proche')}
                                                placeholder="Ex: 6XXXXXXXX"
                                                disabled={loadingDossier || isSubmitting}
                                            />
                                            {errors.contact_proche && (
                                                <p className="text-red-500 text-xs mt-1">{errors.contact_proche}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className={labelClass}>Lien de parenté</label>
                                            <select
                                                name="lien_parente"
                                                value={formData.lien_parente || ''}
                                                onChange={handleChange}
                                                className={inputClass()}
                                                disabled={loadingDossier || isSubmitting}
                                            >
                                                <option value="">Sélectionner...</option>
                                                <option value="PERE">Père</option>
                                                <option value="MERE">Mère</option>
                                                <option value="FRERE_SOEUR">Frère / Sœur</option>
                                                <option value="CONJOINT">Conjoint(e)</option>
                                                <option value="AMI">Ami(e)</option>
                                                <option value="AUTRE">Autre</option>
                                            </select>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 border-t flex justify-end gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-200 rounded-xl"
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting || loadingDossier}
                            className="px-10 py-3 bg-gradient-to-r from-primary-start to-primary-end text-white font-black rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-60"
                        >
                            <Save className="w-5 h-5" />
                            {isSubmitting ? "Enregistrement…" : "Enregistrer les modifications"}
                        </button>
                    </div>
                </div>
            </div>
        </ConfigProvider>
    );
}

EditPatientInfosModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    setCanOpenSuccessModal: PropTypes.func.isRequired,
    setSuccessMessage: PropTypes.func.isRequired,
    setIsLoading: PropTypes.func.isRequired,
    patientData: PropTypes.object,
    onUpdateSuccess: PropTypes.func,
};
