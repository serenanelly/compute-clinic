/**
 * Marque affichée dans l'interface hospitalière COMPUTECLINIC.
 * Ne pas utiliser pour le back-office plateforme (FullTang / multitenance).
 */
export const APP_NAME = 'COMPUTECLINIC';
export const APP_NAME_DISPLAY = 'ComputeClinic';

/** Pied de page PDF / exports : « COMPUTECLINIC - Service » */
export function brandFooter(serviceLabel) {
    return `${APP_NAME} - ${serviceLabel}`;
}
