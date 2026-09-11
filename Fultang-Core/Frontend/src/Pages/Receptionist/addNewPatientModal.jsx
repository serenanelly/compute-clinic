import { XIcon, Save, CheckCircle2, Hash, UserCircle } from "lucide-react";
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { createPatientWithDetails } from "../../services/patientRegistrationApi.js";
import { Alert, DatePicker, ConfigProvider, Segmented } from "antd";
import frFR from "antd/locale/fr_FR";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { isValidPhone, phoneErrorMessage, formatPhoneForApi } from "../../Utils/phoneValidation.js";
import { formatApiError } from "../../Utils/formatApiError.js";
import ProfessionSelect from "../../GlobalComponents/ProfessionSelect.jsx";
import { validateProfessionFields } from "../../constants/patientProfessions.js";

dayjs.locale("fr");

export function AddNewPatientModal({
    isOpen,
    onClose,
    setCanOpenSuccessModal,
    setSuccessMessage,
    setIsLoading,
    onPatientAdded,
}) {
    AddNewPatientModal.propTypes = {
        isOpen: PropTypes.bool.isRequired,
        onClose: PropTypes.func.isRequired,
        setCanOpenSuccessModal: PropTypes.func.isRequired,
        setSuccessMessage: PropTypes.func.isRequired,
        setIsLoading: PropTypes.func.isRequired,
        onPatientAdded: PropTypes.func,
    };

    const [registrationMode, setRegistrationMode] = useState("identite");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showLocalSuccess, setShowLocalSuccess] = useState(false);

    const [formData, setFormData] = useState({
        code_identifiant: "",
        nom: "",
        prenom: "",
        sexe: "MASCULIN",
        date_naissance: null,
        lieu_naissance: "",
        num_securite_sociale: "",
        contact: "",
        nom_proche: "",
        contact_proche: "",
        profession_select: "",
        profession_autre: "",
    });

    const [errors, setErrors] = useState({});
    const [apiError, setApiError] = useState("");

    const NAME_FIELDS = ["nom", "prenom", "nom_proche"];
    const PHONE_FIELDS = ["contact", "contact_proche"];

    useEffect(() => {
        if (!isOpen) resetForm();
    }, [isOpen]);

    const handleChange = (e) => {
        const { name } = e.target;
        let value = e.target.value;

        if (NAME_FIELDS.includes(name)) {
            value = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'-]/g, "");
        } else if (PHONE_FIELDS.includes(name)) {
            value = value.replace(/[^\d+]/g, "").slice(0, 16);
        }

        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    };

    const handleDateChange = (date) => {
        setFormData((prev) => ({ ...prev, date_naissance: date }));
        if (errors.date_naissance) setErrors((prev) => ({ ...prev, date_naissance: null }));
    };

    const validatePhoneField = (value, field, label, newErrors) => {
        if (!value?.trim()) return;
        if (!isValidPhone(value)) {
            newErrors[field] = phoneErrorMessage(label);
        }
    };

    const validate = () => {
        const newErrors = {};
        if (registrationMode === "code") {
            if (!formData.code_identifiant?.trim()) {
                newErrors.code_identifiant = "Le code identifiant est obligatoire.";
            }
        } else {
            if (!formData.nom?.trim()) {
                newErrors.nom = "Le nom est obligatoire.";
            }
            Object.assign(newErrors, validateProfessionFields(formData));
            validatePhoneField(formData.contact, "contact", "Le téléphone du patient", newErrors);
            validatePhoneField(formData.contact_proche, "contact_proche", "Le numéro d'urgence", newErrors);
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setIsLoading(true);
        setIsSubmitting(true);
        setApiError("");

        try {
            const submitData = {
                ...formData,
                contact: formData.contact ? formatPhoneForApi(formData.contact) : "",
                contact_proche: formData.contact_proche ? formatPhoneForApi(formData.contact_proche) : "",
            };
            const created = await createPatientWithDetails(submitData, registrationMode);
            if (created?.id) {
                setIsLoading(false);
                const label =
                    registrationMode === "code"
                        ? `Dossier ${created.code_identifiant || created.nom} ouvert`
                        : `Patient ${created.nom} enregistré`;
                setSuccessMessage(`${label} (matricule ${created.matricule || ""}) !`);
                if (onPatientAdded) onPatientAdded();
                setShowLocalSuccess(true);
                setTimeout(() => {
                    setShowLocalSuccess(false);
                    setIsSubmitting(false);
                    finish();
                }, 1200);
            }
        } catch (error) {
            console.error("Registration Error:", error.response?.data);
            setIsLoading(false);
            setIsSubmitting(false);
            setApiError(formatApiError(error, "Erreur lors de l'enregistrement du patient."));
        }
    };

    const finish = () => {
        setCanOpenSuccessModal(true);
        onClose();
        resetForm();
    };

    const resetForm = () => {
        setRegistrationMode("identite");
        setIsSubmitting(false);
        setFormData({
            code_identifiant: "",
            nom: "",
            prenom: "",
            sexe: "MASCULIN",
            date_naissance: null,
            lieu_naissance: "",
            num_securite_sociale: "",
            contact: "",
            nom_proche: "",
            contact_proche: "",
            profession_select: "",
            profession_autre: "",
        });
        setErrors({});
        setApiError("");
    };

    if (!isOpen) return null;

    const inputClass = (name) =>
        `w-full px-4 py-2.5 border rounded-xl transition-all duration-200 focus:ring-2 focus:ring-primary-end outline-none ${
            errors[name] ? "border-red-500 bg-red-50" : "border-gray-200 focus:border-primary-end"
        }`;

    return (
        <ConfigProvider locale={frFR}>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]">
                    <div className="bg-gradient-to-r from-primary-start to-primary-end p-6 flex justify-between items-center text-white">
                        <div>
                            <h3 className="text-2xl font-bold">Enregistrement Patient</h3>
                            <p className="text-blue-50/80 text-sm">Accueil rapide — identité minimale</p>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="px-8 py-5 bg-gray-50 border-b">
                            <Segmented
                                block
                                value={registrationMode}
                                onChange={setRegistrationMode}
                                options={[
                                    {
                                        label: (
                                            <span className="flex items-center justify-center gap-2 py-1">
                                                <UserCircle className="w-4 h-4" /> Identité
                                            </span>
                                        ),
                                        value: "identite",
                                    },
                                    {
                                        label: (
                                            <span className="flex items-center justify-center gap-2 py-1">
                                                <Hash className="w-4 h-4" /> Code identifiant
                                            </span>
                                        ),
                                        value: "code",
                                    },
                                ]}
                            />
                            {registrationMode === "code" && (
                                <p className="text-xs text-gray-500 mt-3">
                                    Saisissez uniquement un code — le dossier pourra rester anonyme ou être complété plus tard par l&apos;infirmier.
                                </p>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 relative">
                            {apiError && (
                                <Alert message={apiError} type="error" showIcon className="mb-6 rounded-xl" />
                            )}

                            {showLocalSuccess && (
                                <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
                                    <CheckCircle2 className="w-20 h-20 text-green-500 mb-4" />
                                    <h4 className="text-2xl font-bold">Patient enregistré !</h4>
                                </div>
                            )}

                            {registrationMode === "code" ? (
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="code_identifiant" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Code identifiant <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="code_identifiant"
                                            name="code_identifiant"
                                            value={formData.code_identifiant}
                                            onChange={handleChange}
                                            className={inputClass("code_identifiant")}
                                            placeholder="Ex: URG-042, BRACELET-128…"
                                            autoFocus
                                        />
                                        {errors.code_identifiant && (
                                            <p className="text-red-500 text-xs mt-1">{errors.code_identifiant}</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label htmlFor="nom" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Nom <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="nom"
                                            name="nom"
                                            value={formData.nom}
                                            onChange={handleChange}
                                            className={inputClass("nom")}
                                            placeholder="Nom de famille"
                                        />
                                        {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="prenom" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Prénom(s)
                                        </label>
                                        <input
                                            id="prenom"
                                            name="prenom"
                                            value={formData.prenom}
                                            onChange={handleChange}
                                            className={inputClass("prenom")}
                                            placeholder="Prénoms"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Date de naissance
                                        </label>
                                        <DatePicker
                                            className={`w-full py-2.5 rounded-xl ${errors.date_naissance ? "border-red-500" : ""}`}
                                            onChange={handleDateChange}
                                            value={formData.date_naissance}
                                            format="DD/MM/YYYY"
                                            placeholder="Optionnel"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="sexe" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Sexe
                                        </label>
                                        <select
                                            id="sexe"
                                            name="sexe"
                                            value={formData.sexe}
                                            onChange={handleChange}
                                            className={inputClass()}
                                        >
                                            <option value="MASCULIN">Masculin</option>
                                            <option value="FEMININ">Féminin</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="lieu_naissance" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Lieu de naissance
                                        </label>
                                        <input
                                            id="lieu_naissance"
                                            name="lieu_naissance"
                                            value={formData.lieu_naissance}
                                            onChange={handleChange}
                                            className={inputClass()}
                                            placeholder="Optionnel"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="num_securite_sociale" className="block text-sm font-semibold text-gray-700 mb-2">
                                            N° sécurité sociale
                                        </label>
                                        <input
                                            id="num_securite_sociale"
                                            name="num_securite_sociale"
                                            value={formData.num_securite_sociale}
                                            onChange={handleChange}
                                            className={inputClass()}
                                            placeholder="Optionnel"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <ProfessionSelect
                                            professionSelect={formData.profession_select}
                                            professionAutre={formData.profession_autre}
                                            onSelectChange={handleChange}
                                            onAutreChange={handleChange}
                                            errors={errors}
                                            required
                                            inputClass={inputClass()}
                                        />
                                    </div>
                                    <div className="md:col-span-2 border-t pt-4 mt-1">
                                        <h4 className="text-sm font-bold text-gray-600 mb-3">Contact patient</h4>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label htmlFor="contact" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Téléphone du patient
                                        </label>
                                        <input
                                            id="contact"
                                            name="contact"
                                            value={formData.contact}
                                            onChange={handleChange}
                                            className={inputClass("contact")}
                                            placeholder="Ex: 6XXXXXXXX"
                                            inputMode="numeric"
                                            maxLength={16}
                                        />
                                        {errors.contact && <p className="text-red-500 text-xs mt-1">{errors.contact}</p>}
                                    </div>
                                    <div className="md:col-span-2 border-t pt-4">
                                        <h4 className="text-sm font-bold text-gray-600 mb-3">Personne à prévenir</h4>
                                    </div>
                                    <div>
                                        <label htmlFor="nom_proche" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Nom du contact d&apos;urgence
                                        </label>
                                        <input
                                            id="nom_proche"
                                            name="nom_proche"
                                            value={formData.nom_proche}
                                            onChange={handleChange}
                                            className={inputClass()}
                                            placeholder="Optionnel"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="contact_proche" className="block text-sm font-semibold text-gray-700 mb-2">
                                            Téléphone d&apos;urgence
                                        </label>
                                        <input
                                            id="contact_proche"
                                            name="contact_proche"
                                            value={formData.contact_proche}
                                            onChange={handleChange}
                                            className={inputClass("contact_proche")}
                                            placeholder="Ex: 6XXXXXXXX"
                                            maxLength={16}
                                        />
                                        {errors.contact_proche && (
                                            <p className="text-red-500 text-xs mt-1">{errors.contact_proche}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-gray-50 border-t flex justify-between items-center">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-8 py-2.5 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save className="w-5 h-5" />
                                {isSubmitting ? "Enregistrement…" : "Enregistrer"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </ConfigProvider>
    );
}
