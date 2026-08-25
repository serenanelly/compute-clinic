import React from 'react';
import { Button, Select, Table, Tag, Progress } from 'antd';
import {
    Activity,
    Archive,
    BookOpen,
    FileText,
    Layers,
    PieChart,
    Scale,
    TrendingDown,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { ACCOUNTANT_COLORS, accountantCardStyle } from '../accountantTheme';

const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n || 0);

const RAPPORT_TABS = [
    { key: 'bilan', label: 'Bilan', Icon: Scale },
    { key: 'balance', label: 'Balance', Icon: BookOpen },
    { key: 'compte_resultat', label: 'Compte de résultat', Icon: FileText },
    { key: 'flux', label: 'Flux de trésorerie', Icon: Wallet },
];

export function HistoriqueComparatifTab({
    loading,
    exerciceActif,
    exercicesClos,
    selectedHistoriqueId,
    syntheseHistorique,
    rapportHistorique,
    rapportType,
    comparatif,
    comparativeChartData,
    historiqueColumns,
    onSelectExercice,
    onLoadRapport,
    renderRapport,
}) {
    const selectedExerciceClos =
        exercicesClos.find((e) => e.id === selectedHistoriqueId) ||
        exercicesClos[exercicesClos.length - 1];

    const kpis = syntheseHistorique?.kpis || {};
    const recettes = kpis.total_recettes || 0;
    const sorties = kpis.total_sorties ?? kpis.total_depenses ?? 0;
    const charges = kpis.depenses_comptabilisees || 0;
    const resultat =
        kpis.resultat_net ?? selectedExerciceClos?.resultat_net ?? 0;
    const budgetPrevu = syntheseHistorique?.budgets?.prevu || 0;
    const budgetConsomme = syntheseHistorique?.budgets?.consomme || 0;
    const budgetPct =
        budgetPrevu > 0
            ? Math.min(100, Math.round((budgetConsomme / budgetPrevu) * 100))
            : 0;

    const selectedCode =
        syntheseHistorique?.exercice?.code ||
        selectedExerciceClos?.code ||
        (selectedExerciceClos ? `EX-${selectedExerciceClos.annee}` : '—');

    const resultatCumule = (comparatif.length ? comparatif : exercicesClos)
        .filter((r) => r.statut === 'cloture' || r.statut === 'clôturé' || r.statut !== 'ouvert')
        .reduce((s, r) => s + (r.resultat_net || 0), 0);

    const comparatifRows = (comparatif.length ? comparatif : exercicesClos).map(
        (row, idx, arr) => {
            const prev = arr[idx - 1];
            const rowRecettes = row.total_recettes || 0;
            const rowDepenses =
                (row.total_sorties ??
                    row.depenses_operationnelles ??
                    row.total_depenses) ||
                0;
            const rowResultat = row.resultat_net || 0;
            const variation =
                row.variation_recettes_pct != null
                    ? row.variation_recettes_pct
                    : prev && (prev.total_recettes || 0) > 0
                      ? ((rowRecettes - (prev.total_recettes || 0)) /
                            (prev.total_recettes || 1)) *
                        100
                      : null;

            return {
                key: row.id || row.annee || idx,
                annee: String(row.annee || row.year || ''),
                code: row.code || `EX-${row.annee || row.year}`,
                recettes: rowRecettes,
                depenses: rowDepenses,
                resultat: rowResultat,
                variation,
            };
        }
    );

    if (!exercicesClos.length) {
        return (
            <div
                className="mt-5 text-center py-16 px-6"
                style={{ ...accountantCardStyle, background: '#fff' }}
            >
                <Archive className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                <p className="font-bold text-slate-600 m-0">Aucun exercice clôturé</p>
                <p className="text-sm text-slate-400 mt-2 mb-0 max-w-md mx-auto">
                    L&apos;historique apparaîtra après la première clôture d&apos;exercice.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-5 space-y-5">
            {/* Toolbar */}
            <div
                className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between px-5 py-4 bg-white"
                style={accountantCardStyle}
            >
                <div className="flex items-start gap-3 min-w-0">
                    <div
                        className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: `${ACCOUNTANT_COLORS.brandBlue}14` }}
                    >
                        <Archive
                            className="w-5 h-5"
                            style={{ color: ACCOUNTANT_COLORS.brandBlue }}
                        />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 m-0">
                            Archives comptables
                        </p>
                        <h3
                            className="text-lg font-extrabold m-0 tracking-tight"
                            style={{ color: ACCOUNTANT_COLORS.brandNavy }}
                        >
                            Historique & comparatif pluriannuel
                        </h3>
                        <p className="text-sm text-slate-500 m-0 mt-0.5">
                            Résultat, budgets et états SYSCOHADA par exercice clôturé.
                        </p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <Select
                        className="w-full sm:w-56"
                        size="large"
                        placeholder="Exercice clôturé"
                        value={selectedHistoriqueId}
                        onChange={onSelectExercice}
                        options={exercicesClos.map((e) => ({
                            value: e.id,
                            label: `${e.code || `EX-${e.annee}`} — clôturé`,
                        }))}
                    />
                    {exerciceActif && (
                        <div
                            className="text-xs font-semibold px-3 py-2.5 rounded-xl whitespace-nowrap"
                            style={{
                                background: `${ACCOUNTANT_COLORS.brandTeal}18`,
                                color: ACCOUNTANT_COLORS.brandNavy,
                                border: `1px solid ${ACCOUNTANT_COLORS.brandTeal}44`,
                            }}
                        >
                            Courant : {exerciceActif.code || `EX-${exerciceActif.annee}`}
                        </div>
                    )}
                </div>
            </div>

            {/* Hero exercice sélectionné */}
            <div
                className="relative overflow-hidden px-6 py-5"
                style={{
                    ...accountantCardStyle,
                    background: `linear-gradient(135deg, ${ACCOUNTANT_COLORS.brandNavy} 0%, ${ACCOUNTANT_COLORS.brandBlue} 55%, ${ACCOUNTANT_COLORS.brandTeal} 100%)`,
                }}
            >
                <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
                <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4 text-white">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Tag className="m-0 border-none bg-white/20 text-white font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                                Clôturé
                            </Tag>
                            {selectedExerciceClos?.date_debut && (
                                <span className="text-white/70 text-xs font-medium">
                                    {new Date(
                                        selectedExerciceClos.date_debut
                                    ).toLocaleDateString('fr-FR')}
                                    {' → '}
                                    {new Date(
                                        selectedExerciceClos.date_fin ||
                                            selectedExerciceClos.date_cloture ||
                                            selectedExerciceClos.date_debut
                                    ).toLocaleDateString('fr-FR')}
                                </span>
                            )}
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black m-0 tracking-tight">
                            {selectedCode}
                        </h2>
                        <p className="text-white/75 text-sm mt-1 mb-0">
                            {resultat >= 0
                                ? 'Excédent — l\u2019établissement gagne sur cette période'
                                : 'Déficit — l\u2019établissement perd sur cette période'}
                        </p>
                    </div>
                    <div className="text-left md:text-right">
                        <p className="text-white/60 text-[11px] font-bold uppercase tracking-wider m-0">
                            Résultat net
                        </p>
                        <p className="text-2xl md:text-3xl font-black m-0 tabular-nums">
                            {resultat >= 0 ? '+' : ''}
                            {fmt(resultat)}
                            <span className="text-sm font-semibold ml-1 opacity-80">
                                FCFA
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                    {
                        label: 'Recettes',
                        value: `${fmt(recettes)} FCFA`,
                        hint: 'Encaissements / produits',
                        color: ACCOUNTANT_COLORS.accentGreen,
                        Icon: TrendingUp,
                    },
                    {
                        label: 'Sorties & charges',
                        value: `${fmt(sorties || charges)} FCFA`,
                        hint: charges
                            ? `${fmt(charges)} en cl. 6`
                            : 'Caisse + OP',
                        color: ACCOUNTANT_COLORS.accentRed,
                        Icon: TrendingDown,
                    },
                    {
                        label: 'Résultat net',
                        value: `${fmt(resultat)} FCFA`,
                        hint: resultat >= 0 ? 'Bénéfice' : 'Perte',
                        color:
                            resultat >= 0
                                ? ACCOUNTANT_COLORS.accentGreen
                                : ACCOUNTANT_COLORS.accentRed,
                        Icon: resultat >= 0 ? TrendingUp : TrendingDown,
                    },
                    {
                        label: 'Budget consommé',
                        value: `${budgetPct}%`,
                        hint: `${fmt(budgetConsomme)} / ${fmt(budgetPrevu)} FCFA`,
                        color: ACCOUNTANT_COLORS.brandBlue,
                        Icon: PieChart,
                        progress: budgetPct,
                    },
                ].map((kpi) => (
                    <div
                        key={kpi.label}
                        className="px-4 py-3.5 bg-white"
                        style={accountantCardStyle}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {kpi.label}
                            </span>
                            <kpi.Icon className="w-4 h-4" style={{ color: kpi.color }} />
                        </div>
                        <p
                            className="text-lg font-extrabold m-0 tabular-nums"
                            style={{ color: ACCOUNTANT_COLORS.brandNavy }}
                        >
                            {kpi.value}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 mb-0">{kpi.hint}</p>
                        {kpi.progress != null && (
                            <Progress
                                percent={kpi.progress}
                                showInfo={false}
                                size="small"
                                className="mt-2 mb-0"
                                strokeColor={
                                    kpi.progress > 90
                                        ? ACCOUNTANT_COLORS.accentRed
                                        : ACCOUNTANT_COLORS.brandTeal
                                }
                                trailColor="#f1f5f9"
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Chart + tableau comparatif */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div
                    className="xl:col-span-3 bg-white p-5"
                    style={accountantCardStyle}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity
                                className="w-4 h-4"
                                style={{ color: ACCOUNTANT_COLORS.brandBlue }}
                            />
                            <span
                                className="font-extrabold text-sm"
                                style={{ color: ACCOUNTANT_COLORS.brandNavy }}
                            >
                                Recettes vs dépenses
                            </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                            {comparatifRows.length} exercice(s)
                        </span>
                    </div>
                    <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={comparativeChartData}
                                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                                barCategoryGap="28%"
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#eef2f7"
                                />
                                <XAxis
                                    dataKey="year"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{
                                        fill: '#64748b',
                                        fontSize: 12,
                                        fontWeight: 600,
                                    }}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    width={42}
                                    tickFormatter={(v) =>
                                        Math.abs(v) >= 1e6
                                            ? `${(v / 1e6).toFixed(1)}M`
                                            : `${Math.round(v / 1000)}k`
                                    }
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{
                                        background: '#fff',
                                        borderRadius: 12,
                                        border: `1px solid ${ACCOUNTANT_COLORS.border}`,
                                        boxShadow:
                                            '0 8px 24px rgba(15,23,42,0.08)',
                                        fontSize: 12,
                                    }}
                                    formatter={(v) => [`${fmt(v)} FCFA`]}
                                />
                                <Legend
                                    iconType="circle"
                                    wrapperStyle={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        paddingTop: 8,
                                    }}
                                />
                                <Bar
                                    dataKey="Recettes"
                                    radius={[4, 4, 0, 0]}
                                    barSize={22}
                                    fill={ACCOUNTANT_COLORS.accentGreen}
                                />
                                <Bar
                                    dataKey="Dépenses"
                                    radius={[4, 4, 0, 0]}
                                    barSize={22}
                                    fill={ACCOUNTANT_COLORS.accentRed}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div
                    className="xl:col-span-2 bg-white p-5"
                    style={accountantCardStyle}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Layers
                            className="w-4 h-4"
                            style={{ color: ACCOUNTANT_COLORS.brandBlue }}
                        />
                        <span
                            className="font-extrabold text-sm"
                            style={{ color: ACCOUNTANT_COLORS.brandNavy }}
                        >
                            Tableau comparatif
                        </span>
                    </div>
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {comparatifRows.map((row) => {
                            const isSelected =
                                String(row.annee) ===
                                    String(selectedExerciceClos?.annee) ||
                                row.code === selectedCode;
                            return (
                                <button
                                    type="button"
                                    key={row.key}
                                    onClick={() => {
                                        const match = exercicesClos.find(
                                            (e) =>
                                                String(e.annee) ===
                                                    String(row.annee) ||
                                                (e.code || `EX-${e.annee}`) ===
                                                    row.code
                                        );
                                        if (match) onSelectExercice(match.id);
                                    }}
                                    className="w-full text-left rounded-xl px-3 py-2.5 transition-all border"
                                    style={{
                                        borderColor: isSelected
                                            ? ACCOUNTANT_COLORS.brandBlue
                                            : ACCOUNTANT_COLORS.border,
                                        background: isSelected
                                            ? `${ACCOUNTANT_COLORS.brandBlue}0d`
                                            : '#fff',
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span
                                            className="font-extrabold text-sm"
                                            style={{
                                                color: ACCOUNTANT_COLORS.brandNavy,
                                            }}
                                        >
                                            {row.code}
                                        </span>
                                        {row.variation != null && (
                                            <span
                                                className="text-[11px] font-bold"
                                                style={{
                                                    color:
                                                        row.variation >= 0
                                                            ? ACCOUNTANT_COLORS.accentGreen
                                                            : ACCOUNTANT_COLORS.accentRed,
                                                }}
                                            >
                                                {row.variation >= 0 ? '+' : ''}
                                                {Number(row.variation).toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-1 mt-1.5 text-[11px]">
                                        <div>
                                            <p className="text-slate-400 m-0">Recettes</p>
                                            <p className="font-bold text-slate-700 m-0 tabular-nums">
                                                {fmt(row.recettes)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 m-0">Dépenses</p>
                                            <p className="font-bold text-slate-700 m-0 tabular-nums">
                                                {fmt(row.depenses)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-400 m-0">Résultat</p>
                                            <p
                                                className="font-bold m-0 tabular-nums"
                                                style={{
                                                    color:
                                                        row.resultat >= 0
                                                            ? ACCOUNTANT_COLORS.accentGreen
                                                            : ACCOUNTANT_COLORS.accentRed,
                                                }}
                                            >
                                                {fmt(row.resultat)}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs">
                        <span className="text-slate-400 font-semibold">
                            Cumul archives
                        </span>
                        <span
                            className="font-extrabold tabular-nums"
                            style={{
                                color:
                                    resultatCumule >= 0
                                        ? ACCOUNTANT_COLORS.accentGreen
                                        : ACCOUNTANT_COLORS.accentRed,
                            }}
                        >
                            {fmt(resultatCumule)} FCFA
                        </span>
                    </div>
                </div>
            </div>

            {/* États financiers */}
            <div className="bg-white p-5" style={accountantCardStyle}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
                    <div>
                        <h4
                            className="font-extrabold text-sm m-0"
                            style={{ color: ACCOUNTANT_COLORS.brandNavy }}
                        >
                            États financiers — {selectedCode}
                        </h4>
                        <p className="text-xs text-slate-400 m-0 mt-1">
                            Bilan, balance, compte de résultat et flux pour
                            l&apos;exercice sélectionné.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link to="/accountant/ecritures">
                            <Button
                                type="link"
                                className="px-0 font-semibold"
                                style={{ color: ACCOUNTANT_COLORS.brandBlue }}
                            >
                                Journal courant
                            </Button>
                        </Link>
                        <Link to="/accountant/grand-livre">
                            <Button
                                type="link"
                                className="px-0 font-semibold"
                                style={{ color: ACCOUNTANT_COLORS.brandBlue }}
                            >
                                Grand livre courant
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                    {RAPPORT_TABS.map(({ key, label, Icon }) => {
                        const active = rapportType === key && rapportHistorique;
                        return (
                            <Button
                                key={key}
                                type={active ? 'primary' : 'default'}
                                icon={<Icon className="w-3.5 h-3.5" />}
                                onClick={() => onLoadRapport(key)}
                                className="rounded-lg font-semibold h-9"
                                style={
                                    active
                                        ? {
                                              background:
                                                  ACCOUNTANT_COLORS.brandBlue,
                                              borderColor:
                                                  ACCOUNTANT_COLORS.brandBlue,
                                          }
                                        : {
                                              borderColor:
                                                  ACCOUNTANT_COLORS.border,
                                              color: ACCOUNTANT_COLORS.brandNavy,
                                          }
                                }
                            >
                                {label}
                            </Button>
                        );
                    })}
                </div>

                {rapportHistorique ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                        {renderRapport()}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 py-10 text-center">
                        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-500 m-0">
                            Choisissez un état financier pour {selectedCode}
                        </p>
                    </div>
                )}
            </div>

            {/* Table archives */}
            <div className="bg-white p-5" style={accountantCardStyle}>
                <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-4 h-4 text-slate-400" />
                    <span
                        className="font-extrabold text-sm"
                        style={{ color: ACCOUNTANT_COLORS.brandNavy }}
                    >
                        Exercices clôturés
                    </span>
                </div>
                <Table
                    dataSource={exercicesClos.map((e) => ({
                        ...e,
                        code: e.code || `EX-${e.annee}`,
                    }))}
                    columns={historiqueColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="middle"
                    className="custom-table"
                    onRow={(record) => ({
                        onClick: () => onSelectExercice(record.id),
                        style: {
                            cursor: 'pointer',
                            background:
                                record.id === selectedHistoriqueId
                                    ? `${ACCOUNTANT_COLORS.brandBlue}0a`
                                    : undefined,
                        },
                    })}
                />
            </div>
        </div>
    );
}

export default HistoriqueComparatifTab;
