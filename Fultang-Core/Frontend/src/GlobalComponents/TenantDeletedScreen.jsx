import { Building2 } from "lucide-react";
import { APP_NAME } from "../constants/branding.js";

/**
 * Écran de suppression DÉFINITIVE d'un établissement (Cycle de vie du
 * tenant, Phase 4).
 *
 * Affiché en plein écran, par-dessus l'application, dès qu'une réponse
 * backend porte `error_type: "TENANT_DELETED"` (voir
 * Utils/fultangErrorEvents.js + FultangGlobalErrorOverlay.jsx) — y
 * compris pour une session déjà ouverte au moment de la suppression.
 *
 * Distinct de TenantSuspendedScreen.jsx : message exact ("n'existe plus"),
 * jamais "suspendu" — une suppression définitive n'est pas réversible,
 * contrairement à une suspension. Même sobriété : aucun détail technique,
 * aucun bouton Login/Retour.
 */
export function TenantDeletedScreen() {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md text-center">
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-gradient-to-r from-primary-start to-primary-end rounded-2xl p-4 shadow-lg mb-4">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-secondary">{APP_NAME}</h1>
                </div>
                <div className="bg-white shadow-2xl border-2 rounded-lg p-8">
                    <h2 className="text-xl font-bold text-gray-800">Cet établissement n&apos;existe plus.</h2>
                </div>
            </div>
        </div>
    );
}

export default TenantDeletedScreen;
