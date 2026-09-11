import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ScrollText, Filter } from "lucide-react";
import { CustomDashboard } from "../../../GlobalComponents/CustomDashboard.jsx";
import { AppHeader } from "../../../GlobalComponents/AppHeader.jsx";
import { platformAdminNavLink } from "../platformAdminNavLink.js";
import { getAdminLogs, getAllTenants } from "../../../services/platformAdminApi.js";

const ACTION_OPTIONS = [
    { value: "", label: "Tous" },
    { value: "TENANT_CREATED", label: "Établissement créé" },
    { value: "TENANT_PROFILE_UPDATED", label: "Profil mis à jour" },
    { value: "TENANT_TECHNICAL_CONFIG_UPDATED", label: "Configuration technique mise à jour" },
    { value: "TENANT_STATUS_CHANGED", label: "Statut modifié" },
    { value: "TENANT_PROVISIONED", label: "Bases de données provisionnées" },
    { value: "TENANT_ADMIN_PROVISIONED", label: "Compte administrateur créé" },
    { value: "TENANT_LOGO_UPDATED", label: "Logo mis à jour" },
    { value: "TENANT_LOGO_REMOVED", label: "Logo supprimé" },
    { value: "FUNCTIONAL_SERVICES_BULK_SET", label: "Services modifiés (lot)" },
    { value: "FUNCTIONAL_SERVICE_TOGGLED", label: "Service activé/désactivé" },
];

const ACTION_LABELS = ACTION_OPTIONS.reduce((acc, o) => {
    if (o.value) acc[o.value] = o.label;
    return acc;
}, {});

const EMPTY_FILTERS = { tenant: "", actor: "", action: "", date_from: "", date_to: "" };

/**
 * Page "Logs d'administration" — journal d'audit des actions effectuées
 * dans le back-office Platform Admin (création/modification de tenants,
 * provisionnement, gestion du logo, services fonctionnels…).
 *
 * Consomme GET /tenants/admin-logs/ (nouveau, lecture seule, réponse en
 * tableau simple — non paginée). Le filtrage est entièrement délégué au
 * backend via les paramètres de requête.
 */
export function AdminLogsPage() {
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [tenants, setTenants] = useState([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await getAllTenants();
                if (!cancelled) setTenants(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Erreur de chargement de la liste des établissements:", error);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError("");
            try {
                const params = Object.fromEntries(
                    Object.entries(appliedFilters).filter(([, value]) => value !== "")
                );
                const data = await getAdminLogs(params);
                if (!cancelled) setLogs(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Erreur de chargement des logs d'administration:", error);
                if (!cancelled) setLoadError("Impossible de charger les logs pour le moment.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [appliedFilters]);

    const handleFilter = (e) => {
        e.preventDefault();
        setAppliedFilters(filters);
    };

    return (
        <CustomDashboard linkList={platformAdminNavLink} requiredRole="platform_admin" brandLabel="ComputeClinic Platform" showTenantIdentity={false}>
            <AppHeader subtitle="Platform Admin" title="Logs d'administration" />
            <div className="p-6 bg-gray-50 min-h-screen">
                {loadError && (
                    <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-600">
                        {loadError}
                    </div>
                )}

                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white rounded-xl shadow-md border border-gray-100 p-6"
                >
                    <div className="flex items-center gap-2 mb-6">
                        <ScrollText className="w-5 h-5 text-primary-end" />
                        <h2 className="text-lg font-semibold text-gray-800">
                            Journal des actions {!loading && `(${logs.length})`}
                        </h2>
                    </div>

                    <form
                        onSubmit={handleFilter}
                        className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 mb-6"
                    >
                        <div className="flex-1 min-w-[12rem]">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Établissement</label>
                            <select
                                value={filters.tenant}
                                onChange={(e) => setFilters((f) => ({ ...f, tenant: e.target.value }))}
                                className="w-full h-10 px-3 rounded-lg bg-gray-100 border border-gray-200 outline-none focus:ring-2 focus:ring-primary-end text-sm"
                            >
                                <option value="">Tous</option>
                                {tenants.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({t.identifier})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[10rem]">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Acteur</label>
                            <input
                                type="text"
                                value={filters.actor}
                                onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value }))}
                                placeholder="email de l'administrateur plateforme"
                                className="w-full h-10 px-3 rounded-lg bg-gray-100 border border-gray-200 outline-none focus:ring-2 focus:ring-primary-end text-sm"
                            />
                        </div>
                        <div className="flex-1 min-w-[12rem]">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Action</label>
                            <select
                                value={filters.action}
                                onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
                                className="w-full h-10 px-3 rounded-lg bg-gray-100 border border-gray-200 outline-none focus:ring-2 focus:ring-primary-end text-sm"
                            >
                                {ACTION_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="min-w-[9rem]">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Du</label>
                            <input
                                type="date"
                                value={filters.date_from}
                                onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                                className="w-full h-10 px-3 rounded-lg bg-gray-100 border border-gray-200 outline-none focus:ring-2 focus:ring-primary-end text-sm"
                            />
                        </div>
                        <div className="min-w-[9rem]">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Au</label>
                            <input
                                type="date"
                                value={filters.date_to}
                                onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                                className="w-full h-10 px-3 rounded-lg bg-gray-100 border border-gray-200 outline-none focus:ring-2 focus:ring-primary-end text-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 text-white font-bold px-4 h-10 rounded-lg bg-gradient-to-r from-primary-start to-primary-end whitespace-nowrap"
                        >
                            <Filter className="w-4 h-4" />
                            Filtrer
                        </button>
                    </form>

                    {loading ? (
                        <div className="animate-pulse space-y-3">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                            ))}
                        </div>
                    ) : logs.length === 0 ? (
                        <p className="text-sm text-gray-400 py-10 text-center">Aucun log ne correspond à ces critères.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-100">
                                        <th className="pb-2 font-semibold">Date</th>
                                        <th className="pb-2 font-semibold">Acteur</th>
                                        <th className="pb-2 font-semibold">Action</th>
                                        <th className="pb-2 font-semibold">Établissement</th>
                                        <th className="pb-2 font-semibold">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-b border-gray-50 last:border-0 align-top">
                                            <td className="py-3 text-gray-500 whitespace-nowrap">
                                                {log.created_at ? new Date(log.created_at).toLocaleString("fr-FR") : "—"}
                                            </td>
                                            <td className="py-3 text-gray-700">{log.actor_email || log.actor_id || "—"}</td>
                                            <td className="py-3">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-start/10 text-primary-start whitespace-nowrap">
                                                    {ACTION_LABELS[log.action] || log.action}
                                                </span>
                                            </td>
                                            <td className="py-3 text-gray-500">{log.target_tenant_identifier || "—"}</td>
                                            <td className="py-3 text-gray-600">{log.description || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>
            </div>
        </CustomDashboard>
    );
}

export default AdminLogsPage;
