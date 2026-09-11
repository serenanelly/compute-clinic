import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, Modal, Form, Input, Select, InputNumber, message } from 'antd';
import { FileText, RefreshCw, CheckCircle, Trash2, Plus } from 'lucide-react';
import { DashBoard } from "../../GlobalComponents/DashBoard.jsx";
import { cashierNavLink } from "./cashierNavLink.js";
import { getQuittancesAValider, validerQuittance, getComptesComptables } from '../../services/accountantApi';
import { useFeedback } from '../../contexts/FeedbackContext';

const { Option } = Select;

export function QuittancesAValiderPage() {
  const [loading, setLoading] = useState(true);
  const [quittances, setQuittances] = useState([]);
  const [comptes, setComptes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [validatingId, setValidatingId] = useState(null);

  const { showError, showSuccess } = useFeedback();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [quittancesData, comptesData] = await Promise.all([
        getQuittancesAValider(),
        getComptesComptables()
      ]);
      setQuittances(quittancesData || []);
      setComptes(comptesData || []);
    } catch (err) {
      console.error('Error loading quittances to validate:', err);
      showError('Impossible de charger les quittances à valider.', 'Échec');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = (id) => {
    setValidatingId(id);
    form.resetFields();
    setModalVisible(true);
  };

  const handleValidateSubmit = async (values) => {
    try {
      setLoading(true);
      const compteId = values.compte_id || null;
      await validerQuittance(validatingId, compteId);
      showSuccess('Quittance validée avec succès.', 'Succès');
      setModalVisible(false);
      loadData();
    } catch (err) {
      console.error('Error validating quittance:', err);
      showError(err.response?.data?.error || 'Erreur lors de la validation de la quittance.', 'Échec');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setModalVisible(false);
  };

  const colonnes = [
    {
      title: 'N° Quittance',
      dataIndex: 'numero',
      key: 'numero',
      render: (text) => <span className="font-semibold">{text}</span>
    },
    {
      title: 'Patient',
      dataIndex: 'patient_nom',
      key: 'patient_nom',
      render: (text) => <span>{text || 'Client Externe'}</span>
    },
    {
      title: 'Date',
      dataIndex: 'date_creation',
      key: 'date',
      render: (date) => new Date(date).toLocaleString('fr-FR')
    },
    {
      title: 'Type Recette',
      dataIndex: 'type_recette',
      key: 'type_recette',
      render: (type) => {
        let couleur = 'blue';
        if (type === 'consultation') couleur = 'green';
        if (type === 'hospitalisation') couleur = 'orange';
        if (type === 'laboratoire') couleur = 'purple';
        if (type === 'pharmacie') couleur = 'red';
        if (type === 'imagerie') couleur = 'pink';
        if (type === 'chirurgie') couleur = 'cyan';
        return <Tag color={couleur}>{type?.replace('_', ' ').toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Mode Paiement',
      dataIndex: 'mode_paiement',
      key: 'mode_paiement',
      render: (mode) => {
        let couleur = 'blue';
        if (mode === 'especes') couleur = 'green';
        if (mode === 'cheque') couleur = 'orange';
        if (mode === 'virement') couleur = 'purple';
        if (mode === 'mobile_money') couleur = 'red';
        if (mode === 'carte') couleur = 'purple';
        return <Tag color={couleur}>{mode?.replace('_', ' ').toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Montant',
      dataIndex: 'montant',
      key: 'montant',
      align: 'right',
      render: (val) => <span className="font-bold">{new Intl.NumberFormat('fr-FR').format(val)} FCFA</span>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<CheckCircle className="w-4 h-4" />}
          disabled={record.statut === 'validee'}
          onClick={() => handleValidate(record.id)}
        >
          Valider
        </Button>
      )
    }
  ];

  return (
    <DashBoard linkList={cashierNavLink} requiredRole="caissier" requiredFunctionalService="CAISSE">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Quittances à Valider</h2>
            <p className="text-gray-500 text-sm">Liste des quittances en attente de validation par le caissier</p>
          </div>
          <Space>
            <Button
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={loadData}
              className="h-10 flex items-center gap-2 rounded-lg"
            >
              Actualiser
            </Button>
          </Space>
        </div>

        {/* Stats */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={8}>
            <Card style={{ borderRadius: '8px' }}>
              <Statistic
                title="Quittances à valider"
                value={quittances.length}
                prefix={<Plus className="w-4 h-4" />}
                valueStyle={{ color: '#f5222d', fontWeight: 'bold' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card style={{ borderRadius: '8px' }}>
              <Statistic
                title="Montant total"
                value={quittances.reduce((sum, q) => sum + parseFloat(q.montant || 0), 0)}
                suffix="FCFA"
                valueStyle={{ color: '#2f54eb', fontWeight: 'bold' }}
                prefix={<FileText className="w-4 h-4" />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card style={{ borderRadius: '8px' }}>
              <Statistic
                title="Moyenne par quittance"
                value={quittances.length > 0 ? (quittances.reduce((sum, q) => sum + parseFloat(q.montant || 0), 0) / quittances.length).toFixed(0) : 0}
                suffix="FCFA"
              />
            </Card>
          </Col>
        </Row>

        {/* Table */}
        <Card style={{ borderRadius: '8px' }}>
          {quittances.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Aucune quittance en attente de validation.</p>
          ) : (
            <Table
              columns={colonnes}
              dataSource={quittances}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          )}
        </Card>

        {/* Modal Validation */}
        <Modal
          title="Valider la Quittance"
          visible={modalVisible}
          onCancel={handleCancel}
          footer={null}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleValidateSubmit}
          >
            <Form.Item
              name="compte_id"
              label="Comptable Account (Optionnel)"
              placeholder="Sélectionner un compte pour la ventilation comptable"
            >
              <Select>
                <Option value="">Aucun compte (venue directe)</Option>
                {comptes.map(compte => (
                  <Option key={compte.id} value={compte.id}>
                    [{compte.numero_compte}] {compte.libelle}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <div style={{ textAlign: 'right', marginTop: '24px' }}>
              <Button onClick={handleCancel}>Annuler</Button>
              <Button type="primary" htmlType="submit">
                Valider
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    </DashBoard>
  );
}

export default QuittancesAValiderPage;