import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Users, Plus, Search, Edit3, Trash2, Eye, KeyRound, AlertTriangle, X } from 'lucide-react';
import { Table, message, Modal as AntModal, Tag, Input, Select } from 'antd';
import { CustomDashboard } from '../../GlobalComponents/CustomDashboard.jsx';
import { AdminNavBar } from './AdminNavBar.jsx';
import { newAdminNavLink } from './newAdminNavLink.js';
import { getAllPersonnel, deletePersonnel, resetPersonnelPassword, getPersonnelDependencies } from '../../services/personnelApi';
import { getAllServices } from '../../services/servicesApi';
import { useAuthentication } from '../../Utils/Provider.jsx';
import { AddPersonnelModal } from './Personnel/AddPersonnelModal.jsx';
import { EditPersonnelModal } from './Personnel/EditPersonnelModal.jsx';
import { PersonnelDetailsModal } from './Personnel/PersonnelDetailsModal.jsx';
import { PersonnelPrimesModal } from './Personnel/PersonnelPrimesModal.jsx';
import { buildPostesOptions, BACKEND_STATUTS, POSTE_CATEGORIES, getServiceId } from '../../constants/personnelPostes.js';

/**
 * Page de gestion du personnel hospitalier.
 * Liste complète avec filtres, recherche, et actions CRUD.
 */
export function AdminPersonnelPage() {
    const { t } = useTranslation();
    const { userData } = useAuthentication();
    const [personnel, setPersonnel] = useState([]);
    const [filteredPersonnel, setFilteredPersonnel] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [filterPoste, setFilterPoste] = useState('');
    const [filterStatut, setFilterStatut] = useState('');
    const [filterCategorie, setFilterCategorie] = useState('');
    const [filterService, setFilterService] = useState('');
    const [services, setServices] = useState([]);

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [primesModalOpen, setPrimesModalOpen] = useState(false);
    const [selectedPersonnel, setSelectedPersonnel] = useState(null);

    const POSTES = buildPostesOptions(t);

    useEffect(() => {
        fetchPersonnel();
        fetchServicesList();
    }, []);

    const fetchServicesList = async () => {
        try {
            const response = await getAllServices();
            const data = response.results || response.data || response || [];
            setServices(Array.isArray(data) ? data : []);
        } catch {
            setServices([]);
        }
    };

    useEffect(() => {
        let result = [...personnel];

        if (searchText.trim()) {
            const lower = searchText.toLowerCase();
            result = result.filter(p =>
                (p.nom || '').toLowerCase().includes(lower) ||
                (p.prenom || '').toLowerCase().includes(lower) ||
                (p.email || '').toLowerCase().includes(lower) ||
                (p.matricule || '').toLowerCase().includes(lower)
            );
        }

        if (filterPoste) {
            result = result.filter(p => p.poste === filterPoste);
        }

        if (filterStatut) {
            result = result.filter(p => p.statut === filterStatut);
        }
        if (filterCategorie) {
            const allowed = POSTE_CATEGORIES[filterCategorie]?.postes || [];
            result = result.filter(p => allowed.includes(p.poste));
        }
        if (filterService) {
            result = result.filter(p => String(p.service) === String(filterService));
        }

        setFilteredPersonnel(result);
    }, [searchText, filterPoste, filterStatut, filterCategorie, filterService, personnel]);

    const fetchPersonnel = async () => {
        setLoading(true);
        try {
            const response = await getAllPersonnel();
            const data = response.results || response.data || response || [];
            const list = Array.isArray(data) ? data : [];
            // Exclure l'admin connecté de la liste
            const currentId = String(userData?.id || userData?.idpersonnel || '');
            const filtered = currentId
                ? list.filter(p => String(p.id) !== currentId)
                : list;
            setPersonnel(filtered);
        } catch (error) {
            console.error('Error fetching personnel:', error);
            message.error('Erreur lors du chargement du personnel');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (person) => {
        AntModal.confirm({
            title: t('personnel.confirmDelete'),
            icon: <AlertTriangle className="w-5 h-5 text-red-500 mr-2 inline" />,
            content: (
                <div>
                    <p className="font-medium">{person.nom} {person.prenom || ''}</p>
                    <p className="text-sm text-gray-500 mt-1">
                        {person.poste} — {person.email}
                    </p>
                </div>
            ),
            okText: t('common.delete'),
            cancelText: t('common.cancel'),
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await deletePersonnel(person.id);
                    message.success(t('personnel.deleteSuccess'));
                    fetchPersonnel();
                } catch (error) {
                    console.error('Error deleting personnel:', error);
                    if (error.isProtectedError) {
                        message.error(error.message);
                    } else {
                        const msg = error.response?.data?.detail || 'Erreur lors de la suppression';
                        message.error(msg);
                    }
                }
            }
        });
    };

    const handleResetPassword = (person) => {
        AntModal.confirm({
            title: t('personnel.resetPassword'),
            content: (
                <div>
                    <p>{t('personnel.resetPasswordConfirm')}</p>
                    <p className="font-medium mt-2">{person.nom} {person.prenom || ''} ({person.email})</p>
                </div>
            ),
            okText: t('common.confirm'),
            cancelText: t('common.cancel'),
            onOk: async () => {
                try {
                    await resetPersonnelPassword(person.email);
                    message.success(t('personnel.resetPasswordSuccess'));
                } catch (error) {
                    console.error('Error resetting password:', error);
                    const msg = error.response?.data?.detail || 'Erreur lors de la réinitialisation';
                    message.error(msg);
                }
            }
        });
    };

    const getStatusTag = (statut) => {
        const colors = { Actif: 'green', 'Congé': 'orange', Suspendu: 'red', Autre: 'default' };
        const labels = {
            Actif: t('personnel.statuses.actif', { defaultValue: 'Actif' }),
            'Congé': t('personnel.statuses.conge', { defaultValue: 'Congé' }),
            Suspendu: t('personnel.statuses.suspendu', { defaultValue: 'Suspendu' }),
            Autre: t('personnel.statuses.autre', { defaultValue: 'Autre' }),
        };
        return <Tag color={colors[statut] || 'default'}>{labels[statut] || statut}</Tag>;
    };

    const getPosteTag = (poste) => {
        const colors = {
            medecin: 'blue',
            infirmier: 'cyan',
            receptioniste: 'purple',
            caissier: 'orange',
            laborantin: 'green',
            pharmacien: 'magenta',
            comptable: 'gold',
            directeur: 'red',
            admin: 'volcano',
        };
        const label = POSTES.find(p => p.value === poste)?.label || poste;
        return <Tag color={colors[poste] || 'default'}>{label}</Tag>;
    };

    const columns = [
        {
            title: '#',
            key: 'index',
            width: 50,
            render: (_, __, index) => <span className="text-gray-400 font-medium">{index + 1}</span>
        },
        {
            title: t('personnel.lastName'),
            key: 'fullname',
            render: (_, record) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-start to-primary-end flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {(record.nom?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800">{record.nom} {record.prenom || ''}</p>
                        <p className="text-xs text-gray-400">{record.matricule || record.email}</p>
                    </div>
                </div>
            )
        },
        {
            title: t('personnel.position'),
            dataIndex: 'poste',
            key: 'poste',
            render: (poste) => getPosteTag(poste)
        },
        {
            title: t('personnel.email'),
            dataIndex: 'email',
            key: 'email',
            ellipsis: true,
            render: (text) => <span className="text-gray-500">{text}</span>
        },
        {
            title: t('personnel.service'),
            dataIndex: 'service_nom',
            key: 'service_nom',
            render: (text) => <span className="text-gray-600">{text || '—'}</span>
        },
        {
            title: t('personnel.status'),
            dataIndex: 'statut',
            key: 'statut',
            width: 100,
            render: (statut) => getStatusTag(statut)
        },
        {
            title: t('services.actions'),
            key: 'actions',
            width: 200,
            render: (_, record) => (
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { setSelectedPersonnel(record); setDetailsModalOpen(true); }}
                        className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        title={t('personnel.viewDetails')}
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setSelectedPersonnel(record); setEditModalOpen(true); }}
                        className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                        title={t('common.edit')}
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleResetPassword(record)}
                        className="p-2 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                        title={t('personnel.resetPassword')}
                    >
                        <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDelete(record)}
                        className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        title={t('common.delete')}
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
                                <Users className="w-7 h-7 text-primary-end" />
                                {t('personnel.title')}
                            </h1>
                            <p className="text-gray-500 mt-1">{t('admin.manageHospitalPersonnel')}</p>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setAddModalOpen(true)}
                            className="flex items-center gap-2 bg-gradient-to-r from-primary-start to-primary-end text-white px-5 py-3 rounded-xl shadow-lg hover:shadow-xl transition-shadow font-medium"
                        >
                            <Plus className="w-5 h-5" />
                            {t('personnel.addPersonnel')}
                        </motion.button>
                    </div>
                </motion.div>

                {/* Filters & Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden"
                >
                    {/* Search and Filters Bar */}
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex flex-wrap items-center gap-3">
                            <Input
                                prefix={<Search className="w-4 h-4 text-gray-400" />}
                                placeholder={t('common.search') + ' (nom, email, matricule)...'}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="max-w-xs"
                                allowClear
                            />
                            <Select
                                placeholder={t('personnel.position')}
                                value={filterPoste || undefined}
                                onChange={(val) => setFilterPoste(val || '')}
                                allowClear
                                className="min-w-[160px]"
                                options={POSTES}
                            />
                            <Select
                                placeholder={t('personnel.status')}
                                value={filterStatut || undefined}
                                onChange={(val) => setFilterStatut(val || '')}
                                allowClear
                                className="min-w-[140px]"
                                options={BACKEND_STATUTS.map(s => ({
                                    value: s.value,
                                    label: t(s.labelKey, { defaultValue: s.value }),
                                }))}
                            />
                            <Select
                                placeholder="Catégorie"
                                value={filterCategorie || undefined}
                                onChange={(val) => setFilterCategorie(val || '')}
                                allowClear
                                className="min-w-[160px]"
                                options={[
                                    { value: 'medical', label: POSTE_CATEGORIES.medical.label },
                                    { value: 'admin', label: POSTE_CATEGORIES.admin.label },
                                ]}
                            />
                            <Select
                                placeholder={t('personnel.service')}
                                value={filterService || undefined}
                                onChange={(val) => setFilterService(val || '')}
                                allowClear
                                className="min-w-[160px]"
                                options={services.map(s => ({
                                    value: String(getServiceId(s)),
                                    label: s.nom_service,
                                }))}
                            />
                            {(searchText || filterPoste || filterStatut || filterCategorie || filterService) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchText('');
                                        setFilterPoste('');
                                        setFilterStatut('');
                                        setFilterCategorie('');
                                        setFilterService('');
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                                    title={t('common.clearFilters')}
                                >
                                    <X className="w-4 h-4" />
                                    {t('common.clearFilters')}
                                </button>
                            )}
                            <span className="ml-auto text-sm text-gray-400">
                                {filteredPersonnel.length} {t('personnel.membersFound')}
                            </span>
                        </div>
                    </div>

                    <Table
                        columns={columns}
                        dataSource={filteredPersonnel}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `Total: ${total} membre(s)`,
                            showSizeChanger: { showSearch: false },
                            pageSizeOptions: ['5', '10', '20', '50']
                        }}
                        locale={{ emptyText: t('personnel.noPersonnel') }}
                        rowClassName="hover:bg-gray-50 transition-colors"
                        scroll={{ x: 900 }}
                    />
                </motion.div>
            </div>

            {/* Modals */}
            <AddPersonnelModal
                isOpen={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSuccess={fetchPersonnel}
            />
            <EditPersonnelModal
                isOpen={editModalOpen}
                onClose={() => { setEditModalOpen(false); setSelectedPersonnel(null); }}
                onSuccess={fetchPersonnel}
                personnel={selectedPersonnel}
            />
            <PersonnelDetailsModal
                isOpen={detailsModalOpen}
                onClose={() => { setDetailsModalOpen(false); setSelectedPersonnel(null); }}
                personnel={selectedPersonnel}
                onManagePrimes={(p) => { setDetailsModalOpen(false); setSelectedPersonnel(p); setPrimesModalOpen(true); }}
            />
            <PersonnelPrimesModal
                isOpen={primesModalOpen}
                onClose={() => { setPrimesModalOpen(false); setSelectedPersonnel(null); }}
                personnel={selectedPersonnel}
                services={services}
            />
        </CustomDashboard>
    );
}

export default AdminPersonnelPage;
