import { PackageX } from "lucide-react";

/**
 * Écran "service indisponible" (Cycle de vie du tenant, Phase 3).
 *
 * Affiché en plein écran, par-dessus l'application, dès qu'une réponse
 * backend porte `error_type: "SERVICE_UNAVAILABLE"` (un FunctionalService
 * désactivé pour l'établissement, ex. Pharmacie, Infirmerie...) — voir
 * Utils/fultangErrorEvents.js + FultangGlobalErrorOverlay.jsx.
 *
 * Présente le service comme INEXISTANT pour cet établissement (jamais
 * "bloqué" ou "interdit") — cohérent avec le 404 renvoyé côté backend,
 * qui ne révèle jamais qu'un mécanisme d'autorisation est en jeu. Aucun
 * détail technique, aucun bouton Login/Retour.
 */
export function ServiceUnavailableScreen() {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md text-center">
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-gradient-to-r from-primary-start to-primary-end rounded-2xl p-4 shadow-lg mb-4">
                        <PackageX className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-secondary">FullTang</h1>
                </div>
                <div className="bg-white shadow-2xl border-2 rounded-lg p-8">
                    <h2 className="text-xl font-bold text-gray-800">Ce service n&apos;existe pas.</h2>
                </div>
            </div>
        </div>
    );
}

export default ServiceUnavailableScreen;
