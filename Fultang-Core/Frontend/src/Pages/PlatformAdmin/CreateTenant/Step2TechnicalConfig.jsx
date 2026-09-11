import PropTypes from "prop-types";
import { ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Étape 2 de l'assistant de création : configuration technique.
 *
 * Ne contient pour cette phase qu'un seul réglage — le partage des données
 * cliniques — sous forme de VRAIE case à cocher (et non un select ou une
 * paire de boutons oui/non), cochée par défaut pour refléter la valeur par
 * défaut backend (`allow_clinical_agent_export: true`).
 */
export function Step2TechnicalConfig({ allowClinicalAgentExport, onChange, onNext, onBack }) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-bold text-gray-800">Configuration technique</h3>
                <p className="text-sm text-gray-500 mt-1">
                    Paramètres techniques de fonctionnement de l&apos;établissement.
                </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={allowClinicalAgentExport}
                        onChange={(e) => onChange(e.target.checked)}
                        className="mt-0.5 w-5 h-5 rounded border-gray-300 text-primary-end focus:ring-primary-end accent-primary-end cursor-pointer flex-shrink-0"
                    />
                    <span>
                        <span className="block text-sm font-bold text-gray-800">
                            Autoriser le partage des données cliniques
                        </span>
                        <span className="block text-xs text-gray-500 mt-1">
                            Les données médicales anonymisées de cet établissement pourront être partagées
                            avec les outils d&apos;aide à la décision clinique de la plateforme.
                        </span>
                    </span>
                </label>
            </div>

            <div className="flex justify-between pt-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-2 text-gray-600 font-bold px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Précédent
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    className="inline-flex items-center gap-2 text-white font-bold px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary-start to-primary-end transition-opacity"
                >
                    Suivant
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

Step2TechnicalConfig.propTypes = {
    allowClinicalAgentExport: PropTypes.bool.isRequired,
    onChange: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
};

export default Step2TechnicalConfig;
