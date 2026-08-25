// ─── Statuts RDV — configuration partagée entre toutes les vues ───────────────

export const STATUT_CONFIG = {
    PROGRAMME: { label: 'Programmé',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
    CONFIRME:  { label: 'Confirmé',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    EN_COURS:  { label: 'En cours',   color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    TERMINE:   { label: 'Terminé',    color: 'bg-green-50 text-green-700 border-green-200' },
    REPORTE:   { label: 'Reporté',    color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    ANNULE:    { label: 'Annulé',     color: 'bg-red-50 text-red-700 border-red-200' },
};

/**
 * Vrai si un RDV PROGRAMME a dépassé son heure
 */
export const isOverdue = (apt) =>
    apt.statut === 'PROGRAMME' && new Date(apt.date_heure) < new Date();
