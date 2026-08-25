import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Tag, Space, Modal, Form, Input, InputNumber, Select, Row, Col, Statistic, message, Divider, Alert, Tooltip } from 'antd';
import {
    ShoppingCartOutlined, FileTextOutlined, SendOutlined,
    CheckCircleOutlined, PlusOutlined, AlertOutlined,
    LikeOutlined, DislikeOutlined, ThunderboltOutlined,
    HistoryOutlined
} from '@ant-design/icons';
import { 
    ShoppingBag, 
    Layers, 
    FileText, 
    Send, 
    Activity, 
    AlertTriangle, 
    TrendingDown, 
    Sparkles, 
    CheckSquare, 
    History,
    RefreshCw
} from 'lucide-react';
import {
    getBonsCommande, validerBonCommande, approuverBonCommande, createBonCommande,
    getFactures, getFacturesImpayees, createFacture, comptabiliserFacture,
    getOrdresPaiement, createOrdrePaiement, validerOrdrePaiement, approuverOrdrePaiement,
    comptabiliserOrdrePaiement,
    getComptesComptables, getCategoriesSortie, getFournisseurs,
    getDemandesAchat, evaluerDemandeAchat, getArbitrageDemandes,
} from '../../../services/accountantApi';
import { getBudgetEvaluationAssistant } from '../../../services/budgetEvaluationAssistant';
import { FinanceControlChecks, FinanceWorkflowBanner } from './FinanceControlChecks';
import AccountantLayout from '../AccountantLayout';

const fmtFcfa = (n) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' FCFA';

const { Option } = Select;

const MAPPING_TRESORERIE = {
    especes:      { compte: '5711', intitule: 'Caisse Principale' },
    cheque:       { compte: '5211', intitule: 'Banque Générale (Chèque)' },
    carte:        { compte: '5211', intitule: 'Banque Générale (Carte)' },
    mobile_money: { compte: '5215', intitule: 'Mobile Money Orange/MTN' },
    virement:     { compte: '5211', intitule: 'Banque Générale (Virement)' },
};

const MAPPING_DEBIT_NATURE = {
    fournisseur:        { compte: '401',  intitule: 'Fournisseurs' },
    fonctionnement:     { compte: '605',  intitule: 'Fournitures non stockables' },
    entretien:          { compte: '6241', intitule: 'Entretien & réparations' },
    transport:          { compte: '625',  intitule: 'Frais de déplacements' },
    petite_caisse:      { compte: '6064', intitule: 'Fournitures administratives' },
    autre:              { compte: '658',  intitule: 'Charges diverses de gestion' },
};

const SERVICES_PRIORITE_ABSOLUE = ['pharmacie', 'laboratoire'];

const MODE_PAIEMENT_API = {
    especes: 'caisse',
    cheque: 'cheque',
    virement: 'virement',
    mobile_money: 'virement',
    carte: 'cheque',
};

const NATURE_TO_TYPE_SORTIE = {
    fournisseur: 'fournisseur',
    fonctionnement: 'charge',
    entretien: 'charge',
    transport: 'charge',
    petite_caisse: 'charge',
    autre: 'charge',
};

export const AchatsGestionPage = () => {
    const [activeTab, setActiveTab] = useState('demandes');
    const [loading, setLoading] = useState(false);

    // Data
    const [demandes, setDemandes] = useState([]);
    const [arbitrage, setArbitrage] = useState(null);
    const [bons, setBons] = useState([]);
    const [factures, setFactures] = useState([]);
    const [ordres, setOrdres] = useState([]);
    const [comptes, setComptes] = useState([]);
    const [historique, setHistorique] = useState([]);
    const [categoriesSortie, setCategoriesSortie] = useState([]);
    const [fournisseurs, setFournisseurs] = useState([]);

    // Stats
    const [facturesStats, setFacturesStats] = useState({ count: 0, total: 0 });

    // Modals & Forms
    const [factureModalVisible, setFactureModalVisible] = useState(false);
    const [factureForm] = Form.useForm();

    const [opModalVisible, setOpModalVisible] = useState(false);
    const [opForm] = Form.useForm();

    const [evalModalVisible, setEvalModalVisible] = useState(false);
    const [evalForm] = Form.useForm();
    const [selectedDemande, setSelectedDemande] = useState(null);
    const [evalAssistant, setEvalAssistant] = useState(null);
    const [evalAssistantLoading, setEvalAssistantLoading] = useState(false);

    const [bcModalVisible, setBcModalVisible] = useState(false);
    const [bcForm] = Form.useForm();
    const [demandeForBc, setDemandeForBc] = useState(null);

    const fetchData = async (tab) => {
        setLoading(true);
        try {
            if (tab === 'demandes') {
                const res = await getDemandesAchat();
                setDemandes(Array.isArray(res) ? res : (res.results || []));
            } else if (tab === 'arbitrage') {
                const res = await getArbitrageDemandes();
                setArbitrage(res || null);
            } else if (tab === 'bc') {
                const res = await getBonsCommande();
                setBons(res || []);
            } else if (tab === 'factures') {
                const res = await getFactures();
                setFactures(res || []);
                try {
                    const stats = await getFacturesImpayees();
                    setFacturesStats({ count: stats.nombre || 0, total: stats.total || 0 });
                } catch { setFacturesStats({ count: 0, total: 0 }); }
            } else if (tab === 'op') {
                const res = await getOrdresPaiement();
                setOrdres(res || []);
                const cData = await getComptesComptables();
                setComptes(cData || []);
                const fData = await getFactures();
                setFactures(fData || []);
                const catData = await getCategoriesSortie().catch(() => []);
                setCategoriesSortie(catData || []);
            } else if (tab === 'historique') {
                const res = await getOrdresPaiement();
                // Seuls les décaissements réellement exécutés (avec date d'exécution)
                // apparaissent : cohérent avec le grand-livre et le tableau de bord,
                // et écarte les OP « fantômes » sans date d'exécution.
                const executed = (res || []).filter(o =>
                    (o.statut === 'execute' || o.statut === 'comptabilise') && o.date_execution
                );
                setHistorique(executed);
                const cData = await getComptesComptables().catch(() => []);
                setComptes(cData || []);
                const catData = await getCategoriesSortie().catch(() => []);
                setCategoriesSortie(catData || []);
            }
        } catch (error) {
            console.error("Error fetching purchases data:", error);
            message.error("Impossible de récupérer les informations de ce module.");
        } finally {
            setLoading(false);
        }
    };

    const getDebitAccountDisplay = (natureCharge) => {
        const cat = categoriesSortie.find(c => String(c.id) === String(natureCharge) || c.code === natureCharge);
        if (cat) {
            const compObj = comptes.find(comp => comp.id === cat.compte_comptable);
            return {
                compte: compObj ? compObj.numero_compte : 'Classe 6',
                intitule: cat.libelle
            };
        }
        const fallback = MAPPING_DEBIT_NATURE[natureCharge];
        if (fallback) return fallback;
        return { compte: '401/600', intitule: natureCharge || 'Charge non spécifiée' };
    };

    useEffect(() => {
        fetchData(activeTab);
        // Load fournisseurs once on mount for the facture form dropdown
        getFournisseurs().then(data => setFournisseurs(data || [])).catch(() => {});
    }, [activeTab]);

    const handleValiderBC = async (id) => {
        try {
            setLoading(true);
            // Validation + approbation en une seule action comptable.
            // Le directeur n'intervient plus ici : il retrouve les BC dans son rapport mensuel des achats.
            await validerBonCommande(id);
            await approuverBonCommande(id);
            message.success("Bon de commande validé et approuvé. Il figurera dans le rapport des achats du Directeur.");
            fetchData('bc');
        } catch (error) {
            message.error("Impossible de valider ce bon de commande.");
        } finally {
            setLoading(false);
        }
    };

    const openEvalModal = async (demande) => {
        setSelectedDemande(demande);
        setEvalAssistant(null);
        evalForm.setFieldsValue({
            avis_comptable: demande.avis_comptable === 'en_attente' ? 'favorable' : demande.avis_comptable,
            priorite: demande.priorite || 'normale',
            commentaire_budgetaire: demande.commentaire_budgetaire || '',
        });
        setEvalModalVisible(true);
        setEvalAssistantLoading(true);
        try {
            const { recommendation } = await getBudgetEvaluationAssistant(demande);
            setEvalAssistant(recommendation);
            evalForm.setFieldsValue({
                avis_comptable: recommendation.suggestion.avis_comptable,
                priorite: recommendation.suggestion.priorite,
                commentaire_budgetaire: recommendation.suggestion.commentaire_budgetaire,
            });
        } catch (err) {
            console.warn('Assistant évaluation:', err);
        } finally {
            setEvalAssistantLoading(false);
        }
    };

    const applyAssistantSuggestion = () => {
        if (!evalAssistant?.suggestion) return;
        evalForm.setFieldsValue({
            avis_comptable: evalAssistant.suggestion.avis_comptable,
            priorite: evalAssistant.suggestion.priorite,
            commentaire_budgetaire: evalAssistant.suggestion.commentaire_budgetaire,
        });
        message.success('Suggestion appliquée au formulaire.');
    };

    const handleEvalSubmit = async (values) => {
        if (!selectedDemande) return;
        try {
            setLoading(true);
            await evaluerDemandeAchat(selectedDemande.id, values);
            message.success(
                values.avis_comptable === 'favorable'
                    ? "Avis favorable enregistré — en attente d'approbation du Directeur."
                    : "Avis défavorable enregistré — le Directeur sera notifié."
            );
            setEvalModalVisible(false);
            evalForm.resetFields();
            fetchData(activeTab === 'arbitrage' ? 'arbitrage' : 'demandes');
        } catch (error) {
            message.error(error.response?.data?.error || "Erreur lors de l'évaluation.");
        } finally {
            setLoading(false);
        }
    };

    const openBcModal = (demande) => {
        setDemandeForBc(demande);
        bcForm.setFieldsValue({
            fournisseur: undefined,
            designation: demande.description || `Achat ${demande.numero}`,
            montant: demande.montant_estime,
        });
        setBcModalVisible(true);
    };

    const handleBcFromDemande = async (values) => {
        if (!demandeForBc) return;
        try {
            setLoading(true);
            await createBonCommande({
                demande_achat: demandeForBc.id,
                fournisseur: values.fournisseur,
                statut: 'brouillon',
                lignes: [{
                    designation: values.designation,
                    quantite: 1,
                    prix_unitaire: values.montant,
                }],
            });
            message.success('Bon de commande créé en brouillon — validez-le pour transmission au Directeur.');
            setBcModalVisible(false);
            bcForm.resetFields();
            setActiveTab('bc');
            fetchData('bc');
        } catch (error) {
            message.error(error.response?.data?.error || 'Erreur lors de la création du bon de commande.');
        } finally {
            setLoading(false);
        }
    };

    const demandesColumns = [
        { title: 'N° DA', dataIndex: 'numero', key: 'numero', render: n => <span className="font-extrabold text-[#051161]">{n}</span> },
        { title: 'Description', dataIndex: 'description', key: 'desc', ellipsis: { showTitle: true },
          render: d => <span title={d}>{d}</span> },
        { title: 'Montant estimé', dataIndex: 'montant_estime', key: 'montant', align: 'right',
          render: m => <span className="font-bold">{new Intl.NumberFormat('fr-FR').format(m)} FCFA</span> },
        { title: 'Priorité', dataIndex: 'priorite', key: 'priorite',
          render: p => <Tag color={p === 'haute' || p === 'critique' ? 'red' : 'blue'}>{p?.toUpperCase()}</Tag> },
        { title: 'Avis comptable', dataIndex: 'avis_comptable', key: 'avis',
          render: a => {
            if (a === 'favorable') return <Tag color="green">FAVORABLE</Tag>;
            if (a === 'defavorable') return <Tag color="red">DÉFAVORABLE</Tag>;
            return <Tag color="orange">EN ATTENTE</Tag>;
          }},
        { title: 'Statut', dataIndex: 'statut', key: 'statut',
          render: s => <Tag>{s?.replace(/_/g, ' ').toUpperCase()}</Tag> },
        {
            title: 'Actions', key: 'actions', align: 'right',
            render: (_, record) => (
                <Space>
                    {record.statut === 'soumise' && record.avis_comptable === 'en_attente' && (
                        <>
                            <Button type="primary" size="small" icon={<CheckCircleOutlined />}
                                onClick={() => openEvalModal(record)}
                                className="rounded-lg font-bold bg-[#1A73A3] border-none">
                                Évaluer budget
                            </Button>
                            <Button size="small" icon={<DislikeOutlined />}
                                onClick={() => openEvalModal({ ...record, avis_comptable: 'defavorable' })}
                                className="rounded-lg">
                                Refuser
                            </Button>
                        </>
                    )}
                    {record.statut === 'approuvee' && (
                        <Button type="primary" size="small" icon={<PlusOutlined />}
                            onClick={() => openBcModal(record)}
                            className="rounded-lg font-bold bg-emerald-600 border-none">
                            Générer BC
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const renderPriorite = (record) => {
        const service = record.service_demandeur?.toLowerCase() || '';
        if (SERVICES_PRIORITE_ABSOLUE.some(s => service.includes(s))) {
            return <Tag color="green" className="font-extrabold border-none px-3 py-1 rounded-full text-[10px] uppercase shadow-sm">PRIORITÉ ABSOLUE</Tag>;
        }
        if (record.non_servi_precedent) {
            return <Tag color="orange" className="font-extrabold border-none px-3 py-1 rounded-full text-[10px] uppercase shadow-sm">PRIORITAIRE (non servi)</Tag>;
        }
        return <Tag color="blue" className="font-extrabold border-none px-3 py-1 rounded-full text-[10px] uppercase shadow-sm">Selon recettes</Tag>;
    };

    const handleFactureSubmit = async (values) => {
        try {
            setLoading(true);
            const { fournisseur_id, ...rest } = values;
            await createFacture({
                ...rest,
                fournisseur: fournisseur_id,
                date_reception: new Date().toISOString().split('T')[0]
            });
            message.success("Facture fournisseur enregistrée !");
            setFactureModalVisible(false);
            factureForm.resetFields();
            fetchData('factures');
        } catch (error) {
            const detail = error.response?.data;
            const msg = detail?.error
                || (detail && typeof detail === 'object' ? Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ') : null)
                || "Erreur lors de la création de la facture.";
            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleComptabiliserFacture = async (id) => {
        try {
            setLoading(true);
            await comptabiliserFacture(id);
            message.success("Facture comptabilisée : charge (classe 6) et dette fournisseur (401) enregistrées.");
            fetchData('factures');
        } catch (error) {
            const detail = error.response?.data;
            const msg = detail?.error
                || (detail && typeof detail === 'object' ? Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | ') : null)
                || "Erreur lors de la comptabilisation de la facture.";
            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleOpSubmit = async (values) => {
        if (!values.facture_id) {
            message.warning('Sélectionnez une facture impayée avant d\'émettre un ordre de paiement.');
            return;
        }
        try {
            setLoading(true);
            const natureKey = typeof values.nature_charge === 'string'
                ? values.nature_charge
                : 'fournisseur';
            await createOrdrePaiement({
                facture: values.facture_id,
                type_sortie: NATURE_TO_TYPE_SORTIE[natureKey] || 'fournisseur',
                montant: values.montant,
                mode_paiement: MODE_PAIEMENT_API[values.mode_paiement] || values.mode_paiement,
                beneficiaire: values.beneficiaire,
            });
            message.success("Ordre de paiement émis en brouillon !");
            setOpModalVisible(false);
            opForm.resetFields();
            fetchData('op');
        } catch (error) {
            message.error(error.response?.data?.error || "Erreur lors de la création de l'ordre de paiement.");
        } finally {
            setLoading(false);
        }
    };

    const handleComptabiliserOP = async (id) => {
        try {
            setLoading(true);
            await comptabiliserOrdrePaiement(id);
            message.success("Écriture de décaissement générée (Débit charge/401, Crédit trésorerie).");
            fetchData('op');
        } catch (error) {
            const detail = error.response?.data;
            message.error(detail?.error || "Impossible de générer l'écriture comptable.");
        } finally {
            setLoading(false);
        }
    };

    const handleApprouverOP = async (id) => {
        try {
            setLoading(true);
            await approuverOrdrePaiement(id);
            message.success("Ordre approuvé — prêt pour exécution par le caissier.");
            fetchData('op');
        } catch (error) {
            message.error(error.response?.data?.error || "Impossible d'approuver l'ordre de paiement.");
        } finally {
            setLoading(false);
        }
    };

    const handleValiderOP = async (id) => {
        try {
            setLoading(true);
            await validerOrdrePaiement(id);
            message.success("Ordre de paiement validé. Il sera transmis au Directeur pour approbation.");
            fetchData('op');
        } catch (error) {
            message.error("Impossible de valider l'ordre de paiement.");
        } finally {
            setLoading(false);
        }
    };

    const bcColumns = [
        { title: 'Numéro BC', dataIndex: 'numero', key: 'numero', render: n => <span className="font-extrabold text-[#051161] tracking-wider">{n}</span> },
        { title: 'Fournisseur', key: 'fournisseur', render: (_, r) => <span className="font-semibold text-gray-700">{r.fournisseur?.raison_sociale || r.fournisseur_nom || 'N/A'}</span> },
        { title: 'Service Demandeur', dataIndex: 'service_demandeur', key: 'service', render: s => <span className="font-bold text-gray-600 uppercase text-xs">{s || 'Commun'}</span> },
        { title: 'Montant TTC', dataIndex: 'montant_total', key: 'montant', align: 'right', render: m => <span className="font-extrabold text-[#051161]">{new Intl.NumberFormat('fr-FR').format(m)} FCFA</span> },
        { title: 'Priorité Budgétaire', key: 'priorite', render: (_, r) => renderPriorite(r) },
        { title: 'Statut', dataIndex: 'statut', key: 'statut', render: s => {
            const label = s.replace(/_/g, ' ').toUpperCase();
            let color = 'orange';
            if (s === 'approuve_directeur') color = 'purple';
            if (s === 'valide_comptable') color = 'cyan';
            if (s === 'execute') color = 'green';
            return <Tag color={color} className="font-bold border-none px-3 py-1 rounded-full text-[10px] uppercase shadow-sm tracking-wider">{label}</Tag>;
        }},
        {
            title: 'Action',
            key: 'action',
            align: 'right',
            render: (_, record) => (
                <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    disabled={record.statut !== 'brouillon'}
                    onClick={() => handleValiderBC(record.id)}
                    className="rounded-xl font-bold bg-[#1A73A3] hover:bg-[#1A73A3]/90 border-none shadow-sm flex items-center gap-1"
                >
                    Valider et approuver
                </Button>
            )
        }
    ];

    const facturesColumns = [
        { title: 'N° Facture', dataIndex: 'numero_facture', key: 'numero', render: n => <span className="font-extrabold text-[#051161] tracking-wider">{n}</span> },
        { title: 'Fournisseur', key: 'fournisseur', render: (_, r) => <span className="font-bold text-gray-700">{r.fournisseur_nom || r.fournisseur || 'N/A'}</span> },
        { title: 'Montant HT', dataIndex: 'montant_ht', key: 'ht', align: 'right', render: m => `${new Intl.NumberFormat('fr-FR').format(m)} FCFA` },
        { title: 'Montant TTC', dataIndex: 'montant_ttc', key: 'montant', align: 'right', render: m => <span className="font-extrabold text-[#1A73A3]">{new Intl.NumberFormat('fr-FR').format(m)} FCFA</span> },
        { title: 'Date Réception', dataIndex: 'date_reception', key: 'date', render: d => new Date(d).toLocaleDateString('fr-FR') },
        { title: 'Comptabilisée', dataIndex: 'est_comptabilisee', key: 'compta', render: c => <Tag color={c ? 'green' : 'orange'} className="font-bold border-none px-2.5 rounded-full">{c ? 'OUI' : 'NON'}</Tag> },
        { title: 'Payée', dataIndex: 'est_payee', key: 'payee', render: p => <Tag color={p ? 'green' : 'red'} className="font-bold border-none px-2.5 rounded-full">{p ? 'PAYÉE' : 'IMPAYÉE'}</Tag> },
        {
            title: 'Action', key: 'action', align: 'right',
            render: (_, r) => r.est_comptabilisee
                ? <Tag color="green" className="font-bold border-none px-3 py-1 rounded-full text-[10px] uppercase">Charge constatée</Tag>
                : (
                    <Button type="primary" size="small" icon={<CheckCircleOutlined />}
                        onClick={() => handleComptabiliserFacture(r.id)}
                        className="rounded-lg font-bold bg-[#1A73A3] border-none">
                        Comptabiliser
                    </Button>
                )
        }
    ];

    const opColumns = [
        { title: 'Numéro OP', dataIndex: 'numero', key: 'numero', render: n => <span className="font-extrabold text-[#051161] tracking-wider">{n}</span> },
        { title: 'Bénéficiaire', dataIndex: 'beneficiaire', key: 'beneficiaire', render: b => <span className="font-bold text-gray-700">{b}</span> },
        { title: 'Montant', dataIndex: 'montant', key: 'montant', align: 'right', render: m => <span className="font-extrabold text-[#051161]">{new Intl.NumberFormat('fr-FR').format(m)} FCFA</span> },
        { title: 'Mode Paiement', dataIndex: 'mode_paiement', key: 'mode', render: mode => {
            const tresor = MAPPING_TRESORERIE[mode];
            return (
                <Tooltip title={tresor ? `Crédit : ${tresor.compte} ${tresor.intitule}` : ''}>
                    <Tag color="blue" className="font-bold border-none rounded-full px-3 py-0.5 text-[10px] uppercase shadow-sm">{mode?.replace('_', ' ') || '-'}</Tag>
                </Tooltip>
            );
        }},
        { title: 'Nature Charge', dataIndex: 'type_sortie', key: 'nature', render: nature => {
            const debit = getDebitAccountDisplay(nature === 'fournisseur' ? 'fournisseur' : 'autre');
            return <Tag color="volcano" className="font-bold border-none rounded-md px-2.5 py-0.5 text-[11px] uppercase shadow-sm">{debit.compte} — {debit.intitule}</Tag>;
        }},
        { title: 'Statut OP', dataIndex: 'statut', key: 'statut', render: (s, r) => {
            let color = 'orange';
            if (s === 'valide_comptable') color = 'blue';
            if (s === 'approuve_directeur') color = 'purple';
            if (s === 'execute') color = r.ecriture_generee ? 'green' : 'cyan';
            if (s === 'comptabilise') color = 'green';
            const label = s === 'execute' && r.ecriture_generee
                ? 'EXÉCUTÉ — COMPTABILISÉ'
                : s.replace(/_/g, ' ').toUpperCase();
            return <Tag color={color} className="font-bold border-none px-3 py-1 rounded-full text-[10px] uppercase shadow-sm tracking-wider">{label}</Tag>;
        }},
        {
            title: 'Action',
            key: 'action',
            align: 'right',
            render: (_, record) => (
                <Space>
                    {record.statut === 'brouillon' && (
                        <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleValiderOP(record.id)}
                            className="rounded-xl font-bold bg-[#1A73A3] hover:bg-[#1A73A3]/90 border-none shadow-sm flex items-center gap-1"
                        >
                            Valider
                        </Button>
                    )}
                    {record.statut === 'valide_comptable' && (
                        <Button
                            type="primary"
                            icon={<LikeOutlined />}
                            onClick={() => handleApprouverOP(record.id)}
                            className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 border-none shadow-sm"
                        >
                            Approuver
                        </Button>
                    )}
                    {record.statut === 'execute' && (
                        record.ecriture_generee
                            ? (
                                <Tag color="green" className="font-bold border-none px-3 py-1 rounded-full text-[10px] uppercase shadow-sm tracking-wider">
                                    Écriture générée
                                </Tag>
                            )
                            : (
                                <Tooltip title="Décaissé par le caissier. Générez l'écriture comptable de sortie.">
                                    <Button
                                        type="primary"
                                        icon={<ThunderboltOutlined />}
                                        loading={loading}
                                        style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                                        onClick={() => handleComptabiliserOP(record.id)}
                                        className="rounded-xl font-bold border-none shadow-md flex items-center gap-1 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                    >
                                        Générer écriture
                                    </Button>
                                </Tooltip>
                            )
                    )}
                </Space>
            )
        }
    ];

    const historiqueColumns = [
        { title: 'N° OP', dataIndex: 'numero', key: 'numero', render: n => <span className="font-extrabold text-gray-500 tracking-wider">{n}</span> },
        { title: 'Bénéficiaire', dataIndex: 'beneficiaire', key: 'beneficiaire', render: b => <span className="font-bold text-gray-600">{b}</span> },
        { title: 'Montant', dataIndex: 'montant', key: 'montant', align: 'right', render: m => <span className="font-extrabold text-gray-600">{new Intl.NumberFormat('fr-FR').format(m)} FCFA</span> },
        { title: 'Mode Paiement', dataIndex: 'mode_paiement', key: 'mode', render: mode => {
            const tresor = MAPPING_TRESORERIE[mode];
            return tresor ? <Tag color="purple" className="font-bold border-none rounded-full px-2.5 py-0.5 text-[10px] shadow-sm uppercase">{tresor.compte} — {tresor.intitule}</Tag> : <Tag>{mode}</Tag>;
        }},
        { title: 'Nature', dataIndex: 'nature_charge', key: 'nature', render: nature => {
            const debit = getDebitAccountDisplay(nature);
            return <Tag color="volcano" className="font-bold border-none rounded-md px-2.5 py-0.5 text-[10px] shadow-sm uppercase">{debit.compte} — {debit.intitule}</Tag>;
        }},
        { title: 'Date Exécution', dataIndex: 'date_execution', key: 'date', render: d => <span className="font-semibold text-gray-400">{d ? new Date(d).toLocaleString('fr-FR') : '-'}</span> },
        { title: 'Statut', dataIndex: 'statut', key: 'statut', align: 'right', render: s => (
            <Tag color={s === 'comptabilise' ? 'green' : 'cyan'} className="font-bold border-none px-3 py-1 rounded-full text-[10px] uppercase shadow-sm tracking-wider">
                {s === 'comptabilise' ? 'COMPTABILISÉ' : 'DÉCAISSÉ'}
            </Tag>
        )}
    ];

    return (
        <AccountantLayout>
            <div style={{ padding: '24px' }} className="space-y-6">
                
                {/* Modern Banner */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#051161] via-[#1A73A3] to-[#50C2B9] p-8 rounded-3xl text-white shadow-xl mb-6">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                    <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                                <ShoppingBag className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <span className="bg-white/20 text-white font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider backdrop-blur-md">
                                    Règlement des dépenses
                                </span>
                                <h2 className="text-3xl font-extrabold mt-1 tracking-tight">Gestion des Achats & Sorties</h2>
                            </div>
                        </div>
                        <Button 
                            type="primary" 
                            icon={<RefreshCw className="w-4 h-4" />} 
                            onClick={() => fetchData(activeTab)} 
                            loading={loading}
                            className="h-12 px-6 rounded-xl font-bold bg-white/10 hover:bg-white/20 border border-white/25 shadow-md flex items-center gap-1 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Actualiser la liste
                        </Button>
                    </div>
                    <p className="text-white/80 max-w-4xl text-sm leading-relaxed mt-4">
                        Circuit d'approvisionnement et validation budgétaire : BC du comptable matières → Avis budgétaire → Approbation Directeur → Décaissement Caissier → Écriture Comptable automatisée.
                    </p>
                </div>

                {/* Priority Alert Box */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 p-5 rounded-2xl flex gap-4 shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-amber-900 font-extrabold text-sm">Règle de Priorité Budgétaire (SYSCOHADA)</h4>
                        <ul className="text-amber-800 text-xs mt-1.5 list-disc pl-4 space-y-1 leading-relaxed">
                            <li><strong>Pharmacie & Laboratoire</strong> : priorité absolue, toujours approvisionnés en premier.</li>
                            <li><strong>Autres services</strong> : triés par recettes générées (le plus productif d'abord).</li>
                            <li><strong>Exception</strong> : un service non servi à la commande précédente devient automatiquement prioritaire.</li>
                        </ul>
                    </div>
                </div>

                {/* Tabs Layout */}
                <Tabs
                    activeKey={activeTab}
                    onChange={(key) => setActiveTab(key)}
                    className="custom-tabs"
                    items={[
                        {
                            key: 'demandes',
                            label: <span className="font-bold flex items-center gap-1.5"><AlertOutlined /> Demandes d&apos;achat</span>,
                            children: (
                                <Card style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} bordered={false}
                                    title={<span className="font-extrabold text-[#051161]">Évaluation budgétaire (besoins matière → achats)</span>}>
                                    <Alert type="info" showIcon className="mb-4" message="Étape 2 du circuit : le comptable financier évalue ici. Le directeur n'approuve qu'après votre avis (favorable ou défavorable)." />
                                    <Table dataSource={demandes} columns={demandesColumns} rowKey="id" loading={loading} scroll={{ x: 1100 }} />
                                </Card>
                            )
                        },
                        {
                            key: 'arbitrage',
                            label: <span className="font-bold flex items-center gap-1.5"><ThunderboltOutlined /> Plan d&apos;arbitrage</span>,
                            children: (
                                <Card style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} bordered={false}
                                    title={<span className="font-extrabold text-[#051161]">Arbitrage budgétaire — priorisation des demandes en concurrence</span>}
                                    extra={
                                        <Button icon={<RefreshCw className="w-4 h-4" />} onClick={() => fetchData('arbitrage')} loading={loading} className="rounded-xl font-semibold flex items-center gap-1">
                                            Recalculer
                                        </Button>
                                    }
                                >
                                    <Alert type="info" showIcon className="mb-4"
                                        message="Deux contrôles indépendants"
                                        description="Le budget (enveloppe d'autorisation) et la trésorerie (liquidités réelles cl. 5) sont des axes orthogonaux. L'enveloppe allouable = min(trésorerie − réserve, budget dispo − engagements). Approuver ≠ payer." />
                                    {arbitrage ? (
                                        <>
                                            <Row gutter={[12, 12]} className="mb-4">
                                                <Col xs={12} md={8} lg={6}>
                                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/40 p-4 rounded-2xl border border-blue-100/50">
                                                        <p className="text-blue-900/60 font-semibold uppercase text-[11px] tracking-wider">Trésorerie (cl. 5)</p>
                                                        <h3 className="text-xl font-black text-[#051161] mt-1">{fmtFcfa(arbitrage.fonds?.tresorerie)}</h3>
                                                        <p className="text-xs text-gray-400 mt-1">Liquidités réelles — réserve : {fmtFcfa(arbitrage.fonds?.reserve_securite)}</p>
                                                    </div>
                                                </Col>
                                                <Col xs={12} md={8} lg={6}>
                                                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 p-4 rounded-2xl border border-emerald-100/50">
                                                        <p className="text-emerald-900/60 font-semibold uppercase text-[11px] tracking-wider">Budget (enveloppe)</p>
                                                        <h3 className="text-xl font-black text-emerald-700 mt-1">{fmtFcfa(arbitrage.fonds?.budget_disponible)}</h3>
                                                        <p className="text-xs text-gray-400 mt-1">Plafond − consommé − engagements ({fmtFcfa(arbitrage.fonds?.engagements_en_cours)})</p>
                                                    </div>
                                                </Col>
                                                <Col xs={12} md={8} lg={6}>
                                                    <div className="bg-gradient-to-br from-violet-50 to-violet-100/40 p-4 rounded-2xl border border-violet-100/50">
                                                        <p className="text-violet-900/60 font-semibold uppercase text-[11px] tracking-wider">Enveloppe allouable</p>
                                                        <h3 className="text-xl font-black text-violet-700 mt-1">{fmtFcfa(arbitrage.fonds?.enveloppe_allouable)}</h3>
                                                        <p className="text-xs text-gray-400 mt-1">Contrainte la plus serrante (budget ∩ trésorerie)</p>
                                                    </div>
                                                </Col>
                                                <Col xs={12} md={8} lg={6}>
                                                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/40 p-4 rounded-2xl border border-gray-100">
                                                        <p className="text-gray-400 font-semibold uppercase text-[11px] tracking-wider">À servir ce cycle</p>
                                                        <h3 className="text-xl font-black text-[#051161] mt-1">{fmtFcfa(arbitrage.synthese?.total_a_servir)}</h3>
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            <Tag color="green">{arbitrage.synthese?.nb_servir || 0} servies</Tag>
                                                            <Tag color="orange">{arbitrage.synthese?.nb_differer || 0} différées</Tag>
                                                            {arbitrage.synthese?.nb_alerte > 0 && <Tag color="red">{arbitrage.synthese.nb_alerte} alerte</Tag>}
                                                        </p>
                                                    </div>
                                                </Col>
                                            </Row>
                                            <Table
                                                dataSource={arbitrage.demandes || []}
                                                rowKey="id"
                                                loading={loading}
                                                pagination={false}
                                                scroll={{ x: 900 }}
                                                columns={[
                                                    {
                                                        title: 'Rang', width: 60, render: (_t, _r, i) => <span className="font-bold text-gray-500">#{i + 1}</span>,
                                                    },
                                                    { title: 'N°', dataIndex: 'numero', width: 120, render: (v) => <span className="font-semibold">{v}</span> },
                                                    { title: 'Description', dataIndex: 'description', ellipsis: true },
                                                    {
                                                        title: 'Priorité', dataIndex: 'priorite', width: 120,
                                                        render: (v, r) => r.est_banque_de_sang
                                                            ? <Tag color="red" className="font-bold">BANQUE DE SANG</Tag>
                                                            : <Tag color={v === 'critique' ? 'volcano' : v === 'haute' ? 'orange' : 'default'}>{v}</Tag>,
                                                    },
                                                    {
                                                        title: 'Montant', dataIndex: 'montant_estime', width: 130, align: 'right',
                                                        render: (v) => <span className="font-semibold">{fmtFcfa(v)}</span>,
                                                    },
                                                    {
                                                        title: 'Décision', dataIndex: 'decision', width: 120,
                                                        render: (v) => v === 'servir'
                                                            ? <Tag color="green" className="font-bold">SERVIR</Tag>
                                                            : v === 'alerte'
                                                                ? <Tag color="red" className="font-bold">ALERTE</Tag>
                                                                : <Tag color="orange" className="font-bold">DIFFÉRER</Tag>,
                                                    },
                                                    { title: 'Motif', dataIndex: 'motif', ellipsis: true, render: (v) => <span className="text-xs text-gray-500">{v}</span> },
                                                    {
                                                        title: 'Action', width: 130, fixed: 'right',
                                                        render: (_t, r) => (
                                                            <Button size="small" type="link" onClick={() => openEvalModal(r)} className="font-semibold">
                                                                Évaluer
                                                            </Button>
                                                        ),
                                                    },
                                                ]}
                                            />
                                            <p className="text-xs text-gray-400 mt-3">
                                                Ce plan est une aide à la décision : vous restez libre d&apos;évaluer chaque demande manuellement (favorable / défavorable) dans l&apos;onglet Demandes d&apos;achat.
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-gray-400 py-8 text-center">Aucune donnée d&apos;arbitrage. Cliquez sur « Recalculer ».</p>
                                    )}
                                </Card>
                            )
                        },
                        {
                            key: 'bc',
                            label: <span className="font-bold flex items-center gap-1.5"><ShoppingCartOutlined /> Bons de Commande</span>,
                            children: (
                                <Card style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} bordered={false}>
                                    <Table dataSource={bons} columns={bcColumns} rowKey="id" loading={loading} scroll={{ x: 1000 }} />
                                </Card>
                            )
                        },
                        {
                            key: 'factures',
                            label: <span className="font-bold flex items-center gap-1.5"><FileText className="w-4 h-4" /> Factures Fournisseurs</span>,
                            children: (
                                <div className="space-y-6 pt-2">
                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} sm={10}>
                                            <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 p-6 rounded-2xl border border-rose-100/50 shadow-sm text-center">
                                                <p className="text-rose-900/60 font-semibold uppercase text-xs tracking-wider">Factures impayées</p>
                                                <h3 className="text-2xl font-black text-rose-600 mt-2">{facturesStats.count}</h3>
                                            </div>
                                        </Col>
                                        <Col xs={24} sm={14}>
                                            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
                                                <p className="text-gray-400 font-semibold uppercase text-xs tracking-wider">Dettes fournisseurs en attente</p>
                                                <h3 className="text-2xl font-black text-[#051161] mt-2">{new Intl.NumberFormat('fr-FR').format(facturesStats.total)} FCFA</h3>
                                            </div>
                                        </Col>
                                    </Row>
                                    <Card 
                                        style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} 
                                        bordered={false}
                                        title={<span className="font-extrabold text-[#051161]">Grand Livre Factures Fournisseurs</span>}
                                        extra={
                                            <Button 
                                                type="primary" 
                                                icon={<PlusOutlined />} 
                                                onClick={() => setFactureModalVisible(true)}
                                                className="rounded-xl font-semibold bg-[#1A73A3] hover:bg-[#1A73A3]/90 border-none shadow-sm flex items-center gap-1"
                                            >
                                                Enregistrer une Facture
                                            </Button>
                                        }
                                    >
                                        <Table dataSource={factures} columns={facturesColumns} rowKey="id" loading={loading} />
                                    </Card>
                                </div>
                            )
                        },
                        {
                            key: 'op',
                            label: <span className="font-bold flex items-center gap-1.5"><Send className="w-4 h-4" /> Ordres de Paiement</span>,
                            children: (
                                <Card 
                                    style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} 
                                    bordered={false}
                                    title={<span className="font-extrabold text-[#051161]">Suivi des Ordres de Paiement</span>}
                                    extra={
                                        <Button 
                                            type="primary" 
                                            icon={<PlusOutlined />} 
                                            onClick={() => setOpModalVisible(true)}
                                            className="rounded-xl font-semibold bg-[#1A73A3] hover:bg-[#1A73A3]/90 border-none shadow-sm flex items-center gap-1"
                                        >
                                            Créer un Ordre de Paiement
                                        </Button>
                                    }
                                >
                                    <Table dataSource={ordres} columns={opColumns} rowKey="id" loading={loading} scroll={{ x: 1100 }} />
                                </Card>
                            )
                        },
                        {
                            key: 'historique',
                            label: <span className="font-bold flex items-center gap-1.5"><History className="w-4 h-4" /> Historique des Dépenses</span>,
                            children: (
                                <Card style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} bordered={false}>
                                    <Table dataSource={historique} columns={historiqueColumns} rowKey="id" loading={loading} scroll={{ x: 1000 }} />
                                </Card>
                            )
                        }
                    ]}
                />

                {/* MODAL ENREGISTRER FACTURE */}
                <Modal
                    title={<span className="text-lg font-extrabold text-[#051161]">Enregistrer une Facture Fournisseur</span>}
                    open={factureModalVisible}
                    onCancel={() => setFactureModalVisible(false)}
                    footer={null}
                    className="rounded-2xl overflow-hidden"
                    bodyStyle={{ padding: '20px 0' }}
                >
                    <Form form={factureForm} layout="vertical" onFinish={handleFactureSubmit} className="px-1">
                        <Form.Item name="numero_facture" label={<span className="font-semibold text-gray-700">Numéro Facture</span>} rules={[{ required: true, message: 'Le numéro est requis' }]}>
                            <Input placeholder="FACT-002" className="h-10 rounded-xl" />
                        </Form.Item>
                        <Form.Item name="fournisseur_id" label={<span className="font-semibold text-gray-700">Fournisseur</span>} rules={[{ required: true, message: 'Le fournisseur est requis' }]}>
                            <Select
                                showSearch
                                placeholder="Rechercher un fournisseur..."
                                className="h-10 rounded-xl"
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                options={fournisseurs.map(f => ({
                                    value: f.id,
                                    label: `${f.raison_sociale}${f.niu ? ` — NIU: ${f.niu}` : ''}`,
                                }))}
                            />
                        </Form.Item>
                        <Form.Item name="montant_ht" label={<span className="font-semibold text-gray-700">Montant HT (FCFA)</span>} rules={[{ required: true, message: 'Le montant HT est requis' }]}>
                            <InputNumber style={{ width: '100%' }} className="h-10 rounded-xl" />
                        </Form.Item>
                        <Form.Item name="montant_ttc" label={<span className="font-semibold text-gray-700">Montant TTC (FCFA)</span>} rules={[{ required: true, message: 'Le montant TTC est requis' }]}>
                            <InputNumber style={{ width: '100%' }} className="h-10 rounded-xl" />
                        </Form.Item>
                        <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                            <Space size="middle">
                                <Button onClick={() => setFactureModalVisible(false)} className="rounded-xl h-10 px-5 font-semibold">Annuler</Button>
                                <Button type="primary" htmlType="submit" className="rounded-xl h-10 px-6 font-semibold bg-[#1A73A3] hover:bg-[#1A73A3]/90 border-none shadow-sm">Enregistrer</Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>

                {/* MODAL CREATION ORDRE DE PAIEMENT */}
                <Modal
                    title={<span className="text-lg font-extrabold text-[#051161]">Créer un Ordre de Paiement (OP)</span>}
                    open={opModalVisible}
                    onCancel={() => setOpModalVisible(false)}
                    footer={null}
                    className="rounded-2xl overflow-hidden"
                    bodyStyle={{ padding: '20px 0' }}
                >
                    <Form form={opForm} layout="vertical" onFinish={handleOpSubmit} className="px-1">
                        <Form.Item name="beneficiaire" label={<span className="font-semibold text-gray-700">Nom du Bénéficiaire</span>} rules={[{ required: true, message: 'Le bénéficiaire est requis' }]}>
                            <Input placeholder="Fournisseur ou Prestataire..." className="h-10 rounded-xl" />
                        </Form.Item>
                        <Form.Item name="montant" label={<span className="font-semibold text-gray-700">Montant (FCFA)</span>} rules={[{ required: true, message: 'Le montant est requis' }]}>
                            <InputNumber style={{ width: '100%' }} className="h-10 rounded-xl" />
                        </Form.Item>
                        <Form.Item name="nature_charge" label={<span className="font-semibold text-gray-700">Nature de la Charge (Débit)</span>} rules={[{ required: true }]}>
                            <Select placeholder="Nature de la dépense..." className="h-10 rounded-xl">
                                {categoriesSortie.length > 0 ? (
                                    categoriesSortie.map(c => {
                                        const compObj = comptes.find(comp => comp.id === c.compte_comptable);
                                        const labelSuffix = compObj ? ` (${compObj.numero_compte})` : '';
                                        return (
                                            <Option key={c.id} value={c.id}>
                                                {c.libelle}{labelSuffix}
                                            </Option>
                                        );
                                    })
                                ) : (
                                    <>
                                        <Option value="fournisseur">Règlement Fournisseur (401)</Option>
                                        <Option value="fonctionnement">Fournitures de fonctionnement (605)</Option>
                                        <Option value="entretien">Entretien & réparations (6241)</Option>
                                        <Option value="transport">Frais de déplacements (625)</Option>
                                        <Option value="petite_caisse">Petite caisse / Fournitures admin (6064)</Option>
                                        <Option value="autre">Charges diverses (658)</Option>
                                    </>
                                )}
                            </Select>
                        </Form.Item>
                        <Form.Item name="mode_paiement" label={<span className="font-semibold text-gray-700">Mode de Paiement (Crédit Trésorerie)</span>} rules={[{ required: true }]}>
                            <Select placeholder="Mode de règlement..." className="h-10 rounded-xl">
                                <Option value="especes">Espèces — 5711 Caisse Principale</Option>
                                <Option value="virement">Virement Bancaire — 5211 Banque</Option>
                                <Option value="cheque">Chèque de Banque — 5211 Banque</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="facture_id" label={<span className="font-semibold text-gray-700">Facture Fournisseur Associée</span>} rules={[{ required: true, message: 'La facture est obligatoire' }]}>
                            <Select placeholder="Associer à une facture impayée..." allowClear className="h-10 rounded-xl">
                                {factures.filter(f => !f.est_payee).map(f => (
                                    <Option key={f.id} value={f.id}>{f.numero_facture} — {f.fournisseur} ({new Intl.NumberFormat('fr-FR').format(f.montant_ttc)} FCFA)</Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item style={{ textAlign: 'right', marginBottom: 0 }} className="pt-2">
                            <Space size="middle">
                                <Button onClick={() => setOpModalVisible(false)} className="rounded-xl h-10 px-5 font-semibold">Annuler</Button>
                                <Button type="primary" htmlType="submit" className="rounded-xl h-10 px-6 font-semibold bg-[#1A73A3] hover:bg-[#1A73A3]/90 border-none shadow-sm">Émettre l'Ordre</Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>

                {/* MODAL ÉVALUATION DEMANDE D'ACHAT */}
                <Modal
                    title={<span className="text-lg font-extrabold text-[#051161]">Évaluation budgétaire — {selectedDemande?.numero}</span>}
                    open={evalModalVisible}
                    onCancel={() => { setEvalModalVisible(false); setEvalAssistant(null); }}
                    footer={null}
                    width={920}
                >
                    {/* Détails du besoin transmis par le directeur */}
                    {selectedDemande && (
                        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-extrabold text-[#051161]">Détails du besoin</span>
                                <div className="flex items-center gap-2">
                                    <Tag color={selectedDemande.priorite === 'critique' ? 'red' : selectedDemande.priorite === 'haute' ? 'orange' : 'blue'}>
                                        Priorité : {selectedDemande.priorite || 'normale'}
                                    </Tag>
                                    <Tag color="green">
                                        {new Intl.NumberFormat('fr-FR').format(selectedDemande.montant_estime || 0)} FCFA
                                    </Tag>
                                </div>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap m-0">
                                {selectedDemande.description || 'Aucun détail fourni.'}
                            </p>
                        </div>
                    )}

                    {/* Assistant décisionnel */}
                    <div className="mb-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-slate-50 to-blue-50/40 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-[#1A73A3]" />
                                <span className="font-extrabold text-[#051161]">Assistant décisionnel</span>
                                <Tag color="blue">Budget + Trésorerie (contrôles séparés)</Tag>
                            </div>
                            {evalAssistant?.suggestion && (
                                <Button size="small" type="link" onClick={applyAssistantSuggestion} className="font-semibold">
                                    Réappliquer la suggestion
                                </Button>
                            )}
                        </div>

                        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                            Le <strong>budget</strong> répond à « a-t-on le droit de dépenser ? » (enveloppe prévisionnelle, hors bilan).
                            La <strong>trésorerie</strong> répond à « a-t-on l&apos;argent pour payer ? » (comptes classe 5 SYSCOHADA).
                            Ce ne sont pas la même ressource — approuver ne consomme pas le budget tant que l&apos;OP n&apos;est pas exécuté.
                        </p>

                        {evalAssistantLoading ? (
                            <div className="text-center py-6 text-gray-500">Analyse en cours…</div>
                        ) : evalAssistant ? (
                            <>
                                {evalAssistant.workflow && (
                                    <FinanceWorkflowBanner workflow={evalAssistant.workflow} />
                                )}

                                {evalAssistant.suggestion && (
                                    <Alert
                                        type={
                                            evalAssistant.suggestion.avis_comptable === 'favorable'
                                                ? (evalAssistant.suggestion.canPayNow ? 'success' : 'info')
                                                : 'warning'
                                        }
                                        showIcon
                                        className="mb-4"
                                        message={
                                            <span className="font-bold">
                                                {evalAssistant.suggestion.label}
                                                {' '}
                                                <Tag color={evalAssistant.suggestion.confidence === 'forte' ? 'green' : 'orange'}>
                                                    confiance {evalAssistant.suggestion.confidence}
                                                </Tag>
                                                {evalAssistant.suggestion.canAuthorize && !evalAssistant.suggestion.canPayNow && (
                                                    <Tag color="purple" className="ml-1">
                                                        {evalAssistant.suggestion.authorizationType === 'partial_stock'
                                                            ? 'Servir du stock'
                                                            : 'Différer'}
                                                    </Tag>
                                                )}
                                            </span>
                                        }
                                    />
                                )}

                                {evalAssistant.checks && (
                                    <div className="mb-4">
                                        <FinanceControlChecks
                                            checks={evalAssistant.checks}
                                            metrics={evalAssistant.metrics}
                                        />
                                    </div>
                                )}

                                {evalAssistant.metrics?.caisseSolde > 0 && (
                                    <div className="mb-4 bg-white rounded-xl p-3 border border-violet-100 text-sm">
                                        <span className="text-xs font-bold uppercase text-violet-600">Caisse ouverte (cl. 57)</span>
                                        <span className="ml-2 font-extrabold text-violet-700">{fmtFcfa(evalAssistant.metrics.caisseSolde)}</span>
                                        <span className="text-xs text-gray-400 ml-2">
                                            — sous-ensemble de la trésorerie, fonds du jour du caissier
                                        </span>
                                    </div>
                                )}

                                {evalAssistant.materialInsights?.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-xs font-bold text-gray-600 uppercase mb-2">
                                            Inventaire matière — pharmacie / compta matière
                                        </p>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm bg-white rounded-xl border">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-2 py-2 text-left">Matériel</th>
                                                        <th className="px-2 py-2 text-right">Demandé</th>
                                                        <th className="px-2 py-2 text-right">Stock</th>
                                                        <th className="px-2 py-2 text-right">À servir</th>
                                                        <th className="px-2 py-2 text-right">À commander</th>
                                                        <th className="px-2 py-2 text-right">Conso/sem.</th>
                                                        <th className="px-2 py-2 text-right">Jours rest.</th>
                                                        <th className="px-2 py-2 text-center">Urgence</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {evalAssistant.materialInsights.map((m, i) => {
                                                        const partial = evalAssistant.partialPlan?.lines?.[i];
                                                        return (
                                                            <tr key={i} className="border-t">
                                                                <td className="px-2 py-2 font-medium">
                                                                    {m.nom}
                                                                    {m.sourceStock && (
                                                                        <span className="block text-[10px] text-gray-400 font-normal">
                                                                            {m.sourceStock}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-2 py-2 text-right">{m.quantiteDemandee ?? '—'}</td>
                                                                <td className="px-2 py-2 text-right font-semibold">{m.stockActuel ?? '?'}</td>
                                                                <td className="px-2 py-2 text-right text-emerald-700 font-bold">
                                                                    {partial?.quantiteAServirDuStock > 0
                                                                        ? partial.quantiteAServirDuStock
                                                                        : '—'}
                                                                </td>
                                                                <td className="px-2 py-2 text-right text-amber-700">
                                                                    {partial?.quantiteACommander > 0
                                                                        ? partial.quantiteACommander
                                                                        : '—'}
                                                                </td>
                                                                <td className="px-2 py-2 text-right">{m.perWeek > 0 ? m.perWeek : '—'}</td>
                                                                <td className="px-2 py-2 text-right">
                                                                    {m.joursRestants != null ? `${m.joursRestants} j` : '—'}
                                                                </td>
                                                                <td className="px-2 py-2 text-center">
                                                                    <Tag color={m.urgence === 'critique' ? 'red' : m.urgence === 'haute' ? 'orange' : 'blue'}>
                                                                        {m.urgence}
                                                                    </Tag>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {evalAssistant.alerts?.length > 0 && (
                                    <div className="space-y-1">
                                        {evalAssistant.alerts.map((a, i) => (
                                            <Alert key={i} type={a.level === 'error' ? 'error' : a.level === 'warning' ? 'warning' : 'info'} message={a.text} showIcon className="py-1" />
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <Alert type="info" message="Données financières ou matière indisponibles — évaluez manuellement." showIcon />
                        )}
                    </div>

                    <Divider className="my-3" />

                    <Form form={evalForm} layout="vertical" onFinish={handleEvalSubmit}>
                        <Form.Item name="avis_comptable" label="Avis comptable" rules={[{ required: true }]}>
                            <Select placeholder="Choisir selon les deux contrôles ci-dessus">
                                <Option value="favorable">Favorable — autoriser (paiement ou distribution stock)</Option>
                                <Option value="defavorable">Défavorable / Différer — conserver la demande pour plus tard</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="priorite" label="Priorité recommandée">
                            <Select>
                                <Option value="normale">Normale</Option>
                                <Option value="haute">Haute — à traiter en priorité</Option>
                                <Option value="critique">Critique — urgence (ex. banque de sang, stock critique)</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="commentaire_budgetaire" label="Observations pour le Directeur">
                            <Input.TextArea rows={4} placeholder="L'assistant distingue contrôle budgétaire (droit de dépenser) et contrôle trésorerie (liquidités pour payer). Mentionnez si paiement immédiat ou différé." />
                        </Form.Item>
                        <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                            <Space>
                                <Button onClick={() => { setEvalModalVisible(false); setEvalAssistant(null); }}>Annuler</Button>
                                <Button type="primary" htmlType="submit" loading={loading}>Transmettre au Directeur</Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>

                {/* MODAL GÉNÉRATION BON DE COMMANDE */}
                <Modal
                    title={<span className="text-lg font-extrabold text-[#051161]">Générer un Bon de Commande — {demandeForBc?.numero}</span>}
                    open={bcModalVisible}
                    onCancel={() => setBcModalVisible(false)}
                    footer={null}
                >
                    <Form form={bcForm} layout="vertical" onFinish={handleBcFromDemande}>
                        <Form.Item name="fournisseur" label="Fournisseur" rules={[{ required: true }]}>
                            <Select placeholder="Sélectionner un fournisseur" showSearch optionFilterProp="children">
                                {fournisseurs.map(f => (
                                    <Option key={f.id} value={f.id}>{f.raison_sociale}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item name="designation" label="Désignation" rules={[{ required: true }]}>
                            <Input />
                        </Form.Item>
                        <Form.Item name="montant" label="Montant TTC (FCFA)" rules={[{ required: true }]}>
                            <InputNumber className="w-full" min={0} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} />
                        </Form.Item>
                        <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                            <Space>
                                <Button onClick={() => setBcModalVisible(false)}>Annuler</Button>
                                <Button type="primary" htmlType="submit" loading={loading}>Créer le BC (brouillon)</Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        </AccountantLayout>
    );
};
export default AchatsGestionPage;
