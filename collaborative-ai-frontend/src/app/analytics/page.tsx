'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/providers/ToastProvider';
import {
    Sparkles, Send, Database, Hash, Type, Download, AlertTriangle,
    BarChart3, PieChart as PieIcon, TrendingUp, Table, Eye,
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line,
} from 'recharts';
import { apiClient } from '@/lib/apiClient';
import './analytics.css';

interface ChatAction { label: string; id: string }
interface ChatMsg { role: 'ai' | 'user'; text: string; actions?: ChatAction[] }
interface DatasetMeta { id: string; name: string }
interface TopVal { value: string; count: number }
interface ColStat {
    type: string; count: number; nullCount: number;
    min?: number; max?: number; avg?: number; median?: number; stdDev?: number; sum?: number;
    uniqueCount?: number; topValues?: TopVal[];
}
interface DatasetAnalytics {
    name: string; rows: number; columns: string[];
    stats: Record<string, ColStat>;
    distributions: Record<string, { label: string; count: number }[]>;
    qualityScore: number;
}

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#14b8a6'];
type ChartType = 'bar' | 'pie' | 'line';
type ViewTab = 'overview' | 'profiling' | 'charts';

export default function AnalyticsPage() {
    const { showToast } = useToast();

    const [platformData, setPlatformData] = useState<any>(null);
    const [pLoading, setPLoading] = useState(true);

    const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
    const [selectedDs, setSelectedDs] = useState<string>('');
    const [dsAnalytics, setDsAnalytics] = useState<DatasetAnalytics | null>(null);
    const [dsLoading, setDsLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<ViewTab>('overview');
    const [viewCol, setViewCol] = useState<string>('');
    const [chartType, setChartType] = useState<ChartType>('bar');
    const [compareCol, setCompareCol] = useState<string>('');

    const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatBusy, setChatBusy] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const push = useCallback((msg: ChatMsg) => {
        setChatMsgs(p => [...p, msg]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }, []);

    /* ── Load platform analytics ── */
    useEffect(() => {
        (async () => {
            try { const d = await apiClient.get('/data/analytics'); setPlatformData(d); } catch { }
            finally { setPLoading(false); }
        })();
    }, []);

    /* ── Load datasets list ── */
    useEffect(() => {
        (async () => {
            try {
                const d = await apiClient.get('/data/datasets');
                if (d) setDatasets(d.map((ds: any) => ({ id: ds.id, name: ds.name })));
            } catch { }
        })();
    }, []);

    /* ── Load dataset analytics ── */
    useEffect(() => {
        if (!selectedDs) { setDsAnalytics(null); return; }
        (async () => {
            setDsLoading(true);
            try {
                const d = await apiClient.get(`/data/datasets/${selectedDs}/analytics`);
                if (d) {
                    setDsAnalytics(d);
                    setViewCol(d.columns?.[0] || '');
                    setCompareCol(d.columns?.[1] || '');
                    setActiveTab('overview');
                    setChatMsgs([{
                        role: 'ai',
                        text: `📊 **${d.name}** loaded!\n\n• **${d.rows}** rows × **${d.columns.length}** columns\n• Quality: **${d.qualityScore}%**\n\nWhat would you like to explore?`,
                        actions: [
                            { label: '📋 Full Summary', id: 'summarize' },
                            { label: '🔍 Find Patterns', id: 'patterns' },
                            { label: '📊 Column Profiling', id: 'col-details' },
                            { label: '⚠️ Data Issues', id: 'issues' },
                            { label: '🔗 Correlations', id: 'correlations' },
                            { label: '📈 Outliers', id: 'outliers' },
                        ]
                    }]);
                }
            } catch { showToast('Failed to load dataset analytics.', 'error'); }
            finally { setDsLoading(false); }
        })();
    }, [selectedDs, showToast]);

    /* ── Helpers ── */
    const numCols = dsAnalytics?.columns.filter(c => dsAnalytics.stats[c]?.type === 'numeric') || [];
    const catCols = dsAnalytics?.columns.filter(c => dsAnalytics.stats[c]?.type === 'categorical') || [];

    const exportCSV = () => {
        if (!dsAnalytics) return;
        const { stats, columns } = dsAnalytics;
        let csv = 'Column,Type,Count,Nulls,Min,Max,Avg,Median,StdDev,Unique,Top Value\n';
        columns.forEach(c => {
            const s = stats[c];
            csv += `"${c}",${s.type},${s.count},${s.nullCount},${s.min ?? ''},${s.max ?? ''},${s.avg ?? ''},${s.median ?? ''},${s.stdDev ?? ''},${s.uniqueCount ?? ''},${s.topValues?.[0]?.value ?? ''}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${dsAnalytics.name}_profile.csv`; a.click();
        URL.revokeObjectURL(url);
        showToast('Profile exported as CSV!', 'success');
    };

    /* ── AI Chat Actions ── */
    const doAction = async (actionId: string) => {
        if (!dsAnalytics) return;
        const { stats, columns, rows, name, qualityScore } = dsAnalytics;

        switch (actionId) {
            case 'summarize': {
                const totalNulls = Object.values(stats).reduce((s, c) => s + (c.nullCount || 0), 0);
                const numSummary = numCols.map(c => {
                    const s = stats[c]; return `  • \`${c}\`: ${s.min}→${s.max}, avg **${s.avg}**, σ=${s.stdDev}`;
                }).join('\n');
                const catSummary = catCols.map(c => {
                    const s = stats[c]; return `  • \`${c}\`: **${s.uniqueCount}** unique, top: **${s.topValues?.[0]?.value}** (${s.topValues?.[0]?.count})`;
                }).join('\n');

                push({
                    role: 'ai',
                    text: `📋 **Summary: ${name}**\n\n📏 ${rows} rows × ${columns.length} cols | Quality: ${qualityScore}% | Nulls: ${totalNulls}\n\n**Numeric (${numCols.length}):**\n${numSummary || '  None'}\n\n**Categorical (${catCols.length}):**\n${catSummary || '  None'}`,
                    actions: [
                        { label: '🔍 Find Patterns', id: 'patterns' },
                        { label: '📈 Outliers', id: 'outliers' },
                        { label: '⬇️ Export Profile', id: 'export' },
                    ]
                });
                break;
            }
            case 'patterns': {
                setChatBusy(true);
                try {
                    const ctx = columns.map(c => {
                        const s = stats[c];
                        return s.type === 'numeric'
                            ? `${c}(num): min=${s.min}, max=${s.max}, avg=${s.avg}, std=${s.stdDev}, nulls=${s.nullCount}`
                            : `${c}(cat): ${s.uniqueCount} unique, top=${s.topValues?.slice(0, 3).map(v => `${v.value}(${v.count})`).join(',')}`;
                    }).join('\n');
                    const res = await apiClient.post('/ai/chat', {
                        message: `Analyze this dataset and find 4-5 interesting patterns. Be specific with numbers.\n\nDataset: ${name} (${rows} rows)\nColumns:\n${ctx}\n\nGive bullet points. Reference columns and values.`
                    });
                    push({
                        role: 'ai', text: `🔍 **Patterns Found**\n\n${res.reply}`,
                        actions: [{ label: '🔗 Correlations', id: 'correlations' }, { label: '⚠️ Issues', id: 'issues' }]
                    });
                } catch { push({ role: 'ai', text: '⚠️ AI unavailable.' }); }
                finally { setChatBusy(false); }
                break;
            }
            case 'col-details': {
                const details = columns.map(c => {
                    const s = stats[c];
                    if (s.type === 'numeric') return `**\`${c}\`** _(num)_ — range: ${s.min}→${s.max} | avg: ${s.avg} | median: ${s.median} | σ: ${s.stdDev} | sum: ${s.sum} | nulls: ${s.nullCount}`;
                    const tops = s.topValues?.slice(0, 3).map(v => `${v.value}(${v.count})`).join(', ') || 'N/A';
                    return `**\`${c}\`** _(cat)_ — ${s.uniqueCount} unique | top: ${tops} | nulls: ${s.nullCount}`;
                }).join('\n\n');
                push({
                    role: 'ai', text: `📊 **Column Profiles**\n\n${details}`,
                    actions: [{ label: '📋 Summary', id: 'summarize' }, { label: '📈 Outliers', id: 'outliers' }]
                });
                break;
            }
            case 'issues': {
                const issues: string[] = [];
                Object.entries(stats).forEach(([col, s]) => {
                    if (s.nullCount > 0) issues.push(`⚠️ \`${col}\`: **${s.nullCount}** missing (${Math.round((s.nullCount / rows) * 100)}%)`);
                    if (s.type === 'numeric' && s.stdDev && s.avg && s.stdDev > s.avg * 2) issues.push(`📈 \`${col}\`: High variance (σ=${s.stdDev} vs avg=${s.avg})`);
                    if (s.type === 'categorical' && s.uniqueCount === rows) issues.push(`🔑 \`${col}\`: All unique — likely an ID column`);
                    if (s.type === 'categorical' && s.uniqueCount === 1) issues.push(`⚠️ \`${col}\`: Only 1 unique value — constant column`);
                });
                push({
                    role: 'ai',
                    text: issues.length > 0 ? `⚠️ **Data Quality Issues (${issues.length})**\n\n${issues.join('\n')}` : '✅ **No issues found!** Data looks clean.',
                    actions: [{ label: '📋 Summary', id: 'summarize' }, { label: '🔍 Patterns', id: 'patterns' }]
                });
                break;
            }
            case 'outliers': {
                const outlierInfo: string[] = [];
                numCols.forEach(c => {
                    const s = stats[c];
                    if (s.avg !== undefined && s.stdDev !== undefined && s.min !== undefined && s.max !== undefined) {
                        const lower = s.avg - 3 * s.stdDev;
                        const upper = s.avg + 3 * s.stdDev;
                        if (s.min < lower) outlierInfo.push(`📉 \`${c}\`: min **${s.min}** is below 3σ threshold (${Math.round(lower * 100) / 100})`);
                        if (s.max > upper) outlierInfo.push(`📈 \`${c}\`: max **${s.max}** exceeds 3σ threshold (${Math.round(upper * 100) / 100})`);
                        const range = s.max - s.min;
                        const iqr = s.stdDev * 1.35;
                        if (range > iqr * 6) outlierInfo.push(`⚠️ \`${c}\`: Very wide range (**${range}**) — likely outliers present`);
                    }
                });
                push({
                    role: 'ai',
                    text: outlierInfo.length > 0 ? `📈 **Outlier Analysis**\n\n${outlierInfo.join('\n')}\n\n_Based on 3-sigma rule. Values beyond 3 standard deviations from the mean._` : '✅ **No obvious outliers** detected across numeric columns.',
                    actions: [{ label: '⚠️ Issues', id: 'issues' }, { label: '🔗 Correlations', id: 'correlations' }]
                });
                break;
            }
            case 'correlations': {
                setChatBusy(true);
                try {
                    const ctx = numCols.map(c => `${c}: min=${stats[c].min}, max=${stats[c].max}, avg=${stats[c].avg}, std=${stats[c].stdDev}`).join('\n');
                    const res = await apiClient.post('/ai/chat', {
                        message: `Given these numeric columns from "${name}" (${rows} rows):\n${ctx}\n\nIdentify 2-3 likely correlations. Be specific. Also mention which pairs are likely independent.`
                    });
                    push({
                        role: 'ai', text: `🔗 **Correlations**\n\n${res.reply}`,
                        actions: [{ label: '📈 Outliers', id: 'outliers' }, { label: '📋 Summary', id: 'summarize' }]
                    });
                } catch { push({ role: 'ai', text: '⚠️ AI unavailable.' }); }
                finally { setChatBusy(false); }
                break;
            }
            case 'group-by': {
                if (catCols.length === 0) { push({ role: 'ai', text: 'No categorical columns available for grouping.' }); break; }
                const groupCol = catCols[0];
                const s = stats[groupCol];
                const desc = s.topValues?.slice(0, 5).map(v => `  • **${v.value}**: ${v.count} rows (${Math.round((v.count / rows) * 100)}%)`).join('\n') || 'No data';
                push({
                    role: 'ai',
                    text: `📊 **Group By: \`${groupCol}\`**\n\n${desc}\n\n_Showing top 5 groups out of ${s.uniqueCount} unique values._`,
                    actions: [{ label: '📋 Summary', id: 'summarize' }, { label: '🔍 Patterns', id: 'patterns' }]
                });
                break;
            }
            case 'export': { exportCSV(); break; }
        }
    };

    const handleAction = (action: ChatAction) => {
        push({ role: 'user', text: action.label });
        setTimeout(() => doAction(action.id), 50);
    };

    const handleSend = async () => {
        const msg = chatInput.trim();
        if (!msg || chatBusy) return;
        setChatInput('');
        push({ role: 'user', text: msg });

        if (!dsAnalytics) { push({ role: 'ai', text: 'Please select a dataset first.' }); return; }

        const lower = msg.toLowerCase();
        if (lower.includes('summar')) { doAction('summarize'); return; }
        if (lower.includes('pattern') || lower.includes('trend')) { doAction('patterns'); return; }
        if (lower.includes('issue') || lower.includes('quality')) { doAction('issues'); return; }
        if (lower.includes('column') || lower.includes('detail') || lower.includes('profil')) { doAction('col-details'); return; }
        if (lower.includes('correlat')) { doAction('correlations'); return; }
        if (lower.includes('outlier')) { doAction('outliers'); return; }
        if (lower.includes('group')) { doAction('group-by'); return; }
        if (lower.includes('export') || lower.includes('download')) { doAction('export'); return; }

        setChatBusy(true);
        try {
            const ctx = dsAnalytics.columns.map(c => {
                const s = dsAnalytics.stats[c];
                return s.type === 'numeric'
                    ? `${c}(num): min=${s.min}, max=${s.max}, avg=${s.avg}`
                    : `${c}(cat): ${s.uniqueCount} unique, top=${s.topValues?.slice(0, 3).map(v => v.value).join(', ')}`;
            }).join('\n');
            const res = await apiClient.post('/ai/chat', { message: `User asks about "${dsAnalytics.name}" (${dsAnalytics.rows} rows):\n"${msg}"\n\nColumns:\n${ctx}\n\nAnswer concisely with specifics.` });
            push({
                role: 'ai', text: res.reply,
                actions: [{ label: '📋 Summary', id: 'summarize' }, { label: '🔍 Patterns', id: 'patterns' }, { label: '⬇️ Export', id: 'export' }]
            });
        } catch { push({ role: 'ai', text: '⚠️ AI unavailable.' }); }
        finally { setChatBusy(false); }
    };

    /* ── RENDER ── */
    const kpis = platformData?.kpis;
    const da = dsAnalytics;
    const viewStat = da?.stats[viewCol];
    const viewDist = da?.distributions[viewCol];

    return (
        <div className="an-page">
            {/* Header */}
            <div className="an-header">
                <div>
                    <h1>Analytics & Insights</h1>
                    <p>Explore datasets, visualize distributions, and get AI-powered analysis.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <select className="an-ds-select" value={selectedDs} onChange={e => setSelectedDs(e.target.value)}>
                        <option value="">Select dataset...</option>
                        {datasets.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
                    </select>
                    {da && <Button variant="outline" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Download size={14} /> Export</Button>}
                </div>
            </div>

            {/* Platform KPIs */}
            {!pLoading && kpis && (
                <div className="an-stats">
                    <div className="an-stat"><div className="label">Revenue</div><div className="value">${kpis.revenue?.toLocaleString()}</div><div className="sub" style={{ color: 'var(--success-color)' }}>+{kpis.revenueGrowth}%</div></div>
                    <div className="an-stat"><div className="label">Active Users</div><div className="value">{kpis.activeUsers?.toLocaleString()}</div><div className="sub" style={{ color: 'var(--success-color)' }}>+{kpis.usersGrowth}%</div></div>
                    <div className="an-stat"><div className="label">Ingestion Quality</div><div className="value">{kpis.ingestionQuality}%</div><div className="sub">Pipeline pass rate</div></div>
                    <div className="an-stat"><div className="label">Datasets</div><div className="value">{datasets.length}</div><div className="sub">Available</div></div>
                </div>
            )}

            {/* Platform charts when no dataset selected */}
            {!selectedDs && !pLoading && platformData?.revenueTrends?.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <Card style={{ minHeight: '300px' }}>
                        <CardHeader>Revenue Trends</CardHeader>
                        <CardContent style={{ padding: '1.25rem', height: '240px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={platformData.revenueTrends}>
                                    <defs><linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs>
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={v => `$${v / 1000}k`} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#gRev)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card style={{ minHeight: '300px' }}>
                        <CardHeader>Users by Region</CardHeader>
                        <CardContent style={{ padding: '1.25rem', height: '240px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={platformData.regionDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {platformData.regionDistribution.map((_: any, i: number) => <Cell key={i} fill={COLORS[i]} />)}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Empty state */}
            {!selectedDs && (
                <Card style={{ textAlign: 'center', padding: '3rem' }}>
                    <Database size={40} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem' }} />
                    <h3>Select a Dataset to Explore</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: 360, margin: '0.5rem auto 0' }}>Choose a dataset from the dropdown to view column profiling, distributions, outlier detection, and get AI-powered insights.</p>
                </Card>
            )}

            {/* Loading */}
            {dsLoading && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading analytics...</div>}

            {/* ── Dataset Analytics ── */}
            {da && !dsLoading && (
                <>
                    {/* Dataset stats */}
                    <div className="an-stats">
                        <div className="an-stat"><div className="label">Rows</div><div className="value">{da.rows.toLocaleString()}</div></div>
                        <div className="an-stat"><div className="label">Columns</div><div className="value">{da.columns.length}</div></div>
                        <div className="an-stat"><div className="label">Quality</div><div className={`value ${da.qualityScore >= 90 ? 'quality-good' : da.qualityScore >= 70 ? 'quality-ok' : 'quality-bad'}`}>{da.qualityScore}%</div></div>
                        <div className="an-stat"><div className="label">Numeric</div><div className="value">{numCols.length}</div></div>
                        <div className="an-stat"><div className="label">Categorical</div><div className="value">{catCols.length}</div></div>
                    </div>

                    {/* View tabs */}
                    <div className="an-filters" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                            { id: 'overview' as ViewTab, icon: <Eye size={14} />, label: 'Overview' },
                            { id: 'profiling' as ViewTab, icon: <Table size={14} />, label: 'Column Profiling' },
                            { id: 'charts' as ViewTab, icon: <BarChart3 size={14} />, label: 'Visualizations' },
                        ].map(tab => (
                            <button key={tab.id} className={`wf-filter-btn ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Main layout: content + chat */}
                    <div className="an-main">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* OVERVIEW TAB */}
                            {activeTab === 'overview' && (
                                <>
                                    <div className="an-chart-card">
                                        <h3>Column Overview</h3>
                                        <table className="an-col-table">
                                            <thead><tr><th>Column</th><th>Type</th><th>Non-Null</th><th>Nulls</th><th>Unique / Range</th></tr></thead>
                                            <tbody>
                                                {da.columns.map(col => {
                                                    const s = da.stats[col];
                                                    return (
                                                        <tr key={col} onClick={() => { setViewCol(col); setActiveTab('charts'); }} style={{ cursor: 'pointer' }}>
                                                            <td><span className="an-col-name">{s?.type === 'numeric' ? <Hash size={12} /> : <Type size={12} />} {col}</span></td>
                                                            <td><span className={`an-type-badge ${s?.type}`}>{s?.type}</span></td>
                                                            <td>{s?.count}</td>
                                                            <td style={{ color: s?.nullCount ? '#ef4444' : 'var(--success-color)' }}>{s?.nullCount || '✓'}</td>
                                                            <td>{s?.type === 'numeric' ? `${s.min} → ${s.max}` : `${s?.uniqueCount} unique`}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Quick quality overview */}
                                    <div className="an-chart-card">
                                        <h3>Data Quality</h3>
                                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            {da.columns.map(col => {
                                                const s = da.stats[col];
                                                const pct = Math.round(((s.count) / da.rows) * 100);
                                                return (
                                                    <div key={col} style={{ flex: '1 1 120px', minWidth: 120 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                                                            <span style={{ fontWeight: 600 }}>{col}</span>
                                                            <span style={{ color: pct === 100 ? 'var(--success-color)' : 'var(--warning-color)' }}>{pct}%</span>
                                                        </div>
                                                        <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 999, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success-color)' : pct >= 80 ? 'var(--warning-color)' : '#ef4444', borderRadius: 999 }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* PROFILING TAB */}
                            {activeTab === 'profiling' && (
                                <>
                                    {da.columns.map(col => {
                                        const s = da.stats[col];
                                        const dist = da.distributions[col];
                                        const maxCount = dist ? Math.max(...dist.map(d => d.count)) : 1;
                                        return (
                                            <div key={col} className="an-chart-card">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        {s.type === 'numeric' ? <Hash size={14} /> : <Type size={14} />}
                                                        <code>{col}</code>
                                                    </h3>
                                                    <span className={`an-type-badge ${s.type}`}>{s.type}</span>
                                                </div>

                                                {/* Stats row */}
                                                {s.type === 'numeric' ? (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                                        {[['Min', s.min], ['Max', s.max], ['Avg', s.avg], ['Median', s.median], ['StdDev', s.stdDev], ['Sum', s.sum]].map(([k, v]) => (
                                                            <div key={String(k)} style={{ textAlign: 'center', padding: '0.4rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{k}</div>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{v ?? '-'}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                                        {[['Unique', s.uniqueCount], ['Non-Null', s.count], ['Nulls', s.nullCount]].map(([k, v]) => (
                                                            <div key={String(k)} style={{ textAlign: 'center', padding: '0.4rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                                                <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{k}</div>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{v ?? '-'}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Inline distribution bars */}
                                                {dist && (
                                                    <div className="an-dist-bars">
                                                        {dist.map((d, i) => (
                                                            <div key={i} className="an-dist-row">
                                                                <span className="an-dist-label">{d.label}</span>
                                                                <div className="an-dist-bar-bg">
                                                                    <div className="an-dist-bar-fill" style={{ width: `${(d.count / maxCount) * 100}%`, background: COLORS[i % COLORS.length] }} />
                                                                </div>
                                                                <span className="an-dist-count">{d.count}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            )}

                            {/* CHARTS TAB */}
                            {activeTab === 'charts' && (
                                <>
                                    {/* Chart type + column selector */}
                                    <div className="an-chart-card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <h3 style={{ margin: 0 }}>Column Distribution</h3>
                                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                {[
                                                    { id: 'bar' as ChartType, icon: <BarChart3 size={14} /> },
                                                    { id: 'pie' as ChartType, icon: <PieIcon size={14} /> },
                                                    { id: 'line' as ChartType, icon: <TrendingUp size={14} /> },
                                                ].map(ct => (
                                                    <button key={ct.id} className={`wf-filter-btn ${chartType === ct.id ? 'active' : ''}`}
                                                        onClick={() => setChartType(ct.id)} style={{ padding: '0.3rem 0.6rem' }}>{ct.icon}</button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="an-col-pills">
                                            {da.columns.map(c => (
                                                <button key={c} className={`an-col-pill ${viewCol === c ? 'active' : ''}`} onClick={() => setViewCol(c)}>{c}</button>
                                            ))}
                                        </div>

                                        {viewDist && (
                                            <div style={{ height: 280 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    {chartType === 'bar' ? (
                                                        <BarChart data={viewDist}>
                                                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                                                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>{viewDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
                                                        </BarChart>
                                                    ) : chartType === 'pie' ? (
                                                        <PieChart>
                                                            <Pie data={viewDist} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                                                {viewDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                                            </Pie>
                                                            <Tooltip /><Legend />
                                                        </PieChart>
                                                    ) : (
                                                        <LineChart data={viewDist}>
                                                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                                                            <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
                                                        </LineChart>
                                                    )}
                                                </ResponsiveContainer>
                                            </div>
                                        )}

                                        {viewStat?.type === 'numeric' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem', marginTop: '0.75rem' }}>
                                                {[['Min', viewStat.min], ['Max', viewStat.max], ['Avg', viewStat.avg], ['Median', viewStat.median], ['StdDev', viewStat.stdDev]].map(([k, v]) => (
                                                    <div key={String(k)} style={{ textAlign: 'center', padding: '0.4rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{k}</div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{v}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Column comparison */}
                                    {numCols.length >= 2 && (
                                        <div className="an-chart-card">
                                            <h3>Compare Columns</h3>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                                                <select className="an-ds-select" value={viewCol} onChange={e => setViewCol(e.target.value)} style={{ minWidth: 140 }}>
                                                    {numCols.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                                <span style={{ color: 'var(--text-secondary)' }}>vs</span>
                                                <select className="an-ds-select" value={compareCol} onChange={e => setCompareCol(e.target.value)} style={{ minWidth: 140 }}>
                                                    {numCols.filter(c => c !== viewCol).map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                {[viewCol, compareCol].filter(Boolean).map(col => {
                                                    const s = da.stats[col];
                                                    return s?.type === 'numeric' ? (
                                                        <div key={col} style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                                            <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>{col}</div>
                                                            <div style={{ fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem' }}>
                                                                <span>Min: <strong>{s.min}</strong></span><span>Max: <strong>{s.max}</strong></span>
                                                                <span>Avg: <strong>{s.avg}</strong></span><span>Median: <strong>{s.median}</strong></span>
                                                                <span>StdDev: <strong>{s.stdDev}</strong></span><span>Sum: <strong>{s.sum}</strong></span>
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* ── AI Chat Panel ── */}
                        <div className="an-chat">
                            <div className="an-chat-header"><Sparkles size={16} /> AI Analytics Assistant</div>
                            <div className="an-chat-body">
                                {chatMsgs.map((msg, i) => (
                                    <div key={i}>
                                        <div className={`an-chat-msg ${msg.role}`}>{msg.text}</div>
                                        {msg.actions && msg.role === 'ai' && (
                                            <div className="an-chat-actions">
                                                {msg.actions.map(a => (
                                                    <button key={a.id} className="an-chat-action-btn" onClick={() => handleAction(a)} disabled={chatBusy}>{a.label}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {chatBusy && <div className="an-chat-msg ai">Analyzing...</div>}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="an-chat-input">
                                <input placeholder={dsAnalytics ? 'Ask about your data...' : 'Select a dataset first...'} value={chatInput}
                                    onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} disabled={chatBusy || !da} />
                                <Button variant="primary" onClick={handleSend} disabled={chatBusy || !da} style={{ padding: '0.5rem' }}><Send size={16} /></Button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
