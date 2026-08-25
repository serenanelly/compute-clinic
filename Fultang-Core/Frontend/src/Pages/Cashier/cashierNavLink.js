import { MdPending, MdHelpOutline, MdAccountBalanceWallet, MdSend, MdReceiptLong } from "react-icons/md";
import { HiOutlineDocumentReport } from "react-icons/hi";
import { AppRoutesPaths as appRoutes } from "../../Router/appRouterPaths.js";
import { FaHistory } from "react-icons/fa";

export const cashierNavLink = [
    {
        name: 'Encaissement patients',
        icon: MdPending,
        link: appRoutes.cashierPage,
    },
    {
        name: 'Caisse journalière',
        icon: MdAccountBalanceWallet,
        link: '/cashier/caisse',
    },
    {
        name: 'Décaissements',
        icon: MdSend,
        link: '/cashier/decaissements',
    },
    {
        name: 'Quittances validées',
        icon: MdReceiptLong,
        link: '/cashier/quittances/validees',
    },
    {
        name: 'Historique financier',
        icon: FaHistory,
        link: appRoutes.financialHistory,
    },
    {
        name: 'Rapport financier',
        icon: HiOutlineDocumentReport,
        link: appRoutes.financialReport,
    },
    {
        name: 'Centre d\'aide',
        icon: MdHelpOutline,
        link: appRoutes.helpCenter,
    }
];