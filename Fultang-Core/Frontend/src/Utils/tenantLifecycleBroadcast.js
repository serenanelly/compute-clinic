import { getToken } from "./authToken.js";
import {
    FULTANG_TENANT_SUSPENDED_EVENT,
    FULTANG_TENANT_DELETED_EVENT,
} from "./fultangErrorEvents.js";

/**
 * tenantLifecycleBroadcast.js — Propagation immédiate, SANS nouvelle
 * infrastructure temps réel, d'une action administrative (suspension,
 * réactivation, désactivation de FunctionalService, suppression
 * définitive) vers un onglet hospitalier déjà ouvert sur le MÊME ORIGINE
 * (même déploiement frontend — cas réel du développement/démo actuels,
 * où Platform Admin et l'application hospitalière sont servis depuis le
 * même hostname/port).
 *
 * Mécanisme : l'événement natif `storage` du navigateur (aucune librairie,
 * aucun WebSocket/SSE, aucun polling) — un `localStorage.setItem(...)`
 * dans un onglet déclenche un event `storage` dans TOUS LES AUTRES onglets
 * de la MÊME origine, jamais dans celui qui a écrit (comportement natif du
 * navigateur, garanti par la spec, pas un choix d'implémentation ici).
 *
 * LIMITE HONNÊTE, documentée explicitement (voir mission) : cet événement
 * ne traverse JAMAIS une origine différente. Un déploiement réel où
 * Platform Admin (ex. `admin.fulltang.com`) et un établissement (ex.
 * `hopital-x.fulltang.com`) sont des sous-domaines distincts NE PEUT PAS
 * bénéficier de ce mécanisme : `localStorage` est strictement scopé par
 * origine, par construction du navigateur — aucune configuration ni aucun
 * correctif ne peut contourner cela sans introduire exactement le type
 * d'infrastructure (WebSocket/SSE/relais serveur) explicitement exclu de
 * cette mission. Dans ce cas, le filet de sécurité reste le battement de
 * fond de `hooks/useFunctionalServiceGate.js` (au plus quelques secondes
 * de délai, jamais un clic ni un rechargement requis) et le mécanisme
 * réactif déjà existant (`fultangErrorEvents.js`, sur la toute prochaine
 * requête réelle).
 *
 * Réutilise EXACTEMENT les events déjà existants (`fultangErrorEvents.js`)
 * et donc les écrans déjà existants (`FultangGlobalErrorOverlay.jsx`) —
 * aucun nouvel écran, aucun nouveau mécanisme de détection : uniquement un
 * déclenchement plus rapide de ce qui existe déjà.
 */

const STORAGE_KEY = "fultang:tenant_lifecycle_broadcast";

/**
 * Extrait `tenant_id` du JWT d'accès actuellement stocké (même décodage
 * que `setupAuthRefresh.js::isTokenExpired` — payload seulement, jamais de
 * vérification de signature côté client : ceci ne sert qu'à une
 * optimisation d'affichage, l'application réelle de l'accès reste
 * entièrement backend). Retourne `null` pour un Platform Admin (jamais de
 * tenant_id) ou en l'absence de session.
 */
function getMyTenantIdFromToken() {
    const token = getToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.tenant_id || null;
    } catch {
        return null;
    }
}

function broadcast(type, data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ type, ...data, ts: Date.now() }));
    } catch {
        // localStorage indisponible (navigation privée stricte, quota...) :
        // jamais bloquant — le battement de fond reste le filet de sécurité.
    }
}

export function broadcastTenantSuspended(tenantId) {
    broadcast("TENANT_SUSPENDED", { tenant_id: tenantId });
}

export function broadcastTenantReactivated(tenantId) {
    broadcast("TENANT_REACTIVATED", { tenant_id: tenantId });
}

export function broadcastTenantDeleted(tenantId) {
    broadcast("TENANT_DELETED", { tenant_id: tenantId });
}

export function broadcastFunctionalServiceChanged(tenantId, code, enabled) {
    broadcast("SERVICE_CHANGED", { tenant_id: tenantId, code, enabled });
}

/**
 * À appeler UNE SEULE FOIS près de la racine de l'app (voir
 * FultangGlobalErrorOverlay.jsx) : réagit aux diffusions de niveau TENANT
 * (suspension/suppression) — jamais aux diffusions de service, gérées
 * séparément par `useFunctionalServiceGate` (seule la page concernée par
 * CE service précis doit réagir, voir sa docstring, §7 de la mission).
 *
 * Ne réagit JAMAIS à une réactivation ici (`TENANT_REACTIVATED`) : un
 * écran de blocage déjà affiché n'est volontairement jamais retiré
 * automatiquement (cohérent avec le comportement existant de
 * `FultangGlobalErrorOverlay`, qui ne prévoit aucune sortie sans nouvelle
 * navigation/rechargement).
 */
export function setupTenantLifecycleBroadcastListener() {
    const onStorage = (event) => {
        if (event.key !== STORAGE_KEY || !event.newValue) return;
        let data;
        try {
            data = JSON.parse(event.newValue);
        } catch {
            return;
        }
        const myTenantId = getMyTenantIdFromToken();
        if (!myTenantId || data.tenant_id !== myTenantId) return;

        if (data.type === "TENANT_SUSPENDED") {
            window.dispatchEvent(new CustomEvent(FULTANG_TENANT_SUSPENDED_EVENT));
        } else if (data.type === "TENANT_DELETED") {
            window.dispatchEvent(new CustomEvent(FULTANG_TENANT_DELETED_EVENT));
        }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
}

/**
 * À utiliser UNIQUEMENT par `useFunctionalServiceGate` : indique si un
 * event `storage` donné correspond à un changement du FunctionalService
 * `code` pour le tenant de la session courante — jamais un autre service,
 * jamais un autre tenant (isolation, §7/§9 de la mission).
 *
 * @returns {{enabled: boolean}|null} `null` si l'event ne concerne pas ce
 * tenant/service courant.
 */
export function matchFunctionalServiceBroadcast(event, code) {
    if (event.key !== STORAGE_KEY || !event.newValue || !code) return null;
    let data;
    try {
        data = JSON.parse(event.newValue);
    } catch {
        return null;
    }
    if (data.type !== "SERVICE_CHANGED" || data.code !== code) return null;
    const myTenantId = getMyTenantIdFromToken();
    if (!myTenantId || data.tenant_id !== myTenantId) return null;
    return { enabled: Boolean(data.enabled) };
}

export const TENANT_LIFECYCLE_STORAGE_KEY = STORAGE_KEY;
