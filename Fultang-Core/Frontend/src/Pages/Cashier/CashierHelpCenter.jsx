import { MdHelpOutline } from 'react-icons/md';
import { CashierLayout } from './components/CashierLayout.jsx';
import { CashierPageHeader } from './components/CashierPageHeader.jsx';
import { HelpCenterContent } from '../../GlobalComponents/HelpCenterContent.jsx';

export function CashierHelpCenter() {
  return (
    <CashierLayout>
      <CashierPageHeader
        icon={MdHelpOutline}
        title="Centre d'aide"
        subtitle="Guides, FAQ et support pour le module caissier."
      />
      <HelpCenterContent showBack={false} />
    </CashierLayout>
  );
}

export default CashierHelpCenter;
