import { AppHeader } from '../../GlobalComponents/AppHeader.jsx';

export function PharmacyNavbar() {
  return <AppHeader subtitle="Pharmacie" title="Pharmacien" />;
}

/** Alias pour imports existants (PharmacyNavBar vs PharmacyNavbar). */
export { PharmacyNavbar as PharmacyNavBar };

export default PharmacyNavbar;
