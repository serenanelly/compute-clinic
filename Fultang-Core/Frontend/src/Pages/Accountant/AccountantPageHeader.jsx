import PropTypes from 'prop-types';

export function AccountantPageHeader({ title, subtitle, icon: Icon, actions, badge, className = '' }) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1 m-0">
          Comptabilité financière
        </p>
        <div className="flex items-start gap-3">
          {Icon && (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1A73A3]/10 text-[#1A73A3]"
              aria-hidden
            >
              <Icon size={22} strokeWidth={2} />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-[#051161] m-0 leading-tight">{title}</h1>
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

AccountantPageHeader.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  icon: PropTypes.elementType,
  actions: PropTypes.node,
  badge: PropTypes.node,
  className: PropTypes.string,
};

export default AccountantPageHeader;
