import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, InputNumber, Select, Row, Col, Statistic, Space, Tag, message, Divider, Progress } from 'antd';
import { UsersOutlined, DollarOutlined, PlayCircleOutlined, PieChartOutlined, PercentageOutlined } from '@ant-design/icons';
import { getSalaires, genererSalaires, getMasseSalariale } from '../../../services/accountantApi';

const { Option } = Select;

export const PaieGestionPage = () => {
    const [loading, setLoading] = useState(false);
    const [salaires, setSalaires] = useState([]);
    const [masseStats, setMasseStats] = useState({ total_brut: 0, total_net: 0, count: 0 });
    const [form] = Form.useForm();

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getSalaires();
            setSalaires(data || []);

            const currentYear = new Date().getFullYear();
            const stats = await getMasseSalariale(currentYear);
            setMasseStats({
                total_brut: stats.total_brut || 0,
                total_net: stats.total_net || 0,
                count: stats.nombre_bulletins || 0
            });
        } catch (error) {
            console.error("Error loading payroll details:", error);
            message.error("Impossible de charger les fiches de paie.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleGenererPaie = async (values) => {
        setLoading(true);
        try {
            // Mock personnel list for clinical staff generator demo
            const demoPersonnels = [
                { personnel_id: 1, nom_personnel: "Dr. Jean Dupont", matricule: "PERS-001", poste: "Médecin Généraliste", salaire_brut: 950000, retenue_cnps: 42000, retenue_impots: 110000 },
                { personnel_id: 2, nom_personnel: "Dr. Marie Mbarga", matricule: "PERS-002", poste: "Pédiatre", salaire_brut: 1150000, retenue_cnps: 42000, retenue_impots: 155000 },
                { personnel_id: 3, nom_personnel: "Sœur Thérèse Ngo", matricule: "PERS-003", poste: "Infirmière Major", salaire_brut: 450000, retenue_cnps: 18000, retenue_impots: 45000 },
                { personnel_id: 4, nom_personnel: "Albert Kamga", matricule: "PERS-004", poste: "Caissier Principal", salaire_brut: 300000, retenue_cnps: 12000, retenue_impots: 25000 }
            ];

            const payload = {
                mois: values.mois,
                annee: values.annee,
                personnels: demoPersonnels
            };

            const res = await genererSalaires(payload);
            message.success(`Bulletins de paie générés avec succès pour ${values.mois}/${values.annee} ! ${res.bulletins_crees} bulletins créés.`);
            fetchData();
        } catch (error) {
            console.error("Error generating salary slips:", error);
            message.error("Erreur lors de la génération automatique de la paie.");
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: 'Matricule', dataIndex: 'matricule', key: 'matricule', render: text => <strong style={{ color: '#595959' }}>{text}</strong> },
        { title: 'Employé', dataIndex: 'nom_personnel', key: 'nom', render: (text, r) => (
            <div>
                <div style={{ fontWeight: 500 }}>{text}</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{r.poste}</div>
            </div>
        )},
        { title: 'Période', key: 'periode', render: (_, r) => `${String(r.mois).padStart(2, '0')}/${r.annee}` },
        { title: 'Salaire Brut', dataIndex: 'salaire_brut', key: 'brut', render: val => `${new Intl.NumberFormat('fr-FR').format(val)} FCFA` },
        { title: 'Cotis. CNPS', dataIndex: 'retenue_cnps', key: 'cnps', render: val => <span style={{ color: '#faad14' }}>{new Intl.NumberFormat('fr-FR').format(val)} FCFA</span> },
        { title: 'Impôts (IRPP)', dataIndex: 'retenue_impots', key: 'impots', render: val => <span style={{ color: '#ff4d4f' }}>{new Intl.NumberFormat('fr-FR').format(val)} FCFA</span> },
        { title: 'Salaire Net', dataIndex: 'salaire_net', key: 'net', render: val => <strong style={{ color: '#2f54eb' }}>{new Intl.NumberFormat('fr-FR').format(val)} FCFA</strong> },
        { title: 'Statut', dataIndex: 'est_paye', key: 'statut', render: p => p ? <Tag color="green">PAYÉ</Tag> : <Tag color="orange">A PAYER</Tag> }
    ];

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Gestion de la Paie & Bulletins</h1>
                <p style={{ color: '#8c8c8c', margin: 0 }}>
                    Élaborer et valider la paie du personnel hospitalier, et comptabiliser les charges sociales correspondantes.
                </p>
            </div>

            <Row gutter={16} style={{ marginBottom: '24px' }}>
                <Col span={8}>
                    <Card style={{ borderRadius: '8px' }}>
                        <Statistic
                            title="Employés sous contrat"
                            value={masseStats.count}
                            prefix={<UsersOutlined style={{ color: '#1890ff' }} />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card style={{ borderRadius: '8px' }}>
                        <Statistic
                            title="Masse Salariale brute"
                            value={masseStats.total_brut}
                            suffix="FCFA"
                            valueStyle={{ color: '#faad14', fontWeight: 'bold' }}
                            prefix={<DollarOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card style={{ borderRadius: '8px' }}>
                        <Statistic
                            title="Masse Salariale nette versée"
                            value={masseStats.total_net}
                            suffix="FCFA"
                            valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                            prefix={<PieChartOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={24}>
                <Col span={6}>
                    <Card title="Générer Bulletins de Paie" style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleGenererPaie}
                            initialValues={{ mois: currentMonth, annee: currentYear }}
                        >
                            <Form.Item name="mois" label="Mois de Paie" rules={[{ required: true }]}>
                                <Select>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                        <Option key={m} value={m}>{String(m).padStart(2, '0')}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            
                            <Form.Item name="annee" label="Année de Paie" rules={[{ required: true }]}>
                                <Select>
                                    {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                                        <Option key={y} value={y}>{y}</Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Button
                                type="primary"
                                icon={<PlayCircleOutlined />}
                                htmlType="submit"
                                style={{ width: '100%' }}
                                loading={loading}
                            >
                                Lancer Calcul de Paie
                            </Button>
                        </Form>

                        <Divider />
                        
                        <div>
                            <h4>Indicateurs de cotisations</h4>
                            <div style={{ marginBottom: '8px' }}>
                                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>Part salariale CNPS (4.2%)</span>
                                <Progress percent={100} size="small" strokeColor="#faad14" showInfo={false} />
                            </div>
                            <div>
                                <span style={{ fontSize: '13px', color: '#8c8c8c' }}>IRPP & Retenues fiscales</span>
                                <Progress percent={100} size="small" strokeColor="#ff4d4f" showInfo={false} />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col span={18}>
                    <Card title="Livre de Paie & bulletins de salaire" style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <Table
                            dataSource={salaires}
                            columns={columns}
                            rowKey="id"
                            loading={loading}
                            pagination={{ pageSize: 8 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};
