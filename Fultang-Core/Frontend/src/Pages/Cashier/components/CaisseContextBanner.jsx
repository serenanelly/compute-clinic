import PropTypes from 'prop-types';
import { Wallet } from 'lucide-react';
import { formatFcfa } from './cashierTheme.js';

/**
 * Bandeau contexte caisse ouverte (ouverture, solde théorique).
 */
export function CaisseContextBanner({ caisse, className = '' }) {
  if (!caisse) return null;

  return (
    <div
      className={`mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary-end/30 bg-primary-end/5 px-4 py-3 ${className}`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-start/10 text-primary-start">
        <Wallet size={18} />
      </div>
      <div className="text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Caisse ouverte</span>
        {caisse.libelle_periode && (
          <span className="text-slate-500"> · {caisse.libelle_periode}</span>
        )}
        <div className="mt-0.5 text-slate-600">
          Ouverture : <strong className="text-slate-900">{formatFcfa(caisse.solde_ouverture)}</strong>
          {' · '}
          Solde théorique : <strong className="text-primary-start">{formatFcfa(caisse.solde_theorique)}</strong>
        </div>
      </div>
    </div>
  );
}

CaisseContextBanner.propTypes = {
  caisse: PropTypes.shape({
    libelle_periode: PropTypes.string,
    solde_ouverture: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    solde_theorique: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  className: PropTypes.string,
};

export default CaisseContextBanner;
