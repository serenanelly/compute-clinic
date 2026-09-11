import { useEffect, useState } from "react";
import { getMyFunctionalServices } from "../services/tenantConfigApi.js";

/**
 * Bascule la page/route courante en "service indisponible" si le
 * FunctionalService donné est désactivé pour le tenant de l'utilisateur
 * connecté (Cycle de vie du tenant — désactivation effective).
 *
 * Ne modifie AUCUN endpoint métier existant : réutilise
 * `GET /tenants/tenants/functional-services/mine/` (déjà utilisé par
 * `AddPersonnelModal.jsx` depuis la Phase 2), déjà scopé au tenant de
 * l'appelant côté backend — jamais un tenant choisi côté client.
 *
 * Complète, au niveau de la PAGE, ce que le backend ne peut pas toujours
 * garantir lui-même : plusieurs endpoints partagés par plusieurs rôles
 * (ex. la liste des visites, utilisée à la fois par le médecin et
 * l'infirmier) ne peuvent pas être bloqués au niveau de l'API sans
 * casser l'autre rôle — voir MULTITENANT_ARCHITECTURE.md. Bloquer la
 * PAGE dédiée au rôle propriétaire du service (ex. la page infirmière)
 * reste sûr : l'autre rôle a sa propre page, sur sa propre route,
 * inchangée.
 *
 * Limite honnête (comme le reste du mécanisme de désactivation) : cette
 * vérification s'exécute au montage de la page (nouvelle navigation,
 * rechargement, ancienne URL rouverte) — elle ne surveille pas en
 * continu un onglet resté ouvert SANS aucune navigation ni rechargement.
 * Toute action métier réellement protégée côté backend (ex. enregistrer
 * un soin) reste, elle, bloquée immédiatement même dans ce cas — voir
 * l'intercepteur global (fultangErrorEvents.js).
 *
 * @param {string} code Code du FunctionalService (ex. "SOINS_INFIRMIERS").
 * @returns {{checking: boolean, blocked: boolean}}
 */
export function useFunctionalServiceGate(code) {
    const [checking, setChecking] = useState(Boolean(code));
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        if (!code) {
            setChecking(false);
            setBlocked(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setChecking(true);
            try {
                const services = await getMyFunctionalServices();
                const entry = Array.isArray(services) ? services.find((s) => s.code === code) : null;
                if (!cancelled) setBlocked(Boolean(entry) && entry.enabled === false);
            } catch {
                // Échec réseau/autorisation sur cette vérification : ne bloque jamais
                // une page par excès de prudence — le backend reste de toute façon
                // l'autorité finale sur chaque action réellement protégée.
                if (!cancelled) setBlocked(false);
            } finally {
                if (!cancelled) setChecking(false);
            }
        })();
        return () => { cancelled = true; };
    }, [code]);

    return { checking, blocked };
}

export default useFunctionalServiceGate;
