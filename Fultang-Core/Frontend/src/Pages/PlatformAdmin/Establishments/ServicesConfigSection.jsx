import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Save } from "lucide-react";
import { getTenantFunctionalServices, bulkSetTenantFunctionalServices } from "../../../services/platformAdminApi.js";
import { ServicesChecklist } from "../CreateTenant/ServicesChecklist.jsx";
import { ConfirmationModal } from "../../Modals/ConfirmAction.Modal.jsx";
import { useFeedback } from "../../../contexts/FeedbackContext.jsx";
import { broadcastFunctionalServiceChanged } from "../../../Utils/tenantLifecycleBroadcast.js";

/**
 * Section "Services" de la configuration d'un établissement existant.
 *
 * Contrairement à l'assistant de création, cette section modifie un
 * établissement déjà en production : les bascules de case à cocher ne sont
 * QUE des brouillons locaux (`draftServices`), distincts de la dernière
 * configuration confirmée (`savedServices`). Un changement fonctionnel
 * n'est envoyé au backend (bulkSetTenantFunctionalServices, uniquement les
 * entrées modifiées) qu'après confirmation explicite via ConfirmationModal
 * — exigence produit : toute modification à impact fonctionnel doit être
 * confirmée avant application.
 *
 * Consommé via le registre `configCategories.js` : c'est la seule entrée
 * pour l'instant, mais rien ici n'est spécifique à EstablishmentDetailPage
 * au-delà de la prop `tenantId`, donc une future catégorie n'a pas besoin
 * de suivre exactement ce même patron.
 */
export function ServicesConfigSection({ tenantId }) {
    const { showSuccess, showError } = useFeedback();
    const [savedServices, setSavedServices] = useState([]);
    const [draftServices, setDraftServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [saving, setSaving] = useState(false);
    // 0 = aucun pop-up, 1 = premier pop-up (résumé, existant, inchangé),
    // 2 = second pop-up (confirmation critique, Phase 3) — le backend n'est
    // appelé qu'après validation du second.
    const [confirmStep, setConfirmStep] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError("");
            try {
                const data = await getTenantFunctionalServices(tenantId);
                const list = Array.isArray(data) ? data : [];
                if (!cancelled) {
                    setSavedServices(list);
                    setDraftServices(list);
                }
            } catch (error) {
                console.error("Erreur de chargement des services fonctionnels du tenant:", error);
                if (!cancelled) setLoadError("Impossible de charger la configuration des services pour le moment.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [tenantId]);

    const handleToggle = (code, enabled) => {
        setDraftServices((prev) => prev.map((s) => (s.code === code ? { ...s, enabled } : s)));
    };

    const pendingChanges = draftServices.filter((draft) => {
        const saved = savedServices.find((s) => s.code === draft.code);
        return saved && saved.enabled !== draft.enabled;
    });

    const confirmMessage = (() => {
        if (pendingChanges.length === 1) {
            const [change] = pendingChanges;
            return `${change.name} sera ${change.enabled ? "activé" : "désactivé"}.`;
        }
        const toEnable = pendingChanges.filter((c) => c.enabled).map((c) => c.name);
        const toDisable = pendingChanges.filter((c) => !c.enabled).map((c) => c.name);
        const parts = [];
        if (toEnable.length > 0) parts.push(`activer ${toEnable.join(", ")}`);
        if (toDisable.length > 0) parts.push(`désactiver ${toDisable.join(", ")}`);
        return `${parts.join(", ")}.`.replace(/^./, (c) => c.toUpperCase());
    })();

    const toEnableNames = pendingChanges.filter((c) => c.enabled).map((c) => c.name);
    const toDisableNames = pendingChanges.filter((c) => !c.enabled).map((c) => c.name);

    /**
     * Second pop-up (Phase 3) : textes exacts imposés par la mission pour
     * l'activation/désactivation/réactivation d'un service depuis la fiche
     * d'un établissement existant. Cet écran ne distingue pas "jamais activé"
     * de "déjà activé puis désactivé" (le catalogue ne porte pas cet
     * historique) : comme toute modification ici porte sur un établissement
     * déjà en production, remettre un service à `enabled=true` est traité
     * comme une RÉACTIVATION (texte mentionnant explicitement la
     * préservation des données, cohérent avec le scénario réel "Infirmerie"
     * qui a motivé cette phase) plutôt qu'une activation initiale.
     */
    const secondConfirmCopy = (() => {
        if (toEnableNames.length > 0 && toDisableNames.length === 0) {
            return {
                title: "Voulez-vous vraiment réactiver ce service ?",
                message: "Cette action rétablira l'accès à ce service et à ses données pour les utilisateurs de cet établissement.",
                confirmText: "Oui, réactiver",
            };
        }
        if (toDisableNames.length > 0 && toEnableNames.length === 0) {
            return {
                title: "Voulez-vous vraiment désactiver ce service ?",
                message: (
                    <p className="text-red-600 font-bold">
                        Les utilisateurs ne pourront plus accéder à ce service tant qu&apos;il restera désactivé.
                    </p>
                ),
                confirmText: "Oui, désactiver",
            };
        }
        return {
            title: "Voulez-vous vraiment appliquer ces modifications ?",
            message: "Cette action rendra immédiatement les services désactivés indisponibles, et rétablira l'accès aux services réactivés (données conservées), pour les utilisateurs de cet établissement.",
            confirmText: "Oui, confirmer",
        };
    })();

    const handleConfirm = async () => {
        setSaving(true);
        try {
            const updated = await bulkSetTenantFunctionalServices(
                tenantId,
                pendingChanges.map(({ code, enabled }) => ({ code, enabled }))
            );
            const list = Array.isArray(updated) ? updated : draftServices;
            setSavedServices(list);
            setDraftServices(list);
            // Propagation immédiate (même origine) vers un onglet hospitalier
            // déjà ouvert sur ce service précis — voir tenantLifecycleBroadcast.js.
            pendingChanges.forEach(({ code, enabled }) => {
                broadcastFunctionalServiceChanged(tenantId, code, enabled);
            });
            showSuccess(
                pendingChanges.length === 1
                    ? pendingChanges[0].enabled
                        ? "Service activé"
                        : "Service désactivé"
                    : "Configuration mise à jour"
            );
        } catch (error) {
            console.error("Erreur lors de la mise à jour des services fonctionnels:", error);
            showError("Impossible de modifier la configuration");
        } finally {
            setSaving(false);
            setConfirmStep(0);
        }
    };

    if (loading) {
        return (
            <div className="animate-pulse space-y-2">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                ))}
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-600">
                {loadError}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <ServicesChecklist services={draftServices} onToggle={handleToggle} disabled={saving} />

            {pendingChanges.length > 0 && (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setConfirmStep(1)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-lg bg-gradient-to-r from-primary-start to-primary-end disabled:opacity-50 transition-opacity"
                    >
                        <Save className="w-4 h-4" />
                        Enregistrer
                    </button>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmStep === 1}
                onClose={() => setConfirmStep((step) => (step === 1 ? 0 : step))}
                onConfirm={() => setConfirmStep(2)}
                title="Confirmer la modification"
                message={confirmMessage}
                confirmText="Continuer"
                cancelText="Annuler"
            />

            <ConfirmationModal
                isOpen={confirmStep === 2}
                onClose={() => setConfirmStep(0)}
                onConfirm={handleConfirm}
                title={secondConfirmCopy.title}
                message={secondConfirmCopy.message}
                confirmText={secondConfirmCopy.confirmText}
                cancelText="Annuler"
            />
        </div>
    );
}

ServicesConfigSection.propTypes = {
    tenantId: PropTypes.string.isRequired,
};

export default ServicesConfigSection;
