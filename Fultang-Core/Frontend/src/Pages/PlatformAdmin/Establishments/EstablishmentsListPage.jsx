import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, PlusCircle, Search, ChevronRight } from "lucide-react";
import { CustomDashboard } from "../../../GlobalComponents/CustomDashboard.jsx";
import { AppHeader } from "../../../GlobalComponents/AppHeader.jsx";
import { platformAdminNavLink } from "../platformAdminNavLink.js";
import { AppRoutesPaths } from "../../../Router/appRouterPaths.js";
import { getAllTenants } from "../../../services/platformAdminApi.js";

/**
 * Liste de tous les établissements (tenants) de la plateforme.
 *
 * Page d'administration multi-établissements — recherche/filtrage
 * uniquement côté client (l'échelle actuelle ne justifie pas de pagination
 * ou de filtre serveur), navigation vers le détail de chaque tenant, et
 * accès direct à l'assistant de création.
 */
export function EstablishmentsListPage() {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [searchText, setSearchText] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setLoadError("");
            try {
                const data = await getAllTenants();
                if (!cancelled) setTenants(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Erreur de chargement des établissements:", error);
                if (!cancelled) setLoadError("Impossible de charger la liste des établissements pour le moment.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const filteredTenants = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        if (!query) return tenants;
        return tenants.filter(
            (t) => t.name?.toLowerCase().includes(query) || t.identifier?.toLowerCase().includes(query)
        );
    }, [tenants, searchText]);

    return (
        <CustomDashboard linkList={platformAdminNavLink} requiredRole="platform_admin" brandLabel="ComputeClinic Platform" showTenantIdentity={false}>
            <AppHeader subtitle="Platform Admin" title="Établissements" />
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-primary-end" />
                            <h2 className="text-lg font-semibold text-gray-800">
                                Tous les établissements {!loading && `(${tenants.length})`}
                            </h2>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="relative">
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Rechercher un établissement…"
                                    className="pl-9 pr-3 h-10 w-full sm:w-64 rounded-lg bg-gray-100 border border-gray-200 outline-none focus:ring-2 focus:ring-primary-end text-sm"
                                />
                            </div>
                            <Link
                                to={AppRoutesPaths.platformAdminCreateTenantPage}
                                className="inline-flex items-center justify-center gap-2 text-white font-bold px-4 py-2.5 rounded-lg bg-gradient-to-r from-primary-start to-primary-end whitespace-nowrap"
                            >
                                <PlusCircle className="w-4 h-4" />
                                Créer un tenant
                            </Link>
                        </div>
                    </div>

                    {loading ? (
                        <div className="animate-pulse space-y-3">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="h-14 bg-gray-100 rounded-lg" />
                            ))}
                        </div>
                    ) : filteredTenants.length === 0 ? (
                        <p className="text-sm text-gray-400 py-10 text-center">
                            {tenants.length === 0
                                ? "Aucun établissement enregistré."
                                : "Aucun établissement ne correspond à cette recherche."}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-100">
                                        <th className="pb-2 font-semibold">Nom</th>
                                        <th className="pb-2 font-semibold">Identifiant</th>
                                        <th className="pb-2 font-semibold">Statut</th>
                                        <th className="pb-2 font-semibold">Créé le</th>
                                        <th className="pb-2 font-semibold" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTenants.map((tenant) => (
                                        <tr key={tenant.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                            <td className="py-3">
                                                <Link
                                                    to={AppRoutesPaths.platformAdminTenantDetailPage.replace(":tenantId", tenant.id)}
                                                    className="font-medium text-gray-800 hover:text-primary-start"
                                                >
                                                    {tenant.name}
                                                </Link>
                                            </td>
                                            <td className="py-3 text-gray-500">{tenant.identifier}</td>
                                            <td className="py-3">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${tenant.status === "ACTIVE"
                                                            ? "bg-emerald-50 text-emerald-600"
                                                            : "bg-red-50 text-red-500"
                                                        }`}
                                                >
                                                    {tenant.status === "ACTIVE" ? "Actif" : "Inactif"}
                                                </span>
                                            </td>
                                            <td className="py-3 text-gray-500">
                                                {tenant.created_at
                                                    ? new Date(tenant.created_at).toLocaleDateString("fr-FR")
                                                    : "—"}
                                            </td>
                                            <td className="py-3 text-right">
                                                <Link
                                                    to={AppRoutesPaths.platformAdminTenantDetailPage.replace(":tenantId", tenant.id)}
                                                    className="inline-flex items-center gap-1 text-primary-start hover:text-primary-end text-xs font-semibold"
                                                >
                                                    Détails
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </Link>
                                            </td>
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

export default EstablishmentsListPage;
