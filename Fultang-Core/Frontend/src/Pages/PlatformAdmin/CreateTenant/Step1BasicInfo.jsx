import { useState } from "react";
import PropTypes from "prop-types";
import { ArrowRight } from "lucide-react";

const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Dérive un slug valide (lettres minuscules, chiffres, tirets) à partir
 * d'un texte libre — utilisé pour pré-remplir l'identifiant depuis le nom
 * tant que l'admin ne l'a pas modifié manuellement.
 */
function slugify(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // accents (formes combinantes après normalize("NFD"))
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function Step1BasicInfo({ data, onChange, fieldErrors, onNext }) {
    const [identifierTouched, setIdentifierTouched] = useState(Boolean(data.identifier));

    const handleNameChange = (value) => {
        const patch = { name: value };
        if (!identifierTouched) {
            patch.identifier = slugify(value);
        }
        onChange(patch);
    };

    const handleIdentifierChange = (value) => {
        setIdentifierTouched(true);
        onChange({ identifier: value.toLowerCase() });
    };

    const isNameValid = data.name.trim().length > 0;
    const isIdentifierValid = IDENTIFIER_PATTERN.test(data.identifier);
    const isEmailValid = !data.email || EMAIL_PATTERN.test(data.email);
    const isAdminNomValid = data.adminNom.trim().length > 0;
    const isAdminEmailValid = data.adminEmail.trim().length > 0 && EMAIL_PATTERN.test(data.adminEmail);
    const canProceed = isNameValid && isIdentifierValid && isEmailValid && isAdminNomValid && isAdminEmailValid;

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h3 className="text-lg font-bold text-gray-800">Informations de base</h3>
                <p className="text-sm text-gray-500 mt-1">
                    Identité et coordonnées du nouvel établissement.
                </p>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Nom de l&apos;établissement <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={data.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Hôpital Central"
                    className="w-full h-11 px-3 rounded-lg bg-gray-100 border border-gray-200 outline-none focus:ring-2 focus:ring-primary-end"
                />
                {fieldErrors?.name && (
                    <p className="text-xs font-semibold text-red-500 mt-1">{fieldErrors.name.join(" ")}</p>
                )}
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    Identifiant (slug) <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={data.identifier}
                    onChange={(e) => handleIdentifierChange(e.target.value)}
                    placeholder="hopital-central"
                    className={`w-full h-11 px-3 rounded-lg bg-gray-100 border outline-none focus:ring-2 focus:ring-primary-end ${data.identifier && !isIdentifierValid ? "border-red-300" : "border-gray-200"
                        }`}
                />
                <p className="text-xs text-gray-400 mt-1">
                    Lettres minuscules, chiffres et tirets uniquement (ex. « hopital-central »).
                </p>
                {data.identifier && !isIdentifierValid && (
                    <p className="text-xs font-semibold text-red-500 mt-1">
                        Format invalide — utilisez uniquement des lettres minuscules, des chiffres et des tirets.
                    </p>
                )}
                {fieldErrors?.identifier && (
                    <p className="text-xs font-semibold text-red-500 mt-1">{fieldErrors.identifier.join(" ")}</p>
                )}
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Adresse</label>
                <textarea
                    value={data.address}
                    onChange={(e) => onChange({ address: e.target.value })}
                    rows={2}
                    placeholder="Quartier, ville, pays…"
                    className="w-full px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 outline-none focus:ring-2 focus:ring-primary-end resize-none"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Téléphone</label>
                    <input
                        type="text"
                        value={data.phone}
                        onChange={(e) => onChange({ phone: e.target.value })}
                        placeholder="+237 6xx xxx xxx"
                        className="w-full h-11 px-3 rounded-lg bg-gray-100 border border-gray-200 outline-none focus:ring-2 focus:ring-primary-end"
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Email</label>
                    <input
                        type="email"
                        value={data.email}
                        onChange={(e) => onChange({ email: e.target.value })}
                        placeholder="contact@etablissement.com"
                        className={`w-full h-11 px-3 rounded-lg bg-gray-100 border outline-none focus:ring-2 focus:ring-primary-end ${data.email && !isEmailValid ? "border-red-300" : "border-gray-200"
                            }`}
                    />
                    {data.email && !isEmailValid && (
                        <p className="text-xs font-semibold text-red-500 mt-1">Format d&apos;email invalide.</p>
                    )}
                    {fieldErrors?.email && (
                        <p className="text-xs font-semibold text-red-500 mt-1">{fieldErrors.email.join(" ")}</p>
                    )}
                </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-700">Compte administrateur</h4>
                <p className="text-xs text-gray-500 mt-1 mb-3">
                    Identité de la personne qui recevra le compte administrateur initial de cet
                    établissement (distinct du contact général ci-dessus).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">
                            Nom de l&apos;administrateur <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={data.adminNom}
                            onChange={(e) => onChange({ adminNom: e.target.value })}
                            placeholder="Nom"
                            className="w-full h-11 px-3 rounded-lg bg-gray-100 border border-gray-200 outline-none focus:ring-2 focus:ring-primary-end"
                        />
                        {fieldErrors?.adminNom && (
                            <p className="text-xs font-semibold text-red-500 mt-1">{fieldErrors.adminNom.join(" ")}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">
                            Prénom de l&apos;administrateur
                        </label>
                        <input
                            type="text"
                            value={data.adminPrenom}
                            onChange={(e) => onChange({ adminPrenom: e.target.value })}
                            placeholder="Prénom"
                            className="w-full h-11 px-3 rounded-lg bg-gray-100 border border-gray-200 outline-none focus:ring-2 focus:ring-primary-end"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                        Email de l&apos;administrateur <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        value={data.adminEmail}
                        onChange={(e) => onChange({ adminEmail: e.target.value })}
                        placeholder="admin@etablissement.com"
                        className={`w-full h-11 px-3 rounded-lg bg-gray-100 border outline-none focus:ring-2 focus:ring-primary-end ${data.adminEmail && !isAdminEmailValid ? "border-red-300" : "border-gray-200"
                            }`}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Les identifiants de connexion temporaires seront envoyés à cette adresse.
                    </p>
                    {data.adminEmail && !isAdminEmailValid && (
                        <p className="text-xs font-semibold text-red-500 mt-1">Format d&apos;email invalide.</p>
                    )}
                    {fieldErrors?.adminEmail && (
                        <p className="text-xs font-semibold text-red-500 mt-1">{fieldErrors.adminEmail.join(" ")}</p>
                    )}
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <button
                    type="button"
                    disabled={!canProceed}
                    onClick={onNext}
                    className="inline-flex items-center gap-2 text-white font-bold px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary-start to-primary-end disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                    Suivant
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

Step1BasicInfo.propTypes = {
    data: PropTypes.shape({
        name: PropTypes.string,
        identifier: PropTypes.string,
        address: PropTypes.string,
        phone: PropTypes.string,
        email: PropTypes.string,
        adminNom: PropTypes.string,
        adminPrenom: PropTypes.string,
        adminEmail: PropTypes.string,
    }).isRequired,
    onChange: PropTypes.func.isRequired,
    fieldErrors: PropTypes.object,
    onNext: PropTypes.func.isRequired,
};

export default Step1BasicInfo;
