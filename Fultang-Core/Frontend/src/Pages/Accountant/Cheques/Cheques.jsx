import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Tabs, Tooltip, message, Row, Col, Statistic } from 'antd';
import { SyncOutlined, CheckCircleOutlined, DollarOutlined, HistoryOutlined } from '@ant-design/icons';
import { CheckSquare, ShieldCheck, RefreshCw, Wallet, Calendar } from 'lucide-react';
import { getCheques, encaisserCheque } from '../../../services/accountantApi';
import AccountantLayout from '../AccountantLayout';
import AccountantPageHeader from '../AccountantPageHeader';
import { Link } from 'react-router-dom';
import { AppRoutesPaths } from '../../../Router/appRouterPaths';

export const ChequesPage = () => {
    const [loading, setLoading] = useState(false);
    const [cheques, setCheques] = useState([]);
    const [activeTab, setActiveTab] = useState('non_encaisses');

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getCheques();
            setCheques(data || []);
        } catch (error) {
            console.error("Error loading cheques:", error);
            message.error("Impossible de charger le portefeuille de chèques.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleEncaisser = async (id) => {
        try {
            setLoading(true);
            await encaisserCheque(id);
            message.success(
                <span>
                    Chèque encaissé. Comptabilisez la quittance liée pour générer l'écriture.{' '}
                    <Link to={AppRoutesPaths.accountantComptabilisation} className="underline font-semibold">
                        Comptabilisation
                    </Link>
                </span>,
                8
            );
            loadData();
        } catch (error) {
            console.error("Error clearing cheque:", error);
            message.error(error.response?.data?.error || "Erreur lors de l'encaissement du chèque.");
        } finally {
            setLoading(false);
        }
    };

    const pendingCheques = cheques.filter(c => !c.est_encaisse);
    const clearedCheques = cheques.filter(c => c.est_encaisse);

    const pendingColumns = [
        {
            title: 'N° Chèque',
            dataIndex: 'numero',
            key: 'numero',
            render: (text) => <span className="font-extrabold text-[#051161] tracking-wider">{text}</span>
        },
        {
            title: 'Banque Émettrice',
            dataIndex: 'banque',
            key: 'banque',
            render: (text) => <span className="font-bold text-gray-700">{text}</span>
        },
        {
            title: 'Titulaire du Compte',
            dataIndex: 'titulaire',
            key: 'titulaire',
            render: (text) => <span className="font-semibold text-gray-600">{text}</span>
        },
        {
            title: 'Quittance Liée',
            dataIndex: 'quittance_numero',
            key: 'quittance_numero',
            render: (text) => text ? <Tag color="blue" className="font-bold border-none rounded-full px-2.5">{text}</Tag> : <Tag className="border-none rounded-full">Aucune</Tag>
        },
        {
            title: 'Montant',
            dataIndex: 'montant',
            key: 'montant',
            align: 'right',
            render: (val) => <span className="font-extrabold text-[#1A73A3] text-base">{new Intl.NumberFormat('fr-FR').format(val)} FCFA</span>
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleEncaisser(record.id)}
                    loading={loading}
                    className="rounded-xl font-bold bg-[#10b981] hover:bg-emerald-600 border-none shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1"
                >
                    Marquer Encaissé
                </Button>
            )
        }
    ];

    const clearedColumns = [
        {
            title: 'N° Chèque',
            dataIndex: 'numero',
            key: 'numero',
            render: (text) => <span className="font-extrabold text-gray-400 tracking-wider line-through">{text}</span>
        },
        {
            title: 'Banque Émettrice',
            dataIndex: 'banque',
            key: 'banque',
            render: (text) => <span className="font-bold text-gray-600">{text}</span>
        },
        {
            title: 'Titulaire',
            dataIndex: 'titulaire',
            key: 'titulaire',
            render: (text) => <span className="font-semibold text-gray-500">{text}</span>
        },
        {
            title: 'Quittance Liée',
            dataIndex: 'quittance_numero',
            key: 'quittance_numero',
            render: (text) => <Tag color="blue" className="border-none rounded-full px-2.5 font-semibold">{text}</Tag>
        },
        {
            title: 'Montant',
            dataIndex: 'montant',
            key: 'montant',
            align: 'right',
            render: (val) => <span className="font-extrabold text-emerald-600">{new Intl.NumberFormat('fr-FR').format(val)} FCFA</span>
        },
        {
            title: 'Date d\'encaissement',
            dataIndex: 'date_encaissement',
            key: 'date_encaissement',
            render: (d) => <span className="font-semibold text-gray-400">{d ? new Date(d).toLocaleString('fr-FR') : '-'}</span>
        },
        {
            title: 'Statut',
            key: 'status',
            align: 'right',
            render: () => <Tag color="green" className="font-bold border-none rounded-full px-3 py-1 shadow-sm uppercase tracking-wider">ENCAISSÉ</Tag>
        }
    ];

    const totalPending = pendingCheques.reduce((sum, c) => sum + parseFloat(c.montant || 0), 0);
    const totalCleared = clearedCheques.reduce((sum, c) => sum + parseFloat(c.montant || 0), 0);

    return (
        <AccountantLayout>
            <div className="space-y-6">
                <AccountantPageHeader
                    title="Portefeuille chèques"
                    subtitle="Suivi des chèques encaissés — comptabilisez ensuite la quittance liée"
                    icon={Wallet}
                    actions={
                        <Button type="primary" icon={<RefreshCw className="w-4 h-4" />} onClick={loadData} loading={loading}>
                            Actualiser
                        </Button>
                    }
                />

                {/* Statistics Grid */}
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                        <Card style={{ borderRadius: '20px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} className="bg-gradient-to-br from-slate-50 to-slate-100/50">
                            <Statistic 
                                title={<span className="text-gray-400 font-semibold uppercase text-xs tracking-wider">Volume en Attente d'Encaissement</span>} 
                                value={totalPending} 
                                suffix=" FCFA"
                                valueStyle={{ color: '#eab308', fontWeight: '900', fontSize: '28px' }} 
                            />
                        </Card>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Card style={{ borderRadius: '20px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} className="bg-gradient-to-br from-slate-50 to-slate-100/50">
                            <Statistic 
                                title={<span className="text-gray-400 font-semibold uppercase text-xs tracking-wider">Total Encaissé (Mois Courant)</span>} 
                                value={totalCleared} 
                                suffix=" FCFA"
                                valueStyle={{ color: '#10b981', fontWeight: '900', fontSize: '28px' }} 
                            />
                        </Card>
                    </Col>
                </Row>

                {/* Tab layout */}
                <Card style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} bordered={false}>
                    <Tabs
                        activeKey={activeTab}
                        onChange={(key) => setActiveTab(key)}
                        items={[
                            {
                                key: 'non_encaisses',
                                label: <span className="font-bold flex items-center gap-1.5"><CheckSquare className="w-4 h-4" /> Chèques à Encaisser ({pendingCheques.length})</span>,
                                children: (
                                    <Table
                                        dataSource={pendingCheques}
                                        columns={pendingColumns}
                                        rowKey="id"
                                        loading={loading}
                                        pagination={{ pageSize: 8 }}
                                        className="custom-table mt-4"
                                    />
                                )
                            },
                            {
                                key: 'encaisses',
                                label: <span className="font-bold flex items-center gap-1.5"><HistoryOutlined /> Historique des Chèques Encaissés ({clearedCheques.length})</span>,
                                children: (
                                    <Table
                                        dataSource={clearedCheques}
                                        columns={clearedColumns}
                                        rowKey="id"
                                        loading={loading}
                                        pagination={{ pageSize: 8 }}
                                        className="custom-table mt-4"
                                    />
                                )
                            }
                        ]}
                    />
                </Card>
            </div>
        </AccountantLayout>
    );
};
export default ChequesPage;
