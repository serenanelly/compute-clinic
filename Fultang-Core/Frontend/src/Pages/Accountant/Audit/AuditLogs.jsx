import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Tag, Input, Select, Button, message, Row, Col, Statistic } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { Search, RefreshCw, Layers, ShieldCheck, Activity, Users } from 'lucide-react';
import { getAuditLogs } from '../../../services/accountantApi';
import AccountantLayout from '../AccountantLayout';
import AccountantPageHeader from '../AccountantPageHeader';

const { Option } = Select;

const ROLE_LABELS = {
    caissier: 'Caissier',
    comptable_financier: 'Comptable financier',
    compta_matiere: 'Comptable matière',
    ComptableFinancier: 'Comptable financier',
    directeur: 'Directeur',
    Directeur: 'Directeur',
    admin: 'Administrateur',
    Admin: 'Administrateur',
};

const MODULE_LABELS = {
    compte_comptable: 'Plan comptable',
    journal: 'Journal',
    ecriture: 'Écriture comptable',
    exercice: 'Exercice',
    budget: 'Budget',
    prestation: 'Prestation',
    quittance: 'Quittance',
    demande_achat: 'Demande d\'achat',
    bon_commande: 'Bon de commande',
    facture: 'Facture fournisseur',
    ordre_paiement: 'Ordre de paiement',
    caisse: 'Caisse journalière',
    inventaire: 'Inventaire caisse',
};

const MODULE_OPTIONS = [
    { value: 'all', label: 'Tous les modules' },
    { value: 'caisse', label: 'Caisse journalière' },
    { value: 'quittance', label: 'Quittances' },
    { value: 'ecriture', label: 'Écritures comptables' },
    { value: 'exercice', label: 'Exercices' },
    { value: 'budget', label: 'Budgets' },
    { value: 'demande_achat', label: 'Demandes d\'achat' },
    { value: 'bon_commande', label: 'Bons de commande' },
    { value: 'facture', label: 'Factures' },
    { value: 'ordre_paiement', label: 'Ordres de paiement' },
];

const ROLE_OPTIONS = [
    { value: 'all', label: 'Tous les rôles' },
    { value: 'caissier', label: 'Caissier' },
    { value: 'comptable_financier', label: 'Comptable financier' },
    { value: 'directeur', label: 'Directeur' },
    { value: 'admin', label: 'Administrateur' },
];

function roleLabel(roleKey) {
    return ROLE_LABELS[roleKey] || roleKey || '—';
}

function moduleLabel(mod) {
    return MODULE_LABELS[mod] || mod || '—';
}

/** Contenu réutilisable (comptable + directeur). */
export const AuditLogsContent = () => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [selectedModule, setSelectedModule] = useState('all');
    const [selectedRole, setSelectedRole] = useState('all');

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getAuditLogs();
            setLogs(data || []);
        } catch (error) {
            console.error('Error loading audit logs:', error);
            message.error("Impossible de récupérer la piste d'audit.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredLogs = useMemo(() => logs.filter(log => {
        const q = searchText.toLowerCase();
        const matchesSearch = !q
            || log.description?.toLowerCase().includes(q)
            || log.utilisateur_nom?.toLowerCase().includes(q)
            || log.objet_reference?.toLowerCase().includes(q)
            || roleLabel(log.role_utilisateur).toLowerCase().includes(q);
        const matchesModule = selectedModule === 'all' || log.module === selectedModule;
        const matchesRole = selectedRole === 'all' || log.role_utilisateur === selectedRole;
        return matchesSearch && matchesModule && matchesRole;
    }), [logs, searchText, selectedModule, selectedRole]);

    const stats = useMemo(() => ({
        total: logs.length,
        validations: logs.filter(l => l.action === 'validation').length,
        creations: logs.filter(l => l.action === 'creation').length,
        caissier: logs.filter(l => l.role_utilisateur === 'caissier').length,
        comptable: logs.filter(l => l.role_utilisateur === 'comptable_financier').length,
        directeur: logs.filter(l => l.role_utilisateur === 'directeur').length,
    }), [logs]);

    const columns = [
        {
            title: 'Date Action',
            dataIndex: 'date_action',
            key: 'date',
            render: (d) => <span className="font-semibold text-gray-700">{new Date(d).toLocaleString('fr-FR')}</span>,
            width: 180,
        },
        {
            title: 'Utilisateur',
            dataIndex: 'utilisateur_nom',
            key: 'user',
            render: (name, record) => {
                const roleKey = record.role_utilisateur || '';
                const roleLbl = roleLabel(roleKey);
                const isRoleAsName = Boolean(ROLE_LABELS[name]);
                const displayName = isRoleAsName ? '—' : (name || '—');
                return (
                    <div>
                        <strong className="text-gray-900">{displayName}</strong>
                        <div style={{ fontSize: '11px', color: '#8c8c8c' }} className="font-semibold">
                            {roleLbl}
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            width: 120,
            render: (act) => {
                let color = 'blue';
                if (act === 'creation') color = 'green';
                if (act === 'validation') color = 'cyan';
                if (act === 'cloture') color = 'red';
                if (act === 'annulation') color = 'orange';
                return (
                    <Tag color={color} className="font-bold border-none rounded-full px-3 py-0.5 text-[10px] uppercase shadow-sm">
                        {(act || '').toUpperCase()}
                    </Tag>
                );
            },
        },
        {
            title: 'Module',
            dataIndex: 'module',
            key: 'module',
            width: 150,
            render: (mod) => (
                <Tag color="purple" className="border-none rounded-full px-3 py-0.5 text-[10px] uppercase font-bold">
                    {moduleLabel(mod)}
                </Tag>
            ),
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'desc',
            render: (text) => <span className="text-gray-600 font-medium text-sm">{text}</span>,
        },
        {
            title: 'Objet Réf.',
            dataIndex: 'objet_reference',
            key: 'ref',
            width: 130,
            render: (text) => text
                ? <Tag color="orange" className="border-none font-semibold text-xs px-2.5 rounded-md">{text}</Tag>
                : '-',
        },
    ];

    return (
        <div className="space-y-6">
            <AccountantPageHeader
                title="Piste d'audit & sécurité"
                subtitle="Traçabilité complète : caissier, comptable financier et directeur — opérateur, rôle et pièce"
                icon={ShieldCheck}
                actions={
                    <Button type="primary" icon={<RefreshCw className="w-4 h-4" />} onClick={fetchData} loading={loading}>
                        Actualiser
                    </Button>
                }
            />

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                    <Card style={{ borderRadius: '20px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} className="bg-gradient-to-br from-slate-50 to-slate-100/50">
                        <Statistic
                            title={<span className="text-gray-400 font-semibold uppercase text-xs tracking-wider">Événements tracés</span>}
                            value={stats.total}
                            valueStyle={{ color: '#051161', fontWeight: '900', fontSize: '28px' }}
                            prefix={<Activity className="w-5 h-5 text-[#1A73A3] inline mr-1" />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card style={{ borderRadius: '20px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} className="bg-gradient-to-br from-emerald-50 to-emerald-100/40">
                        <Statistic
                            title={<span className="text-gray-400 font-semibold uppercase text-xs tracking-wider">Caissier</span>}
                            value={stats.caissier}
                            valueStyle={{ color: '#10b981', fontWeight: '900', fontSize: '28px' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card style={{ borderRadius: '20px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} className="bg-gradient-to-br from-blue-50 to-blue-100/40">
                        <Statistic
                            title={<span className="text-gray-400 font-semibold uppercase text-xs tracking-wider">Comptable</span>}
                            value={stats.comptable}
                            valueStyle={{ color: '#1A73A3', fontWeight: '900', fontSize: '28px' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card style={{ borderRadius: '20px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} className="bg-gradient-to-br from-violet-50 to-violet-100/40">
                        <Statistic
                            title={<span className="text-gray-400 font-semibold uppercase text-xs tracking-wider">Directeur</span>}
                            value={stats.directeur}
                            valueStyle={{ color: '#6366f1', fontWeight: '900', fontSize: '28px' }}
                            prefix={<Users className="w-5 h-5 text-violet-500 inline mr-1" />}
                        />
                    </Card>
                </Col>
            </Row>

            <Card style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} bordered={false}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} lg={10}>
                        <Input
                            placeholder="Rechercher description, utilisateur, pièce..."
                            prefix={<Search className="w-4 h-4 text-gray-400 mr-2" />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            className="h-11 rounded-xl"
                        />
                    </Col>
                    <Col xs={24} sm={12} lg={7}>
                        <Select
                            value={selectedModule}
                            onChange={setSelectedModule}
                            className="w-full h-11"
                            dropdownClassName="rounded-xl"
                        >
                            {MODULE_OPTIONS.map(o => (
                                <Option key={o.value} value={o.value}>{o.label}</Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} lg={7}>
                        <Select
                            value={selectedRole}
                            onChange={setSelectedRole}
                            className="w-full h-11"
                            dropdownClassName="rounded-xl"
                        >
                            {ROLE_OPTIONS.map(o => (
                                <Option key={o.value} value={o.value}>{o.label}</Option>
                            ))}
                        </Select>
                    </Col>
                </Row>
            </Card>

            <Card style={{ borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }} bordered={false}>
                {filteredLogs.length === 0 && !loading ? (
                    <div className="text-center py-12 text-gray-500">
                        <HistoryOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                        <p className="mt-4 font-semibold text-gray-600">Aucun événement enregistré pour l&apos;instant</p>
                        <p className="text-sm mt-2 max-w-lg mx-auto leading-relaxed">
                            Actions tracées : caisse (ouverture, quittances, dépenses menues), comptable
                            (comptabilisation quittances/OP/factures, écritures, budgets, évaluation achats, clôture exercice),
                            directeur (approbations demandes, BC, OP).
                        </p>
                    </div>
                ) : (
                    <Table
                        dataSource={filteredLogs}
                        columns={columns}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 15, showSizeChanger: { showSearch: false } }}
                        className="custom-table"
                        scroll={{ x: 900 }}
                    />
                )}
            </Card>
        </div>
    );
};

export const AuditLogsPage = () => (
    <AccountantLayout>
        <AuditLogsContent />
    </AccountantLayout>
);

export default AuditLogsPage;
