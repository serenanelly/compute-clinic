import { Calendar, Users, BedDouble, Stethoscope } from "lucide-react";
import { AppRoutesPaths as appRoutes } from "../../Router/appRouterPaths.js";
import { FaQuestionCircle } from "react-icons/fa";

export const receptionistNavLink = [
    {
        name: 'Liste des Patients',
        icon: Users,
        link: appRoutes.receptionistPage,
    },
    {
        name: 'Hospitalisations',
        icon: BedDouble,
        link: appRoutes.hospitalizedPatientsPage,
    },
    {
        name: 'Rendez-vous',
        icon: Calendar,
        link: appRoutes.appointmentsPage,
    },
    {
        name: 'Consultations',
        icon: Stethoscope,
        link: appRoutes.receptionistConsultationsPage,
    },
    {
        name: 'Aide',
        icon: FaQuestionCircle,
        link: appRoutes.helpCenterPage,
    }
];