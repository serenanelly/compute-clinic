import PropTypes from 'prop-types';

/**
 * En-tête de page unifié — hiérarchie visuelle, actions à droite (loi de Fitts, cohérence).
 */
export function CashierPageHeader({ title, subtitle, icon: Icon, actions, badge, className = '' }) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1 m-0">
          Module Caisse
        </p>
        <div className="flex items-start gap-3">
          {Icon && (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-end/10 text-primary-start"
              aria-hidden
            >
              <Icon size={22} strokeWidth={2} />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 m-0 leading-tight">{title}</h1>
              {badge}
            </div>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1.5 mb-0 leading-relaxed max-w-2xl">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}

CashierPageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  icon: PropTypes.elementType,
  actions: PropTypes.node,
  badge: PropTypes.node,
  className: PropTypes.string,
};

export default CashierPageHeader;
