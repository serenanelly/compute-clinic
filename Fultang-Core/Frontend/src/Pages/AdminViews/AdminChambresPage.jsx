import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { BedDouble, Plus, Search, Edit3, Trash2, Check, X } from 'lucide-react';
import { Table, message, Modal as AntModal, Tag, Input, Progress } from 'antd';
import { CustomDashboard } from '../../GlobalComponents/CustomDashboard.jsx';
import { AdminNavBar } from './AdminNavBar.jsx';
import { newAdminNavLink } from './newAdminNavLink.js';
import { getAllChambres, createChambre, updateChambre, deleteChambre, getTypesSalle } from '../../services/chambresApi';
import { getAllServices } from '../../services/servicesApi';

/**
 * Page de gestion des chambres hospitalières.
 * Affiche les chambres avec jauge de remplissage et permet les opérations CRUD.
 */
export function AdminChambresPage() {
    const { t } = useTranslation();
    const [chambres, setChambres] = useState([]);
    const [filteredChambres, setFilteredChambres] = useState([]);
    const [services, setServices] = useState([]);
    const [typesSalle, setTypesSalle] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    // Modal ajout/edit
    const [modalOpen, setModalOpen] = useState(false);
    const [editingChambre, setEditingChambre] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [formData, setFormData] = useState({
        numero: '',
        type: '',
        nb_places_total: 1,
        nb_places_disponibles: 1,
        tarif_journalier: '',
        service: ''
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        fetchChambres();
        fetchServices();
        fetchTypesSalle();
    }, []);

    useEffect(() => {
        if (searchText.trim() === '') {
            setFilteredChambres(chambres);
        } else {
            const lower = searchText.toLowerCase();
            setFilteredChambres(
                chambres.filter(c =>
                    String(c.numero || '').toLowerCase().includes(lower) ||
                    String(c.service_nom || '').toLowerCase().includes(lower)
                )
            );
        }
    }, [searchText, chambres]);

    const fetchChambres = async () => {
        setLoading(true);
        try {
            const response = await getAllChambres();
            const data = response.results || response.data || response || [];
            setChambres(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching chambres:', error);
            message.error('Erreur lors du chargement des chambres');
        } finally {
            setLoading(false);
        }
    };

    const fetchServices = async () => {
        try {
            const response = await getAllServices();
            const data = response.results || response.data || response || [];
            setServices(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const fetchTypesSalle = async () => {
        try {
            const response = await getTypesSalle();
            const data = response.results || response.data || response || [];
            setTypesSalle(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching types salle:', error);
        }
    };

    const openAddModal = () => {
        setEditingChambre(null);
        setFormData({ numero: '', type: '', nb_places_total: 1, nb_places_disponibles: 1, tarif_journalier: '', service: '' });
        setErrors({});
        setModalOpen(true);
    };

    const openEditModal = (chambre) => {
        setEditingChambre(chambre);
        setFormData({
            numero: chambre.numero || '',
            type: chambre.type || '',
            nb_places_total: chambre.nb_places_total || 1,
            nb_places_disponibles: chambre.nb_places_disponibles ?? chambre.nb_places_total ?? 1,
            tarif_journalier: chambre.tarif_journalier || '',
            service: chambre.service || ''
        });
        setErrors({});
        setModalOpen(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.numero) newErrors.numero = t('services.required');
        if (!formData.type) newErrors.type = t('services.required');
        if (!formData.nb_places_total || formData.nb_places_total < 1) newErrors.nb_places_total = t('services.required');
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setFormLoading(true);
        try {
            const dataToSend = {
                numero: formData.numero,
                type: parseInt(formData.type, 10),
                nb_places_total: parseInt(formData.nb_places_total, 10),
                nb_places_disponibles: parseInt(formData.nb_places_disponibles, 10)
            };
            if (formData.service) {
                dataToSend.service = parseInt(formData.service, 10);
            }

            if (editingChambre) {
                await updateChambre(editingChambre.id, dataToSend);
                message.success(t('chambres.updateSuccess'));
            } else {
                await createChambre(dataToSend);
                message.success(t('chambres.createSuccess'));
            }

            setModalOpen(false);
            fetchChambres();
        } catch (error) {
            console.error('Error saving chambre:', error);
            const msg = error.response?.data?.detail || error.response?.data?.erreurs
                ? JSON.stringify(error.response?.data?.erreurs || error.response?.data?.detail)
                : 'Erreur lors de la sauvegarde';
            message.error(msg);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = (chambre) => {
        AntModal.confirm({
            title: t('chambres.confirmDelete'),
            content: `Chambre n° ${chambre.numero}`,
            okText: t('common.delete'),
            cancelText: t('common.cancel'),
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await deleteChambre(chambre.id);
                    message.success(t('chambres.deleteSuccess'));
                    fetchChambres();
                } catch (error) {
                    console.error('Error deleting chambre:', error);
                    const msg = error.response?.data?.detail || 'Erreur lors de la suppression';
                    message.error(msg);
                }
            }
        });
    };

    const columns = [
        {
            title: '#',
            key: 'index',
            width: 50,
            render: (_, __, index) => <span className="text-gray-400 font-medium">{index + 1}</span>
        },
        {
            title: t('chambres.roomNumber'),
            dataIndex: 'numero',
            key: 'numero',
            render: (text) => (
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
                        <BedDouble className="w-5 h-5" />
                    </div>
                    <span className="font-semibold text-gray-800">N° {text}</span>
                </div>
            )
        },
        {
            title: t('chambres.roomType'),
            dataIndex: 'type_nom',
            key: 'type_nom',
            render: (text) => <Tag color="geekblue">{text || '—'}</Tag>
        },
        {
            title: 'Service',
            dataIndex: 'service_nom',
            key: 'service_nom',
            render: (text) => <span className="text-gray-600">{text || '—'}</span>
        },
        {
            title: t('chambres.availability'),
            key: 'availability',
            width: 200,
            render: (_, record) => {
                const total = record.nb_places_total || 1;
                const dispo = record.nb_places_disponibles ?? total;
                const pct = Math.round((dispo / total) * 100);
                const statusColor = pct > 50 ? '#10B981' : pct > 0 ? '#F59E0B' : '#EF4444';

                return (
                    <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-500">{dispo} / {total} places</span>
                            {dispo > 0
                                ? <Tag color="green" className="m-0">{t('chambres.available')}</Tag>
                                : <Tag color="red" className="m-0">{t('chambres.full')}</Tag>
                            }
                        </div>
                        <Progress
                            percent={pct}
                            size="small"
                            strokeColor={statusColor}
                            showInfo={false}
                        />
                    </div>
                );
            }
        },
        {
            title: t('chambres.dailyRate'),
            dataIndex: 'tarif_journalier',
            key: 'tarif_journalier',
            render: (val) => (
                <span className="font-semibold text-gray-700">
                    {val ? `${Number(val).toLocaleString('fr-FR')} FCFA` : '—'}
                </span>
            )
        },
        {
            title: t('services.actions'),
            key: 'actions',
            width: 120,
            render: (_, record) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => openEditModal(record)}
                        className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                        title={t('common.edit')}
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <CustomDashboard linkList={newAdminNavLink} requiredRole={"Admin"} requiredFunctionalService="GESTION_INFRASTRUCTURES">
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
                                <BedDouble className="w-7 h-7 text-primary-end" />
                                {t('chambres.title')}
                            </h1>
                            <p className="text-gray-500 mt-1">{t('admin.manageHospitalRooms')}</p>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={openAddModal}
                            className="flex items-center gap-2 bg-gradient-to-r from-primary-start to-primary-end text-white px-5 py-3 rounded-xl shadow-lg hover:shadow-xl transition-shadow font-medium"
                        >
                            <Plus className="w-5 h-5" />
                            {t('chambres.addChambre')}
                        </motion.button>
                    </div>
                </motion.div>

                {/* Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden"
                >
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-sm text-gray-500 font-medium">
                            {filteredChambres.length} chambre(s) trouvée(s)
                        </span>
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
                        dataSource={filteredChambres}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `Total: ${total} chambre(s)`,
                            showSizeChanger: { showSearch: false },
                            pageSizeOptions: ['5', '10', '20']
                        }}
                        locale={{ emptyText: t('chambres.noChambre') }}
                        rowClassName="hover:bg-gray-50 transition-colors"
                    />
                </motion.div>
            </div>

            {/* Add / Edit Modal */}
            <AntModal
                title={
                    <div className="flex items-center gap-2">
                        <BedDouble className="w-5 h-5 text-primary-end" />
                        <span>{editingChambre ? t('chambres.editChambre') : t('chambres.addChambre')}</span>
                    </div>
                }
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSubmit}
                confirmLoading={formLoading}
                okText={t('common.save')}
                cancelText={t('common.cancel')}
                width={550}
            >
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('chambres.roomNumber')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="numero"
                                value={formData.numero}
                                onChange={handleFormChange}
                                placeholder="Ex: 101, A-12..."
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.numero ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            {errors.numero && <p className="text-red-500 text-xs mt-1">{errors.numero}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('chambres.roomType')} <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleFormChange}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.type ? 'border-red-500' : 'border-gray-300'}`}
                            >
                                <option value="">{t('chambres.selectType')}</option>
                                {typesSalle.map(ty => <option key={ty.id} value={ty.id}>{ty.nom}</option>)}
                            </select>
                            {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Service
                            </label>
                            <select
                                name="service"
                                value={formData.service}
                                onChange={handleFormChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end"
                            >
                                <option value="">— Aucun —</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.nom_service}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('chambres.totalPlaces')} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                name="nb_places_total"
                                value={formData.nb_places_total}
                                onChange={handleFormChange}
                                min="1"
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-end ${errors.nb_places_total ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            {errors.nb_places_total && <p className="text-red-500 text-xs mt-1">{errors.nb_places_total}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('chambres.availablePlaces')}
                            </label>
                            <input
                                type="number"
                                name="nb_places_disponibles"
                                value={formData.nb_places_disponibles}
                                onChange={handleFormChange}
                                min="0"
                                max={formData.nb_places_total}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-end"
                            />
                        </div>
                    </div>
                </div>
            </AntModal>
        </CustomDashboard>
    );
}

export default AdminChambresPage;
