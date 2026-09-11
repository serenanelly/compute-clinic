import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, MinusCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { AppRoutesPaths } from "../../../Router/appRouterPaths.js";

const STATUS_LABELS = {
    PERSONNEL: "Personnel",
    MEDICAL: "Médical",
    COMPTA: "Comptabilité financière",
    COMPTA_MATIERE: "Comptabilité matière",
    INFRASTRUCTURE: "Infrastructure",
};

function StatusRow({ result }) {
    const label = STATUS_LABELS[result.service] || result.service;

    if (result.status === "ACTIVE") {
        return (
            <li className="flex items-start gap-3 px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-emerald-600">Provisionné avec succès</p>
                </div>
            </li>
        );
    }

    if (result.status === "FAILED") {
        return (
            <li className="flex items-start gap-3 px-4 py-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-red-500">{result.detail || "Échec du provisionnement."}</p>
                </div>
            </li>
        );
    }

    return (
        <li className="flex items-start gap-3 px-4 py-3">
            <MinusCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-400">
                    {result.status} {result.detail ? `— ${result.detail}` : ""}
                </p>
            </div>
        </li>
    );
}

StatusRow.propTypes = {
    result: PropTypes.shape({
        service: PropTypes.string.isRequired,
        status: PropTypes.string.isRequired,
        detail: PropTypes.string,
    }).isRequired,
};

/**
 * Ligne de statut générique (succès/échec booléen) — même langage
 * d'icônes que StatusRow, utilisée pour le compte administrateur et
 * l'email d'accès (qui ne sont pas des résultats de provisionnement de
 * base de données mais suivent la même sémantique visuelle).
 */
function SimpleStatusRow({ label, success, successMessage, failureMessage }) {
    return (
        <li className="flex items-start gap-3 px-4 py-3">
            {success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div>
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className={`text-xs ${success ? "text-emerald-600" : "text-red-500"}`}>
                    {success ? successMessage : failureMessage || "Échec."}
                </p>
            </div>
        </li>
    );
}

SimpleStatusRow.propTypes = {
    label: PropTypes.string.isRequired,
    success: PropTypes.bool.isRequired,
    successMessage: PropTypes.string.isRequired,
    failureMessage: PropTypes.string,
};

/**
 * Résumé final après la séquence de création d'un tenant.
 *
 * Affiche explicitement le résultat PAR SERVICE du provisionnement — jamais
 * un message générique unique — car un échec partiel doit rester visible à
 * l'admin (exigence produit explicite).
 */
export function ProvisioningResultsSummary({
    tenant,
    provisioningResults,
    incomplete,
    incompleteReason,
    adminCreated,
    adminDetail,
    emailSent,
    emailDetail,
}) {
    return (
        <div className="flex flex-col gap-5">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                <p className="text-sm font-bold text-emerald-700">
                    Établissement {tenant?.name ? `« ${tenant.name} » ` : ""}créé
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                    Identifiant : {tenant?.identifier}
                </p>
            </div>

            {tenant?.establishment_url && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                            URL de l&apos;établissement
                        </p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{tenant.establishment_url}</p>
                    </div>
                    <a
                        href={tenant.establishment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-white font-bold px-4 py-2 rounded-lg bg-gradient-to-r from-primary-start to-primary-end whitespace-nowrap flex-shrink-0"
                    >
                        Ouvrir
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            )}

            {incomplete && (
                <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-700">
                            La configuration de l&apos;établissement est peut-être incomplète
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            {incompleteReason || "Une étape de la configuration a échoué après la création du tenant."}{" "}
                            Vous pouvez vérifier et corriger la configuration depuis la page de
                            l&apos;établissement — relancer le provisionnement ou les services n&apos;a
                            aucun effet destructif.
                        </p>
                    </div>
                </div>
            )}

            <div>
                <h4 className="text-sm font-bold text-gray-700 mb-2">Provisionnement des bases de données</h4>
                {provisioningResults.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucun résultat de provisionnement disponible.</p>
                ) : (
                    <ul className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                        {provisioningResults.map((result) => (
                            <StatusRow key={result.service} result={result} />
                        ))}
                    </ul>
                )}
            </div>

            <div>
                <h4 className="text-sm font-bold text-gray-700 mb-2">Accès administrateur</h4>
                <ul className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                    <SimpleStatusRow
                        label="Compte administrateur"
                        success={adminCreated}
                        successMessage="Créé avec succès"
                        failureMessage={adminDetail || "Le compte administrateur n'a pas pu être créé."}
                    />
                    <SimpleStatusRow
                        label="Email d'accès"
                        success={emailSent}
                        successMessage="Envoyé avec succès"
                        failureMessage={emailDetail || "L'email d'accès n'a pas pu être envoyé."}
                    />
                </ul>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Link
                    to={AppRoutesPaths.platformAdminEstablishmentsPage}
                    className="inline-flex items-center justify-center text-gray-600 font-bold px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                    Retour à la liste
                </Link>
                {tenant?.id && (
                    <Link
                        to={AppRoutesPaths.platformAdminTenantDetailPage.replace(":tenantId", tenant.id)}
                        className="inline-flex items-center justify-center text-white font-bold px-6 py-2.5 rounded-lg bg-gradient-to-r from-primary-start to-primary-end transition-opacity"
                    >
                        Voir l&apos;établissement
                    </Link>
                )}
            </div>
        </div>
    );
}

ProvisioningResultsSummary.propTypes = {
    tenant: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        identifier: PropTypes.string,
        establishment_url: PropTypes.string,
    }),
    provisioningResults: PropTypes.array.isRequired,
    incomplete: PropTypes.bool,
    incompleteReason: PropTypes.string,
    adminCreated: PropTypes.bool,
    adminDetail: PropTypes.string,
    emailSent: PropTypes.bool,
    emailDetail: PropTypes.string,
};

export default ProvisioningResultsSummary;
