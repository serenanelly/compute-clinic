import { Layers } from "lucide-react";
import { ServicesConfigSection } from "./ServicesConfigSection.jsx";

/**
 * Registre des catégories de configuration d'un établissement.
 *
 * La couche "Configuration de l'établissement" (EstablishmentDetailPage)
 * est amenée à grandir fortement dans les phases futures : workflows,
 * formulaires, règles métier, réglages UX, etc. Ajouter une future
 * catégorie consiste UNIQUEMENT à ajouter une entrée ici — aucune autre
 * modification n'est nécessaire dans EstablishmentDetailPage.jsx, qui se
 * contente de parcourir ce tableau pour construire son sélecteur
 * d'onglets/sections.
 *
 * Chaque entrée :
 * - key         identifiant stable (utilisé comme clé d'onglet actif)
 * - label       libellé affiché dans le sélecteur
 * - description phrase courte affichée sous le libellé / en en-tête de section
 * - icon        composant icône lucide-react
 * - Component   composant de rendu, reçoit `{ tenantId }` en props
 */
export const establishmentConfigCategories = [
    {
        key: "services",
        label: "Services",
        description: "Fonctionnalités activées pour cet établissement",
        icon: Layers,
        Component: ServicesConfigSection,
    },
    // futures catégories : workflows, formulaires, règles métier, UX...
];

export default establishmentConfigCategories;
