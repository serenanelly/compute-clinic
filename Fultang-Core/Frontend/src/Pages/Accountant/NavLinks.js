/**
 * Navigation Links for Accountant Module - Restructured
 * Removes: Saisie Écritures (auto-generated), Quittances Validées (merged in Comptabilisation)
 * Groups: Journal Comptable + Grand Livre under one expandable item
 */
import { MdDashboard, MdHelpOutline, MdAccountBalanceWallet, MdReceiptLong, MdHistory } from "react-icons/md";
import { HiOutlineDocumentReport } from "react-icons/hi";
import { FaBookOpen, FaFileAlt, FaBalanceScale, FaShoppingCart, FaUsers, FaCalendarAlt, FaBook, FaBookReader } from "react-icons/fa";
import { AppRoutesPaths as appRoutes } from "../../Router/appRouterPaths.js";

export const accountantNavLink = [
    {
        name: 'Dashboard',
        icon: MdDashboard,
        link: appRoutes.accountantHome,
    },
    {
        name: 'Comptabilisation',
        icon: MdReceiptLong,
        link: '/accountant/comptabilisation',
    },
    {
        name: 'Journaux & Livres',
        icon: FaBookReader,
        subLinks: [
            {
                name: 'Journal Comptable',
                icon: FaFileAlt,
                link: '/accountant/ecritures',
            },
            {
                name: 'Grand Livre',
                icon: FaBook,
                link: '/accountant/grand-livre',
            },
        ],
    },
    {
        name: 'Balance',
        icon: FaBalanceScale,
        link: '/accountant/balance',
    },
    {
        name: 'Plan Comptable',
        icon: FaBookOpen,
        link: '/accountant/plan-comptable',
    },
    {
        name: 'Exercices Comptables',
        icon: FaCalendarAlt,
        link: '/accountant/exercices-budgets',
    },
    {
        name: 'Rapports Financiers',
        icon: HiOutlineDocumentReport,
        link: '/accountant/rapports',
    },
    {
        name: 'Achats & Sorties',
        icon: FaShoppingCart,
        link: '/accountant/achats',
    },
    {
        name: 'Fournisseurs',
        icon: FaUsers,
        link: '/accountant/fournisseurs',
    },
    {
        name: 'Portefeuille Chèques',
        icon: MdAccountBalanceWallet,
        link: '/accountant/cheques',
    },
    {
        name: 'Piste d\'Audit',
        icon: MdHistory,
        link: '/accountant/audit',
    },
    {
        name: 'Help Center',
        icon: MdHelpOutline,
        link: appRoutes.helpCenterPage,
    }
];
