import PropTypes from "prop-types";
import { mapDossierToForm, updatePatientWithDetails } from "../../services/patientRegistrationApi.js";
import ProfessionSelect from "../../GlobalComponents/ProfessionSelect.jsx";
import { splitProfessionForForm } from "../../constants/patientProfessions.js";
import { isValidPhone, phoneErrorMessage, formatPhoneForApi } from "../../Utils/phoneValidation.js";

const NATIONALITIES = ["Camerounaise", "Gabonaise", "Tchadienne", "Centrafricaine", "Congolaise", "Nigériane", "Autre"];
const COUNTRIES = ["Cameroun", "Gabon", "Tchad", "RCA", "Congo", "Nigéria", "Autre"];
const CITIES = ["Yaoundé", "Douala", "Garoua", "Bamenda", "Bafoussam", "Ngaoundéré", "Bertoua", "Ebolowa", "Maroua", "Kribi", "Autre"];

const NAME_FIELDS = ["nom", "prenom", "nom_proche", "lieu_naissance"];
const PHONE_FIELDS = ["contact", "contact_proche"];

export function dossierToAdminForm(dossier) {
    const base = mapDossierToForm(dossier);
    const professionParts = splitProfessionForForm(base.profession);
    return {
        ...base,
        ...professionParts,
        pays: base.pays || "Cameroun",
        ville: base.ville || "",
        quartier: base.quartier || "",
        rue: base.rue || "",
        nombre_enfants: base.nombre_enfants ?? 0,
    };
}

export default function NursePatientAdminSection({ patientId, dossier, adminForm, setAdminForm, onSaved }) {
    NursePatientAdminSection.propTypes = {
        patientId: PropTypes.string.isRequired,
        dossier: PropTypes.object,
        adminForm: PropTypes.object.isRequired,
        setAdminForm: PropTypes.func.isRequired,
        onSaved: PropTypes.func,
    };

    const handleChange = (e) => {
        const { name } = e.target;
        let { value } = e.target;
        if (NAME_FIELDS.includes(name)) {
            value = value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'-]/g, "");
        } else if (PHONE_FIELDS.includes(name)) {
            value = value.replace(/[^\d+]/g, "").slice(0, 16);
        }
        setAdminForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSaveAdmin = async () => {
        if (adminForm.contact?.trim() && !isValidPhone(adminForm.contact)) {
            return;
        }
        if (adminForm.contact_proche?.trim() && !isValidPhone(adminForm.contact_proche)) {
            return;
        }

        const payload = {
            ...adminForm,
            contact: adminForm.contact ? formatPhoneForApi(adminForm.contact) : "",
            contact_proche: adminForm.contact_proche ? formatPhoneForApi(adminForm.contact_proche) : "",
        };
        await updatePatientWithDetails(patientId, payload, dossier || {});
        if (onSaved) onSaved();
    };

    const inputClass = "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-start outline-none";
    const labelClass = "block text-xs font-bold text-gray-600 uppercase mb-1";

    return (
        <div className="col-span-1 md:col-span-2 border-t border-gray-100 pt-6 mt-2">
            <h4 className="text-sm font-bold text-gray-700 mb-1">Dossier administratif</h4>
            <p className="text-xs text-gray-500 mb-4">
                Informations saisies à l&apos;accueil — visualisation et correction par l&apos;infirmier.
            </p>

            <div className="space-y-6">
                <div>
                    <p className="text-xs font-bold text-primary-start uppercase tracking-wider mb-3">Identité</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {adminForm.est_anonyme && (
                            <div className="md:col-span-2">
                                <label className={labelClass}>Code identifiant</label>
                                <input
                                    type="text"
                                    name="code_identifiant"
                                    value={adminForm.code_identifiant || ""}
                                    onChange={handleChange}
                                    className={inputClass}
                                />
                            </div>
                        )}
                        <div>
                            <label className={labelClass}>Nom</label>
                            <input type="text" name="nom" value={adminForm.nom} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Prénom</label>
                            <input type="text" name="prenom" value={adminForm.prenom} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Sexe</label>
                            <select name="sexe" value={adminForm.sexe} onChange={handleChange} className={inputClass}>
                                <option value="MASCULIN">Masculin</option>
                                <option value="FEMININ">Féminin</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Date de naissance</label>
                            <input
                                type="date"
                                name="date_naissance"
                                value={adminForm.date_naissance?.slice?.(0, 10) || adminForm.date_naissance || ""}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Lieu de naissance</label>
                            <input type="text" name="lieu_naissance" value={adminForm.lieu_naissance} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>N° sécurité sociale</label>
                            <input type="text" name="num_securite_sociale" value={adminForm.num_securite_sociale} onChange={handleChange} className={inputClass} placeholder="Optionnel" />
                        </div>
                        <div className="md:col-span-2">
                            <ProfessionSelect
                                professionSelect={adminForm.profession_select}
                                professionAutre={adminForm.profession_autre}
                                onSelectChange={handleChange}
                                onAutreChange={handleChange}
                                inputClass={inputClass}
                                idPrefix="nurse_profession"
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <p className="text-xs font-bold text-primary-start uppercase tracking-wider mb-3">Contact patient</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Téléphone du patient</label>
                            <input type="text" name="contact" value={adminForm.contact} onChange={handleChange} className={inputClass} placeholder="Ex: 6XXXXXXXX" />
                        </div>
                    </div>
                </div>

                <div>
                    <p className="text-xs font-bold text-primary-start uppercase tracking-wider mb-3">Personne à prévenir</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Nom en cas d&apos;urgence</label>
                            <input type="text" name="nom_proche" value={adminForm.nom_proche} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Téléphone d&apos;urgence</label>
                            <input type="text" name="contact_proche" value={adminForm.contact_proche} onChange={handleChange} className={inputClass} placeholder="Ex: 6XXXXXXXX" />
                        </div>
                    </div>
                </div>

                <div>
                    <p className="text-xs font-bold text-primary-start uppercase tracking-wider mb-3">Compléments administratifs</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Nationalité</label>
                            <select name="nationalite" value={adminForm.nationalite} onChange={handleChange} className={inputClass}>
                                {NATIONALITIES.map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Statut matrimonial</label>
                            <select name="statut_matrimonial" value={adminForm.statut_matrimonial} onChange={handleChange} className={inputClass}>
                                <option value="CELIBATAIRE">Célibataire</option>
                                <option value="MARIE">Marié(e)</option>
                                <option value="VEUF">Veuf(ve)</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Nombre d&apos;enfants</label>
                            <input type="number" name="nombre_enfants" min="0" value={adminForm.nombre_enfants} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Pays</label>
                            <select name="pays" value={adminForm.pays} onChange={handleChange} className={inputClass}>
                                <option value="">—</option>
                                {COUNTRIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Ville</label>
                            <select name="ville" value={adminForm.ville} onChange={handleChange} className={inputClass}>
                                <option value="">—</option>
                                {CITIES.map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Quartier</label>
                            <input type="text" name="quartier" value={adminForm.quartier} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Rue</label>
                            <input type="text" name="rue" value={adminForm.rue} onChange={handleChange} className={inputClass} />
                        </div>
                    </div>
                </div>
            </div>

            <button
                type="button"
                onClick={handleSaveAdmin}
                className="mt-4 px-5 py-2 text-sm font-bold text-primary-start border border-primary-start rounded-lg hover:bg-primary-start/5"
            >
                Enregistrer le dossier administratif
            </button>
        </div>
    );
}
