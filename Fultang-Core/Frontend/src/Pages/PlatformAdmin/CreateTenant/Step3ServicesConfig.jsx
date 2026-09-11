import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getFunctionalServiceCatalog } from "../../../services/platformAdminApi.js";
import { ServicesChecklist } from "./ServicesChecklist.jsx";

/**
 * Étape 3 de l'assistant de création : services fonctionnels.
 *
 * Charge le catalogue complet au montage et l'initialise tous activés
 * (comportement par défaut backend : `enabled: true`). La bascule reste
 * purement locale ici — rien n'est envoyé au backend avant la soumission
 * finale (bulkSetTenantFunctionalServices), contrairement à
 * EstablishmentDetailPage.jsx qui bascule immédiatement.
 */
export function Step3ServicesConfig({ services, onServicesChange, onSubmit, onBack, submitting, submitError }) {
    const [loading, setLoading] = useState(services.length === 0);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        if (services.length > 0) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError("");
            try {
                const catalog = await getFunctionalServiceCatalog();
                if (!cancelled) {
                    onServicesChange(
                        (Array.isArray(catalog) ? catalog : []).map((s) => ({
                            code: s.code,
                            name: s.name,
                            enabled: true,
                        }))
                    );
                }
            } catch (error) {
                console.error("Erreur de chargement du catalogue de services fonctionnels:", error);
                if (!cancelled) {
                    setLoadError("Impossible de charger la liste des services pour le moment.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleToggle = (code, enabled) => {
        onServicesChange(services.map((s) => (s.code === code ? { ...s, enabled } : s)));
    };

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h3 className="text-lg font-bold text-gray-800">Services de l&apos;établissement</h3>
                <p className="text-sm text-gray-500 mt-1">
                    Fonctionnalités disponibles pour cet établissement. Toutes les cases sont cochées par
                    défaut — décochez celles que cet établissement n&apos;utilise pas.
                </p>
            </div>

            {loadError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-600">
                    {loadError}
                </div>
            )}
            {submitError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-600">
                    {submitError}
                </div>
            )}

            {loading ? (
                <div className="animate-pulse space-y-2">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                    ))}
                </div>
            ) : (
                <ServicesChecklist services={services} onToggle={handleToggle} disabled={submitting} />
            )}

            <div className="flex justify-between pt-2">
                <button
                    type="button"
                    onClick={onBack}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 text-gray-600 font-bold px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Précédent
                </button>
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={submitting || loading || services.length === 0}
                    className="inline-flex items-center gap-2 text-white font-bold px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary-start to-primary-end disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? "Création en cours…" : "Créer l'établissement"}
                </button>
            </div>
        </div>
    );
}

Step3ServicesConfig.propTypes = {
    services: PropTypes.array.isRequired,
    onServicesChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    onBack: PropTypes.func.isRequired,
    submitting: PropTypes.bool,
    submitError: PropTypes.string,
};

export default Step3ServicesConfig;
