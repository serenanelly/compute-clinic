import { useEffect, useState } from "react";
import {
    FULTANG_TENANT_SUSPENDED_EVENT,
    FULTANG_SERVICE_UNAVAILABLE_EVENT,
    FULTANG_TENANT_DELETED_EVENT,
} from "../Utils/fultangErrorEvents";
import { setupTenantLifecycleBroadcastListener } from "../Utils/tenantLifecycleBroadcast.js";
import { TenantSuspendedScreen } from "./TenantSuspendedScreen.jsx";
import { ServiceUnavailableScreen } from "./ServiceUnavailableScreen.jsx";
import { TenantDeletedScreen } from "./TenantDeletedScreen.jsx";

/**
 * Monté UNE SEULE FOIS près de la racine de l'app (App.jsx), à côté de
 * `FeedbackProvider` — écoute les deux events globaux déclenchés par les
 * intercepteurs axios (voir Utils/fultangErrorEvents.js) et affiche
 * l'écran plein écran correspondant par-dessus l'application entière,
 * quelle que soit la page/route active au moment où l'erreur survient.
 *
 * Ne modifie ni ne remplace `AppRoute` — un simple overlay conditionnel,
 * jamais une redirection : l'utilisateur reste "bloqué" visuellement sur
 * cet écran tant qu'il ne recharge pas/ne revient pas plus tard, sans que
 * l'état de navigation sous-jacent soit perturbé.
 */
export function FultangGlobalErrorOverlay() {
    const [screen, setScreen] = useState(null); // null | 'suspended' | 'unavailable' | 'deleted'

    useEffect(() => {
        const onSuspended = () => setScreen('suspended');
        const onUnavailable = () => setScreen('unavailable');
        const onDeleted = () => setScreen('deleted');

        window.addEventListener(FULTANG_TENANT_SUSPENDED_EVENT, onSuspended);
        window.addEventListener(FULTANG_SERVICE_UNAVAILABLE_EVENT, onUnavailable);
        window.addEventListener(FULTANG_TENANT_DELETED_EVENT, onDeleted);
        // Propagation immédiate depuis un autre onglet de la même origine
        // (ex. Platform Admin) sans attendre la prochaine requête réelle —
        // voir Utils/tenantLifecycleBroadcast.js pour la portée exacte et
        // sa limite honnête (ne traverse jamais une origine différente).
        const stopBroadcastListener = setupTenantLifecycleBroadcastListener();
        return () => {
            window.removeEventListener(FULTANG_TENANT_SUSPENDED_EVENT, onSuspended);
            window.removeEventListener(FULTANG_SERVICE_UNAVAILABLE_EVENT, onUnavailable);
            window.removeEventListener(FULTANG_TENANT_DELETED_EVENT, onDeleted);
            stopBroadcastListener();
        };
    }, []);

    if (screen === 'suspended') return <TenantSuspendedScreen />;
    if (screen === 'unavailable') return <ServiceUnavailableScreen />;
    if (screen === 'deleted') return <TenantDeletedScreen />;
    return null;
}

export default FultangGlobalErrorOverlay;
