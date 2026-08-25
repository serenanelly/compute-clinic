import { LayoutGrid, UserRound, Stethoscope, Calendar, FlaskConical, History, HelpCircle } from 'lucide-react';
import { AppRoutesPaths } from "../../../Router/appRouterPaths.js";

export const doctorNavLink = [
    {
        name: "Salle d'attente",
        icon: LayoutGrid,
        link: AppRoutesPaths.doctorPage,
    },
    {
        name: "Mes Patients",
        icon: UserRound,
        link: AppRoutesPaths.doctorPatientList,
    },
    {
        name: "Consultations",
        icon: Stethoscope,
        link: AppRoutesPaths.doctorConsultationList,
    },
    {
        name: "Rendez-vous",
        icon: Calendar,
        link: AppRoutesPaths.doctorAppointment,
    },
    {
        name: "Examens",
        icon: FlaskConical,
        link: AppRoutesPaths.doctorExamList,
    },
    {
        name: "Historique",
        icon: History,
        link: AppRoutesPaths.doctorConsultationHistory,
    },
    {
        name: "Aide",
        icon: HelpCircle,
        link: AppRoutesPaths.helpCenterPage,
    },
];