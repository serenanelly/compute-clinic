import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, XCircle, Layers, Activity, Bell, ArrowRight } from "lucide-react";
import { CustomDashboard } from "../../GlobalComponents/CustomDashboard.jsx";
import { AppHeader } from "../../GlobalComponents/AppHeader.jsx";
import StatCard from "../../GlobalComponents/StatCard.jsx";
import { platformAdminNavLink } from "./platformAdminNavLink.js";
import { AppRoutesPaths } from "../../Router/appRouterPaths.js";
import { getAllTenants, getAllPlatformServices } from "../../services/platformAdminApi.js";

/**
 * Dashboard Platform Admin — première version.
 *
 * Statistiques réellement issues du Tenant Registry (tenant-service, via
 * la Gateway) : aucune donnée métier fictive. Les sections "Activité
 * récente" et "Alertes" sont volontairement de simples emplacements
 * réservés (aucune donnée disponible côté backend pour l'instant) —
 * voir MULTITENANT_ARCHITECTURE.md pour la suite prévue (Phase 9 et au-delà).
 */
export function PlatformAdminDashboard() {
    const [tenants, setTenants] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            setLoadError("");
            try {
                const [tenantsData, servicesData] = await Promise.all([
                    getAllTenants(),
                    getAllPlatformServices(),
                ]);
                if (!cancelled) {
                    setTenants(Array.isArray(tenantsData) ? tenantsData : []);
                    setServices(Array.isArray(servicesData) ? servicesData : []);
                }
            } catch (error) {
                console.error("Erreur de chargement du Tenant Registry:", error);
                if (!cancelled) {
                    setLoadError("Impossible de charger les données de la plateforme pour le moment.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, []);

    const activeTenants = tenants.filter((t) => t.status === "ACTIVE").length;
    const inactiveTenants = tenants.filter((t) => t.status === "INACTIVE").length;

    return (
        <CustomDashboard linkList={platformAdminNavLink} requiredRole="platform_admin" brandLabel="ComputeClinic Platform" showTenantIdentity={false}>
            <AppHeader subtitle="Platform Admin" title="Vue d'ensemble de la plateforme" />
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
                    className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
                >
                    <StatCard
                        title="Tenants"
                        value={loading ? 0 : tenants.length}
                        description="Établissements enregistrés"
                        icon={Building2}
                        color="bg-primary-start"
                    />
                    <StatCard
                        title="Tenants actifs"
                        value={loading ? 0 : activeTenants}
                        description="Établissements en service"
                        icon={CheckCircle2}
                        color="bg-emerald-500"
                    />
                    <StatCard
                        title="Tenants désactivés"
                        value={loading ? 0 : inactiveTenants}
                        description="Établissements suspendus"
                        icon={XCircle}
                        color="bg-red-500"
                    />
                    <StatCard
                        title="Services plateforme"
                        value={loading ? 0 : services.length}
                        description="Microservices du catalogue"
                        icon={Layers}
                        color="bg-secondary"
                    />
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Liste des tenants (donnée réelle) */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                        className="bg-white rounded-xl shadow-md p-6 border border-gray-100"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Building2 className="w-5 h-5 text-primary-end" />
                            <h2 className="text-lg font-semibold text-gray-800">Établissements</h2>
                        </div>

                        {loading ? (
                            <div className="animate-pulse space-y-3">
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                                ))}
                            </div>
                        ) : tenants.length === 0 ? (
                            <p className="text-sm text-gray-400 py-6 text-center">Aucun tenant enregistré.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-400 border-b border-gray-100">
                                            <th className="pb-2 font-semibold">Nom</th>
                                            <th className="pb-2 font-semibold">Identifiant</th>
                                            <th className="pb-2 font-semibold">Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tenants.slice(0, 5).map((tenant) => (
                                            <tr key={tenant.id} className="border-b border-gray-50 last:border-0">
                                                <td className="py-2.5 font-medium text-gray-800">{tenant.name}</td>
                                                <td className="py-2.5 text-gray-500">{tenant.identifier}</td>
                                                <td className="py-2.5">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${tenant.status === "ACTIVE"
                                                                ? "bg-emerald-50 text-emerald-600"
                                                                : "bg-red-50 text-red-500"
                                                            }`}
                                                    >
                                                        {tenant.status === "ACTIVE" ? "Actif" : "Inactif"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!loading && tenants.length > 0 && (
                            <div className="mt-4 text-right">
                                <Link
                                    to={AppRoutesPaths.platformAdminEstablishmentsPage}
                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-start hover:text-primary-end transition-colors"
                                >
                                    Voir les établissements
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        )}
                    </motion.div>

                    {/* Emplacements réservés — pas de données fictives */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                        className="flex flex-col gap-6"
                    >
                        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                            <div className="flex items-center gap-2 mb-3">
                                <Activity className="w-5 h-5 text-primary-end" />
                                <h2 className="text-lg font-semibold text-gray-800">Activité récente</h2>
                            </div>
                            <p className="text-sm text-gray-400">
                                Aucune donnée d&apos;activité disponible pour l&apos;instant — cette section sera
                                alimentée par le backend dans une itération ultérieure.
                            </p>
                        </div>

                        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
                            <div className="flex items-center gap-2 mb-3">
                                <Bell className="w-5 h-5 text-primary-end" />
                                <h2 className="text-lg font-semibold text-gray-800">Alertes</h2>
                            </div>
                            <p className="text-sm text-gray-400">
                                Aucune alerte pour l&apos;instant — cette section sera alimentée par le backend
                                dans une itération ultérieure.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>
        </CustomDashboard>
    );
}

export default PlatformAdminDashboard;
