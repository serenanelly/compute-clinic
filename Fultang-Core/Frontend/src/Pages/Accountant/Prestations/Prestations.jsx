import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Input, Select, Button, Space, message } from 'antd';
import { SearchOutlined, SyncOutlined, MedicineBoxOutlined } from '@ant-design/icons';
import { getPrestationsDeService } from '../../../services/accountantApi';
import AccountantLayout from '../AccountantLayout';

const { Option } = Select;

export const PrestationsPage = () => {
    const [loading, setLoading] = useState(false);
    const [prestations, setPrestations] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [selectedService, setSelectedService] = useState('all');

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getPrestationsDeService();
            setPrestations(data || []);
        } catch (error) {
            console.error("Error loading services catalogue:", error);
            message.error("Impossible de récupérer le catalogue des prestations.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const filtered = prestations.filter(p => {
        const matchesSearch = p.libelle?.toLowerCase().includes(searchText.toLowerCase()) ||
                              p.code?.toLowerCase().includes(searchText.toLowerCase());
        const matchesService = selectedService === 'all' || p.service_hospitalier === selectedService;
        return matchesSearch && matchesService;
    });

    const columns = [
        {
            title: 'Code Acte',
            dataIndex: 'code',
            key: 'code',
            render: (text) => <strong style={{ color: '#1e40af' }}>{text}</strong>
        },
        {
            title: 'Libellé de l\'Acte',
            dataIndex: 'libelle',
            key: 'libelle'
        },
        {
            title: 'Service Clinique',
            dataIndex: 'service_hospitalier',
            key: 'service_hospitalier',
            render: (srv) => <Tag color="purple">{srv?.toUpperCase() || 'MUTUALISÉ'}</Tag>
        },
        {
            title: 'Tarif Standard',
            dataIndex: 'tarif',
            key: 'tarif',
            align: 'right',
            render: (val) => <span style={{ fontWeight: 'bold', color: '#10b981' }}>{new Intl.NumberFormat('fr-FR').format(val)} FCFA</span>
        },
        {
            title: 'Statut',
            dataIndex: 'disponible',
            key: 'disponible',
            render: (dispo) => (
                <Tag color={dispo ? 'green' : 'orange'}>
                    {dispo ? 'DISPONIBLE' : 'SUSPENDU'}
                </Tag>
            )
        }
    ];

    // Extract unique services for dropdown filter
    const services = Array.from(new Set(prestations.map(p => p.service_hospitalier).filter(Boolean)));

    return (
        <AccountantLayout>
            <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Catalogue des Prestations & Actes</h1>
                    <p style={{ color: '#8c8c8c', margin: 0 }}>
                        Consulter les tarifs officiels et la ventilation par services cliniques (Consultation, Laboratoire, Pharmacie...).
                    </p>
                </div>
                <Button type="default" icon={<SyncOutlined />} onClick={loadData} loading={loading}>
                    Actualiser
                </Button>
            </div>

            <Card style={{ borderRadius: '8px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <Space size="large">
                    <Input
                        placeholder="Rechercher code acte, libellé..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                    />
                    <div>
                        <span style={{ marginRight: '8px', color: '#8c8c8c' }}>Service :</span>
                        <Select value={selectedService} onChange={setSelectedService} style={{ width: 180 }}>
                            <Option value="all">Tous les Services</Option>
                            {services.map(srv => (
                                <Option key={srv} value={srv}>{srv.toUpperCase()}</Option>
                            ))}
                        </Select>
                    </div>
                </Space>
            </Card>

            <Card style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <Table
                    dataSource={filtered}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 12 }}
                    locale={{ emptyText: "Aucune prestation enregistrée." }}
                />
            </Card>
            </div>
        </AccountantLayout>
    );
};
