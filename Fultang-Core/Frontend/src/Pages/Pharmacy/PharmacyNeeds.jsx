import { useState, useEffect } from 'react';
import { ShoppingCart, Search, RefreshCw, Plus, Clock, CheckCircle, XCircle, AlertCircle, User, Calendar, Send, MessageSquare, Trash2, Package } from 'lucide-react';
import { Modal, Input, Button, Tag, Select, InputNumber, Table } from 'antd';
import { PharmacyNavBar } from './PharmacyNavBar';
import { CustomDashboard } from '../../GlobalComponents/CustomDashboard';
import { pharmacyNavLink } from './lib/pharmacyNavLink';
import { getAllBesoins, createBesoin, createLigneBesoin, getAllMateriels, getLignesBesoin } from '../../services/comptabiliteMatiereApi';
import { useFeedback } from '../../contexts/FeedbackContext.jsx';
import Loader from '../../GlobalComponents/Loader';
import dayjs from 'dayjs';
import { useAuthentication } from '../../Utils/Provider.jsx';

const { TextArea } = Input;

export function PharmacyNeeds() {
    const { userData } = useAuthentication();
    const [besoins, setBesoins] = useState([]);
    const [filteredBesoins, setFilteredBesoins] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedBesoin, setSelectedBesoin] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [materiels, setMateriels] = useState([]);

    // Create form state - updated to match the design
    const [formData, setFormData] = useState({
        objet: '',
        description: ''
    });
    const [lignesForm, setLignesForm] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showSuccess, showError, showWarning } = useFeedback();

    useEffect(() => {
        fetchBesoins();
        fetchMateriels();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [searchTerm, besoins, statusFilter]);

    const fetchBesoins = async () => {
        setIsLoading(true);
        try {
            const response = await getAllBesoins();
            let data = [];
            if (Array.isArray(response)) {
                data = response;
            } else if (response?.data && Array.isArray(response.data)) {
                data = response.data;
            } else if (response?.results && Array.isArray(response.results)) {
                data = response.results;
            }
            setBesoins(data);
            setFilteredBesoins(data);
        } catch (error) {
            console.error('Error fetching besoins:', error);
            showError('Erreur lors de la récupération des besoins.', 'Échec du chargement');
            setBesoins([]);
            setFilteredBesoins([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMateriels = async () => {
        try {
            const response = await getAllMateriels();
            let data = [];
            if (Array.isArray(response)) {
                data = response;
            } else if (response?.data && Array.isArray(response.data)) {
                data = response.data;
            } else if (response?.results && Array.isArray(response.results)) {
                data = response.results;
            }
            setMateriels(data);
        } catch (error) {
            console.error('Error fetching materiels:', error);
        }
    };

    const applyFilters = () => {
        let filtered = [...besoins];

        if (searchTerm.trim() !== '') {
            filtered = filtered.filter(besoin =>
                besoin.motif?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                besoin.idPersonnel_emetteur_nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                besoin.commentaire_directeur?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(besoin => besoin.statut === statusFilter);
        }

        setFilteredBesoins(filtered);
    };

    const handleViewBesoin = async (besoin) => {
        setSelectedBesoin(besoin);
        // Fetch lignes for this besoin
        try {
            const lignesResponse = await getLignesBesoin(besoin.idBesoin);
            let lignes = [];
            if (Array.isArray(lignesResponse)) {
                lignes = lignesResponse;
            } else if (lignesResponse?.results) {
                lignes = lignesResponse.results;
            }
            setSelectedBesoin({ ...besoin, lignes });
        } catch (error) {
            console.error('Error fetching lignes:', error);
            setSelectedBesoin({ ...besoin, lignes: [] });
        }
        setIsDetailModalOpen(true);
    };

    const handleAddLigne = () => {
        setLignesForm([...lignesForm, {
            id: Date.now(),
            materiel_nom: '',
            quantite_demandee: 1,
            priorite: 'NORMAL',
            description_justification: ''
        }]);
    };

    const handleRemoveLigne = (id) => {
        setLignesForm(lignesForm.filter(ligne => ligne.id !== id));
    };

    const handleLigneChange = (id, field, value) => {
        setLignesForm(lignesForm.map(ligne =>
            ligne.id === id ? { ...ligne, [field]: value } : ligne
        ));
    };

    const handleCreateBesoin = async () => {
        if (!formData.objet.trim()) {
            showWarning('Veuillez saisir l\'objet du besoin.', 'Champ requis');
            return;
        }
        if (!formData.description.trim()) {
            showWarning('Veuillez saisir la description du besoin.', 'Champ requis');
            return;
        }
        if (lignesForm.length === 0) {
            showWarning('Veuillez ajouter au moins un matériel.', 'Matériel requis');
            return;
        }
        // Validate all lignes have materiel_nom
        const invalidLigne = lignesForm.find(l => !l.materiel_nom.trim());
        if (invalidLigne) {
            showWarning('Veuillez saisir le nom du matériel pour chaque ligne.', 'Champ requis');
            return;
        }

        setIsSubmitting(true);
        try {
            // Create the besoin with motif combining objet and description
            const motif = `[${formData.objet}]\n\n${formData.description}`;
            const besoinResponse = await createBesoin({
                motif: motif,
                idPersonnel_emetteur: userData?.id || null
            });

            const besoinId = besoinResponse.idBesoin;

            // Create all lignes
            for (const ligne of lignesForm) {
                await createLigneBesoin({
                    id_besoin: besoinId,
                    materiel_nom: ligne.materiel_nom,
                    quantite_demandee: ligne.quantite_demandee,
                    priorite: ligne.priorite,
                    description_justification: ligne.description_justification || ''
                });
            }

            showSuccess('Le besoin a été créé et soumis avec succès.', 'Besoin créé');
            setIsCreateModalOpen(false);
            resetForm();
            fetchBesoins();
        } catch (error) {
            console.error('Error creating besoin:', error);
            showError('Erreur lors de la création du besoin.', 'Échec');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({ objet: '', description: '' });
        setLignesForm([]);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return dayjs(dateString).format('DD/MM/YYYY HH:mm');
    };

    const getStatusConfig = (statut) => {
        const configs = {
            'NON_TRAITE': {
                color: 'gray',
                bgClass: 'bg-gray-100 text-gray-600',
                icon: Clock,
                label: 'Non Traité'
            },
            'EN_COURS': {
                color: 'orange',
                bgClass: 'bg-yellow-100 text-yellow-600',
                icon: AlertCircle,
                label: 'En Cours'
            },
            'TRAITE': {
                color: 'green',
                bgClass: 'bg-green-100 text-green-600',
                icon: CheckCircle,
                label: 'Traité'
            },
            'REJETE': {
                color: 'red',
                bgClass: 'bg-red-100 text-red-600',
                icon: XCircle,
                label: 'Rejeté'
            }
        };
        return configs[statut] || configs['NON_TRAITE'];
    };

    const statusOptions = [
        { value: 'all', label: 'Tous' },
        { value: 'NON_TRAITE', label: 'Non Traité' },
        { value: 'EN_COURS', label: 'En Cours' },
        { value: 'TRAITE', label: 'Traité' },
        { value: 'REJETE', label: 'Rejeté' }
    ];

    const prioriteOptions = [
        { value: 'LOW', label: 'Faible' },
        { value: 'NORMAL', label: 'Normale' },
        { value: 'HIGH', label: 'Haute' }
    ];

    const getPrioriteColor = (priorite) => {
        const colors = {
            'LOW': 'blue',
            'NORMAL': 'green',
            'HIGH': 'red'
        };
        return colors[priorite] || 'default';
    };

    const pendingCount = besoins.filter(b => b.statut === 'EN_COURS' || b.statut === 'NON_TRAITE').length;

    // Table columns for lignes in detail modal
    const lignesColumns = [
        {
            title: 'Matériel',
            dataIndex: 'materiel_nom',
            key: 'materiel_nom',
        },
        {
            title: 'Quantité demandée',
            dataIndex: 'quantite_demandee',
            key: 'quantite_demandee',
            width: 120,
            align: 'center',
        },
        {
            title: 'Priorité',
            dataIndex: 'priorite',
            key: 'priorite',
            width: 100,
            render: (priorite) => (
                <Tag color={getPrioriteColor(priorite)}>
                    {prioriteOptions.find(p => p.value === priorite)?.label || priorite}
                </Tag>
            )
        },
        {
            title: 'Quantité accordée',
            dataIndex: 'quantite_accordee',
            key: 'quantite_accordee',
            width: 120,
            align: 'center',
            render: (val) => val ?? '-'
        },
    ];

    return (
        <CustomDashboard linkList={pharmacyNavLink} requiredRole="Pharmacist">
            <PharmacyNavBar />

            <div className="p-6">
                {/* Header */}
                <div className="bg-gradient-to-br from-primary-end to-primary-start text-white rounded-lg p-6 mb-6 shadow-lg">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <ShoppingCart className="w-8 h-8" />
                            <div>
                                <h1 className="text-2xl font-bold">Besoins</h1>
                                <p className="text-sm opacity-90">
                                    {filteredBesoins.length} besoin{filteredBesoins.length !== 1 ? 's' : ''}
                                    {pendingCount > 0 && ` (${pendingCount} en attente)`}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={fetchBesoins}
                                className="flex items-center gap-2 bg-white text-primary-end px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                                disabled={isLoading}
                            >
                                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                                Actualiser
                            </button>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                                Nouveau Besoin
                            </button>
                        </div>
                    </div>
                </div>

                {/* Status Filter Pills */}
                <div className="mb-4 flex flex-wrap gap-2">
                    {statusOptions.map(option => (
                        <button
                            key={option.value}
                            onClick={() => setStatusFilter(option.value)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${statusFilter === option.value
                                ? 'bg-primary-end text-white shadow-md'
                                : 'bg-white text-gray-600 border border-gray-300 hover:border-primary-end'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {/* Search Bar */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Rechercher par motif..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary-end"
                        />
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader size="medium" color="primary-end" />
                    </div>
                ) : filteredBesoins.length === 0 ? (
                    <div className="text-center py-12">
                        <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">
                            {searchTerm || statusFilter !== 'all' ? 'Aucun besoin trouvé' : 'Aucun besoin disponible'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {filteredBesoins.map((besoin) => {
                            const statusConfig = getStatusConfig(besoin.statut);
                            const StatusIcon = statusConfig.icon;

                            return (
                                <div
                                    key={besoin.idBesoin}
                                    onClick={() => handleViewBesoin(besoin)}
                                    className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-300 cursor-pointer"
                                >
                                    {/* Header Row */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-gradient-to-br from-primary-end to-primary-start text-white rounded-full w-14 h-14 flex items-center justify-center font-bold text-lg shadow-md">
                                                {besoin.idPersonnel_emetteur_nom?.[0] || 'B'}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-800">
                                                    Besoin #{besoin.idBesoin}
                                                </h3>
                                                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        {besoin.idPersonnel_emetteur_nom || 'Inconnu'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {formatDate(besoin.date_creation_besoin)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.bgClass}`}>
                                            <StatusIcon className="w-4 h-4" />
                                            {statusConfig.label}
                                        </div>
                                    </div>

                                    {/* Motif */}
                                    <div className="bg-gray-50 p-3 rounded-lg mb-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                                            <ShoppingCart className="w-4 h-4 text-primary-end" />
                                            <span>Motif du besoin</span>
                                        </div>
                                        <p className="text-gray-600 text-sm line-clamp-3">
                                            {besoin.motif}
                                        </p>
                                    </div>

                                    {/* Director comment */}
                                    {besoin.commentaire_directeur && (
                                        <div className="flex items-start gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                                            <MessageSquare className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <span className="font-medium text-blue-700">Réponse du directeur:</span>
                                                <p className="text-gray-600 mt-1 line-clamp-2">{besoin.commentaire_directeur}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <Modal
                title={null}
                open={isDetailModalOpen}
                onCancel={() => setIsDetailModalOpen(false)}
                footer={null}
                width={700}
                centered
            >
                {selectedBesoin && (() => {
                    const statusConfig = getStatusConfig(selectedBesoin.statut);
                    const StatusIcon = statusConfig.icon;

                    return (
                        <div>
                            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
                                <div className={`rounded-xl w-14 h-14 flex items-center justify-center ${statusConfig.bgClass}`}>
                                    <StatusIcon className="w-7 h-7" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Besoin #{selectedBesoin.idBesoin}</h2>
                                    <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
                                </div>
                            </div>

                            <div className="mb-5">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Motif du besoin</label>
                                <div className="bg-gray-50 rounded-lg p-4 mt-2">
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedBesoin.motif}</p>
                                </div>
                            </div>

                            {/* Lignes du besoin */}
                            {selectedBesoin.lignes && selectedBesoin.lignes.length > 0 && (
                                <div className="mb-5">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Matériels demandés</label>
                                    <div className="mt-2">
                                        <Table
                                            dataSource={selectedBesoin.lignes}
                                            columns={lignesColumns}
                                            rowKey="id_ligne_besoin"
                                            pagination={false}
                                            size="small"
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedBesoin.commentaire_directeur && (
                                <div className="mb-5">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Commentaire du directeur</label>
                                    <div className={`rounded-lg p-4 mt-2 border ${statusConfig.bgClass}`}>
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedBesoin.commentaire_directeur}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Émis par</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <User className="w-4 h-4 text-primary-end" />
                                        <span className="text-sm">{selectedBesoin.idPersonnel_emetteur_nom || 'Inconnu'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Date de création</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Calendar className="w-4 h-4 text-primary-end" />
                                        <span className="text-sm">{formatDate(selectedBesoin.date_creation_besoin)}</span>
                                    </div>
                                </div>
                                {selectedBesoin.date_traitement_directeur && (
                                    <div className="col-span-2">
                                        <label className="text-xs font-semibold text-gray-500 uppercase">Date de traitement</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span className="text-sm">{formatDate(selectedBesoin.date_traitement_directeur)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* Create Modal - Updated to match design */}
            <Modal
                title={null}
                open={isCreateModalOpen}
                onCancel={() => {
                    setIsCreateModalOpen(false);
                    resetForm();
                }}
                footer={null}
                width={800}
                centered
            >
                <div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-gradient-to-br from-primary-end to-primary-start rounded-xl w-12 h-12 flex items-center justify-center">
                            <Plus className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Exprimer un besoin</h2>
                            <p className="text-sm text-gray-500">Soumettre une demande de matériel</p>
                        </div>
                    </div>

                    {/* Objet */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2 text-gray-700">Objet *</label>
                        <Input
                            value={formData.objet}
                            onChange={(e) => setFormData({ ...formData, objet: e.target.value })}
                            placeholder="Brève description du besoin"
                            className="rounded-lg"
                        />
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2 text-gray-700">Description *</label>
                        <TextArea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Détails du besoin"
                            rows={3}
                            className="rounded-lg"
                        />
                    </div>

                    {/* Lignes - Table de matériels */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-medium text-gray-700">Matériels demandés</label>
                            <Button
                                type="dashed"
                                onClick={handleAddLigne}
                                icon={<Plus className="w-4 h-4" />}
                                className="flex items-center gap-1"
                            >
                                Ajouter un matériel
                            </Button>
                        </div>

                        {lignesForm.length === 0 ? (
                            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 mb-3">Aucun matériel ajouté</p>
                                <Button
                                    type="primary"
                                    onClick={handleAddLigne}
                                    icon={<Plus className="w-4 h-4" />}
                                    className="bg-gradient-to-r from-primary-end to-primary-start border-none"
                                >
                                    Ajouter un matériel
                                </Button>
                            </div>
                        ) : (
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Matériel</th>
                                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase w-24">Quantité</th>
                                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase w-32">Priorité</th>
                                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Justification</th>
                                            <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase w-16">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {lignesForm.map((ligne) => (
                                            <tr key={ligne.id} className="bg-white hover:bg-gray-50">
                                                <td className="px-3 py-2">
                                                    <Input
                                                        value={ligne.materiel_nom}
                                                        onChange={(e) => handleLigneChange(ligne.id, 'materiel_nom', e.target.value)}
                                                        placeholder="Nom du matériel"
                                                        size="small"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <InputNumber
                                                        value={ligne.quantite_demandee}
                                                        onChange={(val) => handleLigneChange(ligne.id, 'quantite_demandee', val || 1)}
                                                        min={1}
                                                        size="small"
                                                        className="w-full"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Select
                                                        value={ligne.priorite}
                                                        onChange={(val) => handleLigneChange(ligne.id, 'priorite', val)}
                                                        options={prioriteOptions}
                                                        size="small"
                                                        className="w-full"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        value={ligne.description_justification}
                                                        onChange={(e) => handleLigneChange(ligne.id, 'description_justification', e.target.value)}
                                                        placeholder="Justification (optionnel)"
                                                        size="small"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <Button
                                                        type="text"
                                                        danger
                                                        icon={<Trash2 className="w-4 h-4" />}
                                                        onClick={() => handleRemoveLigne(ligne.id)}
                                                        size="small"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 justify-end border-t pt-4">
                        <Button
                            onClick={() => {
                                setIsCreateModalOpen(false);
                                resetForm();
                            }}
                            className="rounded-lg h-10 px-6"
                        >
                            Annuler
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleCreateBesoin}
                            loading={isSubmitting}
                            icon={<Send className="w-4 h-4" />}
                            className="rounded-lg h-10 px-6 bg-gradient-to-r from-primary-end to-primary-start border-none"
                        >
                            Soumettre le besoin
                        </Button>
                    </div>
                </div>
            </Modal>
        </CustomDashboard>
    );
}
