import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { getTenantDatabases } from "../../../services/platformAdminApi.js";

const SERVICE_LABELS = {
    PERSONNEL: "Personnel",
    MEDICAL: "Médical",
    COMPTA: "Comptabilité financière",
    COMPTA_MATIERE: "Comptabilité matière",
    INFRASTRUCTURE: "Infrastructure",
};

const STATUS_STYLES = {
    ACTIVE: "bg-emerald-50 text-emerald-600",
    FAILED: "bg-red-50 text-red-500",
};

function StatusBadge({ status }) {
    return (
        <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                STATUS_STYLES[status] || "bg-gray-100 text-gray-500"
            }`}
        >
            {status}
        </span>
    );
}

StatusBadge.propTypes = {
    status: PropTypes.string.isRequired,
};

/**
 * Fiche technique d'un établissement : identifiant du tenant et état de
 * ses bases de données par service plateforme.
 *
 * Consomme GET /tenants/tenant-databases/?tenant={id} (déjà existant côté
 * backend depuis la Phase 1). N'affiche jamais `host`, `port`, ni
 * `secret_reference` — uniquement service / statut / nom de base /
 * dernière mise à jour.
 */
export function TechnicalSheet({ tenantId }) {
    const [databases, setDatabases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError("");
            try {
                const data = await getTenantDatabases(tenantId);
                if (!cancelled) setDatabases(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Erreur de chargement de la fiche technique du tenant:", error);
                if (!cancelled) setLoadError("Impossible de charger la fiche technique pour le moment.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [tenantId]);

    return (
        <div className="flex flex-col gap-4">
            <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Identifiant tenant</span>
                <p className="font-mono text-xs text-gray-600 mt-1 break-all">{tenantId}</p>
            </div>

            {loading ? (
                <div className="animate-pulse space-y-2">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                    ))}
                </div>
            ) : loadError ? (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-600">
                    {loadError}
                </div>
            ) : databases.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Aucune base de données enregistrée.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-400 border-b border-gray-100">
                                <th className="pb-2 font-semibold">Service</th>
                                <th className="pb-2 font-semibold">Statut</th>
                                <th className="pb-2 font-semibold">Base de données</th>
                                <th className="pb-2 font-semibold">Mise à jour</th>
                            </tr>
                        </thead>
                        <tbody>
                            {databases.map((db) => (
                                <tr key={db.id} className="border-b border-gray-50 last:border-0">
                                    <td className="py-2.5 font-medium text-gray-800">
                                        {SERVICE_LABELS[db.service] || db.service}
                                    </td>
                                    <td className="py-2.5">
                                        <StatusBadge status={db.status} />
                                    </td>
                                    <td className="py-2.5 text-gray-500 font-mono text-xs">{db.database_name}</td>
                                    <td className="py-2.5 text-gray-500">
                                        {db.updated_at ? new Date(db.updated_at).toLocaleString("fr-FR") : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

TechnicalSheet.propTypes = {
    tenantId: PropTypes.string.isRequired,
};

export default TechnicalSheet;
