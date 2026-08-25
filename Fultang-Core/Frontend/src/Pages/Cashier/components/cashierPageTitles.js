import { AppRoutesPaths as routes } from '../../../Router/appRouterPaths.js';

/** Titres affichés dans la barre supérieure selon la route active */
export const CASHIER_PAGE_TITLES = {
  [routes.cashierPage]: 'Encaissement patients',
  '/cashier': 'Encaissement patients',
  [routes.cashierCaisseQuotidienne]: 'Caisse journalière',
  [routes.cashierDecaissements]: 'Décaissements',
  [routes.cashierQuittancesValidees]: 'Quittances validées',
  [routes.cashierQuittancesAValider]: 'Quittances à valider',
  [routes.financialHistory]: 'Historique financier',
  [routes.financialReport]: 'Rapport financier',
  [routes.helpCenter]: "Centre d'aide",
};

export function getCashierPageTitle(pathname) {
  if (CASHIER_PAGE_TITLES[pathname]) return CASHIER_PAGE_TITLES[pathname];
  const match = Object.entries(CASHIER_PAGE_TITLES).find(([path]) =>
    path !== '/cashier' && pathname.startsWith(path)
  );
  return match ? match[1] : 'Module Caisse';
}
