import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { CustomDashboard } from "../../../GlobalComponents/CustomDashboard.jsx";
import { AppHeader } from "../../../GlobalComponents/AppHeader.jsx";
import { platformAdminNavLink } from "../platformAdminNavLink.js";
import { AppRoutesPaths } from "../../../Router/appRouterPaths.js";
import {
    createTenant,
    updateTenant,
    provisionTenant,
    provisionTenantAdmin,
    bulkSetTenantFunctionalServices,
} from "../../../services/platformAdminApi.js";
import { ProgressSteps } from "./ProgressSteps.jsx";
import { Step1BasicInfo } from "./Step1BasicInfo.jsx";
import { Step2TechnicalConfig } from "./Step2TechnicalConfig.jsx";
import { Step3ServicesConfig } from "./Step3ServicesConfig.jsx";
import { ProvisioningResultsSummary } from "./ProvisioningResultsSummary.jsx";

const STEPS = [
    { key: "basic-info", label: "Informations de base" },
    { key: "technical-config", label: "Configuration technique" },
    { key: "services", label: "Services" },
];

// Catalogue complet des services plateforme (bases de données) — toujours
// demandés en intégralité au provisionnement, voir spec backend.
const PLATFORM_SERVICE_CODES = ["PERSONNEL", "MEDICAL", "COMPTA", "COMPTA_MATIERE", "INFRASTRUCTURE"];

const INITIAL_FORM_DATA = {
    name: "",
    identifier: "",
    address: "",
    phone: "",
    email: "",
    adminNom: "",
    adminPrenom: "",
    adminEmail: "",
    allowClinicalAgentExport: true,
    services: [],
};

function extractFieldErrors(error) {
    const data = error?.response?.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
        return data;
    }
    return null;
}

/**
 * Assistant de création d'un tenant — conteneur en 3 étapes.
 *
 * Conserve l'intégralité des données saisies dans son propre state (jamais
 * dans les sous-composants d'étape), afin qu'un retour en arrière ne fasse
 * perdre aucune saisie déjà faite sur une étape suivante.
 *
 * Séquence de soumission finale (déclenchée depuis l'étape 3) :
 *   1. createTenant            — si échec (400), on affiche les erreurs de
 *      champ et on revient automatiquement à l'étape 1, rien d'autre n'est
 *      tenté.
 *   2. updateTenant             — allow_clinical_agent_export
 *   3. provisionTenant          — bases de données (les 5 services plateforme)
 *   4. provisionTenantAdmin     — compte administrateur + email de bienvenue
 *      (uniquement si la base PERSONNEL a atteint le statut ACTIVE)
 *   5. bulkSetTenantFunctionalServices — catalogue fonctionnel
 * Si l'étape 1 réussit mais qu'une étape suivante échoue (ex. Gateway
 * injoignable), le résumé final est tout de même affiché avec un
 * avertissement explicite — le tenant existe déjà, sa configuration peut
 * être complétée depuis sa page de détail.
 */
export function CreateTenantWizard() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [maxVisitedStep, setMaxVisitedStep] = useState(1);
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [fieldErrors, setFieldErrors] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [result, setResult] = useState(null); // { tenant, provisioningResults, incomplete, incompleteReason }

    const hasEnteredData = () =>
        formData.name.trim() !== "" ||
        formData.identifier.trim() !== "" ||
        formData.address.trim() !== "" ||
        formData.phone.trim() !== "" ||
        formData.email.trim() !== "" ||
        formData.adminNom.trim() !== "" ||
        formData.adminPrenom.trim() !== "" ||
        formData.adminEmail.trim() !== "";

    const handleCancel = () => {
        if (hasEnteredData()) {
            const confirmed = window.confirm(
                "Des informations ont déjà été saisies et seront perdues. Voulez-vous vraiment quitter ?"
            );
            if (!confirmed) return;
        }
        navigate(AppRoutesPaths.platformAdminEstablishmentsPage);
    };

    const updateFormData = (patch) => setFormData((prev) => ({ ...prev, ...patch }));

    const goToStep = (step) => {
        if (step <= maxVisitedStep) setCurrentStep(step);
    };

    const advanceToStep = (step) => {
        setCurrentStep(step);
        setMaxVisitedStep((prev) => Math.max(prev, step));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError("");
        setFieldErrors(null);

        let tenant;
        try {
            tenant = await createTenant({
                name: formData.name,
                identifier: formData.identifier,
                address: formData.address,
                phone: formData.phone,
                email: formData.email,
            });
        } catch (error) {
            console.error("Erreur lors de la création du tenant:", error);
            const errors = extractFieldErrors(error);
            if (errors) {
                setFieldErrors(errors);
            } else {
                setSubmitError("Impossible de créer l'établissement pour le moment. Veuillez réessayer.");
            }
            setSubmitting(false);
            advanceToStep(1);
            return;
        }

        let incomplete = false;
        let incompleteReason = "";
        let provisioningResults = [];

        try {
            if (!formData.allowClinicalAgentExport) {
                await updateTenant(tenant.id, { allow_clinical_agent_export: false });
            }
        } catch (error) {
            console.error("Erreur lors de la mise à jour de la configuration technique:", error);
            incomplete = true;
            incompleteReason = "Le paramètre de partage des données cliniques n'a pas pu être enregistré.";
        }

        try {
            const provisionResponse = await provisionTenant(tenant.id, PLATFORM_SERVICE_CODES);
            provisioningResults = Array.isArray(provisionResponse?.results) ? provisionResponse.results : [];
            if (provisioningResults.some((r) => r.status === "FAILED")) {
                incomplete = true;
                incompleteReason = incompleteReason || "Un ou plusieurs services n'ont pas pu être provisionnés.";
            }
        } catch (error) {
            console.error("Erreur lors du provisionnement du tenant:", error);
            incomplete = true;
            incompleteReason = "Le provisionnement des bases de données a échoué (problème réseau ou serveur).";
        }

        let adminCreated = false;
        let adminDetail = null;
        let emailSent = false;
        let emailDetail = null;

        const personnelReady = provisioningResults.some((r) => r.service === "PERSONNEL" && r.status === "ACTIVE");
        if (personnelReady) {
            try {
                const adminResponse = await provisionTenantAdmin(tenant.id, {
                    nom: formData.adminNom,
                    prenom: formData.adminPrenom,
                    email: formData.adminEmail,
                });
                adminCreated = Boolean(adminResponse?.admin_created);
                adminDetail = adminResponse?.admin_detail ?? null;
                emailSent = Boolean(adminResponse?.email_sent);
                emailDetail = adminResponse?.email_detail ?? null;
                if (!adminCreated || !emailSent) {
                    incomplete = true;
                    incompleteReason =
                        incompleteReason ||
                        "Le compte administrateur ou son email d'accès n'a pas pu être créé correctement.";
                }
            } catch (error) {
                console.error("Erreur lors de la création du compte administrateur:", error);
                incomplete = true;
                incompleteReason = incompleteReason || "Le compte administrateur n'a pas pu être créé.";
            }
        } else {
            incomplete = true;
            incompleteReason =
                incompleteReason ||
                "Le compte administrateur n'a pas pu être créé (base Personnel non provisionnée).";
        }

        try {
            await bulkSetTenantFunctionalServices(
                tenant.id,
                formData.services.map((s) => ({ code: s.code, enabled: s.enabled }))
            );
        } catch (error) {
            console.error("Erreur lors de l'enregistrement des services fonctionnels:", error);
            incomplete = true;
            incompleteReason = incompleteReason || "La configuration des services fonctionnels n'a pas pu être enregistrée.";
        }

        setResult({
            tenant,
            provisioningResults,
            incomplete,
            incompleteReason,
            adminCreated,
            adminDetail,
            emailSent,
            emailDetail,
        });
        setSubmitting(false);
        advanceToStep(3);
    };

    return (
        <CustomDashboard linkList={platformAdminNavLink} requiredRole="platform_admin" brandLabel="ComputeClinic Platform" showTenantIdentity={false}>
            <AppHeader subtitle="Platform Admin" title="Créer un établissement" />
            <div className="p-6 bg-gray-50 min-h-screen">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-3xl mx-auto"
                >
                    {!result && (
                        <div className="flex justify-end mb-3">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-red-500 transition-colors"
                            >
                                <X className="w-4 h-4" />
                                Annuler
                            </button>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 sm:p-8">
                        {!result && (
                            <div className="mb-8">
                                <ProgressSteps
                                    steps={STEPS}
                                    currentStep={currentStep}
                                    maxVisitedStep={maxVisitedStep}
                                    onStepClick={goToStep}
                                />
                            </div>
                        )}

                        {result ? (
                            <ProvisioningResultsSummary
                                tenant={result.tenant}
                                provisioningResults={result.provisioningResults}
                                incomplete={result.incomplete}
                                incompleteReason={result.incompleteReason}
                                adminCreated={result.adminCreated}
                                adminDetail={result.adminDetail}
                                emailSent={result.emailSent}
                                emailDetail={result.emailDetail}
                            />
                        ) : (
                            <>
                                {currentStep === 1 && (
                                    <Step1BasicInfo
                                        data={formData}
                                        onChange={updateFormData}
                                        fieldErrors={fieldErrors}
                                        onNext={() => advanceToStep(2)}
                                    />
                                )}
                                {currentStep === 2 && (
                                    <Step2TechnicalConfig
                                        allowClinicalAgentExport={formData.allowClinicalAgentExport}
                                        onChange={(value) => updateFormData({ allowClinicalAgentExport: value })}
                                        onNext={() => advanceToStep(3)}
                                        onBack={() => goToStep(1)}
                                    />
                                )}
                                {currentStep === 3 && (
                                    <Step3ServicesConfig
                                        services={formData.services}
                                        onServicesChange={(services) => updateFormData({ services })}
                                        onSubmit={handleSubmit}
                                        onBack={() => goToStep(2)}
                                        submitting={submitting}
                                        submitError={submitError}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </CustomDashboard>
    );
}

export default CreateTenantWizard;
