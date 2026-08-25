import { useEffect, useState } from 'react';
import {
  Table, Tag, Button, Card, Row, Col, Modal, Form,
  Input, Select, Switch, Space, Popconfirm, Tooltip, Empty, Statistic
} from 'antd';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  FolderTree,
  ListFilter,
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';
import AccountantLayout from '../AccountantLayout';
import {
  getComptesArborescence,
  getComptesStatistiques,
  createCompteComptable,
  updateCompteComptable,
  deleteCompteComptable
} from '../../../services/accountantApi';
import { useFeedback } from '../../../contexts/FeedbackContext';

const { Option } = Select;

const CLASSES = [
  { key: 'all', label: 'Tout le plan' },
  { key: '1', label: 'Classe 1 - Capitaux' },
  { key: '2', label: 'Classe 2 - Immobilisations' },
  { key: '3', label: 'Classe 3 - Stocks' },
  { key: '4', label: 'Classe 4 - Tiers' },
  { key: '5', label: 'Classe 5 - Trésorerie' },
  { key: '6', label: 'Classe 6 - Charges' },
  { key: '7', label: 'Classe 7 - Produits' },
];

const TYPE_COMPTE_OPTIONS = [
  { value: 'passif', label: 'Passif (capitaux, dettes fournisseurs 401…)' },
  { value: 'actif', label: 'Actif (immobilisations, stocks, créances 411…)' },
  { value: 'tresorerie', label: 'Trésorerie (caisse, banque — classe 5)' },
  { value: 'charge', label: 'Charge (dépenses — classe 6)' },
  { value: 'produit', label: 'Produit (recettes — classe 7)' },
];

const DEFAULT_TYPE_BY_CLASSE = {
  '1': 'passif',
  '2': 'actif',
  '3': 'actif',
  '4': 'passif',
  '5': 'tresorerie',
  '6': 'charge',
  '7': 'produit',
};

const formatApiError = (err, fallback) => {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join(' · ');
};

export function PlanComptablePage() {
  const [loading, setLoading] = useState(true);
  const [comptesRaw, setComptesRaw] = useState([]);
  const [stats, setStats] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompte, setEditingCompte] = useState(null);

  const [form] = Form.useForm();
  const { showSuccess, showError, showWarning } = useFeedback();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [treeData, statistiques] = await Promise.all([
        getComptesArborescence(),
        getComptesStatistiques()
      ]);
      setComptesRaw(treeData || []);
      setStats(statistiques);
    } catch (err) {
      console.error('Error loading plan comptable:', err);
      showError('Erreur lors du chargement du plan comptable.', 'Échec');
    } finally {
      setLoading(false);
    }
  };

  // Convert "sous_comptes" to "children" for Ant Tree Table compatibility
  const transformTreeData = (data) => {
    if (!data) return [];
    return data.map(item => {
      const mapped = {
        ...item,
        key: item.id,
        title: `${item.numero_compte} - ${item.libelle}`
      };
      if (item.sous_comptes && item.sous_comptes.length > 0) {
        mapped.children = transformTreeData(item.sous_comptes);
      }
      return mapped;
    });
  };

  // Extract flat list of accounts for parents dropdown selection
  const getFlatAccounts = (data) => {
    let result = [];
    const recurse = (list) => {
      list.forEach(item => {
        result.push(item);
        if (item.sous_comptes && item.sous_comptes.length > 0) {
          recurse(item.sous_comptes);
        }
      });
    };
    recurse(data);
    return result;
  };

  const flatAccountsList = getFlatAccounts(comptesRaw);

  const handleOpenAddModal = () => {
    setEditingCompte(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record) => {
    setEditingCompte(record);
    form.setFieldsValue({
      numero_compte: record.numero_compte,
      libelle: record.libelle,
      classe: record.classe,
      type_compte: record.type_compte,
      compte_parent: record.compte_parent || undefined,
      description: record.description,
      actif: record.actif
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteCompteComptable(id);
      showSuccess('Le compte comptable a été supprimé.', 'Supprimé');
      loadData();
    } catch (err) {
      console.error('Error deleting compte:', err);
      showError(err.response?.data?.error || 'Erreur lors de la suppression du compte.', 'Échec');
    }
  };

  const handleFormSubmit = async (values) => {
    try {
      if (editingCompte) {
        await updateCompteComptable(editingCompte.id, values);
        showSuccess('Le compte a été modifié avec succès.', 'Modifié');
      } else {
        await createCompteComptable(values);
        showSuccess('Le compte a été créé avec succès.', 'Créé');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error('Error submitting form:', err);
      showError(formatApiError(err, 'Erreur lors de l\'enregistrement du compte.'), 'Échec');
    }
  };

  // Filtering Tree Data recursively
  const filterTreeData = (data) => {
    if (!data) return [];

    return data
      .map(item => {
        const matchesClass = selectedClass === 'all' || item.classe === selectedClass;
        const matchesSearch =
          item.numero_compte.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.libelle.toLowerCase().includes(searchTerm.toLowerCase());

        // Recurse on children first
        const filteredChildren = item.sous_comptes ? filterTreeData(item.sous_comptes) : [];

        // If current item matches or has matching children
        if ((matchesClass && matchesSearch) || filteredChildren.length > 0) {
          return {
            ...item,
            key: item.id,
            children: filteredChildren.length > 0 ? filteredChildren : undefined
          };
        }
        return null;
      })
      .filter(item => item !== null);
  };

  const displayedTreeData = filterTreeData(comptesRaw);

  const columns = [
    {
      title: 'Numéro Compte',
      dataIndex: 'numero_compte',
      key: 'numero_compte',
      width: '25%',
      render: (text) => <span className="font-bold text-gray-800 tracking-wider">{text}</span>
    },
    {
      title: 'Intitulé / Libellé',
      dataIndex: 'libelle',
      key: 'libelle',
      width: '40%'
    },
    {
      title: 'Classe',
      dataIndex: 'classe',
      key: 'classe',
      align: 'center',
      render: (text) => <Tag color="geekblue" className="font-semibold">Classe {text}</Tag>
    },
    {
      title: 'Type',
      dataIndex: 'type_compte',
      key: 'type_compte',
      align: 'center',
      render: (type) => {
        const colors = { produit: 'green', charge: 'red', actif: 'blue', passif: 'purple', tresorerie: 'cyan' };
        const labels = Object.fromEntries(TYPE_COMPTE_OPTIONS.map(o => [o.value, o.label.split(' (')[0]]));
        return <Tag color={colors[type] || 'default'}>{labels[type] || type}</Tag>;
      }
    },
    {
      title: 'Statut',
      dataIndex: 'actif',
      key: 'actif',
      align: 'center',
      render: (actif) => (
        <Tag color={actif ? 'success' : 'default'} className="font-semibold">
          {actif ? 'Actif' : 'Inactif'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="Modifier">
            <Button
              type="text"
              icon={<Edit className="w-4 h-4 text-blue-600" />}
              onClick={() => handleOpenEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="Supprimer">
            <Popconfirm
              title="Supprimer ce compte ?"
              description="Êtes-vous sûr de vouloir supprimer ce compte du plan comptable ?"
              onConfirm={() => handleDelete(record.id)}
              okText="Oui"
              cancelText="Non"
              okButtonProps={{ className: 'bg-red-500 hover:bg-red-400' }}
            >
              <Button
                type="text"
                danger
                icon={<Trash2 className="w-4 h-4" />}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <AccountantLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Plan Comptable (SYSCOHADA)</h2>
            <p className="text-gray-500 text-sm">Gestion et structuration des comptes des classes 1 à 7</p>
          </div>
          <Button
            type="primary"
            className="bg-primary-end hover:opacity-90 flex items-center gap-2 h-10 rounded-lg shadow-sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAddModal}
          >
            Nouveau Compte
          </Button>
        </div>

        {/* Plan stats overview */}
        {stats && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Total des Comptes"
                  value={stats.total_comptes}
                  prefix={<FolderTree className="w-5 h-5 mr-2 text-indigo-500 inline-block align-middle" />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Comptes Actifs"
                  value={stats.total_actifs}
                  valueStyle={{ color: '#10b981' }}
                  prefix={<CheckCircle className="w-5 h-5 mr-2 inline-block align-middle" />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Comptes Passifs"
                  value={stats.par_type?.passif?.total || 0}
                  prefix={<FileText className="w-5 h-5 mr-2 text-purple-500 inline-block align-middle" />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered={false} className="shadow-sm">
                <Statistic
                  title="Comptes Actifs"
                  value={stats.par_type?.actif?.total || 0}
                  prefix={<FolderTree className="w-5 h-5 mr-2 text-amber-500 inline-block align-middle" />}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Filter bar */}
        <Card className="shadow-sm" bordered={false}>
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {CLASSES.map(cls => (
                <Button
                  key={cls.key}
                  type={selectedClass === cls.key ? 'primary' : 'default'}
                  onClick={() => setSelectedClass(cls.key)}
                  className={`rounded-lg h-9 font-medium ${
                    selectedClass === cls.key ? 'bg-primary-end border-none' : 'text-gray-600 hover:text-primary-end'
                  }`}
                >
                  {cls.label}
                </Button>
              ))}
            </div>
            <div className="w-full md:w-80">
              <Input
                prefix={<Search className="w-4 h-4 text-gray-400 mr-2" />}
                placeholder="Rechercher par N° ou libellé..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 rounded-lg"
                allowClear
              />
            </div>
          </div>
        </Card>

        {/* Tree Table */}
        <Card className="shadow-sm" bordered={false}>
          {displayedTreeData.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Aucun compte correspondant aux filtres"
            />
          ) : (
            <Table
              columns={columns}
              dataSource={displayedTreeData}
              loading={loading}
              pagination={false}
              size="middle"
              className="border border-gray-100 rounded-lg overflow-hidden"
            />
          )}
        </Card>

        {/* Add/Edit Modal */}
        <Modal
          title={editingCompte ? "Modifier Compte Comptable" : "Nouveau Compte Comptable"}
          open={isModalOpen}
          onCancel={() => setIsModalOpen(false)}
          footer={null}
          width={550}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFormSubmit}
            initialValues={{ actif: true, type_compte: 'passif', classe: '4' }}
            onValuesChange={(changed) => {
              if (changed.classe && DEFAULT_TYPE_BY_CLASSE[changed.classe]) {
                form.setFieldsValue({ type_compte: DEFAULT_TYPE_BY_CLASSE[changed.classe] });
              }
            }}
            className="pt-4"
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="numero_compte"
                  label="Numéro de Compte (SYSCOHADA)"
                  rules={[
                    { required: true, message: 'Le numéro de compte est requis' },
                    { pattern: /^[0-9]+$/, message: 'Caractères numériques uniquement' }
                  ]}
                >
                  <Input placeholder="ex: 411100" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="classe"
                  label="Classe de Compte"
                  rules={[{ required: true, message: 'La classe est requise' }]}
                >
                  <Select placeholder="Sélectionner la classe">
                    {[1, 2, 3, 4, 5, 6, 7].map(num => (
                      <Option key={num} value={String(num)}>Classe {num}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="libelle"
              label="Libellé / Intitulé du Compte"
              rules={[{ required: true, message: 'Le libellé est requis' }]}
            >
              <Input placeholder="ex: Clients - Prestations Médicales" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="type_compte"
                  label="Type de Compte"
                  rules={[{ required: true, message: 'Le type est requis' }]}
                >
                  <Select>
                    {TYPE_COMPTE_OPTIONS.map(opt => (
                      <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="compte_parent"
                  label="Compte Parent (Optionnel)"
                >
                  <Select
                    showSearch
                    optionFilterProp="children"
                    placeholder="Aucun parent"
                    allowClear
                  >
                    {flatAccountsList
                      .filter(acc => acc.id !== editingCompte?.id)
                      .map(acc => (
                        <Option key={acc.id} value={acc.id}>{acc.numero_compte} - {acc.libelle}</Option>
                      ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="description"
              label="Description / Observations"
            >
              <Input.TextArea rows={2} placeholder="Précisions sur l'imputation de ce compte..." />
            </Form.Item>

            <Form.Item
              name="actif"
              label="Compte Actif"
              valuePropName="checked"
            >
              <Switch checkedChildren="Actif" unCheckedChildren="Inactif" />
            </Form.Item>

            <div className="flex gap-2 justify-end border-t pt-4">
              <Button onClick={() => setIsModalOpen(false)}>
                Annuler
              </Button>
              <Button type="primary" htmlType="submit" className="bg-primary-end border-none">
                Enregistrer
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    </AccountantLayout>
  );
}

export default PlanComptablePage;