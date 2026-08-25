import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, DatePicker, Select, Table, Space, InputNumber, Row, Col, Alert, message, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { getJournaux, getComptesComptables, createEcriture } from '../../../services/accountantApi';
import dayjs from 'dayjs';
import AccountantLayout from '../AccountantLayout';

const { Option } = Select;

export const SaisieEcriturePage = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [journaux, setJournaux] = useState([]);
    const [comptes, setComptes] = useState([]);
    const [lines, setLines] = useState([
        { key: 1, compte_id: null, libelle: '', montant_debit: null, montant_credit: null },
        { key: 2, compte_id: null, libelle: '', montant_debit: null, montant_credit: null }
    ]);
    const [nextKey, setNextKey] = useState(3);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const jData = await getJournaux();
                setJournaux(jData || []);
                const cData = await getComptesComptables();
                setComptes(cData || []);
            } catch (error) {
                console.error("Error fetching initial accounting data:", error);
                message.error("Impossible de récupérer les listes des comptes ou des journaux.");
            }
        };
        fetchInitialData();
    }, []);

    const handleLineChange = (key, field, value) => {
        setLines(prev => prev.map(line => {
            if (line.key === key) {
                const updatedLine = { ...line, [field]: value };
                // Exclude debit if credit is entered and vice versa
                if (field === 'montant_debit' && value > 0) {
                    updatedLine.montant_credit = null;
                } else if (field === 'montant_credit' && value > 0) {
                    updatedLine.montant_debit = null;
                }
                return updatedLine;
            }
            return line;
        }));
    };

    const addLine = () => {
        setLines(prev => [
            ...prev,
            { key: nextKey, compte_id: null, libelle: form.getFieldValue('libelle') || '', montant_debit: null, montant_credit: null }
        ]);
        setNextKey(prev => prev + 1);
    };

    const removeLine = (key) => {
        if (lines.length <= 2) {
            message.warning("Une écriture doit comporter au moins 2 lignes.");
            return;
        }
        setLines(prev => prev.filter(line => line.key !== key));
    };

    const totalDebit = lines.reduce((acc, curr) => acc + (parseFloat(curr.montant_debit) || 0), 0);
    const totalCredit = lines.reduce((acc, curr) => acc + (parseFloat(curr.montant_credit) || 0), 0);
    const ecart = Math.abs(totalDebit - totalCredit);
    const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

    const handleSubmit = async (values) => {
        if (!isBalanced) {
            message.error("L'écriture comptable n'est pas équilibrée ! Le total des débits doit être égal au total des crédits.");
            return;
        }

        // Validate that all lines have an account selected and at least one debit or credit amount
        const invalidLines = lines.some(line => !line.compte_id || (!line.montant_debit && !line.montant_credit));
        if (invalidLines) {
            message.error("Veuillez renseigner correctement le compte et le montant (débit ou crédit) de chaque ligne.");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                date_ecriture: values.date_ecriture.format('YYYY-MM-DD'),
                libelle: values.libelle,
                journal_id: values.journal_id,
                piece_justificative: values.piece_justificative || '',
                statut: 'validee', // manual entry immediately validated
                lignes: lines.map(line => ({
                    compte_id: line.compte_id,
                    libelle: line.libelle || values.libelle,
                    montant_debit: line.montant_debit || null,
                    montant_credit: line.montant_credit || null
                }))
            };

            await createEcriture(payload);
            message.success("L'écriture comptable a été enregistrée et validée avec succès !");
            
            // Reset form
            form.resetFields();
            setLines([
                { key: 1, compte_id: null, libelle: '', montant_debit: null, montant_credit: null },
                { key: 2, compte_id: null, libelle: '', montant_debit: null, montant_credit: null }
            ]);
            setNextKey(3);
        } catch (error) {
            console.error("Error creating entry:", error);
            message.error(error.response?.data?.error || "Erreur lors de la création de l'écriture comptable.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AccountantLayout>
            <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Saisie d'Écritures Comptables</h1>
                <p style={{ color: '#8c8c8c', margin: 0 }}>
                    Saisir manuellement des écritures en partie double équilibrées (Opérations diverses, reports, amortissements).
                </p>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{ date_ecriture: dayjs() }}
            >
                <Card style={{ borderRadius: '8px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <Row gutter={16}>
                        <Col span={6}>
                            <Form.Item
                                name="date_ecriture"
                                label="Date de l'Écriture"
                                rules={[{ required: true, message: 'La date est requise' }]}
                            >
                                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                name="journal_id"
                                label="Journal"
                                rules={[{ required: true, message: 'Veuillez choisir un journal' }]}
                            >
                                <Select placeholder="Choisir le journal...">
                                    {journaux.map(j => (
                                        <Option key={j.id} value={j.id}>{j.code} - {j.libelle}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item
                                name="libelle"
                                label="Libellé Général"
                                rules={[{ required: true, message: 'Le libellé est requis' }]}
                            >
                                <Input placeholder="Ex: Paiement loyer mensuel..." />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="piece_justificative" label="Pièce Justificative">
                                <Input placeholder="Ex: CH-82631, FACT-92" />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Card style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Lignes d'Écriture en Partie Double</h3>
                    
                    {lines.map((line, index) => (
                        <Row gutter={12} key={line.key} align="middle" style={{ marginBottom: '12px' }}>
                            <Col span={8}>
                                <Select
                                    placeholder="Choisir le compte..."
                                    style={{ width: '100%' }}
                                    showSearch
                                    optionFilterProp="children"
                                    value={line.compte_id}
                                    onChange={(val) => handleLineChange(line.key, 'compte_id', val)}
                                >
                                    {comptes.map(c => (
                                        <Option key={c.id} value={c.id}>
                                            {c.numero_compte} - {c.intitule}
                                        </Option>
                                    ))}
                                </Select>
                            </Col>
                            <Col span={6}>
                                <Input
                                    placeholder="Libellé de ligne (optionnel)"
                                    value={line.libelle}
                                    onChange={(e) => handleLineChange(line.key, 'libelle', e.target.value)}
                                />
                            </Col>
                            <Col span={4}>
                                <InputNumber
                                    placeholder="Débit"
                                    style={{ width: '100%' }}
                                    min={0}
                                    value={line.montant_debit}
                                    onChange={(val) => handleLineChange(line.key, 'montant_debit', val)}
                                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                                    parser={value => value.replace(/\s?/g, '')}
                                />
                            </Col>
                            <Col span={4}>
                                <InputNumber
                                    placeholder="Crédit"
                                    style={{ width: '100%' }}
                                    min={0}
                                    value={line.montant_credit}
                                    onChange={(val) => handleLineChange(line.key, 'montant_credit', val)}
                                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                                    parser={value => value.replace(/\s?/g, '')}
                                />
                            </Col>
                            <Col span={2}>
                                <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => removeLine(line.key)}
                                />
                            </Col>
                        </Row>
                    ))}

                    <Button type="dashed" onClick={addLine} icon={<PlusOutlined />} style={{ width: '100%', marginBottom: '24px' }}>
                        Ajouter une ligne
                    </Button>

                    <Divider />

                    <Row gutter={16} align="middle">
                        <Col span={6}>
                            <div style={{ fontSize: '15px' }}>
                                Total Débit : <strong style={{ color: '#2f54eb' }}>{new Intl.NumberFormat('fr-FR').format(totalDebit)} FCFA</strong>
                            </div>
                        </Col>
                        <Col span={6}>
                            <div style={{ fontSize: '15px' }}>
                                Total Crédit : <strong style={{ color: '#2f54eb' }}>{new Intl.NumberFormat('fr-FR').format(totalCredit)} FCFA</strong>
                            </div>
                        </Col>
                        <Col span={6}>
                            {ecart > 0 ? (
                                <Alert
                                    message={`Écart : ${new Intl.NumberFormat('fr-FR').format(ecart)} FCFA`}
                                    type="error"
                                    showIcon
                                    style={{ padding: '4px 12px' }}
                                />
                            ) : totalDebit > 0 ? (
                                <Alert
                                    message="Écriture équilibrée"
                                    type="success"
                                    showIcon
                                    icon={<CheckCircleOutlined />}
                                    style={{ padding: '4px 12px' }}
                                />
                            ) : null}
                        </Col>
                        <Col span={6} style={{ textAlign: 'right' }}>
                            <Button
                                type="primary"
                                icon={<SaveOutlined />}
                                size="large"
                                htmlType="submit"
                                loading={loading}
                                disabled={!isBalanced}
                            >
                                Enregistrer & Valider
                            </Button>
                        </Col>
                    </Row>
                </Card>
            </Form>
        </div>
        </AccountantLayout>
    );
};
