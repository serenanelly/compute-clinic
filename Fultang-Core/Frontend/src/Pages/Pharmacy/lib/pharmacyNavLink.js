import { ClipboardList, FileText, LayoutDashboard, List, Settings } from 'lucide-react';
import { AppRoutesPaths } from '../../../Router/appRouterPaths.js';

export const pharmacyNavLink = [
  {
    name: 'Prescriptions',
    icon: FileText,
    link: AppRoutesPaths.pharmacyHome,
  },
  {
    name: 'Besoins matériel',
    icon: ClipboardList,
    link: AppRoutesPaths.pharmacyNeeds,
  },
  {
    name: 'Opérations',
    icon: Settings,
    link: AppRoutesPaths.pharmacyOperations,
  },
  {
    name: 'Liste médicaments',
    icon: List,
    link: AppRoutesPaths.pharmacyList,
  },
  {
    name: 'Tableau de bord',
    icon: LayoutDashboard,
    link: AppRoutesPaths.pharmacyDashboard,
  },
];
