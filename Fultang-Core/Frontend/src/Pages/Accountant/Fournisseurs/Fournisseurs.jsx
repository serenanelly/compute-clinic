import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Modal, Form, Input, Switch, message, Tooltip, Row, Col, Statistic, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined, SearchOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { getFournisseurs, createFournisseur, updateFournisseur, deleteFournisseur, getFournisseurHistorique, getComptesComptables } from '../../../services/accountantApi';
import AccountantLayout from '../AccountantLayout';

const formatApiError = (error, fallback = "Erreur lors de l'enregistrement.") => {
    const data = error?.response?.data;
    if (!data) return fallback;
    if (typeof data === 'string') return data;
    if (data.error) return data.error;
    return Object.entries(data)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join(' · ');
};

export const FournisseursPage = () => {
    const [loading, setLoading] = useState(false);
    const [fournisseurs, setFournisseurs] = useState([]);
    const [comptesFournisseur, setComptesFournisseur] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [form] = Form.useForm();

    // History Modal states
    const [historyVisible, setHistoryVisible] = useState(false);
    const [historyData, setHistoryData] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [data, comptes] = await Promise.all([
                getFournisseurs(),
                getComptesComptables().catch(() => []),
            ]);
            setFournisseurs(data || []);
            const comptes401 = (comptes || []).filter(c =>
                String(c.numero_compte || '').startsWith('401')
            );
            setComptesFournisseur(comptes401);
        } catch (error) {
            console.error("Error loading suppliers:", error);
            message.error("Impossible de récupérer la liste des fournisseurs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAdd = () => {
        setEditingRecord(null);
        form.resetFields();
        const defaultCompte = comptesFournisseur.find(c => c.numero_compte === '401') || comptesFournisseur[0];
        if (defaultCompte) {
            form.setFieldsValue({ compte_comptable: defaultCompte.id });
        }
        setModalVisible(true);
    };

    const handleEdit = (record) => {
        setEditingRecord(record);
        form.setFieldsValue(record);
        setModalVisible(true);
    };

    const handleDelete = async (id) => {
        try {
            setLoading(true);
            await deleteFournisseur(id);
            message.success("Fournisseur supprimé avec succès.");
            loadData();
        } catch (error) {
            console.error("Error deleting supplier:", error);
            message.error("Erreur lors de la suppression.");
        } finally {
            setLoading(false);
        }
    };

    const handleHistory = async (record) => {
        setHistoryVisible(true);
        setHistoryLoading(true);
        try {
            const data = await getFournisseurHistorique(record.id);
            setHistoryData(data);
        } catch (error) {
            console.error("Error fetching supplier history:", error);
            message.error("Impossible de récupérer l'historique.");
            setHistoryVisible(false);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleSubmit = async (values) => {
        try {
            setLoading(true);
            if (editingRecord) {
                await updateFournisseur(editingRecord.id, values);
                message.success("Fournisseur mis à jour avec succès.");
            } else {
                await createFournisseur(values);
                message.success("Fournisseur créé avec succès.");
            }
            setModalVisible(false);
            loadData();
        } catch (error) {
            console.error("Error saving supplier:", error);
            message.error(formatApiError(error, "Erreur lors de l'enregistrement."));
        } finally {
            setLoading(false);
        }
    };

    const filtered = fournisseurs.filter(f =>
        f.raison_sociale?.toLowerCase().includes(searchText.toLowerCase()) ||
        f.niu?.toLowerCase().includes(searchText.toLowerCase())
    );

    const columns = [
        {
            title: 'Raison Sociale',
            dataIndex: 'raison_sociale',
            key: 'raison_sociale',
            render: (text) => <strong>{text}</strong>
        },
        {
            title: 'NIU (N° Identifiant Unique)',
            dataIndex: 'niu',
            key: 'niu',
            render: (text) => (
                <Space>
                    <Tag color="blue">{text}</Tag>
                    <SafetyCertificateOutlined style={{ color: '#52c41a' }} title="Conforme DGI Cameroun" />
                </Space>
            )
        },
        {
            title: 'Téléphone',
            dataIndex: 'telephone',
            key: 'telephone'
        },
        {
            title: 'E-mail',
            dataIndex: 'email',
            key: 'email'
        },
        {
            title: 'Statut',
            dataIndex: 'actif',
            key: 'actif',
            render: (actif) => (
                <Tag color={actif ? 'green' : 'red'}>
                    {actif ? 'ACTIF' : 'INACTIF'}
                </Tag>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Modifier">
                        <Button type="default" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    </Tooltip>
                    <Tooltip title="Historique d'achat">
                        <Button type="default" icon={<HistoryOutlined />} onClick={() => handleHistory(record)} />
                    </Tooltip>
                    <Tooltip title="Supprimer">
                        <Button type="primary" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
                    </Tooltip>
                </Space>
            )
        }
    ];

    return (
        <AccountantLayout>
            <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Référentiel des Fournisseurs & Tiers</h1>
                    <p style={{ color: '#8c8c8c', margin: 0 }}>
                        Gérer les fiches des fournisseurs pour le circuit d'achat et suivre leurs volumes de transactions.
                    </p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    Nouveau Fournisseur
                </Button>
            </div>

            <Card style={{ borderRadius: '8px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <Input
                    placeholder="Rechercher par raison sociale, NIU..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 320 }}
                />
            </Card>

            <Card style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <Table
                    dataSource={filtered}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: "Aucun fournisseur enregistré." }}
                />
            </Card>

            {/* CREATE / EDIT MODAL */}
            <Modal
                title={editingRecord ? "Modifier le Fournisseur" : "Nouveau Fournisseur"}
                visible={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{ actif: true }}
                >
                    <Form.Item
                        name="raison_sociale"
                        label="Raison Sociale"
                        rules={[{ required: true, message: "La raison sociale est requise." }]}
                    >
                        <Input placeholder="Ex: Pharmalife S.A." />
                    </Form.Item>

                    <Form.Item
                        name="niu"
                        label="Numéro d'Identifiant Unique (NIU)"
                        rules={[
                            { required: true, message: "Le NIU est requis." },
                            {
                                pattern: /^M[0-9]{11}[A-Z]{0,1}$/,
                                message: "Format NIU invalide (Ex: M012345678901)"
                            }
                        ]}
                    >
                        <Input placeholder="Ex: M123456789012" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="telephone" label="Téléphone">
                                <Input placeholder="Ex: +237 677 88 99 00" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="email"
                                label="E-mail"
                                rules={[{ type: 'email', message: "E-mail invalide." }]}
                            >
                                <Input placeholder="Ex: contact@pharmalife.cm" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="adresse" label="Adresse">
                        <Input.TextArea placeholder="Ex: B.P. 120, Yaoundé" rows={2} />
                    </Form.Item>

                    <Form.Item
                        name="compte_comptable"
                        label="Compte comptable fournisseur (401)"
                        rules={[{ required: true, message: 'Le compte comptable est requis.' }]}
                        tooltip="Compte du plan comptable utilisé pour les écritures fournisseur (classe 4 — 401)."
                    >
                        <Select
                            showSearch
                            placeholder="Sélectionner un compte 401"
                            optionFilterProp="children"
                        >
                            {comptesFournisseur.map(c => (
                                <Select.Option key={c.id} value={c.id}>
                                    {c.numero_compte} — {c.libelle}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="actif" label="Fournisseur Actif" valuePropName="checked">
                        <Switch />
                    </Form.Item>

                    <div style={{ textAlign: 'right', marginTop: '24px' }}>
                        <Space>
                            <Button onClick={() => setModalVisible(false)}>Annuler</Button>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Enregistrer
                            </Button>
                        </Space>
                    </div>
                </Form>
            </Modal>

            {/* TRANSACTION HISTORY MODAL */}
            <Modal
                title="Historique des Transactions Financières"
                visible={historyVisible}
                onCancel={() => setHistoryVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setHistoryVisible(false)}>Fermer</Button>
                ]}
                destroyOnClose
            >
                {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>Chargement de l'historique...</div>
                ) : historyData ? (
                    <div style={{ padding: '12px 0' }}>
                        <h3 style={{ marginBottom: '20px', color: '#1e40af' }}>{historyData.fournisseur}</h3>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Card style={{ background: '#f8fafc' }}>
                                    <Statistic
                                        title="Commandes Validées"
                                        value={historyData.nombre_commandes}
                                        valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card style={{ background: '#f8fafc' }}>
                                    <Statistic
                                        title="Volume Financier Engagé"
                                        value={historyData.total_commandes}
                                        suffix="FCFA"
                                        valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                                    />
                                </Card>
                            </Col>
                        </Row>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px' }}>Aucune donnée historique disponible.</div>
                )}
            </Modal>
            </div>
        </AccountantLayout>
    );
};
