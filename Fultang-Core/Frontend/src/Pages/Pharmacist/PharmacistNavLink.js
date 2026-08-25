import { FileText, Link, Pill, ClipboardList, ShoppingCart, Boxes } from "lucide-react";

export const PharmacistNavLink = [
    {
        name: "Prescription",
        link: "/pharmacist/prescriptions",
        icon: FileText
    },
    {
        name: "Délivrance",
        link: "/pharmacist/delivery",
        icon: Link
    },
    {
        name: "Stock & matière",
        link: "/pharmacist/medication-list",
        icon: Boxes,
        subLinks: [
            {
                name: "Liste des médicaments",
                link: "/pharmacist/medication-list",
                icon: Pill
            },
            {
                name: "Émettre un besoin",
                link: "/pharmacist/emit-need",
                icon: ClipboardList
            },
            {
                name: "Ventes du jour",
                link: "/pharmacist/daily-sales",
                icon: ShoppingCart
            },
            {
                name: "Inventaire",
                link: "/pharmacist/inventory",
                icon: Boxes
            },
            {
                name: "Rapports",
                link: "/pharmacist/reports",
                icon: FileText
            }
        ]
    }
];
