import { useEffect, useState } from 'react';
import { Tooltip } from 'antd';
import { Wallet } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from '../../GlobalComponents/AppHeader.jsx';
import { getCashierPageTitle } from './components/cashierPageTitles.js';
import { getCaisseOuverte } from '../../services/caissierApi.js';
import { formatFcfa } from './components/cashierTheme.js';

export function CashierNavBar() {
  const location = useLocation();
  const [caisseOuverte, setCaisseOuverte] = useState(null);

  useEffect(() => {
    getCaisseOuverte()
      .then((res) => setCaisseOuverte(res))
      .catch(() => setCaisseOuverte(null));
  }, [location.pathname]);

  // Badge d'état de caisse — spécifique au caissier, passé en rightSlot du header partagé.
  const caisseBadge = caisseOuverte?.ouverte ? (
    <Tooltip
      title={(
        <div className="text-xs leading-relaxed">
          <div>{caisseOuverte.caisse?.libelle_periode || 'Période active'}</div>
          <div>Ouverture : {formatFcfa(caisseOuverte.caisse?.solde_ouverture)}</div>
          <div>Solde théorique : {formatFcfa(caisseOuverte.caisse?.solde_theorique)}</div>
        </div>
      )}
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white border border-white/30">
        <Wallet size={12} />
        Caisse · {formatFcfa(caisseOuverte.caisse?.solde_ouverture)}
      </span>
    </Tooltip>
  ) : (
    <Tooltip title="Ouvrez la caisse journalière pour enregistrer les opérations">
      <span className="inline-flex items-center rounded-full bg-amber-400/90 px-2.5 py-1 text-xs font-semibold text-amber-950 border border-amber-300/50">
        Caisse fermée
      </span>
    </Tooltip>
  );

  return (
    <AppHeader
      subtitle="Caisse"
      titleResolver={getCashierPageTitle}
      rightSlot={caisseBadge}
    />
  );
}
