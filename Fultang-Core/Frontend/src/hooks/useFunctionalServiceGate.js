import { useEffect, useState } from "react";
import { getMyFunctionalServices } from "../services/tenantConfigApi.js";
import { matchFunctionalServiceBroadcast } from "../Utils/tenantLifecycleBroadcast.js";

// Cadence du contrôle de fond (Cycle de vie du tenant, Phase 5 — écrans de
// blocage affichés immédiatement). Volontairement modérée ("non agressive",
// exigence explicite de la mission) : un onglet resté ouvert sans navigation
// ni rafraîchissement finit par détecter une suspension/désactivation/
// suppression décidée depuis Platform Admin dans une fenêtre d'au plus
// POLL_INTERVAL_MS, sans WebSocket/SSE/nouvelle architecture temps réel.
const POLL_INTERVAL_MS = 15000;

/**
 * Bascule la page/route courante en "service indisponible" si le
 * FunctionalService donné est désactivé pour le tenant de l'utilisateur
 * connecté (Cycle de vie du tenant — désactivation effective), ET sert de
 * "battement de coeur" pour la détection de suspension/suppression du
 * tenant lui-même (voir plus bas) — mécanisme UNIQUE, jamais deux
 * mécanismes de blocage distincts.
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
 * Battement de coeur tenant (nouveau) : cet appel est émis MÊME SANS
 * `code` (toute page hospitalière utilisant `DashBoard.jsx`/
 * `CustomDashboard.jsx` l'appelle déjà inconditionnellement) — il passe
 * par la Gateway comme n'importe quel appel proxyfié, donc si le tenant a
 * été suspendu ou supprimé DEPUIS le dernier appel, la Gateway répond avec
 * le corps structuré `TENANT_SUSPENDED`/`TENANT_DELETED` déjà détecté par
 * l'intercepteur axios global (`Utils/fultangErrorEvents.js`), qui affiche
 * alors l'écran de blocage déjà existant — AUCUNE nouvelle logique de
 * détection ni de nouvel écran ici, uniquement le déclenchement périodique
 * d'un appel qui existait déjà (au montage seulement, auparavant).
 *
 * Propagation immédiate (même origine) : écoute aussi les diffusions
 * `SERVICE_CHANGED` de `Utils/tenantLifecycleBroadcast.js`, déclenchées par
 * Platform Admin juste après confirmation d'une activation/désactivation —
 * si le `code` et le tenant correspondent, `blocked` change SANS attendre
 * le prochain tick du battement de fond.
 *
 * Volontairement inactif pour une session PLATFORM_ADMIN (aucun tenant,
 * cet appel renverrait systématiquement 404 sans jamais rien vérifier
 * d'utile) et lorsque l'onglet n'est pas visible (Page Visibility API,
 * déjà standard du navigateur — pas de vérification en arrière-plan
 * inutile).
 *
 * Limite honnête : ceci ne détecte un changement que dans un onglet ayant
 * une session active AVEC ce tenant — un navigateur qui n'a strictement
 * aucune communication avec le serveur (hors ligne, onglet suspendu par le
 * navigateur) ne peut, par construction, recevoir aucune information avant
 * sa prochaine requête réelle.
 *
 * @param {string} code Code du FunctionalService (ex. "SOINS_INFIRMIERS").
 * @returns {{checking: boolean, blocked: boolean}}
 */
export function useFunctionalServiceGate(code) {
    const [checking, setChecking] = useState(Boolean(code));
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        if (localStorage.getItem("user_role_fultang") === "platform_admin") {
            setChecking(false);
            setBlocked(false);
            return;
        }

        let cancelled = false;

        const runCheck = async (isInitial) => {
            if (isInitial) setChecking(true);
            try {
                const services = await getMyFunctionalServices();
                if (cancelled) return;
                if (code) {
                    const entry = Array.isArray(services) ? services.find((s) => s.code === code) : null;
                    setBlocked(Boolean(entry) && entry.enabled === false);
                }
            } catch {
                // Échec réseau/autorisation sur cette vérification : ne bloque jamais
                // une page par excès de prudence — le backend reste de toute façon
                // l'autorité finale sur chaque action réellement protégée. Une
                // suspension/suppression réelle est de toute façon déjà signalée
                // par l'intercepteur axios global (voir docstring ci-dessus).
                if (!cancelled) setBlocked(false);
            } finally {
                if (isInitial && !cancelled) setChecking(false);
            }
        };

        runCheck(true);

        const intervalId = setInterval(() => {
            if (document.visibilityState === "visible") {
                runCheck(false);
            }
        }, POLL_INTERVAL_MS);

        // Propagation immédiate (même origine, voir tenantLifecycleBroadcast.js)
        // depuis l'action Platform Admin qui vient de désactiver/réactiver CE
        // service précis pour CE tenant précis — sans attendre le prochain
        // tick du battement de fond ci-dessus (jusqu'à POLL_INTERVAL_MS).
        const onStorage = (event) => {
            const match = matchFunctionalServiceBroadcast(event, code);
            if (match) setBlocked(!match.enabled);
        };
        window.addEventListener("storage", onStorage);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
            window.removeEventListener("storage", onStorage);
        };
    }, [code]);

    return { checking, blocked };
}

export default useFunctionalServiceGate;
