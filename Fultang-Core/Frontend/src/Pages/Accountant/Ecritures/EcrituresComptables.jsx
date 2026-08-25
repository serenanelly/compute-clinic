/**
 * Page des écritures comptables
 * Affiche toutes les écritures comptables avec filtrage par journal
 */
import { useState, useEffect } from "react";
import AccountantLayout from "../AccountantLayout.jsx";
import AccountantPageHeader from "../AccountantPageHeader.jsx";
import { BookOpen } from "lucide-react";
import { message, Spin, Tag, DatePicker, Select, Table, Modal, Collapse, Tooltip, Tabs } from "antd";
import {
    getEcritures,
    getEcrituresStatistiques,
    getJournaux,
    getGrandLivre,
    getGrandLivreGlobal,
    getComptesUtilises
} from "../../../services/accountantApi.js";
import {
    FaFileAlt,
    FaBook,
    FaEye,
    FaCalendar,
    FaFilter,
    FaChartBar,
    FaBalanceScale
} from "react-icons/fa";
import dayjs from 'dayjs';
import { FaPrint, FaFileCsv } from "react-icons/fa";

const { RangePicker } = DatePicker;

export function EcrituresComptablesPage({ defaultTab = "journal" }) {
    const [isLoading, setIsLoading] = useState(true);
    const [ecritures, setEcritures] = useState([]);
    const [journaux, setJournaux] = useState([]);
    const [stats, setStats] = useState(null);
    const [selectedJournal, setSelectedJournal] = useState(null);
    const [dateRange, setDateRange] = useState(null);

    // Grand Livre state
    const [grandLivreLoading, setGrandLivreLoading] = useState(false);
    const [selectedCompte, setSelectedCompte] = useState(null);
    const [comptes, setComptes] = useState([]);
    const [grandLivreData, setGrandLivreData] = useState([]);   // flat list for table
    const [grandLivreComptes, setGrandLivreComptes] = useState([]); // grouped by compte for print
    const [grandLivreDateRange, setGrandLivreDateRange] = useState(null);

    // Modal state
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedEcriture, setSelectedEcriture] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [ecrituresData, journauxData, statsData] = await Promise.all([
                getEcritures(),
                getJournaux(),
                getEcrituresStatistiques()
            ]);

            setEcritures(ecrituresData.results || ecrituresData || []);
            setJournaux(journauxData.results || journauxData || []);
            setStats(statsData);
        } catch (error) {
            console.error('Error loading data:', error);
            message.error('Erreur lors du chargement des données');
        } finally {
            setIsLoading(false);
        }
    };

    const loadComptes = async () => {
        try {
            // Only load accounts that have actual movements — not all 60 plan accounts
            const data = await getComptesUtilises();
            setComptes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error loading comptes:', error);
        }
    };

    const loadGrandLivre = async () => {
        setGrandLivreLoading(true);
        try {
            const filters = {};
            if (grandLivreDateRange) {
                filters.date_debut = grandLivreDateRange[0].format('YYYY-MM-DD');
                filters.date_fin   = grandLivreDateRange[1].format('YYYY-MM-DD');
            }

            if (!selectedCompte) {
                // "Tous les comptes" — fetch all movements from all accounts
                const response = await getGrandLivreGlobal(filters);
                setGrandLivreData(response?.mouvements || []);
                setGrandLivreComptes(response?.comptes || []);
            } else {
                // Single account
                const response = await getGrandLivre(selectedCompte.id, filters);
                setGrandLivreData(response?.mouvements || []);
                // Build single-compte structure for print
                setGrandLivreComptes([{
                    numero_compte: selectedCompte.numero_compte,
                    libelle_compte: selectedCompte.libelle,
                    classe: selectedCompte.classe,
                    total_debit: response?.total_debit || 0,
                    total_credit: response?.total_credit || 0,
                    solde_final: response?.solde_final || 0,
                    mouvements: response?.mouvements || [],
                }]);
            }
        } catch (error) {
            console.error('Error loading grand livre:', error);
            message.error('Erreur lors du chargement du grand livre');
        } finally {
            setGrandLivreLoading(false);
        }
    };

    // Load comptes on mount
    useEffect(() => {
        loadData();
        loadComptes();
    }, []);

    // Reload grand livre when selected compte or date range changes
    useEffect(() => {
        loadGrandLivre();
    }, [selectedCompte, grandLivreDateRange]);    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount) + ' FCFA';
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const openDetailsModal = (ecriture) => {
        setSelectedEcriture(ecriture);
        setIsModalVisible(true);
    };

    // --- CSV Export ---
    const exportJournalCSV = () => {
        const rows = [
            ['N° Écriture', 'Date', 'Journal', 'Libellé', 'Pièce', 'Débit', 'Crédit', 'Équilibré']
        ];
        filteredEcritures.forEach(e => {
            const eq = e.is_equilibree ?? (Math.abs(parseFloat(e.total_debit||0) - parseFloat(e.total_credit||0)) < 0.01);
            rows.push([
                e.numero_ecriture, formatDate(e.date_ecriture),
                e.journal_libelle || e.journal, e.libelle,
                e.piece_justificative || '',
                parseFloat(e.total_debit||0).toFixed(0),
                parseFloat(e.total_credit||0).toFixed(0),
                eq ? 'Oui' : 'Non'
            ]);
        });
        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `journal_comptable_${dayjs().format('YYYY-MM-DD')}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    // --- Print Grand Livre ---
    const printGrandLivre = () => {
        const titre = selectedCompte
            ? `${selectedCompte.numero_compte} — ${selectedCompte.libelle}`
            : 'Grand Livre Général — Tous les comptes';

        // Couleurs par classe SYSCOHADA
        const classeColors = {
            '1': { bg: '#1e3a5f', text: '#fff', label: 'Classe 1 — Capitaux' },
            '2': { bg: '#1a5276', text: '#fff', label: 'Classe 2 — Immobilisations' },
            '3': { bg: '#1a6b4a', text: '#fff', label: 'Classe 3 — Stocks' },
            '4': { bg: '#6e2f8a', text: '#fff', label: 'Classe 4 — Tiers' },
            '5': { bg: '#1a5276', text: '#fff', label: 'Classe 5 — Trésorerie' },
            '6': { bg: '#922b21', text: '#fff', label: 'Classe 6 — Charges' },
            '7': { bg: '#1e8449', text: '#fff', label: 'Classe 7 — Produits' },
        };

        const fmtNum = (v) => parseFloat(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 });
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '';

        let currentClasse = null;
        const sections = grandLivreComptes.map(c => {
            const color = classeColors[c.classe] || { bg: '#2c3e50', text: '#fff' };
            let classeHeader = '';
            if (c.classe !== currentClasse) {
                currentClasse = c.classe;
                classeHeader = `
                    <tr>
                        <td colspan="6" style="background:${color.bg};color:${color.text};font-weight:bold;font-size:13px;padding:10px 12px;letter-spacing:0.05em;text-transform:uppercase;">
                            ${color.label || `Classe ${c.classe}`}
                        </td>
                    </tr>`;
            }

            const compteHeader = `
                <tr style="background:#f0f4f8;border-left:4px solid ${color.bg};">
                    <td colspan="6" style="padding:8px 12px;font-weight:bold;color:${color.bg};font-size:12px;">
                        📒 ${c.numero_compte} — ${c.libelle_compte}
                        &nbsp;&nbsp;|&nbsp;&nbsp;
                        Débit: <span style="color:#1a5276">${fmtNum(c.total_debit)} FCFA</span>
                        &nbsp;&nbsp;Crédit: <span style="color:#1e8449">${fmtNum(c.total_credit)} FCFA</span>
                        &nbsp;&nbsp;Solde: <span style="color:${parseFloat(c.solde_final) >= 0 ? '#1a5276' : '#922b21'};font-weight:bold">
                            ${fmtNum(Math.abs(c.solde_final))} FCFA ${parseFloat(c.solde_final) >= 0 ? 'D' : 'C'}
                        </span>
                    </td>
                </tr>`;

            let mouvRows = '';
            if (c.mouvements && c.mouvements.length > 0) {
                mouvRows = c.mouvements.map((m, i) => `
                    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fbfc'};">
                        <td style="padding:5px 10px;color:#555">${fmtDate(m.date)}</td>
                        <td style="padding:5px 10px;color:#1a5276;font-weight:500">${m.numero_ecriture || ''}</td>
                        <td style="padding:5px 10px;text-align:center"><span style="background:#e8f4fd;color:#1a5276;padding:2px 6px;border-radius:4px;font-size:11px">${m.journal || ''}</span></td>
                        <td style="padding:5px 10px;color:#333">${m.libelle || ''}</td>
                        <td style="padding:5px 10px;text-align:right;color:#1a5276;font-weight:bold">${parseFloat(m.debit || 0) > 0 ? fmtNum(m.debit) : ''}</td>
                        <td style="padding:5px 10px;text-align:right;color:#1e8449;font-weight:bold">${parseFloat(m.credit || 0) > 0 ? fmtNum(m.credit) : ''}</td>
                    </tr>`).join('');
            } else {
                mouvRows = `<tr><td colspan="6" style="padding:5px 10px;color:#aaa;font-style:italic;text-align:center">Aucun mouvement</td></tr>`;
            }

            const separateur = `<tr><td colspan="6" style="height:6px;background:#e8edf5;"></td></tr>`;

            return classeHeader + compteHeader + mouvRows + separateur;
        }).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Grand Livre — Polyclinique Fultang</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #333; padding: 20px; }
        .header { text-align: center; border-bottom: 3px double #1e3a5f; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { font-size: 18px; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.1em; }
        .header h2 { font-size: 13px; color: #555; margin-top: 4px; }
        .header p { font-size: 11px; color: #888; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; }
        thead th { background: #2c3e50; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; }
        thead th:nth-child(5), thead th:nth-child(6) { text-align: right; }
        @media print { body { padding: 10px; } button { display: none; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Polyclinique Fultang</h1>
        <h2>GRAND LIVRE COMPTABLE — ${titre}</h2>
        <p>Édité le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
    </div>
    <table>
        <thead>
            <tr>
                <th style="width:90px">Date</th>
                <th style="width:120px">N° Écriture</th>
                <th style="width:60px">Journal</th>
                <th>Libellé</th>
                <th style="width:110px;text-align:right">Débit (FCFA)</th>
                <th style="width:110px;text-align:right">Crédit (FCFA)</th>
            </tr>
        </thead>
        <tbody>
            ${sections}
        </tbody>
    </table>
    <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
</body>
</html>`;

        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
    };

    // Filter écritures
    const filteredEcritures = ecritures.filter(e => {
        if (selectedJournal && e.journal !== selectedJournal) return false;
        if (dateRange) {
            const ecritureDate = dayjs(e.date_ecriture);
            if (ecritureDate.isBefore(dateRange[0], 'day') || ecritureDate.isAfter(dateRange[1], 'day')) {
                return false;
            }
        }
        return true;
    });

    // Calculate totals
    const totalDebit = filteredEcritures.reduce((sum, e) => sum + parseFloat(e.total_debit || 0), 0);
    const totalCredit = filteredEcritures.reduce((sum, e) => sum + parseFloat(e.total_credit || 0), 0);

    // Grand Livre totals — backend returns 'debit' and 'credit' fields
    const grandLivreTotalDebit = grandLivreData.reduce((sum, m) => sum + parseFloat(m.debit || 0), 0);
    const grandLivreTotalCredit = grandLivreData.reduce((sum, m) => sum + parseFloat(m.credit || 0), 0);

    // Grand Livre columns — add "Compte" column when showing all accounts
    const grandLivreColumns = [
        ...(selectedCompte ? [] : [{
            title: 'Compte',
            key: 'compte',
            width: 180,
            render: (_, record) => (
                <span className="font-bold text-indigo-700">
                    {record.numero_compte} — {record.libelle_compte}
                </span>
            ),
        }]),
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            render: (date) => formatDate(date),
            width: 110,
        },
        {
            title: 'N° Écriture',
            dataIndex: 'numero_ecriture',
            key: 'numero_ecriture',
            render: (text) => <span className="font-medium text-indigo-600">{text}</span>,
        },
        {
            title: 'Journal',
            dataIndex: 'journal',
            key: 'journal',
            width: 70,
            render: (code) => <Tag color="blue">{code}</Tag>,
        },
        {
            title: 'Libellé',
            dataIndex: 'libelle',
            key: 'libelle',
            ellipsis: true,
        },
        {
            title: 'Débit',
            dataIndex: 'debit',
            key: 'debit',
            align: 'right',
            render: (amount) => (
                parseFloat(amount || 0) > 0
                    ? <span className="font-bold text-blue-600">{formatCurrency(parseFloat(amount))}</span>
                    : <span className="text-gray-300">—</span>
            ),
        },
        {
            title: 'Crédit',
            dataIndex: 'credit',
            key: 'credit',
            align: 'right',
            render: (amount) => (
                parseFloat(amount || 0) > 0
                    ? <span className="font-bold text-green-600">{formatCurrency(parseFloat(amount))}</span>
                    : <span className="text-gray-300">—</span>
            ),
        },
        {
            title: 'Solde Cumulé',
            dataIndex: 'solde_cumule',
            key: 'solde_cumule',
            align: 'right',
            render: (solde) => {
                const val = parseFloat(solde || 0);
                return (
                    <span className={`font-bold ${val >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(val))} {val >= 0 ? 'D' : 'C'}
                    </span>
                );
            },
        },
    ];

    // Table columns
    const columns = [
        {
            title: 'N° Écriture',
            dataIndex: 'numero_ecriture',
            key: 'numero_ecriture',
            render: (text) => <span className="font-medium text-blue-600">{text}</span>
        },
        {
            title: 'Date',
            dataIndex: 'date_ecriture',
            key: 'date_ecriture',
            render: (date) => formatDate(date)
        },
        {
            title: 'Journal',
            dataIndex: 'journal_code',
            key: 'journal',
            render: (code, record) => {
                const value = code || record.journal_detail?.code || record.journal;
                if (!value) return <span className="text-gray-300">—</span>;
                return (
                <Tag color={
                    value === 'JC' ? 'green' :
                        value === 'JB' ? 'blue' :
                            value === 'JMM' ? 'purple' :
                                value === 'JOD' ? 'orange' : 'gray'
                }>
                    {value}
                </Tag>
                );
            }
        },
        {
            title: 'Libellé',
            dataIndex: 'libelle',
            key: 'libelle',
            ellipsis: true,
        },
        {
            title: 'Pièce',
            dataIndex: 'piece_justificative',
            key: 'piece_justificative',
            render: (piece) => piece || '-'
        },
        {
            title: 'Débit',
            dataIndex: 'total_debit',
            key: 'total_debit',
            render: (amount) => (
                <span className="font-bold text-blue-600">
                    {formatCurrency(parseFloat(amount || 0))}
                </span>
            ),
            align: 'right'
        },
        {
            title: 'Crédit',
            dataIndex: 'total_credit',
            key: 'total_credit',
            render: (amount) => (
                <span className="font-bold text-green-600">
                    {formatCurrency(parseFloat(amount || 0))}
                </span>
            ),
            align: 'right'
        },
        {
            title: 'Équilibre',
            key: 'equilibre',
            render: (_, record) => {
                const eq = record.is_equilibree ??
                    (Math.abs(parseFloat(record.total_debit||0) - parseFloat(record.total_credit||0)) < 0.01);
                return eq ? <Tag color="green">✓ Équilibrée</Tag> : <Tag color="red">✗ Non équil.</Tag>;
            },
            align: 'center'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Tooltip title="Voir détails">
                    <button
                        onClick={() => openDetailsModal(record)}
                        className="p-2 bg-blue-100 rounded-lg hover:bg-blue-200 transition-all"
                    >
                        <FaEye className="text-blue-600" />
                    </button>
                </Tooltip>
            ),
            align: 'center'
        }
    ];

    return (
        <AccountantLayout>
            <div>
                <AccountantPageHeader
                    title="Journaux & Écritures"
                    subtitle="Journal des écritures comptables en partie double et grand livre"
                    icon={BookOpen}
                    actions={
                        <div className="flex gap-4">
                            <div className="bg-blue-100 px-4 py-2 rounded-lg text-center">
                                <p className="text-sm text-blue-600">Total Débit</p>
                                <p className="text-xl font-bold text-blue-700">{formatCurrency(totalDebit)}</p>
                            </div>
                            <div className="bg-green-100 px-4 py-2 rounded-lg text-center">
                                <p className="text-sm text-green-600">Total Crédit</p>
                                <p className="text-xl font-bold text-green-700">{formatCurrency(totalCredit)}</p>
                            </div>
                        </div>
                    }
                />

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-500">
                            <p className="text-gray-500 text-sm">Total Écritures</p>
                            <p className="text-2xl font-bold">{stats.total ?? 0}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                            <p className="text-gray-500 text-sm">Validées</p>
                            <p className="text-2xl font-bold text-green-600">{stats.validees ?? 0}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
                            <p className="text-gray-500 text-sm">Brouillons</p>
                            <p className="text-2xl font-bold text-yellow-600">{stats.brouillons ?? 0}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
                            <p className="text-gray-500 text-sm">Journaux actifs</p>
                            <p className="text-2xl font-bold">{journaux.length}</p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <Tabs
                    defaultActiveKey={defaultTab}
                    style={{ marginBottom: '24px' }}
                    items={[
                        {
                            key: 'journal',
                            label: '📖 Journal Comptable',
                            children: (
                                <>
                                    {/* Filters */}
                                    <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
                                        <div className="flex flex-wrap gap-3 items-center justify-between">
                                            <div className="flex flex-wrap gap-3 items-center">
                                                <div className="flex items-center gap-2">
                                                    <FaFilter className="text-gray-400" />
                                                    <span className="text-gray-600 font-medium">Filtres :</span>
                                                </div>
                                                <Select
                                                    placeholder="Tous les journaux"
                                                    allowClear
                                                    style={{ width: 200 }}
                                                    onChange={(value) => setSelectedJournal(value)}
                                                    options={[
                                                        { value: undefined, label: 'Tous les journaux' },
                                                        ...journaux.map(j => ({ value: j.code, label: `${j.code} - ${j.libelle}` }))
                                                    ]}
                                                />
                                                <RangePicker
                                                    onChange={(dates) => setDateRange(dates)}
                                                    format="DD/MM/YYYY"
                                                    placeholder={['Date début', 'Date fin']}
                                                />
                                                <span className="text-gray-400 text-sm">{filteredEcritures.length} écriture(s)</span>
                                            </div>
                                            <button
                                                onClick={exportJournalCSV}
                                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-sm font-medium shadow-sm"
                                            >
                                                <FaFileCsv />
                                                Exporter CSV
                                            </button>
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                                        <Table
                                            columns={columns}
                                            dataSource={filteredEcritures}
                                            rowKey="id"
                                            loading={isLoading}
                                            pagination={{
                                                pageSize: 10,
                                                showTotal: (total, range) => `${range[0]}-${range[1]} sur ${total} écritures`
                                            }}
                                            summary={() => (
                                                <Table.Summary fixed>
                                                    <Table.Summary.Row className="bg-gray-100 font-bold">
                                                        <Table.Summary.Cell index={0} colSpan={5}>TOTAUX</Table.Summary.Cell>
                                                        <Table.Summary.Cell index={5} align="right" className="text-blue-600">
                                                            {formatCurrency(totalDebit)}
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell index={6} align="right" className="text-green-600">
                                                            {formatCurrency(totalCredit)}
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell index={7} colSpan={2}></Table.Summary.Cell>
                                                    </Table.Summary.Row>
                                                </Table.Summary>
                                            )}
                                        />
                                    </div>
                                </>
                            )
                        },
                        {
                            key: 'grand_livre',
                            label: '📒 Grand Livre',
                            children: (
                                <>
                                    {/* Filters for Grand Livre */}
                                    <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
                                        <div className="flex flex-wrap gap-3 items-center justify-between">
                                            <div className="flex flex-wrap gap-3 items-center">
                                                <div className="flex items-center gap-2">
                                                    <FaBalanceScale className="text-gray-400" />
                                                    <span className="text-gray-600 font-medium">Filtres :</span>
                                                </div>
                                                <Select
                                                    placeholder="Tous les comptes"
                                                    allowClear
                                                    style={{ width: 220 }}
                                                    value={selectedCompte?.id || undefined}
                                                    onChange={(value) => {
                                                        const compte = comptes.find(c => c.id === value);
                                                        setSelectedCompte(compte || null);
                                                    }}
                                                    options={[
                                                        { value: undefined, label: 'Tous les comptes' },
                                                        ...comptes.map(c => ({ value: c.id, label: `${c.numero_compte} - ${c.libelle}` }))
                                                    ]}
                                                />
                                                <RangePicker
                                                    onChange={(dates) => setGrandLivreDateRange(dates)}
                                                    format="DD/MM/YYYY"
                                                    placeholder={['Date début', 'Date fin']}
                                                />
                                                <span className="text-gray-400 text-sm">
                                                    {grandLivreData.length} mouvement(s)
                                                    {!selectedCompte && grandLivreData.length > 0 && ' — tous comptes'}
                                                </span>                                            </div>
                                            <button
                                                onClick={printGrandLivre}
                                                disabled={grandLivreData.length === 0}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <FaPrint />
                                                Imprimer Grand Livre
                                            </button>
                                        </div>
                                    </div>

                                    {/* Grand Livre Table */}
                                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                                        {grandLivreLoading ? (
                                            <div className="flex flex-col items-center justify-center h-[200px]">
                                                <Spin size="large" tip="Chargement du grand livre..." />
                                            </div>
                                        ) : (
                                            <Table
                                                columns={grandLivreColumns}
                                                dataSource={grandLivreData}
                                                rowKey={(r, i) => `${r.numero_ecriture}-${i}`}
                                                loading={grandLivreLoading}
                                                locale={{
                                                    emptyText: grandLivreLoading
                                                        ? 'Chargement...'
                                                        : 'Aucun mouvement sur cette période'
                                                }}
                                                pagination={false}
                                                summary={() => (
                                                    <Table.Summary fixed>
                                                        <Table.Summary.Row className="bg-gray-100 font-bold">
                                                            <Table.Summary.Cell index={0} colSpan={3}>TOTAUX</Table.Summary.Cell>
                                                            <Table.Summary.Cell index={3} align="right" className="text-blue-600">
                                                                {formatCurrency(grandLivreTotalDebit)}
                                                            </Table.Summary.Cell>
                                                            <Table.Summary.Cell index={4} align="right" className="text-green-600">
                                                                {formatCurrency(grandLivreTotalCredit)}
                                                            </Table.Summary.Cell>
                                                            <Table.Summary.Cell index={5} colSpan={1}></Table.Summary.Cell>
                                                        </Table.Summary.Row>
                                                    </Table.Summary>
                                                )}
                                            />
                                        )}
                                    </div>
                                </>
                            )
                        }
                    ]}
                />

                {/* Details Modal */}
                <Modal
                    title={
                        <div className="flex items-center gap-2">
                            <FaFileAlt className="text-indigo-500" />
                            <span>Détails de l'écriture</span>
                        </div>
                    }
                    open={isModalVisible}
                    onCancel={() => setIsModalVisible(false)}
                    footer={null}
                    width={700}
                >
                    {selectedEcriture && (
                        <div className="space-y-4">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm opacity-80">N° Écriture</p>
                                        <p className="text-xl font-bold">{selectedEcriture.numero_ecriture}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm opacity-80">Date</p>
                                        <p className="text-lg font-bold">{formatDate(selectedEcriture.date_ecriture)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">Journal:</span>
                                        <span className="ml-2 font-medium">
                                            {selectedEcriture.journal_libelle
                                                || (selectedEcriture.journal_detail
                                                    ? `${selectedEcriture.journal_detail.code} — ${selectedEcriture.journal_detail.libelle}`
                                                    : selectedEcriture.journal_code)
                                                || '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Pièce:</span>
                                        <span className="ml-2 font-medium">{selectedEcriture.piece_justificative || '-'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-500">Libellé:</span>
                                        <span className="ml-2 font-medium">{selectedEcriture.libelle}</span>
                                    </div>
                                    {selectedEcriture.quittance_numero && (
                                        <div className="col-span-2">
                                            <span className="text-gray-500">Quittance:</span>
                                            <Tag color="blue" className="ml-2">{selectedEcriture.quittance_numero}</Tag>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-gray-500">Comptable:</span>
                                        <span className="ml-2 font-medium">{selectedEcriture.comptable_nom || selectedEcriture.created_by_nom || '—'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Lignes */}
                            <div>
                                <h4 className="font-bold text-gray-700 mb-3">Lignes de l'écriture</h4>
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="p-2 text-left border">Compte</th>
                                            <th className="p-2 text-left border">Libellé</th>
                                            <th className="p-2 text-right border">Débit</th>
                                            <th className="p-2 text-right border">Crédit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedEcriture.lignes?.map((ligne, index) => (
                                            <tr key={index} className="hover:bg-gray-50">
                                                <td className="p-2 border">
                                                    <span className="font-medium">{ligne.compte_numero}</span>
                                                    <span className="text-gray-500 text-sm ml-2">{ligne.compte_libelle}</span>
                                                </td>
                                                <td className="p-2 border text-sm">{ligne.libelle}</td>
                                                <td className="p-2 border text-right font-bold text-blue-600">
                                                    {parseFloat(ligne.montant_debit) > 0 ? formatCurrency(parseFloat(ligne.montant_debit)) : ''}
                                                </td>
                                                <td className="p-2 border text-right font-bold text-green-600">
                                                    {parseFloat(ligne.montant_credit) > 0 ? formatCurrency(parseFloat(ligne.montant_credit)) : ''}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-100 font-bold">
                                            <td colSpan="2" className="p-2 border">TOTAL</td>
                                            <td className="p-2 border text-right text-blue-600">
                                                {formatCurrency(parseFloat(selectedEcriture.total_debit))}
                                            </td>
                                            <td className="p-2 border text-right text-green-600">
                                                {formatCurrency(parseFloat(selectedEcriture.total_credit))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Équilibre */}
                            {(() => {
                                const eq = selectedEcriture.is_equilibree ??
                                    (Math.abs(parseFloat(selectedEcriture.total_debit||0) - parseFloat(selectedEcriture.total_credit||0)) < 0.01);
                                return (
                                    <div className={`p-3 rounded-lg text-center ${eq ? 'bg-green-100' : 'bg-red-100'}`}>
                                        {eq ? (
                                            <span className="text-green-700 font-semibold">✓ Écriture équilibrée (Débit = Crédit)</span>
                                        ) : (
                                            <span className="text-red-700 font-semibold">✗ Écriture NON équilibrée</span>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </Modal>
            </div>
        </AccountantLayout>
    );
}

export default EcrituresComptablesPage;
