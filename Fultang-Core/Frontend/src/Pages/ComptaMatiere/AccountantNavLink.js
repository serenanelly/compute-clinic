import { AppRoutesPaths as appRoutes } from "../../Router/appRouterPaths";
import {
  FaHome,
  FaClipboardList,
  FaTruck,
  FaBoxOpen,
  FaChartLine,
  FaBoxes,
  FaListAlt,
  FaArchive,
  FaHistory,
} from "react-icons/fa";

export const AccountantNavLink = [
  {
    name: "Tableau de bord",
    link: appRoutes.comptaMatiereDashboard,
    icon: FaHome,
    description: "Vue d'ensemble des activités"
  },

  {
    name: "Émettre un besoin",
    link: appRoutes.comptaMatiereEmitNeed,
    icon: FaClipboardList,
    description: "Créer une demande de matériel"
  },

  {
    name: "Enregistrer une livraison",
    link: appRoutes.comptaMatiereRegisterDelivery,
    icon: FaTruck,
    description: "Enregistrer la réception de matériel"
  },

  {
    name: "Historique des livraisons",
    link: appRoutes.comptaMatiereDeliveryList,
    icon: FaHistory,
    description: "Consulter toutes les livraisons enregistrées"
  },

  {
    name: "Enregistrer une sortie",
    link: appRoutes.comptaMatiereRegisterOutput,
    icon: FaBoxOpen,
    description: "Enregistrer la sortie de matériel"
  },

  {
    name: "Consulter Inventaire",
    link: appRoutes.comptaMatiereInventoryArchives,
    icon: FaArchive,
    description: "Voir les inventaires terminés"
  },

  {
    name: "Rapports",
    link: appRoutes.comptaMatiereReports,
    icon: FaChartLine,
    description: "Consulter les rapports"
  },

  {
    name: "Liste du matériel",
    link: appRoutes.comptaMatiereMaterialList,
    icon: FaBoxes,
    description: "Inventaire du matériel disponible"
  },

  {
    name: "Liste des sorties",
    link: appRoutes.comptaMatiereOutputList,
    icon: FaListAlt,
    description: "Historique des sorties de matériel"
  },
];
