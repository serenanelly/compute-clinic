import PropTypes from 'prop-types';
import { DashBoard } from '../../../GlobalComponents/DashBoard.jsx';
import { cashierNavLink } from '../cashierNavLink.js';
import { CashierNavBar } from '../CashierNavBar.jsx';
import { CASHIER_COLORS } from './cashierTheme.js';

/**
 * Layout caissier unifié : sidebar + barre supérieure + zone de contenu cohérente.
 */
export function CashierLayout({ children }) {
  return (
    <DashBoard linkList={cashierNavLink} requiredRole="caissier" requiredFunctionalService="CAISSE">
      <div
        className="flex min-h-screen flex-col"
        style={{ backgroundColor: CASHIER_COLORS.background }}
      >
        <CashierNavBar />
        <main className="flex-1 px-5 py-5 sm:px-6 sm:py-6" role="main">
          {children}
        </main>
      </div>
    </DashBoard>
  );
}

CashierLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default CashierLayout;
