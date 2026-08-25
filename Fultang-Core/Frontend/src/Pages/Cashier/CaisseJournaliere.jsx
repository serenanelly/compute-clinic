import React, { useState, useEffect } from 'react';
import {
    Card, Table, Button, Form, InputNumber, Row, Col, Statistic,
    Space, Tag, message, Alert, Input, Modal, Tabs, Tooltip, Badge, Divider, Select, DatePicker, AutoComplete
} from 'antd';
import {
    WalletOutlined, LockOutlined, UnlockOutlined, PlusOutlined,
    AlertOutlined, HistoryOutlined, InfoCircleOutlined, CheckCircleOutlined,
    ExclamationCircleOutlined, MinusCircleOutlined, SyncOutlined
} from '@ant-design/icons';
import { CashierLayout } from './components/CashierLayout.jsx';
import { CashierPageHeader } from './components/CashierPageHeader.jsx';
import { Wallet } from 'lucide-react';
import { useAuthentication } from '../../Utils/Provider.jsx';
import {
    getCaissesJournalieres, ouvrirCaisse, fermerCaisse,
    getDepensesMenues, createDepenseMenue,
    getInventairesCaisse, cloreInventaire, getDernierSoldeCaisse
} from '../../services/accountantApi';
import { MOTIFS_DEPENSE_MENUE } from '../../constants/motifsCaisse.js';

const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

/**
 * Caisse Journalière — Anti-Fraude expliqué :
 *
 * ✅ SOLDE THÉORIQUE : Calculé AUTOMATIQUEMENT par le système.
 *    = Solde d'ouverture + somme de TOUS les encaissements validés
 *    - somme de TOUTES les dépenses menues déclarées
 *    → Le caissier NE PEUT PAS modifier ce chiffre. C'est le chiffre attendu.
 *
 * 🔢 SOLDE PHYSIQUE : Saisi par le caissier lors de la FERMETURE.
 *    = Ce qu'il compte réellement dans son tiroir-caisse / coffre.
 *    → Le caissier entre ce montant manuellement à la fermeture.
 *
 * ⚠️ ÉCART DE CAISSE = Solde Physique − Solde Théorique
 *    • Écart nul (0) → Parfait, caisse conforme.
 *    • Écart négatif → Manque d'argent → Anomalie à investiguer.
 *    • Écart positif → Excédent → À déclarer aussi (erreur de rendu).
 *    → L'écart est automatiquement signalé au Directeur / Comptable.
 */
export const CaisseJournalierePage = () => {
    const { userData } = useAuthentication();
    const [loading, setLoading] = useState(false);
    const [caisses, setCaisses] = useState([]);
    const [depenses, setDepenses] = useState([]);
    const [inventaires, setInventaires] = useState([]);
    const [activeCaisse, setActiveCaisse] = useState(null);
    // Solde de report autoritaire renvoyé par le backend (source unique de vérité)
    const [reportSolde, setReportSolde] = useState({ has_report: false, solde_ouverture: null });

    const [openModalVisible, setOpenModalVisible] = useState(false);
    const [closeModalVisible, setCloseModalVisible] = useState(false);
    const [depenseModalVisible, setDepenseModalVisible] = useState(false);

    const [openForm] = Form.useForm();
    const [closeForm] = Form.useForm();
    const [depenseForm] = Form.useForm();

    const fetchData = async () => {
        setLoading(true);
        try {
            const cRes = await getCaissesJournalieres();
            setCaisses(cRes || []);
            const active = (cRes || []).find(c => c.statut === 'ouverte');
            setActiveCaisse(active || null);
            // Solde de report autoritaire (backend) — évite tout recalcul divergent côté client
            try {
                const soldeRes = await getDernierSoldeCaisse();
                setReportSolde(soldeRes || { has_report: false, solde_ouverture: null });
            } catch (e) {
                console.warn('Solde de report non chargé:', e);
                setReportSolde({ has_report: false, solde_ouverture: null });
            }
            const dRes = await getDepensesMenues();
            setDepenses(dRes || []);
            const iRes = await getInventairesCaisse();
            setInventaires(iRes || []);
        } catch (error) {
            console.error('Error loading caisse data:', error);
            message.error('Erreur lors de la récupération des états de caisse.');
        } finally {
            setLoading(false);
        }
    };

    // Fonction pour obtenir le solde d'ouverture fiable
    // Utilise la valeur du backend lorsqu'elle est disponible et valide,
    // sinon retourne le solde physique de la dernière caisse fermée
    const getFiableOpeningBalance = () => {
        return expectedBalance();
    };

    useEffect(() => { fetchData(); }, []);

    // Source unique de vérité = valeur autoritaire du backend (même logique que `ouvrir`).
// Mais on n'utilise le mode automatique que si la valeur du backend est cohérente
// avec la règle anti-fraude (solde d'ouverture = solde physique de la dernière fermeture)
const expectedBalance = () => {
    let balance = 0;
    const closedCaisses = caisses.filter(c => c.statut !== 'ouverte');
    if (closedCaisses.length > 0) {
        const sortedClosed = [...closedCaisses].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );
        const lastClosed = sortedClosed[0];
        if (lastClosed.solde_physique !== null && lastClosed.solde_physique !== undefined) {
            const physicalValue = Number(lastClosed.solde_physique);
            if (!isNaN(physicalValue) && physicalValue >= 0) {
                balance = physicalValue;
            }
        }
    }
    return balance;
};

const hasAutoReport = reportSolde.has_report === true &&
                     reportSolde.solde_ouverture !== null &&
                     !isNaN(Number(reportSolde.solde_ouverture)) &&
                     Math.abs(Number(reportSolde.solde_ouverture) - expectedBalance()) < 1;

    useEffect(() => {
        if (openModalVisible) {
            const lastVal = getFiableOpeningBalance();
            openForm.setFieldsValue({ solde_ouverture: lastVal });
        }
    }, [openModalVisible, reportSolde, caisses]);

    const handleOuvrirCaisse = async (values) => {
        try {
            setLoading(true);
            const payload = {
                type_periode: values.type_periode || 'journee',
                libelle_periode: values.libelle_periode,
                periode_debut: values.periode_custom?.[0]?.toISOString(),
                periode_fin_prevue: values.periode_custom?.[1]?.toISOString(),
            };
            if (!hasAutoReport) {
                payload.solde_ouverture = values.solde_ouverture;
            }
            const rawCaissierId = userData?.idpersonnel ?? userData?.id ?? userData?.personnel_id;
            const caissierId = Number.isInteger(rawCaissierId)
                ? rawCaissierId
                : (typeof rawCaissierId === 'string' && /^\d+$/.test(rawCaissierId)
                    ? parseInt(rawCaissierId, 10)
                    : null);
            if (caissierId != null) payload.caissier_id = caissierId;

            await ouvrirCaisse(payload);
            message.success(
                hasAutoReport
                    ? 'Caisse ouverte — solde de départ repris automatiquement de la dernière clôture.'
                    : 'Caisse ouverte — fond initial enregistré.'
            );
            setOpenModalVisible(false);
            openForm.resetFields();
            fetchData();
        } catch (error) {
            const msg = error.response?.data?.error || error.response?.data?.detail
                || "Impossible d'ouvrir la caisse.";
            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleFermerCaisse = async (values) => {
        try {
            setLoading(true);
            const res = await fermerCaisse(activeCaisse.id, { solde_physique: values.solde_physique });
            const ecart = res.ecart || (values.solde_physique - (activeCaisse.solde_theorique || 0));
            const ecartMsg = ecart === 0
                ? "✅ Caisse conforme — Aucun écart."
                : ecart < 0
                    ? `⚠️ Écart négatif de ${new Intl.NumberFormat('fr-FR').format(Math.abs(ecart))} FCFA — Manque d'argent détecté !`
                    : `ℹ️ Excédent de ${new Intl.NumberFormat('fr-FR').format(ecart)} FCFA — À justifier.`;
            message.info(ecartMsg, 6);
            setCloseModalVisible(false);
            closeForm.resetFields();
            fetchData();
        } catch (error) {
            message.error(error.response?.data?.error || "Impossible de fermer la caisse.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDepense = async (values) => {
        if (!activeCaisse) {
            message.warning("Veuillez d'abord ouvrir la caisse du jour.");
            return;
        }
        try {
            setLoading(true);
            await createDepenseMenue({ caisse: activeCaisse.id, montant: values.montant, motif: values.motif });
            message.success("Dépense enregistrée — visible dans Historique financier et Rapport (onglet Journal des flux).");
            setDepenseModalVisible(false);
            depenseForm.resetFields();
            fetchData();
        } catch (error) {
            message.error("Erreur lors de l'enregistrement de la dépense.");
        } finally {
            setLoading(false);
        }
    };

    const handleCloreInventaire = async (id) => {
        try {
            setLoading(true);
            await cloreInventaire(id, { ecart_justifie: true, observations: 'Vérifié conforme' });
            message.success("Inventaire de caisse clos avec succès.");
            fetchData();
        } catch (error) {
            message.error("Erreur lors de la clôture d'inventaire.");
        } finally {
            setLoading(false);
        }
    };

    const formatFCFA = (v) => `${new Intl.NumberFormat('fr-FR').format(v ?? 0)} FCFA`;

    const renderEcart = (e) => {
        if (e === null || e === undefined) return <span style={{ color: '#aaa' }}>—</span>;
        if (e === 0) return <Tag color="green" icon={<CheckCircleOutlined />}>0 FCFA — Conforme</Tag>;
        if (e < 0) return <Tag color="red" icon={<ExclamationCircleOutlined />}>{formatFCFA(e)} — Manque</Tag>;
        return <Tag color="orange" icon={<InfoCircleOutlined />}>+{formatFCFA(e)} — Excédent</Tag>;
    };

    // Plage réellement travaillée : ouverture (date_creation ou periode_debut) → fermeture (date_fermeture).
    const renderPeriodeTravaillee = (r) => {
        const fmtHeure = (v) => v ? new Date(v).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
        const debut = r.periode_debut || r.date_creation;
        const debutH = fmtHeure(debut);
        if (!debutH) return <span style={{ color: '#aaa' }}>—</span>;

        if (r.statut === 'ouverte' || !r.date_fermeture) {
            return (
                <span>
                    <span style={{ fontWeight: 600 }}>{debutH}</span>
                    <span style={{ color: '#aaa' }}> → en cours</span>
                </span>
            );
        }
        const finH = fmtHeure(r.date_fermeture);
        // Durée travaillée
        const ms = new Date(r.date_fermeture) - new Date(debut);
        let duree = '';
        if (ms > 0) {
            const totalMin = Math.round(ms / 60000);
            const h = Math.floor(totalMin / 60);
            const m = totalMin % 60;
            duree = h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
        }
        return (
            <span>
                <span style={{ fontWeight: 600 }}>{debutH} → {finH}</span>
                {duree && <span style={{ color: '#888', marginLeft: 6, fontSize: 12 }}>({duree})</span>}
            </span>
        );
    };

    const caisseColumns = [
        { title: 'Date', dataIndex: 'date', key: 'date', render: d => new Date(d).toLocaleDateString('fr-FR') },
        {
            title: 'Statut', dataIndex: 'statut', key: 'statut',
            render: s => <Tag color={s === 'ouverte' ? 'green' : 'default'}>{s?.toUpperCase()}</Tag>
        },
        {
            title: (
                <Tooltip title="Plage réellement travaillée : de l'ouverture à la fermeture. Permet le relais entre caissiers (une caissière peut fermer avant l'heure et être remplacée).">
                    Période travaillée <InfoCircleOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
            ),
            key: 'periode_travaillee',
            render: (_, r) => renderPeriodeTravaillee(r)
        },
        {
            title: (
                <Tooltip title="Argent présent à l'ouverture de caisse ce matin">
                    Solde Ouverture <InfoCircleOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
            ),
            dataIndex: 'solde_ouverture', key: 'so',
            render: m => <span style={{ fontWeight: 600 }}>{formatFCFA(m)}</span>
        },
        {
            title: (
                <Tooltip title="Calculé automatiquement par le système : Ouverture + Encaissements – Dépenses menues. Le caissier ne peut PAS modifier ce chiffre.">
                    Solde Théorique (Système) <InfoCircleOutlined style={{ color: '#722ed1' }} />
                </Tooltip>
            ),
            dataIndex: 'solde_theorique', key: 'st',
            render: m => <span style={{ color: '#722ed1', fontWeight: 600 }}>{formatFCFA(m)}</span>
        },
        {
            title: (
                <Tooltip title="Montant compté physiquement dans le tiroir/coffre par le caissier à la fermeture. Saisi manuellement.">
                    Solde Physique Compté <InfoCircleOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
            ),
            dataIndex: 'solde_physique', key: 'sp',
            render: m => m !== null && m !== undefined ? formatFCFA(m) : <span style={{ color: '#aaa' }}>Non encore compté</span>
        },
        {
            title: (
                <Tooltip title="Écart = Solde Physique − Solde Théorique. Un écart négatif signale une anomalie à investiguer.">
                    Écart de Caisse <InfoCircleOutlined style={{ color: '#f5222d' }} />
                </Tooltip>
            ),
            dataIndex: 'ecart', key: 'ecart',
            render: renderEcart
        }
    ];

    const depenseColumns = [
        { title: 'Date & Heure', dataIndex: 'date_creation', key: 'date', render: d => new Date(d).toLocaleString('fr-FR') },
        { title: 'Motif / Description', dataIndex: 'motif', key: 'motif' },
        {
            title: 'Montant Sorti', dataIndex: 'montant', key: 'montant',
            render: m => <span style={{ color: '#f5222d', fontWeight: 600 }}>{formatFCFA(m)}</span>
        }
    ];

    const invColumns = [
        { title: 'Période', key: 'periode', render: (_, r) => `${r.mois}/${r.annee}` },
        { title: 'Solde Comptable (Système)', dataIndex: 'solde_comptable', key: 'sc', render: m => formatFCFA(m) },
        { title: 'Solde Coffre (Compté)', dataIndex: 'solde_physique', key: 'sf', render: m => formatFCFA(m) },
        { title: 'Écart', dataIndex: 'ecart', key: 'ecart', render: renderEcart },
        { title: 'Statut', dataIndex: 'statut', key: 'statut', render: s => <Tag color={s === 'en_cours' ? 'blue' : 'green'}>{s?.toUpperCase()}</Tag> },
        {
            title: 'Action', key: 'action',
            render: (_, r) => (
                <Button type="primary" size="small" disabled={r.statut === 'clos'} onClick={() => handleCloreInventaire(r.id)}>
                    Clore & Justifier
                </Button>
            )
        }
    ];

    return (
        <CashierLayout>
                <CashierPageHeader
                    icon={Wallet}
                    title="Caisse journalière & inventaires"
                    subtitle="Supervision de la journée de caisse, dépenses menues et inventaires périodiques."
                    actions={(
                        <Button icon={<SyncOutlined />} onClick={fetchData} loading={loading}>
                            Actualiser
                        </Button>
                    )}
                />

                {/* Anti-Fraude Info Banner */}
                <Alert
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined />}
                    style={{ marginBottom: 24, borderRadius: 8 }}
                    message={
                        <span style={{ fontWeight: 600 }}>Comment fonctionne le contrôle de caisse ?</span>
                    }
                    description={
                        <Row gutter={24} style={{ marginTop: 8 }}>
                            <Col span={8}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <Tag color="purple" style={{ marginTop: 2 }}>THÉORIQUE</Tag>
                                    <span style={{ fontSize: 12, color: '#555' }}>
                                        Calculé <strong>automatiquement</strong> par le système = Ouverture + Encaissements − Dépenses.
                                        <br />Le caissier <strong>ne peut pas modifier</strong> ce chiffre.
                                    </span>
                                </div>
                            </Col>
                            <Col span={8}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <Tag color="blue" style={{ marginTop: 2 }}>PHYSIQUE</Tag>
                                    <span style={{ fontSize: 12, color: '#555' }}>
                                        Ce que le caissier <strong>compte réellement</strong> dans son tiroir à la fermeture.
                                        <br />Saisi manuellement une seule fois à la clôture.
                                    </span>
                                </div>
                            </Col>
                            <Col span={8}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <Tag color="red" style={{ marginTop: 2 }}>ÉCART</Tag>
                                    <span style={{ fontSize: 12, color: '#555' }}>
                                        = Physique − Théorique.<br />
                                        Un <strong>écart négatif</strong> signale une anomalie → signalement automatique au Directeur.
                                    </span>
                                </div>
                            </Col>
                        </Row>
                    }
                />

                {/* Status Cards Row */}
                <Row gutter={16} style={{ marginBottom: '24px' }}>
                    <Col span={activeCaisse ? 12 : 24}>
                        <Card style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 8 }}>Statut de la Caisse</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <Badge
                                            status={activeCaisse ? 'success' : 'default'}
                                            text={
                                                <span style={{
                                                    fontSize: 22, fontWeight: 700,
                                                    color: activeCaisse ? '#52c41a' : '#bfbfbf'
                                                }}>
                                                    {activeCaisse ? '🔓 OUVERTE' : '🔒 FERMÉE'}
                                                </span>
                                            }
                                        />
                                    </div>
                                    {activeCaisse && (
                                        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                                            {activeCaisse.libelle_periode || 'Période active'} •
                                            Ouverte le {new Date(activeCaisse.periode_debut || activeCaisse.date).toLocaleString('fr-FR')} •
                                            Solde d&apos;ouverture : <strong>{formatFCFA(activeCaisse.solde_ouverture)}</strong>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    {activeCaisse ? (
                                        <Button
                                            type="primary" danger
                                            icon={<LockOutlined />}
                                            onClick={() => setCloseModalVisible(true)}
                                            size="large"
                                        >
                                            Fermer la Caisse
                                        </Button>
                                    ) : (
                                        <Button
                                            type="primary"
                                            icon={<UnlockOutlined />}
                                            onClick={() => setOpenModalVisible(true)}
                                            size="large"
                                        >
                                            Ouvrir la Caisse
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </Col>

                    {activeCaisse && (
                        <Col span={12}>
                            <Card style={{ borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', background: 'linear-gradient(135deg, #f0f5ff, #e6f7ff)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <Tooltip title="Ce montant est calculé automatiquement par le système. Vous ne pouvez pas le modifier.">
                                            <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 8 }}>
                                                Solde Théorique Actuel (Système) <InfoCircleOutlined style={{ color: '#722ed1' }} />
                                            </div>
                                        </Tooltip>
                                        <div style={{ fontSize: 26, fontWeight: 700, color: '#722ed1' }}>
                                            {formatFCFA(activeCaisse.solde_theorique)}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                                            Calculé automatiquement • Non modifiable par le caissier
                                        </div>
                                    </div>
                                    <Button
                                        type="dashed"
                                        icon={<PlusOutlined />}
                                        onClick={() => setDepenseModalVisible(true)}
                                    >
                                        Déclarer Dépense Menue
                                    </Button>
                                </div>
                            </Card>
                        </Col>
                    )}
                </Row>

                {/* Tabs */}
                <Tabs
                    defaultActiveKey="caisses"
                    size="large"
                    tabBarExtraContent={
                        <Button icon={<SyncOutlined />} onClick={fetchData} loading={loading}>
                            Actualiser
                        </Button>
                    }
                >
                    <TabPane
                        tab={<span><HistoryOutlined /> Historique des Caisses</span>}
                        key="caisses"
                    >
                        <Card style={{ borderRadius: 8 }}>
                            <Table
                                dataSource={caisses}
                                columns={caisseColumns}
                                rowKey="id"
                                loading={loading}
                                locale={{ emptyText: "Aucun historique de caisse." }}
                                rowClassName={(record) => record.ecart !== null && record.ecart !== undefined && record.ecart < 0 ? 'ant-table-row-danger' : ''}
                            />
                        </Card>
                    </TabPane>

                    <TabPane
                        tab={<span><MinusCircleOutlined /> Petites Dépenses de Caisse</span>}
                        key="depenses"
                    >
                        <Alert
                            type="warning"
                            message="Chaque dépense déclarée ici est déduite automatiquement du solde théorique. Le système enregistre l'heure et l'auteur."
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        <Card style={{ borderRadius: 8 }}>
                            <Table
                                dataSource={depenses}
                                columns={depenseColumns}
                                rowKey="id"
                                loading={loading}
                                locale={{ emptyText: "Aucune dépense de petite caisse déclarée." }}
                            />
                        </Card>
                    </TabPane>

                    <TabPane
                        tab={<span><AlertOutlined /> Inventaires Mensuels</span>}
                        key="inventaires"
                    >
                        <Alert
                            type="info"
                            message="L'inventaire mensuel compare le solde comptable (calculé par le système) avec le solde physique compté dans le coffre. Tout écart est signalé."
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        <Card style={{ borderRadius: 8 }}>
                            <Table
                                dataSource={inventaires}
                                columns={invColumns}
                                rowKey="id"
                                loading={loading}
                                locale={{ emptyText: "Aucun inventaire mensuel enregistré." }}
                            />
                        </Card>
                    </TabPane>
                </Tabs>

                {/* MODAL: Ouvrir Caisse */}
                <Modal
                    title={<><UnlockOutlined /> Ouvrir la Caisse du Jour</>}
                    open={openModalVisible}
                    onCancel={() => setOpenModalVisible(false)}
                    footer={null}
                >
                    {hasAutoReport ? (
                        <Alert
                            type="success"
                            showIcon
                            message="Report automatique de caisse (anti-fraude)"
                            description={
                                <span>
                                    Le solde de départ sera <strong>{formatFCFA(getFiableOpeningBalance())}</strong>,
                                    repris du comptage physique de la dernière fermeture.
                                    Le caissier <strong>ne peut pas modifier</strong> ce montant.
                                </span>
                            }
                            style={{ marginBottom: 16 }}
                        />
                    ) : (
                        <Alert
                            type="warning"
                            showIcon
                            message="Premier démarrage de caisse"
                            description="Aucun historique fermé trouvé. Entrez le fond de caisse initial alloué par le chef de comptabilité."
                            style={{ marginBottom: 16 }}
                        />
                    )}
                    <Form form={openForm} layout="vertical" onFinish={handleOuvrirCaisse} initialValues={{ type_periode: 'journee' }}>
                        <Form.Item
                            name="type_periode"
                            label="Type de période de caisse"
                            rules={[{ required: true }]}
                        >
                            <Select>
                                <Option value="journee">Journée standard (07h – 19h)</Option>
                                <Option value="garde_24h">Garde 24h/24</Option>
                                <Option value="personnalisee">Période personnalisée</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type_periode !== cur.type_periode}>
                            {({ getFieldValue }) => getFieldValue('type_periode') === 'personnalisee' ? (
                                <>
                                    <Form.Item name="libelle_periode" label="Libellé de la période">
                                        <Input placeholder="Ex: Garde de nuit, Week-end..." />
                                    </Form.Item>
                                    <Form.Item name="periode_custom" label="Début et fin prévus">
                                        <RangePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" />
                                    </Form.Item>
                                </>
                            ) : null}
                        </Form.Item>
                        <Form.Item
                            name="solde_ouverture"
                            label="Fond de caisse initial (première ouverture uniquement)"
                            rules={hasAutoReport ? [] : [{ required: true, message: 'Ce champ est obligatoire' }]}
                            extra={
                                hasAutoReport
                                    ? 'Montant calculé par le système — non modifiable.'
                                    : 'Saisie réservée au premier démarrage, validée par le chef comptable.'
                            }
                            hidden={hasAutoReport}
                        >
                            <InputNumber
                                style={{ width: '100%' }}
                                min={0}
                                step={500}
                                placeholder="Ex: 50 000"
                                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                                addonAfter="FCFA"
                            />
                        </Form.Item>
                        {hasAutoReport && (
                            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 mb-4 text-green-900">
                                <div className="text-xs uppercase font-semibold text-green-700">Solde d&apos;ouverture</div>
                                <div className="text-xl font-bold">{formatFCFA(getFiableOpeningBalance())}</div>
                            </div>
                        )}
                        <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                            <Space>
                                <Button onClick={() => setOpenModalVisible(false)}>Annuler</Button>
                                <Button type="primary" htmlType="submit" loading={loading}>
                                    Confirmer et Ouvrir la Caisse
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>

                {/* MODAL: Fermer Caisse */}
                <Modal
                    title={<><LockOutlined /> Fermeture de la Caisse du Jour</>}
                    open={closeModalVisible}
                    onCancel={() => setCloseModalVisible(false)}
                    footer={null}
                    width={520}
                >
                    {activeCaisse && (
                        <>
                            <Alert
                                type="info"
                                showIcon
                                icon={<InfoCircleOutlined />}
                                message={
                                    <div>
                                        <div><strong>Solde Théorique attendu (Système) :</strong></div>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#722ed1', margin: '6px 0' }}>
                                            {formatFCFA(activeCaisse.solde_theorique)}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#666' }}>
                                            Ce chiffre a été calculé automatiquement par le système à partir de toutes les transactions de la journée.
                                            Vous devez compter physiquement votre tiroir-caisse et entrer le résultat ci-dessous.
                                        </div>
                                    </div>
                                }
                                style={{ marginBottom: 20 }}
                            />
                            <Divider>Comptage physique du coffre</Divider>
                        </>
                    )}
                    <Form form={closeForm} layout="vertical" onFinish={handleFermerCaisse}>
                        <Form.Item
                            name="solde_physique"
                            label="Montant compté dans votre tiroir-caisse / coffre"
                            rules={[{ required: true, message: 'Ce champ est obligatoire' }]}
                            extra="Comptez précisément les billets et pièces. Ce montant sera comparé au solde théorique."
                        >
                            <InputNumber
                                style={{ width: '100%' }}
                                min={0}
                                step={500}
                                placeholder="Ex: 138 500"
                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                                addonAfter="FCFA"
                            />
                        </Form.Item>
                        <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                            <Space>
                                <Button onClick={() => setCloseModalVisible(false)}>Annuler</Button>
                                <Button type="primary" danger htmlType="submit" loading={loading}>
                                    Fermer la Caisse & Calculer l'Écart
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>

                {/* MODAL: Dépense Menue */}
                <Modal
                    title={<><PlusOutlined /> Déclarer une Dépense Menue de Caisse</>}
                    open={depenseModalVisible}
                    onCancel={() => setDepenseModalVisible(false)}
                    footer={null}
                >
                    <Alert
                        type="warning"
                        showIcon
                        message="Cette dépense sera automatiquement déduite du solde théorique. Elle est enregistrée avec votre identifiant et l'heure exacte."
                        style={{ marginBottom: 16 }}
                    />
                    <Form form={depenseForm} layout="vertical" onFinish={handleCreateDepense}>
                        <Form.Item
                            name="motif"
                            label="Motif / Description de la dépense"
                            rules={[{ required: true, message: 'Décrivez la raison de cette dépense' }]}
                        >
                            <AutoComplete
                                options={MOTIFS_DEPENSE_MENUE.map((m) => ({ value: m }))}
                                filterOption={(input, option) =>
                                    (option?.value || '')
                                        .toLowerCase()
                                        .includes((input || '').toLowerCase())
                                }
                                placeholder="Rechercher ou saisir un motif…"
                            />
                        </Form.Item>
                        <Form.Item
                            name="montant"
                            label="Montant Sorti"
                            rules={[{ required: true, message: 'Entrez le montant exact' }]}
                        >
                            <InputNumber
                                style={{ width: '100%' }}
                                min={1}
                                step={500}
                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                                addonAfter="FCFA"
                            />
                        </Form.Item>
                        <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
                            <Space>
                                <Button onClick={() => setDepenseModalVisible(false)}>Annuler</Button>
                                <Button type="primary" htmlType="submit" loading={loading}>
                                    Enregistrer la Dépense
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>
        </CashierLayout>
    );
};

export default CaisseJournalierePage;
