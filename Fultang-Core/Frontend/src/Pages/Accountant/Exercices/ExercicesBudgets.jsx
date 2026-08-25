import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Tag, Space, Modal, Form, Input, DatePicker, InputNumber, Select, Row, Col, message, Progress, Alert, Checkbox } from 'antd';
import { CalendarOutlined, BarChartOutlined, PlusOutlined, LockOutlined, CloudUploadOutlined, HistoryOutlined, StopOutlined } from '@ant-design/icons';
import {
    Calendar,
    Briefcase,
    ShieldCheck,
    Award,
    Activity,
    Layers,
    PieChart,
    ChevronRight,
    ArrowUpRight
} from 'lucide-react';
import {
    getExercices, createExercice, cloturerExercice, genererReportNouveau,
    getBudgets, createBudget, getEvaluationBudget,
    getCategoriesSortie,
    getExerciceComparatif, getExerciceSyntheseHistorique,
    getBilan, getBalance, getCompteResultat, getFluxTresorerie
} from '../../../services/accountantApi';
import AccountantLayout from '../AccountantLayout';
import HistoriqueComparatifTab from './HistoriqueComparatifTab';

const { Option } = Select;

export const ExercicesBudgetsPage = () => {
    const [activeTab, setActiveTab] = useState('exercices');
    const [loading, setLoading] = useState(false);

    // Data
    const [exercices, setExercices] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [consumption, setConsumption] = useState([]);
    const [comparatif, setComparatif] = useState([]);
    const [selectedHistoriqueId, setSelectedHistoriqueId] = useState(null);
    const [syntheseHistorique, setSyntheseHistorique] = useState(null);
    const [rapportHistorique, setRapportHistorique] = useState(null);
    const [rapportType, setRapportType] = useState('bilan');
    const [categoriesSortie, setCategoriesSortie] = useState([]);
    const exerciceActif = exercices.find(e => e.statut === 'ouvert');
    const exercicesClos = exercices.filter(e => e.statut !== 'ouvert');
    const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n || 0);

    // Modals
    const [exModalVisible, setExModalVisible] = useState(false);
    const [exForm] = Form.useForm();

    const [bgModalVisible, setBgModalVisible] = useState(false);
    const [bgForm] = Form.useForm();

    const fetchData = async (tab) => {
        setLoading(true);
        try {
            if (tab === 'exercices' || tab === 'historique') {
                const res = await getExercices();
                const list = res || [];
                setExercices(list);
                if (tab === 'historique') {
                    const comp = await getExerciceComparatif();
                    const rows = comp?.exercices || [];
                    setComparatif(rows);
                    const clos = list.filter(e => e.statut !== 'ouvert');
                    if (clos.length && !selectedHistoriqueId) {
                        const last = clos[clos.length - 1];
                        setSelectedHistoriqueId(last.id);
                        await loadSyntheseHistorique(last.id);
                    }
                }
            } else if (tab === 'budgets') {
                const [res, cats] = await Promise.all([
                    getBudgets(),
                    getCategoriesSortie().catch(() => []),
                ]);
                setCategoriesSortie(cats || []);
                const budgetsList = res || [];
                setBudgets(budgetsList);

                // Service labels mapping
                const serviceNames = {
                    maternite: "Maternité & Gynécologie",
                    pediatrie: "Pédiatrie",
                    chirurgie: "Chirurgie Générale",
                    laboratoire: "Laboratoire d'analyses",
                    pharmacie: "Pharmacie"
                };

                // Aggregate client-side to prevent crashes from invalid objects in Table dataSource
                const serviceConsumption = Object.keys(serviceNames).map(key => {
                    const serviceBudgets = budgetsList.filter(b => b.service_hospitalier === key);
                    const alloue = serviceBudgets.reduce((sum, b) => sum + parseFloat(b.montant_prevu || 0), 0);
                    const consomme = serviceBudgets.reduce((sum, b) => sum + parseFloat(b.montant_consomme || 0), 0);
                    return {
                        service: serviceNames[key],
                        alloue,
                        consomme
                    };
                }).filter(s => s.alloue > 0 || s.consomme > 0);

                setConsumption(serviceConsumption);

                const exRes = await getExercices();
                setExercices(exRes || []);
            }
        } catch (error) {
            console.error("Error loading exercices or budgets:", error);
            message.error("Impossible de récupérer les données de gestion financière.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(activeTab);
    }, [activeTab]);

    const loadSyntheseHistorique = async (exerciceId) => {
        if (!exerciceId) return;
        setLoading(true);
        try {
            const data = await getExerciceSyntheseHistorique(exerciceId);
            setSyntheseHistorique(data);
            setRapportHistorique(null);
        } catch (e) {
            message.error('Impossible de charger la synthèse de cet exercice.');
        } finally {
            setLoading(false);
        }
    };

    const loadRapportHistorique = async (type) => {
        if (!selectedHistoriqueId) return;
        setRapportType(type);
        setLoading(true);
        try {
            const filters = { exercice: selectedHistoriqueId };
            let data;
            if (type === 'bilan') data = await getBilan(filters);
            else if (type === 'balance') data = await getBalance(filters);
            else if (type === 'compte_resultat') data = await getCompteResultat(filters);
            else data = await getFluxTresorerie(filters);
            setRapportHistorique(data);
        } catch (e) {
            message.error('Erreur lors du chargement du rapport.');
        } finally {
            setLoading(false);
        }
    };

    const handleHistoriqueChange = async (id) => {
        setSelectedHistoriqueId(id);
        await loadSyntheseHistorique(id);
    };

    // ====== EXERCICES ======

    /**
     * Règle : la date_fin est automatiquement calculée = date_debut + 12 mois - 1 jour.
     * On ne peut pas ouvrir un exercice si un exercice est déjà ouvert.
     */
    const handleCreateExercice = async (values) => {
        // Bloquer si un exercice est déjà ouvert
        if (exerciceActif) {
            message.error("Impossible : un exercice comptable est déjà ouvert. Clôturez-le avant d'en créer un nouveau.");
            return;
        }

        try {
            setLoading(true);
            const dateDebut = values.date_debut.format('YYYY-MM-DD');
            // Calcul automatique : +12 mois - 1 jour
            const dateFin = values.date_debut.clone().add(12, 'months').subtract(1, 'day').format('YYYY-MM-DD');

            const res = await createExercice({
                code: values.code,
                date_debut: dateDebut,
                date_fin: dateFin,
                statut: 'ouvert'
            });

            // Automatic report à nouveau if authorized
            const lastClosed = exercices.find(e => e.statut !== 'ouvert');
            if (values.autoriser_report && lastClosed) {
                try {
                    await genererReportNouveau(lastClosed.id);
                    message.success(`Report à nouveau de l'exercice ${lastClosed.code} effectué automatiquement avec succès !`);
                } catch (reportError) {
                    console.error("Error doing automatic carry-forward:", reportError);
                    message.warning("L'exercice a été créé, mais le report automatique a échoué. Vous pourrez contacter le support.");
                }
            }

            message.success(`Exercice "${values.code}" ouvert du ${dateDebut} au ${dateFin} (12 mois automatiques).`);
            setExModalVisible(false);
            exForm.resetFields();
            fetchData('exercices');
        } catch (error) {
            message.error(error.response?.data?.error || "Impossible de créer cet exercice.");
        } finally {
            setLoading(false);
        }
    };

    const handleCloturer = async (id) => {
        // ────────────────────────────────────────────────
        // Garde calendaire côté FRONTEND (première ligne de défense)
        // L'exercice ne peut être clôturé qu'après sa date de fin officielle.
        // ────────────────────────────────────────────────
        const exercice = exercices.find(e => e.id === id);
        if (exercice) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dateFin = new Date(exercice.date_fin);
            dateFin.setHours(0, 0, 0, 0);

            if (today < dateFin) {
                const todayStr = today.toLocaleDateString('fr-FR');
                const dateFinStr = dateFin.toLocaleDateString('fr-FR');
                Modal.error({
                    title: '⛔ Clôture Impossible — Exercice non Échu',
                    content: (
                        <div className="space-y-3 pt-2">
                            <p className="text-gray-700 text-sm leading-relaxed">
                                L'exercice <strong>{exercice.code}</strong> ne peut pas être clôturé avant sa date de fin prévue.
                            </p>
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-gray-500 font-medium">Date du système :</span>
                                    <span className="font-bold text-rose-600">{todayStr}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 font-medium">Date de fin de l'exercice :</span>
                                    <span className="font-bold text-[#051161]">{dateFinStr}</span>
                                </div>
                            </div>
                            <p className="text-gray-500 text-xs">
                                La clôture sera disponible à partir du <strong>{dateFinStr}</strong>. Vérifiez également que les données de test (mock data) ont été retirées.
                            </p>
                        </div>
                    ),
                    okText: 'Compris',
                    okButtonProps: {
                        className: 'rounded-xl font-bold bg-[#051161] border-none'
                    },
                    icon: null,
                    centered: true,
                    width: 480,
                });
                return;
            }
        }

        // Confirmation normale si la date est bien passée
        Modal.confirm({
            title: 'Confirmer la Clôture Comptable',
            content: 'La clôture est irréversible. Le résultat net sera calculé et les comptes de charges et produits (Classes 6 & 7) seront soldés. Continuer ?',
            okText: 'Clôturer Définitivement',
            okType: 'danger',
            cancelText: 'Annuler',
            onOk: async () => {
                try {
                    setLoading(true);
                    const res = await cloturerExercice(id);
                    message.success(
                        `Exercice clôturé ! Résultat Net : ${new Intl.NumberFormat('fr-FR').format(res.resultat_net || 0)} FCFA`
                    );
                    fetchData('exercices');
                } catch (error) {
                    // Propager le message d'erreur précis venant du backend (date, balance, etc.)
                    const backendMsg = error.response?.data?.error;
                    message.error(backendMsg || "Impossible de clôturer. Vérifiez que la balance est équilibrée.");
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    // ====== BUDGETS ======

    const handleCreateBudget = async (values) => {
        try {
            setLoading(true);
            const serviceLabels = {
                maternite: 'Maternité & Gynécologie',
                pediatrie: 'Pédiatrie',
                chirurgie: 'Chirurgie Générale',
                laboratoire: "Laboratoire d'analyses",
                pharmacie: 'Pharmacie',
                neurologie: 'Neurologie',
            };
            await createBudget({
                exercice: values.exercice_id,
                categorie: values.categorie_id,
                libelle: values.libelle || `Budget ${serviceLabels[values.service_hospitalier] || values.service_hospitalier}`,
                service_hospitalier: values.service_hospitalier,
                montant_prevu: values.montant_prevu,
                priorite: values.priorite || 'normale',
            });
            message.success("Dotation budgétaire enregistrée !");
            setBgModalVisible(false);
            bgForm.resetFields();
            fetchData('budgets');
        } catch (error) {
            message.error("Erreur lors de la création de la dotation budgétaire.");
        } finally {
            setLoading(false);
        }
    };

    // ====== COLONNES ======

    const exColumns = [
        { title: 'Code', dataIndex: 'code', key: 'code', render: c => <span className="font-extrabold text-[#051161] tracking-wider">{c}</span> },
        { title: 'Statut', dataIndex: 'statut', key: 'statut', render: s => (
            <Tag color={s === 'ouvert' ? 'green' : 'red'} className="font-bold px-3 py-1 rounded-full uppercase border-none text-[11px] shadow-sm tracking-wider">
                {s === 'ouvert' ? 'Actif' : s}
            </Tag>
        )},
        { title: 'Date Début', dataIndex: 'date_debut', key: 'debut', render: d => new Date(d).toLocaleDateString('fr-FR') },
        { title: 'Date Fin', dataIndex: 'date_fin', key: 'fin', render: d => new Date(d).toLocaleDateString('fr-FR') },
        {
            title: 'Actions de fin de période',
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                <Space>
                    <Button
                        type="primary"
                        danger
                        icon={<LockOutlined />}
                        disabled={record.statut !== 'ouvert'}
                        onClick={() => handleCloturer(record.id)}
                        className="rounded-lg font-medium shadow-sm hover:scale-[1.02] transition-all duration-150"
                    >
                        Clôturer l'exercice
                    </Button>
                </Space>
            )
        }
    ];

    const historiqueColumns = [
        { title: 'Code', dataIndex: 'code', key: 'code', render: c => <span className="font-extrabold text-[#051161] tracking-wider">{c}</span> },
        { title: 'Date Ouverture', dataIndex: 'date_debut', key: 'debut', render: d => new Date(d).toLocaleDateString('fr-FR') },
        { title: 'Date Clôture', dataIndex: 'date_fin', key: 'fin', render: d => new Date(d).toLocaleDateString('fr-FR') },
        { title: 'Clôturé par', dataIndex: 'cree_par_nom', key: 'user', render: u => <span className="font-medium text-gray-600">{u || 'Directeur Financier'}</span> },
        { title: 'Statut', dataIndex: 'statut', key: 'statut', render: s => (
            <Tag color="red" className="font-bold px-3 py-1 rounded-full uppercase border-none text-[11px] shadow-sm tracking-wider">
                {s.toUpperCase()}
            </Tag>
        ) },
        { title: 'Résultat Net (Calculé)', dataIndex: 'resultat_net', key: 'resultat', align: 'right', render: r => r !== null && r !== undefined ? (
            <span style={{ fontWeight: '800', color: r >= 0 ? '#10b981' : '#f43f5e' }} className="text-base">
                {new Intl.NumberFormat('fr-FR').format(r)} FCFA
            </span>
        ) : '-' }
    ];

    const bgColumns = [
        { title: 'Service Clinique', key: 'service', render: (_, r) => {
            const serviceNames = {
                maternite: "Maternité & Gynécologie",
                pediatrie: "Pédiatrie",
                chirurgie: "Chirurgie Générale",
                laboratoire: "Laboratoire d'analyses",
                pharmacie: "Pharmacie",
                neurologie: "Neurologie"
            };
            return <span className="font-semibold text-gray-800">{serviceNames[r.service_hospitalier] || r.service_hospitalier || 'Service Commun'}</span>;
        } },
        { title: 'Catégorie', dataIndex: 'categorie_libelle', key: 'categorie', render: (c, r) => <Tag color="blue" className="border-none rounded-full px-3 font-semibold text-[10px]">{c || r.categorie}</Tag> },
        { title: 'Enveloppe', dataIndex: 'montant_prevu', key: 'montant', align: 'right', render: m => <span className="font-extrabold text-[#051161]">{new Intl.NumberFormat('fr-FR').format(m)} FCFA</span> }
    ];

    const cColumns = [
        { title: 'Service', dataIndex: 'service', key: 'service', render: text => <span className="font-semibold text-gray-800">{text}</span> },
        { title: 'Budget Alloué', dataIndex: 'alloue', key: 'alloue', align: 'right', render: m => <span className="font-bold text-[#051161]">{new Intl.NumberFormat('fr-FR').format(m)} FCFA</span> },
        { title: 'Dépenses', dataIndex: 'consomme', key: 'consomme', align: 'right', render: m => <span className="font-bold text-rose-600">{new Intl.NumberFormat('fr-FR').format(m)} FCFA</span> },
        { title: 'Taux Consommation', key: 'taux', render: (_, r) => {
            const pct = r.alloue > 0 ? Math.min(Math.round((r.consomme / r.alloue) * 100), 100) : 0;
            const reste = Math.max(0, r.alloue - r.consomme);
            return (
                <div style={{ width: '100%' }}>
                    <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1">
                        <span>Consommé : {pct}%</span>
                        <span>Reste : {new Intl.NumberFormat('fr-FR').format(reste)} FCFA</span>
                    </div>
                    <Progress 
                        percent={pct} 
                        size="small" 
                        status={pct > 90 ? "exception" : "normal"} 
                        strokeColor={pct > 90 ? '#f43f5e' : pct > 75 ? '#eab308' : '#10b981'}
                        trailColor="#f1f5f9"
                        showInfo={false}
                    />
                </div>
            );
        }}
    ];

    const comparativeChartData = (comparatif.length ? comparatif : exercicesClos).map((row) => ({
        year: String(row.annee || row.year),
        Recettes: row.total_recettes || 0,
        Dépenses: (row.total_sorties ?? row.depenses_operationnelles ?? row.total_depenses) || 0,
        'Charges compt.': row.depenses_comptabilisees ?? 0,
        Résultat: row.resultat_net || 0,
    }));

    const renderHistoriqueRapport = () => {
        if (!rapportHistorique) return null;
        const data = rapportHistorique;
        const ligneCols = [
            { title: 'Compte', dataIndex: 'numero_compte', key: 'num', render: (v) => <span className="font-bold">{v}</span> },
            { title: 'Libellé', dataIndex: 'libelle', key: 'lib' },
            { title: 'Débit', dataIndex: 'debit', key: 'd', align: 'right', render: (v) => fmt(v) },
            { title: 'Crédit', dataIndex: 'credit', key: 'c', align: 'right', render: (v) => fmt(v) },
            { title: 'Solde', dataIndex: 'solde', key: 's', align: 'right', render: (v) => <span className="font-bold">{fmt(v)}</span> },
        ];

        if (rapportType === 'compte_resultat') {
            return (
                <div className="space-y-6">
                    <h4 className="font-extrabold text-[#051161]">{data.titre}</h4>
                    <div>
                        <p className="font-semibold text-rose-600 mb-2">Charges (classe 6)</p>
                        <Table size="small" dataSource={data.charges?.detail || []} columns={ligneCols} rowKey="numero_compte" pagination={false} />
                        <p className="text-right font-bold mt-2">Total charges : {fmt(data.charges?.total)} FCFA</p>
                    </div>
                    <div>
                        <p className="font-semibold text-emerald-600 mb-2">Produits (classe 7)</p>
                        <Table size="small" dataSource={data.produits?.detail || []} columns={ligneCols} rowKey={(r) => `p-${r.numero_compte}`} pagination={false} />
                        <p className="text-right font-bold mt-2">Total produits : {fmt(data.produits?.total)} FCFA</p>
                    </div>
                    <Alert type={data.resultat_net >= 0 ? 'success' : 'error'} message={`Résultat net : ${fmt(data.resultat_net)} FCFA (${data.type_resultat})`} />
                </div>
            );
        }

        if (rapportType === 'balance') {
            const comptes = data.comptes || data;
            return (
                <Table
                    size="small"
                    dataSource={Array.isArray(comptes) ? comptes : []}
                    rowKey="numero_compte"
                    pagination={{ pageSize: 15 }}
                    columns={[
                        { title: 'Compte', dataIndex: 'numero_compte', key: 'n' },
                        { title: 'Libellé', dataIndex: 'libelle', key: 'l' },
                        { title: 'Mvt Débit', dataIndex: 'mouvements_debit', align: 'right', render: fmt },
                        { title: 'Mvt Crédit', dataIndex: 'mouvements_credit', align: 'right', render: fmt },
                        { title: 'Solde Débit', dataIndex: 'solde_debit', align: 'right', render: fmt },
                        { title: 'Solde Crédit', dataIndex: 'solde_credit', align: 'right', render: fmt },
                    ]}
                />
            );
        }

        if (rapportType === 'bilan') {
            return (
                <Row gutter={16}>
                    <Col span={12}>
                        <h4 className="font-bold mb-2">Actif</h4>
                        <Table size="small" dataSource={data.actif?.detail || []} columns={ligneCols} rowKey="numero_compte" pagination={false} />
                        <p className="font-bold text-right mt-2">Total : {fmt(data.actif?.total)} FCFA</p>
                    </Col>
                    <Col span={12}>
                        <h4 className="font-bold mb-2">Passif</h4>
                        <Table size="small" dataSource={data.passif?.detail || []} columns={ligneCols} rowKey={(r) => `passif-${r.numero_compte}`} pagination={false} />
                        <p className="font-bold text-right mt-2">Total : {fmt(data.passif?.total)} FCFA</p>
                    </Col>
                </Row>
            );
        }

        return (
            <div className="space-y-3">
                <h4 className="font-extrabold text-[#051161]">{data.titre || 'Flux de trésorerie'}</h4>
                <p>Flux opérationnels : <strong>{fmt(data.flux_operationnels)} FCFA</strong></p>
                <p>Flux investissement : <strong>{fmt(data.flux_investissement)} FCFA</strong></p>
                <p>Flux financement : <strong>{fmt(data.flux_financement)} FCFA</strong></p>
                <p>Variation nette trésorerie : <strong>{fmt(data.variation_nette_tresorerie)} FCFA</strong></p>
            </div>
        );
    };

    const tabItems = [
        {
            key: 'exercices',
            label: <span className="flex items-center gap-2 font-semibold"><CalendarOutlined /> Exercice Actif</span>,
            children: (
                <div style={{ marginTop: '20px' }} className="space-y-6">
                    {exerciceActif ? (
                        <div className="relative overflow-hidden bg-gradient-to-br from-[#1A73A3] via-[#3B92A3] to-[#50C2B9] p-8 rounded-3xl text-white shadow-xl mb-6 hover:shadow-2xl transition-all duration-300">
                            {/* Decorative background shape */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                            <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                            
                            <Row gutter={[24, 24]} align="middle">
                                <Col xs={24} md={18}>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                                            <ShieldCheck className="w-8 h-8 text-white" />
                                        </div>
                                        <div>
                                            <span className="bg-white/20 text-white font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider backdrop-blur-md">
                                                Période Comptable Active
                                            </span>
                                            <h2 className="text-3xl font-extrabold mt-1 tracking-tight">Exercice {exerciceActif.code || `EX-${exerciceActif.annee}`}</h2>
                                        </div>
                                    </div>
                                    <p className="text-white/80 max-w-2xl text-sm leading-relaxed">
                                        Cet exercice comptable centralise l'ensemble des écritures financières courantes. 
                                        Conformément aux directives du plan SYSCOHADA, sa clôture entraînera automatiquement la génération du résultat net et le report à nouveau pour le prochain exercice.
                                    </p>
                                    <Alert
                                        type="info"
                                        showIcon
                                        className="mt-4 rounded-xl"
                                        message="Après clôture"
                                        description="1) Calcul automatique du résultat net · 2) Génération du report à nouveau (exercice N+1) · 3) Les écritures de l'exercice clôturé passent en lecture seule."
                                    />
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mt-8 pt-6 border-t border-white/10">
                                        <div>
                                            <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Date d'Ouverture</p>
                                            <p className="text-lg font-bold mt-1">{new Date(exerciceActif.date_debut).toLocaleDateString('fr-FR')}</p>
                                        </div>
                                        <div>
                                            <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Échéance de Clôture</p>
                                            <p className="text-lg font-bold mt-1">{new Date(exerciceActif.date_fin).toLocaleDateString('fr-FR')}</p>
                                        </div>
                                        <div>
                                            <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Durée Réglementaire</p>
                                            <p className="text-lg font-bold mt-1 flex items-center gap-1">12 Mois <Award className="w-4 h-4 text-emerald-300" /></p>
                                        </div>
                                    </div>
                                </Col>
                                
                                <Col xs={24} md={6} className="text-right">
                                    <Button 
                                        type="primary" 
                                        danger 
                                        size="large"
                                        icon={<LockOutlined />} 
                                        onClick={() => handleCloturer(exerciceActif.id)}
                                        className="h-14 px-8 rounded-2xl font-bold bg-[#f43f5e] hover:bg-rose-600 border-none shadow-lg w-full md:w-auto hover:scale-[1.02] active:scale-[0.98] transition-all"
                                    >
                                        Clôturer l'Exercice
                                    </Button>
                                </Col>
                            </Row>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-8 rounded-3xl shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex gap-4">
                                <div className="bg-amber-100 p-3 rounded-2xl h-12 w-12 flex items-center justify-center">
                                    <Calendar className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-amber-900">Aucun exercice comptable ouvert</h3>
                                    <p className="text-amber-700 text-sm max-w-xl mt-1">
                                        Vous devez ouvrir un nouvel exercice comptable de 12 mois pour pouvoir enregistrer vos écritures, journaux et budgets.
                                    </p>
                                </div>
                            </div>
                            <Button 
                                type="primary"
                                onClick={() => setExModalVisible(true)}
                                className="h-12 px-6 rounded-xl font-bold bg-[#1A73A3] hover:bg-[#1A73A3]/90 border-none shadow-md hover:scale-[1.02] transition-all"
                            >
                                Ouvrir un Nouvel Exercice
                            </Button>
                        </div>
                    )}

                    <Card
                        style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}
                        bordered={false}
                        title={
                            <div className="flex items-center gap-2 py-1">
                                <Layers className="w-5 h-5 text-[#1A73A3]" />
                                <span className="font-extrabold text-[#051161] text-lg">Périodes & Journaux Comptables</span>
                            </div>
                        }
                        extra={
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setExModalVisible(true)}
                                disabled={!!exerciceActif}
                                className="h-10 rounded-xl font-semibold bg-[#1A73A3] hover:bg-[#1A73A3]/90 border-none shadow-sm flex items-center gap-1"
                            >
                                {exerciceActif ? (
                                    <span>Exercice déjà ouvert</span>
                                ) : 'Ouvrir Nouvel Exercice'}
                            </Button>
                        }
                        className="overflow-hidden"
                    >
                        <Table 
                            dataSource={exercices} 
                            columns={exColumns} 
                            rowKey="id" 
                            loading={loading}
                            pagination={{ pageSize: 5 }}
                            className="custom-table"
                        />
                    </Card>
                </div>
            )
        },
        {
            key: 'historique',
            label: <span className="flex items-center gap-2 font-semibold"><HistoryOutlined /> Historique & Comparatif</span>,
            children: (
                <HistoriqueComparatifTab
                    loading={loading}
                    exerciceActif={exerciceActif}
                    exercicesClos={exercicesClos}
                    selectedHistoriqueId={selectedHistoriqueId}
                    syntheseHistorique={syntheseHistorique}
                    rapportHistorique={rapportHistorique}
                    rapportType={rapportType}
                    comparatif={comparatif}
                    comparativeChartData={comparativeChartData}
                    historiqueColumns={historiqueColumns}
                    onSelectExercice={handleHistoriqueChange}
                    onLoadRapport={loadRapportHistorique}
                    renderRapport={renderHistoriqueRapport}
                />
            )
        },
        {
            key: 'budgets',
            label: <span className="flex items-center gap-2 font-semibold"><BarChartOutlined /> Budgets & Services</span>,
            children: (
                <div style={{ marginTop: '20px' }} className="space-y-6">
                    <Alert
                        type="info"
                        showIcon
                        message="Enveloppes budgétaires (contrôle de gestion)"
                        description="Le budget alloué ici est un plafond d'autorisation prévisionnel — il ne crée pas de liquidités. La trésorerie réelle (classe 5 SYSCOHADA) provient des encaissements comptabilisés. Consommation : uniquement à l'exécution des OP et dépenses menues, pas à l'approbation ni aux encaissements."
                        className="rounded-xl border border-slate-100 bg-slate-50"
                    />
                    <Row gutter={[24, 24]}>
                        <Col xs={24} lg={11}>
                            <Card
                                title={
                                    <div className="flex items-center gap-2 py-1">
                                        <PieChart className="w-5 h-5 text-[#1A73A3]" />
                                        <span className="font-extrabold text-[#051161]">Dotations Budgétaires</span>
                                    </div>
                                }
                                style={{ borderRadius: '16px', border: '1px solid #e2e8f0' }}
                                className="shadow-sm"
                                bordered={false}
                                extra={
                                    <Button 
                                        type="primary" 
                                        size="middle" 
                                        icon={<PlusOutlined />} 
                                        onClick={() => setBgModalVisible(true)}
                                        className="rounded-xl font-semibold bg-[#1A73A3] hover:bg-[#1A73A3]/90 border-none shadow-sm flex items-center gap-1"
                                    >
                                        Allouer
                                    </Button>
                                }
                            >
                                <Table 
                                    dataSource={budgets} 
                                    columns={bgColumns} 
                                    rowKey="id" 
                                    loading={loading} 
                                    pagination={{ pageSize: 5 }} 
                                />
                            </Card>
                        </Col>
                        <Col xs={24} lg={13}>
                            <Card 
                                title={
                                    <div className="flex flex-col gap-1 py-1">
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-5 h-5 text-emerald-500" />
                                            <span className="font-extrabold text-[#051161]">Évaluation Budgétaire par Service</span>
                                        </div>
                                        <span className="text-xs text-gray-400 font-normal">Alloué vs consommé (dépenses) — reste disponible</span>
                                    </div>
                                } 
                                style={{ borderRadius: '16px', border: '1px solid #e2e8f0' }}
                                className="shadow-sm"
                                bordered={false}
                            >
                                <Table 
                                    dataSource={consumption} 
                                    columns={cColumns} 
                                    rowKey="service" 
                                    loading={loading} 
                                    pagination={false}
                                />
                            </Card>
                        </Col>
                    </Row>
                </div>
            )
        }
    ];

    return (
        <AccountantLayout>
            <div style={{ padding: '24px' }}>
                <div style={{ marginBottom: '28px' }} className="flex justify-between items-start">
                    <div>
                        <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#051161' }} className="tracking-tight">
                            Exercices Comptables & Budgets
                        </h1>
                        <p style={{ color: '#64748b', margin: '4px 0 0 0' }} className="text-sm font-medium">
                            Gérer les périodes comptables (12 mois), travaux de fin d'exercice (classes 1 à 7 OHADA) et enveloppes budgétaires.
                        </p>
                    </div>
                </div>

                <Tabs 
                    activeKey={activeTab} 
                    onChange={(key) => setActiveTab(key)} 
                    size="large" 
                    items={tabItems} 
                    className="custom-tabs"
                />

                {/* MODAL OUVERTURE EXERCICE */}
                <Modal
                    title={<span className="text-lg font-extrabold text-[#051161]">Ouvrir un Nouvel Exercice Comptable</span>}
                    open={exModalVisible}
                    onCancel={() => setExModalVisible(false)}
                    footer={null}
                    className="rounded-2xl overflow-hidden"
                    bodyStyle={{ padding: '20px 0' }}
                >
                    {exerciceActif && (
                        <Alert
                            message="Un exercice est déjà ouvert. Clôturez-le avant d'en créer un nouveau."
                            type="error"
                            showIcon
                            style={{ marginBottom: '16px', borderRadius: '12px' }}
                        />
                    )}
                    <Form form={exForm} layout="vertical" onFinish={handleCreateExercice} className="px-1">
                        <Form.Item name="code" label={<span className="font-semibold text-gray-700">Code de l'exercice</span>} rules={[{ required: true, message: 'Le code est requis' }]}>
                            <Input placeholder="EX-2026" className="h-10 rounded-xl" />
                        </Form.Item>
                        <Form.Item name="date_debut" label={<span className="font-semibold text-gray-700">Date de Début</span>} rules={[{ required: true, message: 'La date de début est requise' }]}>
                            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" className="h-10 rounded-xl" />
                        </Form.Item>
                        
                        {exercices.find(e => e.statut !== 'ouvert') && (
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl mb-4">
                                <Form.Item 
                                    name="autoriser_report" 
                                    valuePropName="checked" 
                                    initialValue={true}
                                    style={{ marginBottom: 0 }}
                                >
                                    <Checkbox className="text-emerald-850 font-bold text-xs">
                                        Autoriser le report automatique à nouveau depuis l'exercice clôturé ({exercices.find(e => e.statut !== 'ouvert').code})
                                    </Checkbox>
                                </Form.Item>
                                <p className="text-emerald-600 text-[10px] mt-1 pl-6 leading-relaxed">
                                    Ceci effectuera automatiquement la reprise des soldes des comptes de bilan (Classes 1 à 5) vers le nouvel exercice lors de sa création.
                                </p>
                            </div>
                        )}

                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-6 flex gap-3">
                            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-blue-700 text-xs leading-relaxed">
                                Conformément aux principes de régularité, la date de fin sera calculée automatiquement (+12 mois). Aucun autre exercice ne pourra être ouvert simultanément.
                            </p>
                        </div>

                        <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                            <Space size="middle">
                                <Button onClick={() => setExModalVisible(false)} className="rounded-xl h-10 px-5 font-semibold">
                                    Annuler
                                </Button>
                                <Button 
                                    type="primary" 
                                    htmlType="submit" 
                                    disabled={!!exerciceActif}
                                    className="rounded-xl h-10 px-6 font-semibold bg-[#1A73A3] hover:bg-[#1A73A3]/90 border-none shadow-sm"
                                >
                                    Ouvrir l'Exercice
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>

                {/* MODAL ALLOCATION BUDGET */}
                <Modal
                    title={<span className="text-lg font-extrabold text-[#051161]">Allouer un Budget Prévisionnel</span>}
                    open={bgModalVisible}
                    onCancel={() => setBgModalVisible(false)}
                    footer={null}
                    className="rounded-2xl overflow-hidden"
                    bodyStyle={{ padding: '20px 0' }}
                >
                    <Form form={bgForm} layout="vertical" onFinish={handleCreateBudget} className="px-1">
                        <Form.Item name="exercice_id" label={<span className="font-semibold text-gray-700">Exercice comptable lié</span>} rules={[{ required: true, message: 'L\'exercice est requis' }]}>
                            <Select placeholder="Choisir l'exercice..." className="h-10 rounded-xl">
                                {exercices.map(e => (
                                    <Option key={e.id} value={e.id}>{e.code} ({e.statut})</Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item name="service_hospitalier" label={<span className="font-semibold text-gray-700">Service Clinique bénéficiaire</span>} rules={[{ required: true, message: 'Le service est requis' }]}>
                            <Select placeholder="Choisir le service..." className="h-10 rounded-xl">
                                <Option value="maternite">Maternité & Gynécologie</Option>
                                <Option value="pediatrie">Pédiatrie</Option>
                                <Option value="chirurgie">Chirurgie Générale</Option>
                                <Option value="laboratoire">Laboratoire d'analyses</Option>
                                <Option value="pharmacie">Pharmacie</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="categorie_id" label={<span className="font-semibold text-gray-700">Catégorie de dépense</span>} rules={[{ required: true, message: 'La catégorie est requise' }]}>
                            <Select placeholder="Catégorie..." className="h-10 rounded-xl">
                                {(categoriesSortie || []).map((c) => (
                                    <Option key={c.id} value={c.id}>{c.code} — {c.libelle}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item name="montant_prevu" label={<span className="font-semibold text-gray-700">Montant de l'Enveloppe (FCFA)</span>} rules={[{ required: true, message: 'Le montant est requis' }]}>
                            <InputNumber style={{ width: '100%' }} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} parser={val => val.replace(/\s?/g, '')} className="h-10 rounded-xl" />
                        </Form.Item>
                        <Form.Item style={{ textAlign: 'right', marginBottom: 0 }} className="pt-2">
                            <Space size="middle">
                                <Button onClick={() => setBgModalVisible(false)} className="rounded-xl h-10 px-5 font-semibold">
                                    Annuler
                                </Button>
                                <Button 
                                    type="primary" 
                                    htmlType="submit"
                                    className="rounded-xl h-10 px-6 font-semibold bg-[#1A73A3] hover:bg-[#1A73A3]/90 border-none shadow-sm"
                                >
                                    Enregistrer la Dotation
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        </AccountantLayout>
    );
};
