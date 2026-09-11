import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Building2, Plus, Search, Edit3, Trash2, BarChart3, Users } from 'lucide-react';
import { Table, message, Modal as AntModal, Tag, Input } from 'antd';
import { CustomDashboard } from '../../GlobalComponents/CustomDashboard.jsx';
import { AdminNavBar } from './AdminNavBar.jsx';
import { newAdminNavLink } from './newAdminNavLink.js';
import { getAllServices, deleteService } from '../../services/servicesApi';
import { AddServiceModal } from './Services/AddServiceModal.jsx';
import { EditServiceModal } from './Services/EditServiceModal.jsx';
import { ServiceStatsModal } from './Services/ServiceStatsModal.jsx';

/**
 * Page de gestion des services hospitaliers.
 * Permet de lister, créer, modifier, voir les stats et supprimer les services.
 */
export function AdminServicesPage() {
    const { t } = useTranslation();
    const [services, setServices] = useState([]);
    const [filteredServices, setFilteredServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    // Modals state
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [statsModalOpen, setStatsModalOpen] = useState(false);
    const [selectedService, setSelectedService] = useState(null);

    useEffect(() => {
        fetchServices();
    }, []);

    useEffect(() => {
        if (searchText.trim() === '') {
            setFilteredServices(services);
        } else {
            const lower = searchText.toLowerCase();
            setFilteredServices(
                services.filter(s =>
                    (s.nom_service || '').toLowerCase().includes(lower) ||
                    (s.desc_service || '').toLowerCase().includes(lower) ||
                    (s.chef_service_details?.nom || '').toLowerCase().includes(lower)
                )
            );
        }
    }, [searchText, services]);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const response = await getAllServices();
            const data = response.results || response.data || response || [];
            setServices(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching services:', error);
            message.error('Erreur lors du chargement des services');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (service) => {
        AntModal.confirm({
            title: t('services.confirmDelete'),
            content: `Service : ${service.nom_service}`,
            okText: t('common.delete'),
            cancelText: t('common.cancel'),
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await deleteService(service.id);
                    message.success(t('services.deleteSuccess'));
                    fetchServices();
                } catch (error) {
                    console.error('Error deleting service:', error);
                    const msg = error.response?.data?.detail || 'Erreur lors de la suppression';
                    message.error(msg);
                }
            }
        });
    };

    const handleEdit = (service) => {
        setSelectedService(service);
        setEditModalOpen(true);
    };

    const handleStats = (service) => {
        setSelectedService(service);
        setStatsModalOpen(true);
    };

    const columns = [
        {
            title: '#',
            key: 'index',
            width: 50,
            render: (_, __, index) => (
                <span className="text-gray-400 font-medium">{index + 1}</span>
            )
        },
        {
            title: t('services.serviceName'),
            dataIndex: 'nom_service',
            key: 'nom_service',
            render: (text) => <span className="font-semibold text-gray-800">{text}</span>
        },
        {
            title: t('services.chefService'),
            key: 'chef',
            render: (_, record) => {
                const chef = record.chef_service_details;
                if (chef) {
                    return (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-start to-primary-end flex items-center justify-center text-white text-xs font-bold">
                                {(chef.nom?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700">{chef.nom} {chef.prenom || ''}</p>
                                <p className="text-xs text-gray-400">{chef.poste || ''}</p>
                            </div>
                        </div>
                    );
                }
                return <Tag color="orange">Non assigné</Tag>;
            }
        },
        {
            title: 'Création',
            dataIndex: 'date_creation',
            key: 'date_creation',
            render: (d) => <span className="text-gray-500 text-sm">{d || '—'}</span>,
        },
        {
            title: 'Décret',
            key: 'decret',
            render: (_, r) => (
                <span className="text-gray-500 text-sm">
                    {r.reference_decret || '—'}
                    {r.date_decret ? ` (${r.date_decret})` : ''}
                </span>
            ),
        },
        {
            title: t('services.actions'),
            key: 'actions',
            width: 180,
            render: (_, record) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleStats(record)}
                        className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        title={t('services.viewStats')}
                    >
                        <BarChart3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleEdit(record)}
                        className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                        title={t('services.edit')}
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDelete(record)}
                        className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        title={t('services.delete')}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <CustomDashboard linkList={newAdminNavLink} requiredRole={"Admin"}>
            <AdminNavBar />
            <div className="p-6 bg-gray-50 min-h-screen">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-6"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <Building2 className="w-7 h-7 text-primary-end" />
                                {t('services.title')}
                            </h1>
                            <p className="text-gray-500 mt-1">{t('admin.manageHospitalServices')}</p>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setAddModalOpen(true)}
                            className="flex items-center gap-2 bg-gradient-to-r from-primary-start to-primary-end text-white px-5 py-3 rounded-xl shadow-lg hover:shadow-xl transition-shadow font-medium"
                        >
                            <Plus className="w-5 h-5" />
                            {t('services.addService')}
                        </motion.button>
                    </div>
                </motion.div>

                {/* Search & Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden"
                >
                    {/* Search Bar */}
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-500">
                            <Users className="w-5 h-5" />
                            <span className="font-medium">{filteredServices.length} service(s) trouvé(s)</span>
                        </div>
                        <Input
                            prefix={<Search className="w-4 h-4 text-gray-400" />}
                            placeholder={t('common.search') + '...'}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            className="max-w-xs"
                            allowClear
                        />
                    </div>

                    <Table
                        columns={columns}
                        dataSource={filteredServices}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `Total: ${total} service(s)`,
                            showSizeChanger: { showSearch: false },
                            pageSizeOptions: ['5', '10', '20']
                        }}
                        locale={{ emptyText: t('services.noServices') }}
                        rowClassName="hover:bg-gray-50 transition-colors"
                    />
                </motion.div>
            </div>

            {/* Modals */}
            <AddServiceModal
                isOpen={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSuccess={fetchServices}
            />
            <EditServiceModal
                isOpen={editModalOpen}
                onClose={() => { setEditModalOpen(false); setSelectedService(null); }}
                onSuccess={fetchServices}
                service={selectedService}
            />
            <ServiceStatsModal
                isOpen={statsModalOpen}
                onClose={() => { setStatsModalOpen(false); setSelectedService(null); }}
                service={selectedService}
            />
        </CustomDashboard>
    );
}

export default AdminServicesPage;
