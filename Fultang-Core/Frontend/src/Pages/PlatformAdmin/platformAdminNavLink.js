import { LayoutDashboard } from "lucide-react";
import { AppRoutesPaths as appRoutes } from "../../Router/appRouterPaths.js";

/**
 * Navigation du back-office Platform Admin.
 *
 * Volontairement réduite à une seule entrée pour cette première étape
 * (Dashboard) — la gestion des tenants/services/bases/configuration
 * viendra dans une itération ultérieure (voir MULTITENANT_ARCHITECTURE.md,
 * Phase 9 et suivantes). Ajouter une entrée ici n'exige aucun changement
 * de CustomDashboard, qui consomme cette liste telle quelle.
 */
export const platformAdminNavLink = [
    {
        name: "Dashboard",
        link: appRoutes.platformAdminDashboardPage,
        icon: LayoutDashboard,
    },
];
