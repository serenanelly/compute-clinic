import { LayoutGrid, UserRound, Stethoscope, Calendar, FlaskConical, BedDouble, HelpCircle } from 'lucide-react';
import { AppRoutesPaths } from "../../../Router/appRouterPaths.js";

export const specialistNavLink = [
    {
        name: "Salle d'attente",
        icon: LayoutGrid,
        link: AppRoutesPaths.specialistWaitingRoom,
    },
    {
        name: "Mes Patients",
        icon: UserRound,
        link: AppRoutesPaths.specialistPatientList,
    },
    {
        name: "Consultation",
        icon: Stethoscope,
        link: AppRoutesPaths.specialistConsultationList,
    },
    {
        name: "Rendez-vous",
        icon: Calendar,
        link: AppRoutesPaths.specialistAppointments,
    },
    {
        name: "Examens",
        icon: FlaskConical,
        link: AppRoutesPaths.specialistExamList,
    },
    {
        name: "Hospitalisés",
        icon: BedDouble,
        link: AppRoutesPaths.specialistHospitalized,
    },
    {
        name: "Aide",
        icon: HelpCircle,
        link: AppRoutesPaths.helpCenterPage,
    },
];
