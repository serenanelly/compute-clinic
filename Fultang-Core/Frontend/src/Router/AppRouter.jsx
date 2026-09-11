import React from "react"
import { Route, Routes } from "react-router-dom";
import { Loading } from "../GlobalComponents/Loading.jsx";
import { AppRoutesPaths } from "./appRouterPaths.js";





export function AppRoute() {
    const LoginPage = React.lazy(async () => ({ default: (await import("../Pages/Authentication/Login.jsx")).LoginPage }));
    const PlatformAdminLoginPage = React.lazy(async () => ({ default: (await import("../Pages/PlatformAdmin/PlatformAdminLogin.jsx")).PlatformAdminLogin }));
    const PlatformAdminDashboardPage = React.lazy(async () => ({ default: (await import("../Pages/PlatformAdmin/PlatformAdminDashboard.jsx")).PlatformAdminDashboard }));
    const PlatformAdminEstablishmentsPage = React.lazy(async () => ({ default: (await import("../Pages/PlatformAdmin/Establishments/EstablishmentsListPage.jsx")).EstablishmentsListPage }));
    const PlatformAdminTenantDetailPage = React.lazy(async () => ({ default: (await import("../Pages/PlatformAdmin/Establishments/EstablishmentDetailPage.jsx")).EstablishmentDetailPage }));
    const PlatformAdminCreateTenantPage = React.lazy(async () => ({ default: (await import("../Pages/PlatformAdmin/CreateTenant/CreateTenantWizard.jsx")).CreateTenantWizard }));
    const PlatformAdminLogsPage = React.lazy(async () => ({ default: (await import("../Pages/PlatformAdmin/Logs/AdminLogsPage.jsx")).AdminLogsPage }));
    const ForgottenPage = React.lazy(async () => ({ default: (await import("../Pages/Authentication/ForgottenPassword.jsx")).ForgottenPassword }));
    const LandingPage = React.lazy(async () => ({ default: (await import("../Pages/LandingPage/LandingPage.jsx")).LandingPage }));
    const NurseWaitingRoomPage = React.lazy(async () => ({ default: (await import("../Pages/Nurse/WaitingRoom.jsx")).WaitingRoom }));
    const NurseAppointmentsPage = React.lazy(async () => ({ default: (await import("../Pages/Nurse/NurseAppointments.jsx")).NurseAppointments }));
    const NurseExamsPage = React.lazy(async () => ({ default: (await import("../Pages/Nurse/NurseExams.jsx")).NurseExams }));
    const NurseHospitalizationsPage = React.lazy(async () => ({ default: (await import("../Pages/Nurse/NurseHospitalizations.jsx")).NurseHospitalizations }));
    const PatientManagementPage = React.lazy(async () => ({ default: (await import("../Pages/Nurse/PatientManagement.jsx")).PatientManagement }));
    const NotFoundPage = React.lazy(async () => ({ default: (await import("../GlobalComponents/NotFound.jsx")).NotFound }));
    const NurseMedicalStaffsPage = React.lazy(async () => ({ default: (await import("../Pages/Nurse/MedicalStaffs.jsx")).MedicalStaffs }));
    const ConsultationHistoryPage = React.lazy(async () => ({ default: (await import("../Pages/Nurse/ConsultationHistory.jsx")).ConsultationHistory }));
    const HelpCenterPage = React.lazy(async () => ({ default: (await import("../Pages/HelpCenter/HelpCenter.jsx")).HelpCenter }));
    const PatientDetailsPage = React.lazy(async () => ({ default: (await import("../Pages/Nurse/PatientParameters.jsx")).PatientParameters }));

    const ReceptionistPage = React.lazy(async () => ({ default: (await import("../Pages/Receptionist/Receptionist.jsx")).Receptionist }));
    /*const LaboratoryAssistantPage = React.lazy(async () => ({default: (await import("../Pages/Laboratory/LaboratoryAssistant.jsx")).LaboratoryAssistant}));*/
    const CashierPage = React.lazy(async () => ({ default: (await import("../Pages/Cashier/Cashier.jsx")).Cashier }));
    const FinancialReport = React.lazy(async () => ({ default: (await import("../Pages/Cashier/FinancialReport.jsx")).CashierFinancialReport }));
    const FinancialHistory = React.lazy(async () => ({ default: (await import("../Pages/Cashier/FinancialHistory.jsx")).default }));
    const HelpCenter = React.lazy(async () => ({ default: (await import("../GlobalComponents/HelpCenter.jsx")).HelpCenter }));
    const CashierHelpCenterPage = React.lazy(async () => ({ default: (await import("../Pages/Cashier/CashierHelpCenter.jsx")).CashierHelpCenter }));
    const AdminHomePage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminHomePage.jsx")).AdminHomePage }));
    const AdminServicesPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminServicesPage.jsx")).AdminServicesPage }));
    const AdminPersonnelPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminPersonnelPage.jsx")).AdminPersonnelPage }));
    const AdminChambresPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminChambresPage.jsx")).AdminChambresPage }));
    const ReceptionistMedicalStaffsPage = React.lazy(async () => ({ default: (await import("../Pages/Receptionist/ReceptionistMedicalStaffs.jsx")).ReceptionistMedicalStaffs }));
    const ReceptionistAppointmentsPage = React.lazy(async () => ({ default: (await import("../Pages/Receptionist/Appointments.jsx")).Appointments }));
    const ReceptionistConsultationsPage = React.lazy(async () => ({ default: (await import("../Pages/Receptionist/Consultations.jsx")).Consultations }));
    const HospitalizedPatientsPage = React.lazy(async () => ({ default: (await import("../Pages/Receptionist/HospitalizedPatients.jsx")).HospitalizedPatients }));
    const AdminPatientListPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminPatientList.jsx")).AdminPatientList }));
    const AddMedicalStaffPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AddMedicalStaff.jsx")).AddMedicalStaff }));
    const AdminMedicalStaffListPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminMedicalStaffList.jsx")).AdminMedicalStaffList }));
    const AdminConsultationListPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminConsultationList.jsx")).AdminConsultationList }));
    const AdminAppointmentsListPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminAppointmentsList.jsx")).AdminAppointmentsList }));
    const AddExamPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AddExam.jsx")).AddExam }));
    const AdminExamsListPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminExamsList.jsx")).AdminExamsList }));
    const AddDrugPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AddDrug.jsx")).AddDrug }));
    const AdminDrugsListPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminDrugsList.jsx")).AdminDrugsList }));
    const AdminHospitalRoomPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminHospitalRooms.jsx")).AdminHospitalRooms }));
    const AdminFinancialReportsPage = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/AdminFinancialReports.jsx")).AdminFinancialReports }));
    const AdminConsultationDetails = React.lazy(async () => ({ default: (await import("../Pages/AdminViews/ConsultationDetails.jsx")).ConsultationDetails }));
    /*const CurrentExamsLaboratoryPage = React.lazy(async () => ({default: (await import("../Pages/Laboratory/CurrentExams.jsx")).CurrentExams}));
    const ExamsHistoryLaboratoryPage = React.lazy(async () => ({default: (await import("../Pages/Laboratory/ExamsHistory.jsx")).ExamHistory}));*/

    const DoctorAppointments = React.lazy(async () => ({ default: (await import("../Pages/Doctor/AppointmentList.jsx")).AppointmentList }));
    const DoctorWaitingRoom = React.lazy(async () => ({ default: (await import("../Pages/Doctor/DoctorWaitingRoom.jsx")).DoctorWaitingRoom }));
    const DoctorConsultation = React.lazy(async () => ({ default: (await import("../Pages/Doctor/ConsultationPage.jsx")).ConsultationPage }));
    const DoctorPatientList = React.lazy(async () => ({ default: (await import("../Pages/Doctor/DoctorPatientList.jsx")).DoctorPatientList }));
    const DoctorPatientMedicalFolder = React.lazy(async () => ({ default: (await import("../Pages/Doctor/DoctorPatientMedicalFolder.jsx")).DoctorPatientMedicalFolder }));
    const DoctorConsultationHistory = React.lazy(async () => ({ default: (await import("../Pages/Doctor/DoctorConsultationHistory.jsx")).DoctorConsultationHistory }));
    const DoctorExamsList = React.lazy(async () => ({ default: (await import("../Pages/Doctor/DoctorExamsList.jsx")).DoctorExamsList }));
    
    // Specialist components
    const SpecialistWaitingRoom = React.lazy(async () => ({ default: (await import("../Pages/Specialist/SpecialistWaitingRoom.jsx")).SpecialistWaitingRoom }));
    const SpecialistPatientList = React.lazy(async () => ({ default: (await import("../Pages/Specialist/SpecialistPatientList.jsx")).SpecialistPatientList }));
    const SpecialistPatientDossier = React.lazy(async () => ({ default: (await import("../Pages/Specialist/SpecialistPatientDossier.jsx")).SpecialistPatientDossier }));
    const SpecialistConsultationPage = React.lazy(async () => ({ default: (await import("../Pages/Specialist/SpecialistConsultationPage.jsx")).SpecialistConsultationPage }));
    const SpecialistConsultationHistory = React.lazy(async () => ({ default: (await import("../Pages/Specialist/SpecialistConsultationHistory.jsx")).SpecialistConsultationHistory }));
    const SpecialistExamsList = React.lazy(async () => ({ default: (await import("../Pages/Specialist/SpecialistExamsList.jsx")).SpecialistExamsList }));
    const SpecialistHospitalizedPatients = React.lazy(async () => ({ default: (await import("../Pages/Specialist/SpecialistHospitalizedPatients.jsx")).SpecialistHospitalizedPatients }));
    const SpecialistAppointments = React.lazy(async () => ({ default: (await import("../Pages/Specialist/SpecialistAppointments.jsx")).SpecialistAppointments }));

    const LaboratoryAnalyse = React.lazy(async () => ({ default: (await import("../Pages/Laboratory/LaboratoryAnalyse.jsx")).LaboratoryAnalyse }));
    const LaboratoryResults = React.lazy(async () => ({ default: (await import("../Pages/Laboratory/LaboratoryResults.jsx")).LaboratoryResults }));
    const LaboratoryHistory = React.lazy(async () => ({ default: (await import("../Pages/Laboratory/LaboratoryHistory.jsx")).LaboratoryHistory }));

    // ComptaMatiere (Comptable Matière) components
    const ComptaMatiereDashboard = React.lazy(async () => ({ default: (await import("../Pages/ComptaMatiere/Accountant.jsx")).Accountant }));
    const ComptaMatiereEmitNeed = React.lazy(async () => ({ default: (await import("../Pages/ComptaMatiere/EmitNeed.jsx")).EmitNeed }));
    const ComptaMatiereRegisterDelivery = React.lazy(async () => ({ default: (await import("../Pages/ComptaMatiere/RegisterDelivery.jsx")).RegisterDelivery }));
    const ComptaMatiereDeliveryList = React.lazy(async () => ({ default: (await import("../Pages/ComptaMatiere/DeliveryList.jsx")).DeliveryList }));
    const ComptaMatiereRegisterOutput = React.lazy(async () => ({ default: (await import("../Pages/ComptaMatiere/RegisterOutput.jsx")).RegisterOutput }));
    const ComptaMatiereReports = React.lazy(async () => ({ default: (await import("../Pages/ComptaMatiere/AccountantReports.jsx")).AccountantReports }));
    const ComptaMatiereMaterialList = React.lazy(async () => ({ default: (await import("../Pages/ComptaMatiere/MaterialList.jsx")).MaterialList }));
    const ComptaMatiereOutputList = React.lazy(async () => ({ default: (await import("../Pages/ComptaMatiere/OutputList.jsx")).OutputList }));
    const ComptaMatiereInventoryArchives = React.lazy(async () => ({ default: (await import("../Pages/ComptaMatiere/AccountantInventoryArchives.jsx")).AccountantInventoryArchives }));

    // Director components
    const DirectorDashboard = React.lazy(async () => ({ default: (await import("../Pages/Director/Director.jsx")).Director }));
    const DirectorReports = React.lazy(async () => ({ default: (await import("../Pages/Director/DirectorReports.jsx")).DirectorReports }));
    const DirectorAudit = React.lazy(async () => ({ default: (await import("../Pages/Director/DirectorAudit.jsx")).DirectorAudit }));

    // Pharmacist components
    const PharmacistPrescriptions = React.lazy(async () => ({ default: (await import("../Pages/Pharmacist/PharmacistPrescriptions.jsx")).PharmacistPrescriptions }));
    const PharmacistDelivery = React.lazy(async () => ({ default: (await import("../Pages/Pharmacist/PharmacistDelivery.jsx")).PharmacistDelivery }));
    const PharmacistMedicationList = React.lazy(async () => ({ default: (await import("../Pages/Pharmacist/PharmacistMedicationList.jsx")).PharmacistMedicationList }));
    const PharmacistEmitNeed = React.lazy(async () => ({ default: (await import("../Pages/Pharmacist/PharmacistEmitNeed.jsx")).PharmacistEmitNeed }));
    const PharmacistDailySales = React.lazy(async () => ({ default: (await import("../Pages/Pharmacist/PharmacistDailySales.jsx")).PharmacistDailySales }));
    const PharmacistInventory = React.lazy(async () => ({ default: (await import("../Pages/Pharmacist/PharmacistInventory.jsx")).PharmacistInventory }));
    const PharmacistReports = React.lazy(async () => ({ default: (await import("../Pages/Pharmacist/PharmacistReports.jsx")).PharmacistReports }));

    // Old Pharmacy components
    const Pharmacy = React.lazy(async () => ({ default: (await import("../Pages/Pharmacy/Pharmacy.jsx")).Pharmacy }));
    const PharmacyNeeds = React.lazy(async () => ({ default: (await import("../Pages/Pharmacy/PharmacyNeeds.jsx")).PharmacyNeeds }));
    const PharmacyOperations = React.lazy(async () => ({ default: (await import("../Pages/Pharmacy/PharmacyOperations.jsx")).PharmacyOperations }));
    const PharmacyList = React.lazy(async () => ({ default: (await import("../Pages/Pharmacy/PharmacyList.jsx")).PharmacyList }));
    const PharmacyDashboardOld = React.lazy(async () => ({ default: (await import("../Pages/Pharmacy/PharmacyDashboard.jsx")).PharmacyDashboard }));

    // Accountant Module components (from prototype)
    const AccountantHomePage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Home/HomePage.jsx")).AccountantHomePage }));
    const ComptabilisationPage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Quittances/Comptabilisation.jsx")).ComptabilisationPage }));
    const QuittancesValideesPage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Quittances/QuittancesValidees.jsx")).QuittancesValideesPage }));
    const EcrituresComptablesPage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Ecritures/EcrituresComptables.jsx")).EcrituresComptablesPage }));
    const BalancePage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Balance/Balance.jsx")).BalancePage }));
    const PlanComptablePage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/PlanComptable/PlanComptable.jsx")).PlanComptablePage }));
    const ExercicesBudgetsPage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Exercices/ExercicesBudgets.jsx")).ExercicesBudgetsPage }));
    const RapportsPage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Rapports/Rapports.jsx")).RapportsPage }));
    const AuditLogsPage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Audit/AuditLogs.jsx")).AuditLogsPage }));
    const AchatsGestionPage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Achats/AchatsGestion.jsx")).AchatsGestionPage }));
    const FournisseursPage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Fournisseurs/Fournisseurs.jsx")).FournisseursPage }));
    const ChequesPage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Cheques/Cheques.jsx")).ChequesPage }));
    const PrestationsPage = React.lazy(async () => ({ default: (await import("../Pages/Accountant/Prestations/Prestations.jsx")).PrestationsPage }));

    // Cashier Module components
    const CashierHomePage = React.lazy(async () => ({ default: (await import("../Pages/Cashier/Cashier.jsx")).Cashier }));
    const CaisseJournalierePage = React.lazy(async () => ({ default: (await import("../Pages/Cashier/CaisseJournaliere.jsx")).CaisseJournalierePage }));
    const DecaissementsPage = React.lazy(async () => ({ default: (await import("../Pages/Cashier/DecaissementsExécution.jsx")).DecaissementsPage }));
    const CashierQuittancesValideesPage = React.lazy(async () => ({ default: (await import("../Pages/Cashier/QuittancesValidees.jsx")).QuittancesValideesPage }));



    return (
        <React.Suspense fallback={<Loading />}>
            <Routes>
                <Route path={AppRoutesPaths.welcomePage} element={<LandingPage />} />
                <Route path={AppRoutesPaths.loginPage} element={<LoginPage />} />
                <Route path={AppRoutesPaths.forgottenPasswordPage} element={<ForgottenPage />} />
                <Route path={AppRoutesPaths.platformAdminLoginPage} element={<PlatformAdminLoginPage />} />
                <Route path={AppRoutesPaths.platformAdminDashboardPage} element={<PlatformAdminDashboardPage />} />
                <Route path={AppRoutesPaths.platformAdminEstablishmentsPage} element={<PlatformAdminEstablishmentsPage />} />
                <Route path={AppRoutesPaths.platformAdminCreateTenantPage} element={<PlatformAdminCreateTenantPage />} />
                <Route path={AppRoutesPaths.platformAdminTenantDetailPage} element={<PlatformAdminTenantDetailPage />} />
                <Route path={AppRoutesPaths.platformAdminLogsPage} element={<PlatformAdminLogsPage />} />
                <Route path={AppRoutesPaths.nursePage} element={<NurseWaitingRoomPage />} />
                <Route path={AppRoutesPaths.nurseWaitingRoomPage} element={<NurseWaitingRoomPage />} />
                <Route path={AppRoutesPaths.nursePatientManagementPage} element={<PatientManagementPage />} />
                <Route path={AppRoutesPaths.nurseAppointmentsPage} element={<NurseAppointmentsPage />} />
                <Route path={AppRoutesPaths.nurseExamsPage} element={<NurseExamsPage />} />
                <Route path={AppRoutesPaths.nurseHospitalizationsPage} element={<NurseHospitalizationsPage />} />

                <Route path={AppRoutesPaths.consultationHistoryPage} element={<ConsultationHistoryPage />} />
                <Route path={AppRoutesPaths.helpCenterPage} element={<HelpCenter />} />
                <Route path={AppRoutesPaths.patientDetailsPage} element={<PatientDetailsPage />} />
                <Route path={AppRoutesPaths.cashierPage} element={<CashierPage />} />
                <Route path={AppRoutesPaths.financialHistory} element={<FinancialHistory />} />
                <Route path={AppRoutesPaths.financialReport} element={<FinancialReport />} />
                <Route path={AppRoutesPaths.helpCenter} element={<CashierHelpCenterPage />} />
                <Route path={AppRoutesPaths.receptionistPage} element={<ReceptionistPage />} />
                {/*<Route path={AppRoutesPaths.laboratoryAssistantPage} element={<LaboratoryAssistantPage />} />*/}
                <Route path={AppRoutesPaths.adminHomePage} element={<AdminHomePage />} />
                <Route path={AppRoutesPaths.adminServicesPage} element={<AdminServicesPage />} />
                <Route path={AppRoutesPaths.adminPersonnelPage} element={<AdminPersonnelPage />} />
                <Route path={AppRoutesPaths.adminChambresPage} element={<AdminChambresPage />} />
                <Route path={AppRoutesPaths.receptionistMedicalStaffsPage} element={<ReceptionistMedicalStaffsPage />} />
                <Route path={AppRoutesPaths.appointmentsPage} element={<ReceptionistAppointmentsPage />} />
                <Route path={AppRoutesPaths.receptionistConsultationsPage} element={<ReceptionistConsultationsPage />} />
                <Route path={AppRoutesPaths.hospitalizedPatientsPage} element={<HospitalizedPatientsPage />} />
                <Route path={AppRoutesPaths.adminPatientListPage} element={<AdminPatientListPage />} />
                <Route path={AppRoutesPaths.addMedicalStaff} element={<AddMedicalStaffPage />} />
                <Route path={AppRoutesPaths.adminMedicalStaffListPage} element={<AdminMedicalStaffListPage />} />
                <Route path={AppRoutesPaths.adminConsultationListPage} element={<AdminConsultationListPage />} />
                <Route path={AppRoutesPaths.adminAppointmentsListPage} element={<AdminAppointmentsListPage />} />
                <Route path={AppRoutesPaths.addExam} element={<AddExamPage />} />
                <Route path={AppRoutesPaths.adminExamsListPage} element={<AdminExamsListPage />} />
                <Route path={AppRoutesPaths.addDrug} element={<AddDrugPage />} />
                <Route path={AppRoutesPaths.adminDrugsListPage} element={<AdminDrugsListPage />} />
                <Route path={AppRoutesPaths.adminHospitalRoomPage} element={<AdminHospitalRoomPage />} />
                <Route path={AppRoutesPaths.adminFinancialReportsPage} element={<AdminFinancialReportsPage />} />
                <Route path={AppRoutesPaths.adminConsultationDetailsPage} element={<AdminConsultationDetails />} />
                {/*<Route path={AppRoutesPaths.laboratoryHistory} element={<ExamsHistoryLaboratoryPage />} />*/}
                {/*<Route path={AppRoutesPaths.laboratoryCurrent} element={<CurrentExamsLaboratoryPage />} />*/}
                <Route path={AppRoutesPaths.financialHistory} element={<FinancialHistory />} />
                <Route path={AppRoutesPaths.notFound} element={<NotFoundPage />} />

                <Route path={AppRoutesPaths.doctorAppointment} element={<DoctorAppointments />} />
                <Route path={AppRoutesPaths.doctorPage} element={<DoctorWaitingRoom />} />
                <Route path="/doctor/consultation" element={<DoctorConsultation />} />
                <Route path={AppRoutesPaths.doctorPatientList} element={<DoctorPatientList />} />
                <Route path={AppRoutesPaths.doctorPatientMedicalFolderPage} element={<DoctorPatientMedicalFolder />} />
                {/* doctorConsultationList (/doctor/consultation-list) et doctorConsultationHistory pointent vers la même page */}
                <Route path={AppRoutesPaths.doctorConsultationList} element={<DoctorConsultationHistory />} />
                <Route path={AppRoutesPaths.doctorConsultationHistory} element={<DoctorConsultationHistory />} />
                <Route path={AppRoutesPaths.doctorExamList} element={<DoctorExamsList />} />

                {/* Specialist Routes */}
                <Route path={AppRoutesPaths.specialistPage} element={<SpecialistWaitingRoom />} />
                <Route path={AppRoutesPaths.specialistWaitingRoom} element={<SpecialistWaitingRoom />} />
                <Route path={AppRoutesPaths.specialistPatientList} element={<SpecialistPatientList />} />
                <Route path={AppRoutesPaths.specialistPatientDossier} element={<SpecialistPatientDossier />} />
                <Route path="/specialist/consultation" element={<SpecialistConsultationPage />} />
                <Route path={AppRoutesPaths.specialistConsultationList} element={<SpecialistConsultationHistory />} />
                <Route path={AppRoutesPaths.specialistExamList} element={<SpecialistExamsList />} />
                <Route path={AppRoutesPaths.specialistHospitalized} element={<SpecialistHospitalizedPatients />} />
                <Route path={AppRoutesPaths.specialistAppointments} element={<SpecialistAppointments />} />

                <Route path={AppRoutesPaths.laboratoryAnalyse} element={<LaboratoryAnalyse />} />
                <Route path={AppRoutesPaths.laboratoryResults} element={<LaboratoryResults />} />
                <Route path={AppRoutesPaths.laboratoryHistory} element={<LaboratoryHistory />} />

                {/* ComptaMatiere (Comptable Matière) Routes */}
                <Route path={AppRoutesPaths.comptaMatiereDashboard} element={<ComptaMatiereDashboard />} />
                <Route path={AppRoutesPaths.comptaMatiereEmitNeed} element={<ComptaMatiereEmitNeed />} />
                <Route path={AppRoutesPaths.comptaMatiereRegisterDelivery} element={<ComptaMatiereRegisterDelivery />} />
                <Route path={AppRoutesPaths.comptaMatiereDeliveryList} element={<ComptaMatiereDeliveryList />} />
                <Route path={AppRoutesPaths.comptaMatiereRegisterOutput} element={<ComptaMatiereRegisterOutput />} />
                <Route path={AppRoutesPaths.comptaMatiereReports} element={<ComptaMatiereReports />} />
                <Route path={AppRoutesPaths.comptaMatiereMaterialList} element={<ComptaMatiereMaterialList />} />
                <Route path={AppRoutesPaths.comptaMatiereOutputList} element={<ComptaMatiereOutputList />} />
                <Route path={AppRoutesPaths.comptaMatiereInventoryArchives} element={<ComptaMatiereInventoryArchives />} />

                {/* Director Routes */}
                <Route path={AppRoutesPaths.directorDashboard} element={<DirectorDashboard />} />
                <Route path={AppRoutesPaths.directorReports} element={<DirectorReports />} />
                <Route path={AppRoutesPaths.directorAudit} element={<DirectorAudit />} />

                {/* Pharmacist Routes */}
                <Route path={AppRoutesPaths.pharmacistPrescriptions} element={<PharmacistPrescriptions />} />
                <Route path={AppRoutesPaths.pharmacistDelivery} element={<PharmacistDelivery />} />
                <Route path={AppRoutesPaths.pharmacistMedicationList} element={<PharmacistMedicationList />} />
                <Route path={AppRoutesPaths.pharmacistEmitNeed} element={<PharmacistEmitNeed />} />
                <Route path={AppRoutesPaths.pharmacistDailySales} element={<PharmacistDailySales />} />
                <Route path={AppRoutesPaths.pharmacistInventory} element={<PharmacistInventory />} />
                <Route path={AppRoutesPaths.pharmacistReports} element={<PharmacistReports />} />

                {/* Old Pharmacy Routes */}
                <Route path={AppRoutesPaths.pharmacyHome} element={<Pharmacy />} />
                <Route path={AppRoutesPaths.pharmacyNeeds} element={<PharmacyNeeds />} />
                <Route path={AppRoutesPaths.pharmacyOperations} element={<PharmacyOperations />} />
                <Route path={AppRoutesPaths.pharmacyList} element={<PharmacyList />} />
                <Route path={AppRoutesPaths.pharmacyDashboard} element={<PharmacyDashboardOld><Pharmacy /></PharmacyDashboardOld>} />

                {/* Accountant Module Routes (from prototype) */}
                <Route path={AppRoutesPaths.accountantHome} element={<AccountantHomePage />} />
                <Route path={AppRoutesPaths.accountantQuittancesValidees} element={<ComptabilisationPage />} />
                <Route path={AppRoutesPaths.accountantComptabilisation} element={<ComptabilisationPage />} />
                <Route path={AppRoutesPaths.accountantSaisieEcriture} element={<EcrituresComptablesPage defaultTab="journal" />} />
                <Route path={AppRoutesPaths.accountantEcritures} element={<EcrituresComptablesPage defaultTab="journal" />} />
                <Route path="/accountant/grand-livre" element={<EcrituresComptablesPage defaultTab="grand_livre" />} />
                <Route path={AppRoutesPaths.accountantAchats} element={<AchatsGestionPage />} />
                <Route path={AppRoutesPaths.accountantBalance} element={<BalancePage />} />
                <Route path={AppRoutesPaths.accountantPlanComptable} element={<PlanComptablePage />} />
                <Route path={AppRoutesPaths.accountantExercices} element={<ExercicesBudgetsPage />} />
                <Route path={AppRoutesPaths.accountantRapports} element={<RapportsPage />} />
                <Route path={AppRoutesPaths.accountantAuditLog} element={<AuditLogsPage />} />
                <Route path={AppRoutesPaths.accountantFournisseurs} element={<FournisseursPage />} />
                <Route path={AppRoutesPaths.accountantCheques} element={<ChequesPage />} />
                <Route path={AppRoutesPaths.accountantPrestations} element={<PrestationsPage />} />

                {/* Cashier Module Routes */}
                <Route path={AppRoutesPaths.cashierCaisseQuotidienne} element={<CaisseJournalierePage />} />
                <Route path={AppRoutesPaths.cashierDecaissements} element={<DecaissementsPage />} />
                <Route path={AppRoutesPaths.cashierQuittancesValidees} element={<CashierQuittancesValideesPage />} />

            </Routes>
        </React.Suspense>
    )
}
