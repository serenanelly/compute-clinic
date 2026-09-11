import { LayoutDashboard, Building2, PlusCircle, ScrollText } from "lucide-react";
import { AppRoutesPaths as appRoutes } from "../../Router/appRouterPaths.js";

/**
 * Navigation du back-office Platform Admin.
 *
 * Dashboard (vue d'ensemble globale) + gestion des établissements
 * (Tenant Management, Phase 1 — voir MULTITENANT_ARCHITECTURE.md).
 * Ajouter une entrée ici n'exige aucun changement de CustomDashboard,
 * qui consomme cette liste telle quelle.
 */
export const platformAdminNavLink = [
    {
        name: "Dashboard",
        link: appRoutes.platformAdminDashboardPage,
        icon: LayoutDashboard,
    },
    {
        name: "Établissements",
        link: appRoutes.platformAdminEstablishmentsPage,
        icon: Building2,
    },
    {
        name: "Logs",
        link: appRoutes.platformAdminLogsPage,
        icon: ScrollText,
    },
    {
        name: "Créer un tenant",
        link: appRoutes.platformAdminCreateTenantPage,
        icon: PlusCircle,
    },
];
