import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Tag, Row, Col, Statistic, message, Tooltip } from 'antd';
import { CheckCircleOutlined, SyncOutlined, ArrowRightOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { getQuittancesAComptabiliser, comptabiliserQuittance, getComptesProduits } from '../../../services/accountantApi';
import AccountantLayout from '../AccountantLayout';

/**
 * Mapping SYSCOHADA Classe 7 — le système choisit automatiquement
 * le compte de produit en fonction du type de recette de la quittance.
 */
const MAPPING_TYPE_RECETTE_COMPTE = {
    consultation:    { prefixe: '701', intitule: 'Consultations médicales' },
    hospitalisation: { prefixe: '702', intitule: 'Hospitalisations' },
    laboratoire:     { prefixe: '703', intitule: 'Examens de laboratoire' },
    pharmacie:       { prefixe: '706', intitule: 'Pharmacie' },
    imagerie:        { prefixe: '704', intitule: 'Imagerie médicale' },
    chirurgie:       { prefixe: '705', intitule: 'Actes chirurgicaux' },
    maternite:       { prefixe: '707', intitule: 'Maternité & Gynécologie' },
    pediatrie:       { prefixe: '708', intitule: 'Pédiatrie' },
    autre:           { prefixe: '75',  intitule: "Autres produits d'exploitation" },
};

/**
 * Mapping du mode de paiement vers le compte de trésorerie (Classe 5)
 * qui sera automatiquement débité par le backend.
 */
const MAPPING_MODE_PAIEMENT_TRESORERIE = {
    especes:      { compte: '571', intitule: 'Caisse principale' },
    cheque:       { compte: '521', intitule: 'Banque principale (BICEC)' },
    carte:        { compte: '521', intitule: 'Banque principale (Carte)' },
    mobile_money: { compte: '521', intitule: 'Banque principale (Mobile Money)' },
    virement:     { compte: '521', intitule: 'Banque principale (Virement)' },
    assurance:    { compte: '411', intitule: 'Clients divers (Assurance)' },
};

export const ComptabilisationPage = () => {
    const [loading, setLoading] = useState(false);
    const [quittances, setQuittances] = useState([]);
    const [comptesProduits, setComptesProduits] = useState([]);
    const [stats, setStats] = useState({ total: 0, count: 0 });

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getQuittancesAComptabiliser();
            setQuittances(data.quittances || data || []);

            const list = Array.isArray(data.quittances) ? data.quittances : (Array.isArray(data) ? data : []);
            const totalSum = list.reduce((acc, q) => acc + parseFloat(q.montant || 0), 0);
            setStats({ total: totalSum, count: list.length });

            const accounts = await getComptesProduits();
            setComptesProduits(accounts || []);
        } catch (error) {
            console.error("Error fetching comptabilisation data:", error);
            message.error("Impossible de récupérer les quittances à comptabiliser.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    /**
     * Résolution automatique du compte de produit (Classe 7) à partir
     * du type_recette de la quittance et de la liste des comptes existants.
     */
    const resolveCompteId = (typeRecette) => {
        const mapping = MAPPING_TYPE_RECETTE_COMPTE[typeRecette] || MAPPING_TYPE_RECETTE_COMPTE['autre'];
        // Chercher le compte dont le numéro commence par le préfixe attendu
        const found = Array.isArray(comptesProduits) ? comptesProduits.find(c =>
            String(c.numero_compte).startsWith(mapping.prefixe)
        ) : undefined;
        return found ? found.id : null;
    };

    /**
     * Un seul clic : "Générer l'Écriture"
     * Le système choisit automatiquement le compte de produit (Crédit Classe 7)
     * et le backend débitera automatiquement le compte de trésorerie (Débit Classe 5)
     * selon le mode de paiement de la quittance.
     */
    const handleGenererEcriture = async (quittance) => {
        const compteId = resolveCompteId(quittance.type_recette);

        if (!compteId) {
            message.warning(
                `Aucun compte de la classe 7 commençant par "${MAPPING_TYPE_RECETTE_COMPTE[quittance.type_recette]?.prefixe || '706'}" ` +
                `n'a été trouvé dans le plan comptable. Veuillez d'abord créer ce compte.`
            );
            return;
        }

        try {
            setLoading(true);
            const res = await comptabiliserQuittance(quittance.id, compteId);
            message.success(
                `Écriture N° ${res.numero_ecriture || 'OK'} générée pour la quittance ${quittance.numero} !`
            );
            // Retirer immédiatement la quittance de la liste locale sans attendre le rechargement
            setQuittances(prev => {
                const updated = prev.filter(q => q.id !== quittance.id);
                const totalSum = updated.reduce((acc, q) => acc + parseFloat(q.montant || 0), 0);
                setStats({ total: totalSum, count: updated.length });
                return updated;
            });
            // Rechargement complet en arrière-plan pour synchroniser avec le backend
            fetchData();
        } catch (error) {
            console.error("Error posting comptabilisation:", error);
            message.error(error.response?.data?.error || "Erreur lors de la génération de l'écriture comptable.");
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'N° Quittance',
            dataIndex: 'numero',
            key: 'numero',
            render: (text) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{text}</span>
        },
        {
            title: 'Date',
            dataIndex: 'date_creation',
            key: 'date_creation',
            render: (date) => new Date(date).toLocaleString('fr-FR')
        },
        {
            title: 'Patient',
            key: 'patient',
            render: (_, record) => (
                <div>
                    {record.patient ? (
                        <>
                            <div style={{ fontWeight: 500 }}>{record.patient.full_name}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{record.patient.matricule}</div>
                        </>
                    ) : (
                        <span>-</span>
                    )}
                </div>
            )
        },
        {
            title: 'Motif / Recette',
            key: 'motif_recette',
            render: (_, record) => (
                <div>
                    <div style={{ fontWeight: 500 }}>{record.motif}</div>
                    <Tag color="cyan">{record.type_recette}</Tag>
                </div>
            )
        },
        {
            title: 'Mode Paiement',
            dataIndex: 'mode_paiement',
            key: 'mode_paiement',
            render: (mode) => {
                const safeMode = mode || 'especes';
                const tresor = MAPPING_MODE_PAIEMENT_TRESORERIE[safeMode] || MAPPING_MODE_PAIEMENT_TRESORERIE['especes'];
                return (
                    <Tooltip title={tresor ? `Débit : ${tresor.compte} ${tresor.intitule}` : ''}>
                        <Tag color="blue" style={{ textTransform: 'capitalize' }}>
                            {safeMode.replace('_', ' ')}
                        </Tag>
                    </Tooltip>
                );
            }
        },
        {
            title: 'Montant',
            dataIndex: 'montant',
            key: 'montant',
            render: (val) => (
                <span style={{ fontWeight: 'bold', color: '#2f54eb' }}>
                    {new Intl.NumberFormat('fr-FR').format(val)} FCFA
                </span>
            )
        },
        {
            title: 'Compte Produit (Auto)',
            key: 'compte_auto',
            render: (_, record) => {
                const mapping = MAPPING_TYPE_RECETTE_COMPTE[record.type_recette] || MAPPING_TYPE_RECETTE_COMPTE['autre'];
                const found = Array.isArray(comptesProduits) ? comptesProduits.find(c => String(c.numero_compte).startsWith(mapping.prefixe)) : undefined;
                return found ? (
                    <Tag color="green">{found.numero_compte} — {found.intitule || mapping.intitule}</Tag>
                ) : (
                    <Tag color="red">⚠ {mapping.prefixe} non trouvé</Tag>
                );
            }
        },
        {
            title: 'Compte Trésorerie (Auto)',
            key: 'compte_tresor',
            render: (_, record) => {
                const safeMode = record.mode_paiement || 'especes';
                const tresor = MAPPING_MODE_PAIEMENT_TRESORERIE[safeMode] || MAPPING_MODE_PAIEMENT_TRESORERIE['especes'];
                return tresor ? (
                    <Tag color="purple">{tresor.compte} — {tresor.intitule}</Tag>
                ) : (
                    <Tag color="orange">Mode inconnu</Tag>
                );
            }
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={() => handleGenererEcriture(record)}
                    loading={loading}
                >
                    Générer l'Écriture
                </Button>
            )
        }
    ];

    return (
        <AccountantLayout>
            <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
                            Comptabilisation des Encaissements
                        </h1>
                        <p style={{ color: '#8c8c8c', margin: 0 }}>
                            Quittances validées par la caisse en attente de génération d'écriture.
                            Le système choisit automatiquement les comptes SYSCOHADA (Classe 5 au Débit, Classe 7 au Crédit).
                        </p>
                    </div>
                    <Button type="default" icon={<SyncOutlined />} onClick={fetchData} loading={loading}>
                        Actualiser
                    </Button>
                </div>

                <Row gutter={16} style={{ marginBottom: '24px' }}>
                    <Col span={8}>
                        <Card style={{ borderRadius: '8px' }}>
                            <Statistic
                                title="Quittances à comptabiliser"
                                value={stats.count}
                                prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
                            />
                        </Card>
                    </Col>
                    <Col span={16}>
                        <Card style={{ borderRadius: '8px' }}>
                            <Statistic
                                title="Volume financier en attente de ventilation"
                                value={stats.total}
                                precision={0}
                                suffix="FCFA"
                                valueStyle={{ color: '#2f54eb', fontWeight: 'bold' }}
                                prefix={<ArrowRightOutlined />}
                            />
                        </Card>
                    </Col>
                </Row>

                <Card style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <Table
                        dataSource={Array.isArray(quittances) ? quittances : []}
                        columns={columns}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                        locale={{ emptyText: "Aucune quittance en attente de ventilation comptable." }}
                        scroll={{ x: 1200 }}
                    />
                </Card>
            </div>
        </AccountantLayout>
    );
};
