import { useEffect, useState } from "react";
import { getMyTenant } from "../services/tenantConfigApi.js";
import { resolveTenantLogoUrl } from "../Utils/gatewayUrls.js";

/**
 * Identité (nom, logo) de l'établissement de l'utilisateur hospitalier
 * connecté — branding dynamique des sidebars (GlobalComponents/TenantBrandHeader.jsx).
 *
 * Réutilise le système déjà existant : `Tenant.name`/`Tenant.logo` (voir
 * Platform Admin, EstablishmentDetailPage/LogoUploader) via
 * `GET /tenants/tenants/mine/` (tenantConfigApi.js), lui-même dérivé du
 * tenant de l'appelant côté backend (X-Tenant-ID) — jamais un nom choisi
 * ou codé en dur côté frontend.
 *
 * 404/erreur (compte du pool non assigné, Platform Admin, panne réseau) :
 * retombe silencieusement sur `{name: null, logoUrl: null}` — le composant
 * consommateur affiche alors uniquement le repli ComputeClinic, jamais une
 * erreur visible pour une simple absence de tenant.
 *
 * @returns {{name: string|null, logoUrl: string|null, loading: boolean}}
 */
export function useTenantBranding() {
    const [name, setName] = useState(null);
    const [logoUrl, setLogoUrl] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const tenant = await getMyTenant();
                if (cancelled) return;
                setName(tenant?.name || null);
                setLogoUrl(resolveTenantLogoUrl(tenant?.logo_display_url) || null);
            } catch {
                if (!cancelled) {
                    setName(null);
                    setLogoUrl(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return { name, logoUrl, loading };
}

export default useTenantBranding;
