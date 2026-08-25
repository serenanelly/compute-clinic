import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Building2, Users, BedDouble, ArrowRight, Activity, Stethoscope, TrendingUp } from 'lucide-react';
import { CustomDashboard } from '../../GlobalComponents/CustomDashboard.jsx';
import { AdminNavBar } from './AdminNavBar.jsx';
import { newAdminNavLink } from './newAdminNavLink.js';
import { getAllServices } from '../../services/servicesApi';
import { getAllPersonnel } from '../../services/personnelApi';
import { getAllChambres } from '../../services/chambresApi';
import { AppRoutesPaths } from '../../Router/appRouterPaths.js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

/**
 * Dashboard principal de l'administrateur.
 * Affiche les statistiques globales, un graphique de répartition et des accès rapides.
 */
export function AdminHomePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ services: 0, personnel: 0, chambres: 0 });
    const [personnelByPoste, setPersonnelByPoste] = useState([]);
    const [loading, setLoading] = useState(true);

    const COLORS = ['#1A73A3', '#50C2B9', '#051161', '#F59E0B', '#EF4444', '#8B5CF6', '#10B981', '#EC4899'];

    useEffect(() => {
        fetchAllStats();
    }, []);

    const fetchAllStats = async () => {
        setLoading(true);
        try {
            const [servicesRes, personnelRes, chambresRes] = await Promise.allSettled([
                getAllServices(),
                getAllPersonnel(),
                getAllChambres()
            ]);

            const servicesData = servicesRes.status === 'fulfilled'
                ? (servicesRes.value.results || servicesRes.value.data || servicesRes.value || [])
                : [];
            const personnelData = personnelRes.status === 'fulfilled'
                ? (personnelRes.value.results || personnelRes.value.data || personnelRes.value || [])
                : [];
            const chambresData = chambresRes.status === 'fulfilled'
                ? (chambresRes.value.results || chambresRes.value.data || chambresRes.value || [])
                : [];

            const sArr = Array.isArray(servicesData) ? servicesData : [];
            const pArr = Array.isArray(personnelData) ? personnelData : [];
            const cArr = Array.isArray(chambresData) ? chambresData : [];

            setStats({
                services: sArr.length,
                personnel: pArr.length,
                chambres: cArr.length
            });

            // Répartition du personnel par poste
            const posteMap = {};
            pArr.forEach(p => {
                const poste = p.poste || 'autre';
                posteMap[poste] = (posteMap[poste] || 0) + 1;
            });
            const chartData = Object.entries(posteMap).map(([name, value]) => ({ name, value }));
            setPersonnelByPoste(chartData);
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        {
            title: t('admin.servicesAvailable'),
            value: stats.services,
            icon: Building2,
            color: 'from-blue-500 to-blue-600',
            bgLight: 'bg-blue-50',
            textColor: 'text-blue-600',
            link: AppRoutesPaths.adminServicesPage
        },
        {
            title: t('admin.personnelMembers'),
            value: stats.personnel,
            icon: Users,
            color: 'from-emerald-500 to-teal-600',
            bgLight: 'bg-emerald-50',
            textColor: 'text-emerald-600',
            link: AppRoutesPaths.adminPersonnelPage
        },
        {
            title: t('admin.roomsAvailable'),
            value: stats.chambres,
            icon: BedDouble,
            color: 'from-purple-500 to-indigo-600',
            bgLight: 'bg-purple-50',
            textColor: 'text-purple-600',
            link: AppRoutesPaths.adminChambresPage
        }
    ];

    const quickActions = [
        {
            title: t('admin.manageServices'),
            desc: t('admin.manageHospitalServices'),
            icon: Building2,
            link: AppRoutesPaths.adminServicesPage,
            gradient: 'from-blue-500 to-cyan-500'
        },
        {
            title: t('admin.managePersonnel'),
            desc: t('admin.manageHospitalPersonnel'),
            icon: Users,
            link: AppRoutesPaths.adminPersonnelPage,
            gradient: 'from-emerald-500 to-teal-500'
        },
        {
            title: t('admin.manageRooms'),
            desc: t('admin.manageHospitalRooms'),
            icon: BedDouble,
            link: AppRoutesPaths.adminChambresPage,
            gradient: 'from-purple-500 to-indigo-500'
        }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };

    return (
        <CustomDashboard linkList={newAdminNavLink} requiredRole={"Admin"}>
            <AdminNavBar />
            <div className="p-6 bg-gray-50 min-h-screen">
                {/* Welcome Banner */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-8 bg-gradient-to-r from-primary-start to-primary-end rounded-2xl p-8 text-white shadow-lg"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <Activity className="w-8 h-8" />
                        <h1 className="text-3xl font-bold">{t('admin.welcomeDashboard')}</h1>
                    </div>
                    <p className="text-white/80 text-lg ml-11">{t('admin.manageEfficiently')}</p>
                </motion.div>

                {/* Stat Cards */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
                >
                    {statCards.map((card, index) => (
                        <motion.div
                            key={index}
                            variants={itemVariants}
                            whileHover={{ scale: 1.03, y: -4 }}
                            onClick={() => navigate(card.link)}
                            className="bg-white rounded-xl shadow-md p-6 cursor-pointer border border-gray-100 hover:shadow-xl transition-shadow"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">{card.title}</p>
                                    <p className="text-4xl font-bold text-gray-800 mt-2">
                                        {loading ? (
                                            <span className="inline-block w-12 h-8 bg-gray-200 rounded animate-pulse"></span>
                                        ) : card.value}
                                    </p>
                                </div>
                                <div className={`p-4 rounded-2xl bg-gradient-to-br ${card.color} shadow-lg`}>
                                    <card.icon className="w-7 h-7 text-white" />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center text-sm text-gray-400 hover:text-primary-end transition-colors">
                                <span>Voir les détails</span>
                                <ArrowRight className="w-4 h-4 ml-1" />
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Chart Section */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="bg-white rounded-xl shadow-md p-6 border border-gray-100"
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <TrendingUp className="w-5 h-5 text-primary-end" />
                            <h2 className="text-lg font-semibold text-gray-800">Répartition du Personnel par Poste</h2>
                        </div>
                        {personnelByPoste.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={personnelByPoste}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={110}
                                        paddingAngle={3}
                                        dataKey="value"
                                        label={({ name, value }) => `${name} (${value})`}
                                    >
                                        {personnelByPoste.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-gray-400">
                                {loading ? (
                                    <div className="animate-pulse flex flex-col items-center gap-3">
                                        <div className="w-32 h-32 rounded-full bg-gray-200"></div>
                                        <div className="w-24 h-4 bg-gray-200 rounded"></div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <Stethoscope className="w-12 h-12 text-gray-300" />
                                        <p>Aucune donnée disponible</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>

                    {/* Quick Actions */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="bg-white rounded-xl shadow-md p-6 border border-gray-100"
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <Activity className="w-5 h-5 text-primary-end" />
                            <h2 className="text-lg font-semibold text-gray-800">{t('admin.quickAccess')}</h2>
                        </div>
                        <div className="space-y-4">
                            {quickActions.map((action, index) => (
                                <motion.div
                                    key={index}
                                    whileHover={{ x: 6 }}
                                    onClick={() => navigate(action.link)}
                                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-primary-end/30 hover:shadow-md cursor-pointer transition-all group"
                                >
                                    <div className={`p-3 rounded-xl bg-gradient-to-br ${action.gradient} shadow-md`}>
                                        <action.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-800 group-hover:text-primary-end transition-colors">
                                            {action.title}
                                        </h3>
                                        <p className="text-sm text-gray-500">{action.desc}</p>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary-end transition-colors" />
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </CustomDashboard>
    );
}

export default AdminHomePage;
