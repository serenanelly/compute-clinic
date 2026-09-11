import { ShieldAlert } from "lucide-react";
import { APP_NAME } from "../constants/branding.js";

/**
 * Écran de suspension d'un établissement (Cycle de vie du tenant, Phase 3).
 *
 * Affiché en plein écran, par-dessus l'application, dès qu'une réponse
 * backend porte `error_type: "TENANT_SUSPENDED"` (voir
 * Utils/fultangErrorEvents.js + GlobalComponents/FultangGlobalErrorOverlay.jsx) —
 * y compris pour une session déjà ouverte au moment de la suspension.
 *
 * Volontairement dépourvu de tout détail technique, code d'erreur ou
 * bouton d'action (Login/Retour) — exigence produit explicite : ceci est
 * un écran métier dédié à un état précis, jamais une variante du 403
 * générique existant (GlobalComponents/AccessDenied.jsx, inchangé par
 * cette phase).
 */
export function TenantSuspendedScreen() {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md text-center">
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-gradient-to-r from-primary-start to-primary-end rounded-2xl p-4 shadow-lg mb-4">
                        <ShieldAlert className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-secondary">{APP_NAME}</h1>
                </div>
                <div className="bg-white shadow-2xl border-2 rounded-lg p-8">
                    <h2 className="text-xl font-bold text-gray-800">Vous avez été suspendu.</h2>
                </div>
            </div>
        </div>
    );
}

export default TenantSuspendedScreen;
