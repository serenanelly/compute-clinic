import PropTypes from "prop-types";
import { Check, Lock } from "lucide-react";

// Fonctionnalité d'administration du tenant, pas un service optionnel —
// le backend refuse déjà toute tentative de désactivation (400,
// tenant-service/tenants/services.py::NON_DISABLEABLE_FUNCTIONAL_SERVICES).
// Verrouillée ici uniquement pour éviter à l'utilisateur une erreur 400
// confuse ; la garantie réelle reste côté backend.
const NON_DISABLEABLE_CODES = new Set(["GESTION_PERSONNEL"]);

/**
 * Liste à cocher des services fonctionnels d'un établissement.
 *
 * Composant partagé entre :
 * - Step3ServicesConfig.jsx (assistant de création d'un tenant — bascule
 *   locale, envoyée en une seule fois via bulkSetTenantFunctionalServices)
 * - EstablishmentDetailPage.jsx / ServicesConfigSection.jsx (page de détail
 *   d'un établissement existant — bascule immédiate via
 *   toggleTenantFunctionalService, une requête par service)
 *
 * L'ordre des `services` reçu en prop n'est JAMAIS modifié ici : il reflète
 * le `display_order` du catalogue backend (services cliniques/métier en
 * premier, services administratifs en dernier).
 *
 * Reste volontairement une liste plate pour cette phase. Un regroupement
 * futur (ex. par catégorie fonctionnelle) pourrait être ajouté via une prop
 * `groupBy` optionnelle sans réécrire ce composant — non implémenté ici car
 * non requis par le backend actuel (un seul niveau de catalogue).
 */
export function ServicesChecklist({ services, onToggle, disabled = false }) {
    if (!services || services.length === 0) {
        return <p className="text-sm text-gray-400 py-4 text-center">Aucun service disponible.</p>;
    }

    return (
        <ul className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {services.map((service) => {
                const isLocked = NON_DISABLEABLE_CODES.has(service.code);
                return (
                    <li key={service.code} className="bg-white">
                        <label
                            className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${disabled || isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                            title={isLocked ? "Fonctionnalité d'administration de l'établissement — toujours disponible." : undefined}
                        >
                            <span className="relative inline-flex items-center justify-center flex-shrink-0">
                                <input
                                    type="checkbox"
                                    checked={isLocked ? true : !!service.enabled}
                                    disabled={disabled || isLocked}
                                    onChange={(e) => onToggle(service.code, e.target.checked)}
                                    className="peer w-5 h-5 rounded border-gray-300 text-primary-end focus:ring-primary-end accent-primary-end cursor-pointer disabled:cursor-not-allowed"
                                />
                            </span>
                            <span className="flex-1 text-sm font-medium text-gray-800">{service.name}</span>
                            {isLocked ? (
                                <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                            ) : service.enabled && (
                                <Check className="w-4 h-4 text-primary-end flex-shrink-0" aria-hidden="true" />
                            )}
                        </label>
                    </li>
                );
            })}
        </ul>
    );
}

ServicesChecklist.propTypes = {
    services: PropTypes.arrayOf(
        PropTypes.shape({
            code: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            enabled: PropTypes.bool,
        })
    ).isRequired,
    onToggle: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
};

export default ServicesChecklist;
