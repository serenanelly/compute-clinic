import { APP_NAME } from "../constants/branding.js";
import { useTenantBranding } from "../hooks/useTenantBranding.js";

/**
 * En-tête d'identité affiché en haut des sidebars hospitalières :
 *
 *     [LOGO DE L'HÔPITAL]
 *     Hôpital Saint Martin   <- nom du tenant courant (dynamique)
 *     ComputeClinic          <- marque de la plateforme (toujours affichée)
 *
 * Nom et logo proviennent du tenant courant (useTenantBranding.js →
 * GET /tenants/tenants/mine/) — jamais codés en dur. Composant unique,
 * réutilisé par TOUTES les sidebars hospitalières (Réceptionniste,
 * Médecin, Infirmier, Pharmacien, Laborantin, Caissier, Comptable...)
 * pour éviter toute duplication de cette logique.
 *
 * Ne s'utilise QUE dans un contexte hospitalier (un tenant existe
 * toujours) — jamais pour la Platform Admin, qui garde son propre
 * libellé statique "ComputeClinic Platform" (voir CustomDashboard.jsx,
 * prop `showTenantIdentity`).
 */
export function TenantBrandHeader() {
    const { name, logoUrl } = useTenantBranding();

    return (
        <div className="flex flex-col items-start ml-6 mb-10 mt-7 pr-4">
            {logoUrl && (
                <img
                    src={logoUrl}
                    alt="Logo de l'établissement"
                    className="w-12 h-12 rounded-xl object-contain bg-white/90 p-1 mb-3 shadow-sm"
                />
            )}
            {name && (
                <p className="text-lg font-bold text-white leading-tight break-words">
                    {name}
                </p>
            )}
            <p className={`font-bold text-white/70 ${name ? 'text-xs uppercase tracking-widest mt-1' : 'text-3xl'}`}>
                {APP_NAME}
            </p>
        </div>
    );
}

export default TenantBrandHeader;
