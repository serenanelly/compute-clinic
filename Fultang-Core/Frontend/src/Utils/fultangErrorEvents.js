/**
 * fultangErrorEvents.js — Détection des réponses d'erreur structurées
 * "tenant suspendu" / "service désactivé" (Cycle de vie du tenant, Phase 3),
 * partagée entre toutes les instances axios de l'application.
 *
 * Deux formes de corps de réponse existent selon le service qui répond
 * (jamais unifiées entre les deux frameworks, documenté honnêtement) :
 *   - API Gateway (FastAPI)      : {"detail": {"error_type": "...", "message": "..."}}
 *   - Services Django (DRF)      : {"error_type": "...", "message": "..."} (racine)
 * `extractFultangErrorType` gère les deux formes de façon unique.
 *
 * Volontairement basé sur `window.dispatchEvent`/`CustomEvent` plutôt que
 * sur un state manager global : aucun store global n'existe déjà dans ce
 * projet, et un event DOM natif reste la façon la moins intrusive
 * d'informer un composant monté une seule fois près de la racine de l'app
 * (voir App.jsx) sans modifier aucun intercepteur/page existant au-delà
 * d'un seul nouveau bloc, placé avant leur logique actuelle.
 */

export const FULTANG_TENANT_SUSPENDED_EVENT = 'fultang:tenant-suspended';
export const FULTANG_SERVICE_UNAVAILABLE_EVENT = 'fultang:service-unavailable';
export const FULTANG_TENANT_DELETED_EVENT = 'fultang:tenant-deleted';

export function extractFultangErrorType(error) {
    const data = error?.response?.data;
    if (!data) return null;
    return data?.detail?.error_type || data?.error_type || null;
}

/**
 * À appeler depuis un intercepteur de réponse axios, AVANT toute logique
 * 401/403 existante. Ne fait rien (retourne `false`) pour toute erreur qui
 * n'est pas explicitement l'un de ces deux cas — jamais d'effet de bord
 * sur un 403/404 "classique" (permission métier insuffisante, ressource
 * introuvable ordinaire), qui continuent d'être gérés par chaque page
 * comme aujourd'hui.
 */
export function dispatchFultangErrorEvent(error) {
    const errorType = extractFultangErrorType(error);
    if (errorType === 'TENANT_SUSPENDED') {
        window.dispatchEvent(new CustomEvent(FULTANG_TENANT_SUSPENDED_EVENT));
        return true;
    }
    if (errorType === 'SERVICE_UNAVAILABLE') {
        window.dispatchEvent(new CustomEvent(FULTANG_SERVICE_UNAVAILABLE_EVENT));
        return true;
    }
    if (errorType === 'TENANT_DELETED') {
        // Suppression DÉFINITIVE d'un tenant (Cycle de vie du tenant,
        // Phase 4) — onglet resté ouvert au moment de la suppression :
        // même mécanisme que TENANT_SUSPENDED, écran dédié (message exact
        // distinct : "n'existe plus", jamais "suspendu").
        window.dispatchEvent(new CustomEvent(FULTANG_TENANT_DELETED_EVENT));
        return true;
    }
    return false;
}
