import { FaHome } from "react-icons/fa";
import { AppRoutesPaths as appRoutes } from "../../Router/appRouterPaths.js";
import { Building2, Users, Stethoscope } from "lucide-react";

/**
 * Configuration de la navigation pour le dashboard administrateur.
 * Definit les liens de la sidebar avec leurs icones et routes.
 */
export const newAdminNavLink = [
    {
        name: "Dashboard",
        link: appRoutes.adminHomePage,
        icon: FaHome,
    },
    {
        name: "Services",
        icon: Building2,
        link: appRoutes.adminServicesPage,
    },
    {
        name: "Personnel",
        icon: Users,
        link: appRoutes.adminPersonnelPage,
    },
    {
        name: "Infrastructures",
        icon: Stethoscope,
        link: appRoutes.adminChambresPage,
    },
];
