import React from 'react';
import { Tag } from 'antd';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Wallet, PieChart } from 'lucide-react';

const STATUS_META = {
    ok: { color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', Icon: CheckCircle2, label: 'OK' },
    warning: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', Icon: AlertTriangle, label: 'Attention' },
    blocked: { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', Icon: XCircle, label: 'Bloqué' },
    pending: { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', Icon: Clock, label: 'En attente' },
};

const fmt = (n) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

function CheckCard({ title, subtitle, icon: HeaderIcon, check, children }) {
    const meta = STATUS_META[check?.status] || STATUS_META.warning;
    const StatusIcon = meta.Icon;

    return (
        <div
            className="rounded-xl p-4 border h-full"
            style={{ background: meta.bg, borderColor: meta.border }}
        >
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <HeaderIcon className="w-4 h-4 shrink-0" style={{ color: meta.color }} />
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider m-0 text-slate-500">
                            {title}
                        </p>
                        <p className="text-xs text-slate-400 m-0 mt-0.5">{subtitle}</p>
                    </div>
                </div>
                <Tag
                    className="m-0 border-none font-bold text-[10px] uppercase shrink-0"
                    style={{ background: `${meta.color}22`, color: meta.color }}
                >
                    <StatusIcon className="w-3 h-3 inline mr-1 -mt-0.5" />
                    {check?.statusLabel || meta.label}
                </Tag>
            </div>
            <p className="text-sm font-semibold m-0 mb-2" style={{ color: '#051161' }}>
                {check?.headline}
            </p>
            <p className="text-xs text-slate-600 m-0 leading-relaxed">{check?.detail}</p>
            {children}
        </div>
    );
}

/**
 * Affiche les deux contrôles orthogonaux : autorisation budgétaire vs liquidité trésorerie.
 */
export function FinanceControlChecks({ checks, metrics, compact = false }) {
    if (!checks) return null;

    const { budget, treasury } = checks;

    return (
        <div className={`grid grid-cols-1 ${compact ? '' : 'lg:grid-cols-2'} gap-3`}>
            <CheckCard
                title="Contrôle budgétaire"
                subtitle="A-t-on le droit de dépenser ? (enveloppe prévisionnelle)"
                icon={PieChart}
                check={budget}
            >
                {metrics && (
                    <div className="mt-3 pt-3 border-t border-emerald-200/60 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                            <p className="text-slate-400 m-0">Alloué exercice</p>
                            <p className="font-bold text-slate-700 m-0 tabular-nums">{fmt(metrics.budgetPrevu)} FCFA</p>
                        </div>
                        <div>
                            <p className="text-slate-400 m-0">Reste disponible</p>
                            <p className="font-bold text-emerald-700 m-0 tabular-nums">{fmt(metrics.budgetDispo)} FCFA</p>
                        </div>
                    </div>
                )}
            </CheckCard>

            <CheckCard
                title="Contrôle de trésorerie"
                subtitle="A-t-on l'argent pour payer maintenant ? (classe 5 SYSCOHADA)"
                icon={Wallet}
                check={treasury}
            >
                {metrics && (
                    <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-2 text-[11px]">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-slate-400 m-0">Solde actuel</p>
                                <p className="font-bold text-slate-700 m-0 tabular-nums">{fmt(metrics.tresorerie)} FCFA</p>
                            </div>
                            <div>
                                <p className="text-slate-400 m-0">Après décaissement</p>
                                <p
                                    className="font-bold m-0 tabular-nums"
                                    style={{
                                        color: metrics.tresorerieApres < 0 ? '#ef4444' : '#051161',
                                    }}
                                >
                                    {fmt(metrics.tresorerieApres)} FCFA
                                </p>
                            </div>
                        </div>
                        {(metrics.tresorerieReport > 0 || metrics.tresorerieMouvements !== undefined) && (
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-100">
                                <div>
                                    <p className="text-slate-400 m-0">Report à nouveau (JRN)</p>
                                    <p className="font-semibold text-indigo-700 m-0 tabular-nums">
                                        {fmt(metrics.tresorerieReport)} FCFA
                                    </p>
                                </div>
                                <div>
                                    <p className="text-slate-400 m-0">Mouvements exercice</p>
                                    <p className="font-semibold text-slate-600 m-0 tabular-nums">
                                        {fmt(metrics.tresorerieMouvements)} FCFA
                                    </p>
                                </div>
                            </div>
                        )}
                        {metrics.reportManquant && (
                            <p className="text-amber-700 m-0 text-[10px] leading-snug">
                                Report à nouveau non généré — exécutez le JRN depuis l&apos;exercice précédent clôturé.
                            </p>
                        )}
                    </div>
                )}
            </CheckCard>
        </div>
    );
}

export function FinanceWorkflowBanner({ workflow }) {
    if (!workflow) return null;

    return (
        <div
            className="rounded-xl px-4 py-3 mb-4 border text-sm"
            style={{
                background: workflow.bg || '#f8fafc',
                borderColor: workflow.border || '#e2e8f0',
            }}
        >
            <p className="font-extrabold m-0 mb-1" style={{ color: '#051161' }}>
                {workflow.title}
            </p>
            <p className="text-slate-600 m-0 text-xs leading-relaxed">{workflow.message}</p>
            {workflow.steps?.length > 0 && (
                <ol className="mt-2 mb-0 pl-4 text-xs text-slate-500 space-y-0.5">
                    {workflow.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                    ))}
                </ol>
            )}
        </div>
    );
}

export default FinanceControlChecks;
