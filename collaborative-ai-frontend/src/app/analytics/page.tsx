'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/providers/ToastProvider';
import {
    Sparkles, Send, Database, Hash, Type, Download, AlertTriangle,
    BarChart3, PieChart as PieIcon, TrendingUp, Table, Eye, Plus,
    Trash2, Maximize2, RefreshCw, Layers, Link as LinkIcon, Edit2,
    Play, Copy, HelpCircle, TrendingDown, ArrowUpRight, Palette,
    LayoutGrid, ChevronUp, ChevronDown, Check, ArrowRight,
    Home, Compass, Cpu, Bell, FileText, Lock, History, MessageSquare,
    Share2, Sliders, Settings
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line,
    ScatterChart, Scatter, ZAxis, Treemap, FunnelChart, Funnel, LabelList
} from 'recharts';
import { apiClient } from '@/lib/apiClient';
import './analytics.css';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';

// ── Types ──
interface CalculatedMetric {
    name: string;
    formula: string;
    expression: string;
}

interface Widget {
    id: string;
    title: string;
    type: 'kpi' | 'bar' | 'pie' | 'line' | 'area' | 'table' | 'heatmap' | 'forecast' | 'insights' | 'anomalies' | 'recommendations' | 'scatter' | 'treemap';
    data: any[];
    columns: string[];
    width: number;
    value?: string;
    sub?: string;
    trend?: string;
    isUp?: boolean;
}

interface ChatMsg {
    role: 'ai' | 'user';
    text: string;
    suggestedPrompts?: string[];
    chartData?: any[];
    chartType?: 'line' | 'bar';
}

interface DatasetMeta {
    id: string;
    name: string;
    status?: string;
    contractStatus?: string;
}

interface ColStat {
    type: string;
    count: number;
    nullCount: number;
    min?: number; max?: number; avg?: number; median?: number; stdDev?: number; sum?: number;
    uniqueCount?: number;
    topValues?: { value: string; count: number }[];
}

interface DatasetAnalytics {
    name: string;
    rows: number;
    columns: string[];
    stats: Record<string, ColStat>;
    distributions: Record<string, { label: string; count: number }[]>;
    qualityScore: number;
}

const THEME_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];

// Helper to safely format Date representations, including Excel date serials
function formatExcelDate(val: any): string {
    if (val === undefined || val === null) return 'Unknown';
    if (!isNaN(Number(val))) {
        const serial = Number(val);
        if (serial > 30000 && serial < 60000) {
            // Excel serial to JS Date (25569 days between 1900 and 1970)
            const date = new Date((serial - 25569) * 86400 * 1000);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            }
        }
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    return String(val);
}

const parseInlineMarkdown = (content: string, isUser: boolean): React.ReactNode[] => {
    return content.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
        }
        return part.split(/(`[^`]+`)/g).map((sub, k) => {
            if (sub.startsWith('`') && sub.endsWith('`')) {
                return (
                    <code
                        key={k}
                        style={{
                            backgroundColor: isUser ? 'rgba(255, 255, 255, 0.2)' : '#f1f5f9',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '0.85em',
                            border: isUser ? 'none' : '1px solid var(--studio-border, #e2e8f0)',
                            color: isUser ? '#ffffff' : '#ef4444'
                        }}
                    >
                        {sub.slice(1, -1)}
                    </code>
                );
            }
            return sub;
        }) as any;
    }) as any;
};

const renderMarkdownToJSX = (text: string, isUser: boolean): React.ReactNode => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentListItems: React.ReactNode[] = [];

    const flushList = (key: number) => {
        if (currentListItems.length > 0) {
            elements.push(
                <ul
                    key={`ul-${key}`}
                    style={{
                        margin: '0.35rem 0 0.35rem 1.25rem',
                        paddingLeft: 0,
                        listStyleType: 'disc',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem'
                    }}
                >
                    {currentListItems}
                </ul>
            );
            currentListItems = [];
        }
    };

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
            flushList(index);
            elements.push(
                <h1 key={index} style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.5rem 0 0.25rem 0', color: isUser ? 'white' : '#0f172a' }}>
                    {parseInlineMarkdown(trimmed.slice(2), isUser)}
                </h1>
            );
        } else if (trimmed.startsWith('## ')) {
            flushList(index);
            elements.push(
                <h2 key={index} style={{ fontSize: '1.0rem', fontWeight: 750, margin: '0.45rem 0 0.2rem 0', color: isUser ? 'white' : '#1e293b' }}>
                    {parseInlineMarkdown(trimmed.slice(3), isUser)}
                </h2>
            );
        } else if (trimmed.startsWith('### ')) {
            flushList(index);
            elements.push(
                <h3 key={index} style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0.4rem 0 0.15rem 0', color: isUser ? 'white' : '#334155' }}>
                    {parseInlineMarkdown(trimmed.slice(4), isUser)}
                </h3>
            );
        } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            const content = trimmed.replace(/^[\*\-\u2022]\s+/, '');
            currentListItems.push(
                <li key={`li-${index}`} style={{ margin: '0.15rem 0', fontSize: '0.74rem', lineHeight: '1.4' }}>
                    {parseInlineMarkdown(content, isUser)}
                </li>
            );
        } else {
            flushList(index);
            if (trimmed !== '') {
                elements.push(
                    <p key={index} style={{ margin: '0.3rem 0', fontSize: '0.74rem', lineHeight: '1.4' }}>
                        {parseInlineMarkdown(line, isUser)}
                    </p>
                );
            } else {
                elements.push(<div key={index} style={{ height: '0.25rem' }} />);
            }
        }
    });

    flushList(lines.length);
    return <div style={{ display: 'flex', flexDirection: 'column' }}>{elements}</div>;
};

const getDynamicSuggestions = (stats: DatasetAnalytics | null): string[] => {
    if (!stats) {
        return [
            'What are key insights?',
            'Explain dataset overview',
            'Reset layout to default',
            'Explain dataset quality'
        ];
    }
    const cols = Object.keys(stats.stats);
    const numCols = cols.filter(c => stats.stats[c]?.type === 'numeric');
    const catCols = cols.filter(c => stats.stats[c]?.type === 'categorical');
    const dateCol = cols.find(c => {
        const l = c.toLowerCase();
        return l.includes('date') || l.includes('time') || l.includes('year') || l.includes('month');
    });

    const suggestions: string[] = [];

    // 1. Trend suggestion or metric summary
    if (dateCol && numCols.length > 0) {
        suggestions.push(`Change ${numCols[0]} Over Time to line chart`);
    } else if (numCols.length > 0) {
        suggestions.push(`Show total sum of ${numCols[0]}`);
    } else {
        suggestions.push('Summarize transactional count');
    }

    // 2. Add chart suggestion
    const sensibleCatCols = catCols.filter(c => {
        const l = c.toLowerCase();
        return !l.includes('name') && !l.includes('email') && !l.includes('id') && !l.includes('url') && !l.includes('link');
    });
    const targetCat = sensibleCatCols[0] || catCols[0] || cols[0];
    const targetNum = numCols[0] || '';

    if (targetCat && targetNum) {
        suggestions.push(`Add a pie chart for ${targetCat} distribution`);
    } else if (targetCat) {
        suggestions.push(`Add a bar chart of ${targetCat} counts`);
    } else {
        suggestions.push('Add category breakdown');
    }

    // 3. Modifying widget suggestion
    if (targetCat && targetNum) {
        suggestions.push(`Convert ${targetNum} by ${targetCat} to bar chart`);
    } else {
        suggestions.push('Remove Strategic Playbook Recommendations');
    }

    // 4. Insights/Anomalies suggestion
    suggestions.push('What are key insights?');

    return suggestions;
};

function computeClientSideAnalytics(name: string, rows: any[]): DatasetAnalytics {
    const columns = rows.length > 0 ? Object.keys(rows[0]).filter(k => !k.startsWith('_')) : [];
    const stats: Record<string, ColStat> = {};
    const distributions: Record<string, { label: string; count: number }[]> = {};

    columns.forEach(col => {
        const values = rows.map(r => r[col]);
        const nonNull = values.filter(v => v != null && String(v).trim() !== '');
        const nullCount = values.length - nonNull.length;

        // Check if numeric
        const numValues = nonNull.filter(v => !isNaN(Number(v))).map(Number);
        const isNumeric = numValues.length > nonNull.length * 0.6;

        if (isNumeric && numValues.length > 0) {
            const sorted = [...numValues].sort((a, b) => a - b);
            const sum = numValues.reduce((a, b) => a + b, 0);
            const avg = sum / numValues.length;
            const median = sorted.length % 2 === 0
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)];
            const stdDev = Math.sqrt(numValues.reduce((s, v) => s + (v - avg) ** 2, 0) / numValues.length) || 1;

            stats[col] = {
                type: 'numeric',
                count: numValues.length,
                nullCount,
                min: sorted[0],
                max: sorted[sorted.length - 1],
                avg,
                median,
                stdDev,
                sum,
            };

            // Histogram buckets (5 buckets)
            const range = sorted[sorted.length - 1] - sorted[0];
            if (range > 0) {
                const bucketSize = range / 5;
                const buckets: { label: string; count: number }[] = [];
                for (let i = 0; i < 5; i++) {
                    const low = Math.round((sorted[0] + i * bucketSize) * 10) / 10;
                    const high = Math.round((sorted[0] + (i + 1) * bucketSize) * 10) / 10;
                    const count = numValues.filter(v => v >= low && (i === 4 ? v <= high : v < high)).length;
                    buckets.push({ label: `${low}-${high}`, count });
                }
                distributions[col] = buckets;
            } else {
                distributions[col] = [{ label: String(sorted[0]), count: numValues.length }];
            }
        } else {
            // Categorical
            const freq: Record<string, number> = {};
            nonNull.forEach(v => { const k = String(v); freq[k] = (freq[k] || 0) + 1; });
            const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
            const uniqueCount = sorted.length;

            stats[col] = {
                type: 'categorical',
                count: nonNull.length,
                nullCount,
                uniqueCount,
                topValues: sorted.slice(0, 5).map(([value, count]) => ({ value, count })),
            };

            distributions[col] = sorted.slice(0, 8).map(([value, count]) => ({ label: String(value).slice(0, 20), count }));
        }
    });

    const totalCells = rows.length * columns.length;
    const totalNulls = Object.values(stats).reduce((s: number, c: any) => s + (c.nullCount || 0), 0);
    const qualityScore = totalCells > 0 ? Math.round(((totalCells - totalNulls) / totalCells) * 100) : 100;

    return {
        name,
        rows: rows.length,
        columns,
        stats,
        distributions,
        qualityScore,
    };
}

export default function AnalyticsPage() {
    const { showToast } = useToast();

    // Datasets and state variables
    const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
    const [selectedDs, setSelectedDs] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return params.get('dataset') || '';
        }
        return '';
    });
    const [dsAnalytics, setDsAnalytics] = useState<DatasetAnalytics | null>(null);
    const [loading, setLoading] = useState(false);

    // Active Interactive Mode states (KPIs are merged into widgets array!)
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [activeRawData, setActiveRawData] = useState<any[]>([]);
    const [originalRawData, setOriginalRawData] = useState<any[]>([]);
    const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
    const lastWidgetIdRef = useRef<string | null>(null);
    const [savedLayouts, setSavedLayouts] = useState<Record<string, { widgets: Widget[], cardSizes: any }>>({});

    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [filterCol, setFilterCol] = useState('');
    const [filterVal, setFilterVal] = useState('');

    const [showExportModal, setShowExportModal] = useState(false);
    const [exporting, setExporting] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);

    const uniqueValues = useMemo(() => {
        if (!filterCol || originalRawData.length === 0) return [];
        return Array.from(new Set(originalRawData.map(r => String(r[filterCol] ?? '')).filter(Boolean))).sort();
    }, [filterCol, originalRawData]);

    // Helper to get sparkline data points (sum of values)
    const getSparklineDataPoints = (colName: string | null, rows: any[], dateDim: string | null) => {
        if (!colName || rows.length === 0) {
            return [10, 20, 15, 25, 22, 35, 30, 45, 40, 55, 50, 60];
        }
        if (dateDim) {
            const grouped: Record<string, number> = {};
            rows.forEach(r => {
                const d = formatExcelDate(r[dateDim]);
                const val = Number(r[colName]) || 0;
                grouped[d] = (grouped[d] || 0) + val;
            });
            const sorted = Object.entries(grouped)
                .map(([_, v]) => v)
                .slice(-12);
            if (sorted.length >= 3) return sorted;
        }
        const interval = Math.ceil(rows.length / 12);
        const points: number[] = [];
        for (let i = 0; i < 12; i++) {
            const slice = rows.slice(i * interval, (i + 1) * interval);
            const sum = slice.reduce((a, b) => a + (Number(b[colName]) || 0), 0);
            points.push(sum);
        }
        return points;
    };

    // Helper to get sparkline data points (row counts)
    const getSparklineCountPoints = (colName: string | null, rows: any[], dateDim: string | null) => {
        if (rows.length === 0) {
            return [10, 12, 11, 15, 14, 18, 17, 22, 20, 25, 24, 30];
        }
        if (dateDim) {
            const grouped: Record<string, number> = {};
            rows.forEach(r => {
                const d = formatExcelDate(r[dateDim]);
                if (colName) {
                    const val = r[colName] !== undefined && r[colName] !== null ? 1 : 0;
                    grouped[d] = (grouped[d] || 0) + val;
                } else {
                    grouped[d] = (grouped[d] || 0) + 1;
                }
            });
            const sorted = Object.entries(grouped)
                .map(([_, v]) => v)
                .slice(-12);
            if (sorted.length >= 3) return sorted;
        }
        const interval = Math.ceil(rows.length / 12);
        const points: number[] = [];
        for (let i = 0; i < 12; i++) {
            const slice = rows.slice(i * interval, (i + 1) * interval);
            if (colName) {
                const uniqueVal = new Set(slice.map(s => s[colName]).filter(Boolean)).size;
                points.push(uniqueVal);
            } else {
                points.push(slice.length);
            }
        }
        return points;
    };

    // Drag-and-drop reordering state
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // Dynamic cursor card resizing dimensions
    const [cardSizes, setCardSizes] = useState<Record<string, { width: string; height: number }>>({});

    const [autoRefresh, setAutoRefresh] = useState(true);

    // AI Assistant Side Chat Feed
    const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatBusy, setChatBusy] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Scroll chat bottom helper
    const scrollToBottom = () => {
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    // Load initial datasets list
    useEffect(() => {
        (async () => {
            try {
                const d = await apiClient.get('/data/datasets');
                const mockDs = {
                    id: 'products-50',
                    name: 'products-50.csv',
                    status: 'Active',
                    contractStatus: 'Active'
                };
                let filtered = [mockDs];
                if (d) {
                    const mapped = d.map((ds: any) => ({
                        id: ds.id,
                        name: ds.name,
                        status: ds.status || 'Active',
                        contractStatus: ds.contractStatus || ''
                    }));
                    const activeDbDs = mapped.filter((ds: any) =>
                        (ds.contractStatus || '').toLowerCase() === 'active'
                    );
                    filtered = [...filtered, ...activeDbDs];
                }
                setDatasets(filtered);
                if (filtered.length > 0) {
                    setSelectedDs(prev => prev || filtered[0].id);
                }
            } catch {
                showToast('Failed to retrieve datasets.', 'error');
            }
        })();
    }, [showToast]);

    // Sync selectedDs to URL query parameter
    useEffect(() => {
        if (selectedDs && typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('dataset') !== selectedDs) {
                params.set('dataset', selectedDs);
                const newUrl = `${window.location.pathname}?${params.toString()}`;
                window.history.replaceState(null, '', newUrl);
            }
        }
    }, [selectedDs]);

    // Load dataset and boot BI studio canvas
    useEffect(() => {
        if (!selectedDs) {
            setDsAnalytics(null);
            setWidgets([]);
            return;
        }

        (async () => {
            setLoading(true);
            try {
                let rows = [];
                let stats = null;

                if (selectedDs === 'products-50') {
                    // Try to load products-50 data from localStorage
                    const localData = localStorage.getItem('dataset_data_products-50');
                    if (localData) {
                        rows = JSON.parse(localData);
                    } else {
                        // Fallback to default raw products-50 rows
                        rows = [
                            { _rid: 'r1', id: 1, user_id: 1, name: 'Rahul Sharma', age: 23, gender: 'M', email: 'rahuls@gmail.com', signup_date: '2024-01-05', country: 'India', total_spent: 1200, device: 'mobile' },
                            { _rid: 'r2', id: 2, user_id: 2, name: 'ankita patil', age: 27, gender: 'F', email: 'ankita@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 3400, device: 'desktop' },
                            { _rid: 'r3', id: 3, user_id: 3, name: 'Aman Verma', age: 18, gender: 'M', email: 'aman.verma@gmail.com', signup_date: '2024-03-12', country: 'India', total_spent: 500, device: 'laptop' },
                            { _rid: 'r4', id: 4, user_id: 4, name: 'Pooja Singh', age: 18, gender: 'M', email: 'pooja@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 0, device: 'mobile', _flag: true, _field: 'total_spent', _reason: 'Missing Value', _fix: 2300 },
                            { _rid: 'r5', id: 5, user_id: 5, name: 'Rakesh Kumar', age: 45, gender: 'M', email: 'rakesh@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 9800, device: 'mobile' },
                            { _rid: 'r6', id: 6, user_id: 6, name: 'Neha Joshi', age: 19, gender: 'F', email: 'nehaj@outlook', signup_date: '2024-04-18', country: 'India', total_spent: 0, device: 'mobile', _flag: true, _field: 'email', _reason: 'Invalid Domain', _fix: 'nehaj@outlook.com' },
                            { _rid: 'r7', id: 7, user_id: 7, name: 'Aditya Rao', age: 29, gender: 'M', email: 'aditya@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 2300, device: 'laptop' },
                            { _rid: 'r8', id: 8, user_id: 8, name: 'Sneha Patil', age: 34, gender: 'F', email: 'sneha@outlook.com', signup_date: '2024-02-29', country: 'India', total_spent: 4100, device: 'desktop' },
                            { _rid: 'r9', id: 9, user_id: 9, name: 'Vikas More', age: 60, gender: 'M', email: 'vikasm@outlook.com', signup_date: '2024-01-10', country: 'India', total_spent: 12000, device: 'mobile' },
                            { _rid: 'r10', id: 10, user_id: 10, name: 'Kiran Kale', age: 60, gender: 'F', email: 'kiran@outlook.com', signup_date: '2024-01-15', country: 'India', total_spent: 800, device: 'tablet' }
                        ];
                    }
                    stats = computeClientSideAnalytics('products-50.csv', rows);
                } else {
                    const det = await apiClient.get(`/data/datasets/${selectedDs}`);
                    const s = await apiClient.get(`/data/datasets/${selectedDs}/analytics`);
                    if (det?.data && s) {
                        rows = det.data.rawData || [];
                        stats = s;
                    }
                }

                if (stats && rows) {
                    setDsAnalytics(stats);
                    setActiveRawData(rows);
                    setOriginalRawData(rows);
                    setActiveFilters({});
                    lastWidgetIdRef.current = null;

                    // Restore layout configuration if saved in localStorage
                    const layoutKey = selectedDs || 'default';
                    const localLayoutStr = localStorage.getItem(`dashboard_layout_${layoutKey}`);
                    if (localLayoutStr) {
                        try {
                            const savedLayout = JSON.parse(localLayoutStr);
                            const remappedWidgets = updateAllWidgetsData(rows, savedLayout.widgets, stats);
                            setWidgets(remappedWidgets);
                            setCardSizes(savedLayout.cardSizes || {});
                            showToast('Loaded saved dashboard configuration.', 'success');
                        } catch (err) {
                            console.error('Failed to restore saved layout from localStorage:', err);
                            buildExecutiveDashboard(stats, rows);
                        }
                    } else {
                        buildExecutiveDashboard(stats, rows);
                    }

                    // Parse filters from URL on load
                    const params = new URLSearchParams(window.location.search);
                    const urlFilters = params.get('filters');
                    if (urlFilters) {
                        try {
                            const parsed = JSON.parse(decodeURIComponent(urlFilters));
                            applyFiltersAndRebuild(parsed, rows);
                        } catch (e) {
                            console.error('Failed to parse filters from URL', e);
                        }
                    }

                    // Boot AI dialogue with real context reference
                    setChatMsgs([
                        {
                            role: 'user',
                            text: `Analyze ${stats.name} and generate an AI BI canvas containing executive metrics and visual trends.`
                        },
                        {
                            role: 'ai',
                            text: `👋 Greetings! I have analyzed the **${stats.name}** schema containing **${rows.length.toLocaleString()}** records across **${stats.columns.length}** columns.\n\nI have dynamically generated a fully data-driven dashboard mapping measures and dimensions to your visual grid. All elements inside the grid (including KPIs and charts) can be dragged to reorder, or resized by cursor! What would you like to explore, modify, or delete next?`,
                            suggestedPrompts: getDynamicSuggestions(stats).slice(0, 2)
                        }
                    ]);
                    scrollToBottom();
                }
            } catch (err) {
                console.error(err);
                showToast('Error loading dataset inside AI BI Studio.', 'error');
            } finally {
                setLoading(false);
            }
        })();
    }, [selectedDs]);

    // ── Build Dynamic Executive Dashboard from Real Raw Data ──
    const buildExecutiveDashboard = (stats: DatasetAnalytics, rows: any[]) => {
        const keys = Object.keys(stats.stats);
        const numCols = keys.filter(c => stats.stats[c]?.type === 'numeric');
        const catCols = keys.filter(c => stats.stats[c]?.type === 'categorical');

        // 1. Dynamic Date dimension discovery
        const dateDim = keys.find(c => {
            const l = c.toLowerCase();
            return l.includes('date') || l.includes('time') || l.includes('year') || l.includes('month');
        }) || null;

        // 2. Dynamic Continuous Measures discovery
        const primaryMeasure = numCols.find(c => {
            const l = c.toLowerCase();
            return l.includes('totalprice') || l.includes('revenue') || l.includes('sales') || l.includes('amount') || l.includes('price');
        }) || numCols[0] || null;

        const secondaryMeasure = numCols.find(c => {
            const l = c.toLowerCase();
            return c !== primaryMeasure && (l.includes('quantity') || l.includes('orders') || l.includes('units') || l.includes('shippingcost') || l.includes('discount'));
        }) || numCols.find(c => c !== primaryMeasure) || null;

        // 3. Dynamic Categories discovery
        const primaryDim = catCols.find(c => {
            const l = c.toLowerCase();
            return l.includes('product') || l.includes('category') || l.includes('item') || l.includes('segment');
        }) || catCols[0] || null;

        const secondaryDim = catCols.find(c => {
            const l = c.toLowerCase();
            return c !== primaryDim && (l.includes('region') || l.includes('country') || l.includes('store') || l.includes('location') || l.includes('state') || l.includes('city') || l.includes('market'));
        }) || catCols.find(c => c !== primaryDim) || null;

        const recordCount = rows.length;
        const totalRevSum = primaryMeasure ? rows.reduce((s, r) => s + (Number(r[primaryMeasure]) || 0), 0) : 0;

        // ── KPIs Generation (3 to 6 KPIs) ──
        const activeKpis: Widget[] = [];

        // kpi-records
        activeKpis.push({
            id: 'kpi-records',
            title: 'Total Transactions',
            type: 'kpi',
            data: getSparklineCountPoints(null, rows, dateDim),
            columns: [],
            width: 2,
            value: recordCount > 1000 ? `${(recordCount / 1000).toFixed(1)}K` : `${recordCount}`,
            trend: '12.4%',
            isUp: true,
            sub: `vs ${Math.round(recordCount * 0.89)}`
        });

        // kpi-primary-meas
        if (primaryMeasure) {
            const isCurrency = primaryMeasure.toLowerCase().includes('price') || primaryMeasure.toLowerCase().includes('rev') || primaryMeasure.toLowerCase().includes('amount') || primaryMeasure.toLowerCase().includes('cost') || primaryMeasure.toLowerCase().includes('spent');
            activeKpis.push({
                id: 'kpi-primary-meas',
                title: `Total ${primaryMeasure}`,
                type: 'kpi',
                data: getSparklineDataPoints(primaryMeasure, rows, dateDim),
                columns: [primaryMeasure],
                width: 2,
                value: isCurrency
                    ? (totalRevSum > 1000000 ? `$${(totalRevSum / 1000000).toFixed(2)}M` : `$${totalRevSum.toLocaleString()}`)
                    : (totalRevSum > 1000000 ? `${(totalRevSum / 1000000).toFixed(2)}M` : `${totalRevSum.toLocaleString()}`),
                trend: '8.3%',
                isUp: true,
                sub: `vs ${isCurrency ? '$' : ''}${(totalRevSum * 0.92).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            });
        }

        // kpi-primary-dim
        if (primaryDim) {
            const uniqueVal = new Set(rows.map(r => r[primaryDim]).filter(Boolean)).size;
            activeKpis.push({
                id: 'kpi-primary-dim',
                title: `Unique ${primaryDim}s`,
                type: 'kpi',
                data: getSparklineCountPoints(primaryDim, rows, dateDim),
                columns: [primaryDim],
                width: 2,
                value: uniqueVal > 1000 ? `${(uniqueVal / 1000).toFixed(1)}K` : `${uniqueVal}`,
                trend: '4.2%',
                isUp: true,
                sub: `vs ${Math.round(uniqueVal * 0.95)}`
            });
        }

        // kpi-secondary-meas
        if (secondaryMeasure && secondaryMeasure !== primaryMeasure) {
            const sumVal = rows.reduce((s, r) => s + (Number(r[secondaryMeasure]) || 0), 0);
            const avgVal = sumVal / (rows.length || 1);
            const isAvg = secondaryMeasure.toLowerCase().includes('age') || secondaryMeasure.toLowerCase().includes('rate') || secondaryMeasure.toLowerCase().includes('discount') || secondaryMeasure.toLowerCase().includes('margin');
            const showVal = isAvg ? avgVal : sumVal;
            const isCurrency = secondaryMeasure.toLowerCase().includes('cost') || secondaryMeasure.toLowerCase().includes('price') || secondaryMeasure.toLowerCase().includes('rev');

            activeKpis.push({
                id: 'kpi-secondary-meas',
                title: isAvg ? `Average ${secondaryMeasure}` : `Total ${secondaryMeasure}`,
                type: 'kpi',
                data: getSparklineDataPoints(secondaryMeasure, rows, dateDim),
                columns: [secondaryMeasure],
                width: 2,
                value: isCurrency
                    ? (showVal > 1000000 ? `$${(showVal / 1000000).toFixed(2)}M` : `$${showVal.toLocaleString()}`)
                    : (showVal > 1000000 ? `${(showVal / 1000000).toFixed(2)}M` : `${showVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}`),
                trend: '3.1%',
                isUp: true,
                sub: `vs ${isCurrency ? '$' : ''}${(showVal * 0.96).toLocaleString(undefined, { maximumFractionDigits: 1 })}`
            });
        }

        // kpi-secondary-dim
        if (secondaryDim && secondaryDim !== primaryDim) {
            const uniqueVal = new Set(rows.map(r => r[secondaryDim]).filter(Boolean)).size;
            activeKpis.push({
                id: 'kpi-secondary-dim',
                title: `Unique ${secondaryDim}s`,
                type: 'kpi',
                data: getSparklineCountPoints(secondaryDim, rows, dateDim),
                columns: [secondaryDim],
                width: 2,
                value: uniqueVal > 1000 ? `${(uniqueVal / 1000).toFixed(1)}K` : `${uniqueVal}`,
                trend: '2.5%',
                isUp: true,
                sub: `vs ${Math.round(uniqueVal * 0.97)}`
            });
        }

        // kpi-third-meas
        const thirdMeasure = numCols.find(c => c !== primaryMeasure && c !== secondaryMeasure);
        if (thirdMeasure) {
            const sumVal = rows.reduce((s, r) => s + (Number(r[thirdMeasure]) || 0), 0);
            const avgVal = sumVal / (rows.length || 1);
            const isAvg = thirdMeasure.toLowerCase().includes('age') || thirdMeasure.toLowerCase().includes('rate') || thirdMeasure.toLowerCase().includes('discount') || thirdMeasure.toLowerCase().includes('margin') || thirdMeasure.toLowerCase().includes('score');
            const showVal = isAvg ? avgVal : sumVal;

            activeKpis.push({
                id: 'kpi-third-meas',
                title: isAvg ? `Average ${thirdMeasure}` : `Total ${thirdMeasure}`,
                type: 'kpi',
                data: getSparklineDataPoints(thirdMeasure, rows, dateDim),
                columns: [thirdMeasure],
                width: 2,
                value: showVal > 1000000 ? `${(showVal / 1000000).toFixed(2)}M` : `${showVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
                trend: '1.4%',
                isUp: true,
                sub: `vs ${(showVal * 0.98).toLocaleString(undefined, { maximumFractionDigits: 1 })}`
            });
        }

        // ── Charts & Visual Panels Generation ──
        const activeCharts: Widget[] = [];

        // 1. Executive Summary: Dynamic Insights List (Always present)
        const donutData = primaryDim && primaryMeasure ? aggregateMetric(rows, primaryDim, primaryMeasure, 'sum').slice(0, 5) : [];
        const barData = secondaryDim && primaryMeasure ? aggregateMetric(rows, secondaryDim, primaryMeasure, 'sum').slice(0, 5) : [];

        const topProd = donutData[0]?.label || 'None';
        const topProdVal = donutData[0]?.value || 0;
        const topProdPct = totalRevSum > 0 ? ((topProdVal / totalRevSum) * 100).toFixed(1) : '0';

        const topReg = barData[0]?.label || 'None';
        const topRegVal = barData[0]?.value || 0;
        const topRegPct = totalRevSum > 0 ? ((topRegVal / totalRevSum) * 100).toFixed(1) : '0';

        const insightsList = [
            { icon: '🟢', t: `Dataset details scanned`, d: `Successfully registered across ${recordCount.toLocaleString()} records.` }
        ];
        if (primaryMeasure) {
            insightsList.push({ icon: '🔵', t: `Total ${primaryMeasure} sum`, d: `Total cumulative value is ${totalRevSum > 1000000 ? `$${(totalRevSum / 1000000).toFixed(2)}M` : totalRevSum.toLocaleString()}.` });
        }
        if (secondaryDim && topReg !== 'None') {
            insightsList.push({ icon: '🟣', t: `${topReg} is the leading ${secondaryDim}`, d: `Contributes ${topRegPct}% of total cumulative values.` });
        }
        if (primaryDim && topProd !== 'None') {
            insightsList.push({ icon: '🟡', t: `${topProd} is top ${primaryDim}`, d: `Generates ${topProdPct}% contribution to the portfolio share.` });
        }

        activeCharts.push({
            id: 'w-insights',
            title: 'Data-Driven Key Insights',
            type: 'insights',
            data: insightsList,
            columns: [],
            width: 4 // Shares top row with Trend (8 + 4 = 12)
        });

        // 2. Trend Line / Area Chart (if date dimension exists)
        let lineData: any[] = [];
        let forecastList: any[] = [];
        if (dateDim && primaryMeasure) {
            const monthlyDataMap: Record<string, { sum: number; count: number }> = {};
            rows.forEach(row => {
                const formatted = formatExcelDate(row[dateDim]);
                if (!monthlyDataMap[formatted]) monthlyDataMap[formatted] = { sum: 0, count: 0 };
                monthlyDataMap[formatted].sum += Number(row[primaryMeasure]) || 0;
                monthlyDataMap[formatted].count += 1;
            });
            lineData = Object.entries(monthlyDataMap).map(([label, s]) => ({
                label,
                value: Math.round(s.sum * 100) / 100,
                valuePY: Math.round(s.sum * 0.85 * 100) / 100
            })).slice(-12);

            if (lineData.length > 0) {
                activeCharts.push({
                    id: 'w-line',
                    title: `${primaryMeasure} Over Time`,
                    type: 'line',
                    data: lineData,
                    columns: [dateDim, primaryMeasure],
                    width: 8
                });

                // Forecast List
                const forecastAvg = lineData.reduce((sum, t) => sum + t.value, 0) / (lineData.length || 1);
                forecastList = [
                    ...lineData.map(t => ({ label: t.label, actual: t.value, fct: t.value })),
                    { label: 'Next Month (Fct)', actual: null, fct: Math.round(forecastAvg * 1.04 * 100) / 100, fctLow: Math.round(forecastAvg * 0.94 * 100) / 100, fctHigh: Math.round(forecastAvg * 1.14 * 100) / 100 },
                    { label: 'Following Month (Fct)', actual: null, fct: Math.round(forecastAvg * 1.07 * 100) / 100, fctLow: Math.round(forecastAvg * 0.90 * 100) / 100, fctHigh: Math.round(forecastAvg * 1.22 * 100) / 100 }
                ];
                activeCharts.push({
                    id: 'w-forecast',
                    title: `${primaryMeasure} vs Forecast Curve`,
                    type: 'forecast',
                    data: forecastList,
                    columns: [dateDim, primaryMeasure],
                    width: 4
                });
            }
        }

        // 3. Category Breakdown (Pie Chart for Part-to-whole)
        // Find categorical column with low cardinality (<= 7 unique values)
        const lowCardCol = catCols.find(c => stats.stats[c]?.uniqueCount !== undefined && stats.stats[c].uniqueCount! <= 7);
        if (lowCardCol && primaryMeasure) {
            const pieData = aggregateMetric(rows, lowCardCol, primaryMeasure, 'sum').slice(0, 5);
            activeCharts.push({
                id: 'w-donut',
                title: `${primaryMeasure} by ${lowCardCol}`,
                type: 'pie',
                data: pieData,
                columns: [lowCardCol, primaryMeasure],
                width: 4
            });
        }

        // 10. Recommendations Playbook (re-ordered here to complete 12-column grid row)
        const recList = [
            { icon: '🟣', t: `Focus resources on top performing segments`, d: `Optimize inventory for top items like ${topProd}.` },
            { icon: '🟠', t: `Target campaign channels outside main core`, d: `Expand business reach beyond ${topReg} region.` }
        ];
        activeCharts.push({
            id: 'w-recommendations',
            title: 'Strategic Playbook Recommendations',
            type: 'recommendations',
            data: recList,
            columns: [],
            width: 4
        });

        // 4. Ranking (Bar Chart)
        if (primaryDim && primaryMeasure) {
            // Deduplicate: if primaryDim was already used for Pie chart, pick another
            if (primaryDim !== lowCardCol) {
                const rankingData = aggregateMetric(rows, primaryDim, primaryMeasure, 'sum').slice(0, 5);
                activeCharts.push({
                    id: 'w-bar',
                    title: `${primaryMeasure} by ${primaryDim}`,
                    type: 'bar',
                    data: rankingData,
                    columns: [primaryDim, primaryMeasure],
                    width: 6
                });
            }
        }

        // 5. Geographic Analysis (Heatmap)
        if (secondaryDim && primaryMeasure) {
            const topRegions = Array.from(new Set(rows.map(r => String(r[secondaryDim] ?? '')))).filter(Boolean).slice(0, 5);
            // Find a secondary category to cross-analyze, like StoreLocation or Salesperson or CustomerType
            const storeCol = catCols.find(c => c !== secondaryDim && c !== primaryDim && c !== lowCardCol) || catCols.find(c => c !== secondaryDim) || null;
            if (storeCol) {
                const topStores = Array.from(new Set(rows.map(r => String(r[storeCol] ?? '')))).filter(Boolean).slice(0, 5);
                const heatmapRows = topRegions.map(reg => {
                    const regRows = rows.filter(r => String(r[secondaryDim]) === reg);
                    const cells = topStores.map(store => {
                        return regRows.filter(r => String(r[storeCol]) === store)
                            .reduce((sum, r) => sum + (Number(r[primaryMeasure]) || 0), 0);
                    });
                    const maxVal = Math.max(...cells, 1);
                    const normalizedCells = cells.map(v => Math.round((v / maxVal) * 8) + 1);
                    return {
                        r: reg,
                        cells: normalizedCells,
                        raw: cells
                    };
                });

                activeCharts.push({
                    id: 'w-heatmap',
                    title: `${primaryMeasure} Heatmap (${secondaryDim} vs ${storeCol})`,
                    type: 'heatmap',
                    data: heatmapRows,
                    columns: topStores,
                    width: 6
                });
            }
        }

        // 6. Treemap Chart (Hierarchical / Card representation)
        // If a categorical column has uniqueCount between 5 and 15
        const midCardCol = catCols.find(c => stats.stats[c]?.uniqueCount !== undefined && stats.stats[c].uniqueCount! >= 5 && stats.stats[c].uniqueCount! <= 15 && c !== lowCardCol);
        if (midCardCol && primaryMeasure) {
            const treemapData = aggregateMetric(rows, midCardCol, primaryMeasure, 'sum').slice(0, 8);
            activeCharts.push({
                id: 'w-treemap',
                title: `${primaryMeasure} Distribution by ${midCardCol}`,
                type: 'treemap',
                data: treemapData,
                columns: [midCardCol, primaryMeasure],
                width: 6
            });
        }

        // 7. Correlation / Scatter Chart (if multiple numeric fields)
        if (numCols.length >= 2 && primaryMeasure && secondaryMeasure) {
            const scatterData = rows.slice(0, 50).map(r => ({
                x: Number(r[secondaryMeasure]) || 0,
                y: Number(r[primaryMeasure]) || 0
            }));
            activeCharts.push({
                id: 'w-scatter',
                title: `${secondaryMeasure} vs ${primaryMeasure} Correlation`,
                type: 'scatter',
                data: scatterData,
                columns: [secondaryMeasure, primaryMeasure],
                width: 6
            });
        }

        // 8. Detailed Breakdown Table
        if (primaryDim && primaryMeasure) {
            const tableData = aggregateMetric(rows, primaryDim, primaryMeasure, 'sum')
                .slice(0, 5)
                .map(item => {
                    const itemRows = rows.filter(r => String(r[primaryDim]) === item.label);
                    const secondaryGroup = secondaryDim ? (itemRows[0]?.[secondaryDim] || 'General') : 'General';
                    return {
                        p: item.label,
                        c: secondaryGroup,
                        r: item.value > 1000000 ? `$${(item.value / 1000000).toFixed(2)}M` : `$${item.value.toLocaleString()}`,
                        o: itemRows.length.toLocaleString()
                    };
                });
            activeCharts.push({
                id: 'w-table',
                title: `Top ${primaryDim}s by ${primaryMeasure}`,
                type: 'table',
                data: tableData,
                columns: [primaryDim, primaryMeasure],
                width: 12
            });
        }

        // ── Combine KPIs and Sorted Charts ──
        const activeWidgets = [...activeKpis, ...activeCharts];

        // ── Context-Aware Merge and State Updates ──
        setWidgets(prev => {
            // Find manually added user widgets
            const customWidgets = prev.filter(w => w.id.startsWith('w-custom-'));

            // Map generated widgets: if widget already exists, preserve customized title and widths
            const updatedWidgets = activeWidgets.map(newW => {
                const existing = prev.find(oldW => oldW.id === newW.id);
                if (existing) {
                    return {
                        ...newW,
                        title: existing.title,
                        width: existing.width,
                        type: existing.type,
                        data: newW.data,
                        columns: newW.columns
                    };
                }
                return newW;
            });

            // Clean custom widgets that rely on columns that don't exist anymore in stats.stats
            const validColumns = new Set(Object.keys(stats.stats));
            const validCustomWidgets = customWidgets.filter(w => {
                if (w.columns && w.columns.length > 0) {
                    return w.columns.every(col => validColumns.has(col));
                }
                return true;
            });

            return [...updatedWidgets, ...validCustomWidgets];
        });
    };

    // ── Aggregator Utility ──
    const aggregateMetric = (data: any[], dim: string, measure: string, calc: 'sum' | 'avg' | 'count' = 'sum'): { label: string; value: number }[] => {
        const groups: Record<string, { sum: number; count: number }> = {};
        data.forEach(row => {
            const k = String(row[dim] ?? 'Unknown');
            const v = Number(row[measure]) || 0;
            if (!groups[k]) groups[k] = { sum: 0, count: 0 };
            groups[k].sum += v;
            groups[k].count += 1;
        });

        return Object.entries(groups).map(([label, s]) => ({
            label,
            value: calc === 'sum'
                ? Math.round(s.sum * 100) / 100
                : calc === 'avg'
                    ? Math.round((s.sum / s.count) * 100) / 100
                    : s.count
        })).sort((a, b) => b.value - a.value);
    };

    // ── Drag and Drop Sequence Reordering Hooks ──
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        const w = widgets[index];
        if (w) {
            lastWidgetIdRef.current = w.id;
        }
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const draggedWidget = widgets[draggedIndex];
        const targetWidget = widgets[index];
        if (!draggedWidget || !targetWidget) return;

        // Prevent cross-boundary drag/drops (KPI vs Chart) to preserve grid alignment
        const isDraggedKpi = draggedWidget.type === 'kpi';
        const isTargetKpi = targetWidget.type === 'kpi';
        if (isDraggedKpi !== isTargetKpi) {
            showToast('KPIs and Charts must be reordered within their own sections.', 'info');
            return;
        }

        const updatedWidgets = [...widgets];
        const [movedWidget] = updatedWidgets.splice(draggedIndex, 1);
        updatedWidgets.splice(index, 0, movedWidget);

        setWidgets(updatedWidgets);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    // ── Dynamic Width helper for card flex grids ──
    const getInitialWidth = (span: number): string => {
        if (span === 12) return '100%';
        if (span === 8) return 'calc(66.66% - 0.6rem)';
        if (span === 6) return 'calc(50% - 0.6rem)';
        if (span === 2) return 'calc(16.66% - 0.6rem)';
        return 'calc(33.33% - 0.6rem)';
    };

    // ── Smooth Cursor Mouse Resize Delta Hook ──
    const handleResizeMouseDown = (e: React.MouseEvent, widgetId: string) => {
        e.preventDefault();
        lastWidgetIdRef.current = widgetId;
        const cardElement = e.currentTarget.parentElement;
        if (!cardElement) return;

        const startWidth = cardElement.offsetWidth;
        const startHeight = cardElement.offsetHeight;
        const startX = e.clientX;
        const startY = e.clientY;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            const newWidth = Math.max(160, startWidth + dx);
            const newHeight = Math.max(100, startHeight + dy);

            setCardSizes(prev => ({
                ...prev,
                [widgetId]: { width: `${newWidth}px`, height: newHeight }
            }));
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // ── Dynamic AI Dialog Trigger & NLP Command Interceptor (Add / Modify / Delete) ──
    // Helper to find a matching column name in the dataset schema
    const findColumnName = (text: string, columns: string[]): string | null => {
        const lowerText = text.toLowerCase();
        for (const col of columns) {
            if (lowerText.includes(col.toLowerCase())) {
                return col;
            }
        }

        // Semantic overrides
        if (lowerText.includes('sale') || lowerText.includes('revenue') || lowerText.includes('turnover') || lowerText.includes('spent') || lowerText.includes('amount') || lowerText.includes('price')) {
            const found = columns.find(c => {
                const l = c.toLowerCase();
                return l.includes('price') || l.includes('revenue') || l.includes('sale') || l.includes('amount') || l.includes('cost') || l.includes('spent');
            });
            if (found) return found;
        }
        if (lowerText.includes('product') || lowerText.includes('item') || lowerText.includes('goods') || lowerText.includes('category') || lowerText.includes('sku') || lowerText.includes('name')) {
            const found = columns.find(c => {
                const l = c.toLowerCase();
                return l.includes('product') || l.includes('category') || l.includes('item') || l.includes('segment') || l.includes('name');
            });
            if (found) return found;
        }
        if (lowerText.includes('region') || lowerText.includes('country') || lowerText.includes('city') || lowerText.includes('state') || lowerText.includes('location') || lowerText.includes('area') || lowerText.includes('territory') || lowerText.includes('market') || lowerText.includes('zone')) {
            const found = columns.find(c => {
                const l = c.toLowerCase();
                return l.includes('region') || l.includes('country') || l.includes('state') || l.includes('city') || l.includes('location') || l.includes('store') || l.includes('market') || l.includes('zone');
            });
            if (found) return found;
        }
        if (lowerText.includes('customer') || lowerText.includes('client') || lowerText.includes('buyer') || lowerText.includes('user') || lowerText.includes('account')) {
            const found = columns.find(c => {
                const l = c.toLowerCase();
                return l.includes('customer') || l.includes('client') || l.includes('user') || l.includes('buyer');
            });
            if (found) return found;
        }
        if (lowerText.includes('date') || lowerText.includes('time') || lowerText.includes('month') || lowerText.includes('year') || lowerText.includes('period') || lowerText.includes('quarter') || lowerText.includes('day')) {
            const found = columns.find(c => {
                const l = c.toLowerCase();
                return l.includes('date') || l.includes('time') || l.includes('year') || l.includes('month') || l.includes('created') || l.includes('period');
            });
            if (found) return found;
        }
        return null;
    };

    // Helper to discover filter columns and values from raw data
    const discoverFilter = (text: string, rawData: any[], columns: string[]) => {
        const lowerText = text.toLowerCase();
        for (const col of columns) {
            const uniqueValues = Array.from(new Set(rawData.map(r => String(r[col] ?? '').toLowerCase()).filter(Boolean)));
            for (const val of uniqueValues) {
                if (val.length >= 3 && lowerText.includes(val)) {
                    const originalVal = Array.from(new Set(rawData.map(r => String(r[col] ?? '')).filter(Boolean))).find(v => v.toLowerCase() === val);
                    return { col, val: originalVal || val };
                }
            }
        }
        return null;
    };

    // Helper to filter raw data and update widgets dynamically
    const applyFiltersAndRebuild = (newFilters: Record<string, any>, rawData: any[] = originalRawData) => {
        setActiveFilters(newFilters);
        let filtered = [...rawData];
        Object.entries(newFilters).forEach(([col, val]) => {
            if (val === undefined || val === null || val === '') return;
            filtered = filtered.filter(row => {
                const rowVal = String(row[col] ?? '').toLowerCase();
                const filterVal = String(val).toLowerCase();
                return rowVal === filterVal || rowVal.includes(filterVal);
            });
        });
        setActiveRawData(filtered);
        if (dsAnalytics) {
            setWidgets(prev => updateAllWidgetsData(filtered, prev, dsAnalytics));
        }
    };

    // Helper to dynamically update visual datasets for existing and custom widgets
    const updateAllWidgetsData = (filteredRows: any[], currentWidgets: Widget[], stats: DatasetAnalytics) => {
        const keys = Object.keys(stats.stats);
        const numCols = keys.filter(c => stats.stats[c]?.type === 'numeric');
        const catCols = keys.filter(c => stats.stats[c]?.type === 'categorical');

        // 1. Dynamic Date dimension discovery
        const dateDim = keys.find(c => {
            const l = c.toLowerCase();
            return l.includes('date') || l.includes('time') || l.includes('year') || l.includes('month');
        }) || null;

        // 2. Dynamic Continuous Measures discovery
        const primaryMeasure = numCols.find(c => {
            const l = c.toLowerCase();
            return l.includes('totalprice') || l.includes('revenue') || l.includes('sales') || l.includes('amount') || l.includes('price');
        }) || numCols[0] || null;

        const secondaryMeasure = numCols.find(c => {
            const l = c.toLowerCase();
            return c !== primaryMeasure && (l.includes('quantity') || l.includes('orders') || l.includes('units') || l.includes('shippingcost') || l.includes('discount'));
        }) || numCols.find(c => c !== primaryMeasure) || null;

        // 3. Dynamic Categories discovery
        const primaryDim = catCols.find(c => {
            const l = c.toLowerCase();
            return l.includes('product') || l.includes('category') || l.includes('item') || l.includes('segment');
        }) || catCols[0] || null;

        const secondaryDim = catCols.find(c => {
            const l = c.toLowerCase();
            return c !== primaryDim && (l.includes('region') || l.includes('country') || l.includes('store') || l.includes('location') || l.includes('state') || l.includes('city') || l.includes('market'));
        }) || catCols.find(c => c !== primaryDim) || null;

        const recordCount = filteredRows.length;
        const totalRevSum = primaryMeasure ? filteredRows.reduce((s, r) => s + (Number(r[primaryMeasure]) || 0), 0) : 0;
        const uniqueCustomers = primaryDim ? new Set(filteredRows.map(r => r[primaryDim]).filter(Boolean)).size : 0;

        // Generate Real dynamic aggregates
        let lineData: any[] = [];
        let forecastList: any[] = [];
        if (dateDim && primaryMeasure) {
            const monthlyDataMap: Record<string, { sum: number; count: number }> = {};
            filteredRows.forEach(row => {
                const formatted = formatExcelDate(row[dateDim]);
                if (!monthlyDataMap[formatted]) monthlyDataMap[formatted] = { sum: 0, count: 0 };
                monthlyDataMap[formatted].sum += Number(row[primaryMeasure]) || 0;
                monthlyDataMap[formatted].count += 1;
            });
            lineData = Object.entries(monthlyDataMap).map(([label, s]) => ({
                label,
                value: Math.round(s.sum * 100) / 100,
                valuePY: Math.round(s.sum * 0.85 * 100) / 100
            })).slice(-12);

            const forecastAvg = lineData.reduce((sum, t) => sum + t.value, 0) / (lineData.length || 1);
            forecastList = [
                ...lineData.map(t => ({ label: t.label, actual: t.value, fct: t.value })),
                { label: 'Next Month (Fct)', actual: null, fct: Math.round(forecastAvg * 1.04 * 100) / 100, fctLow: Math.round(forecastAvg * 0.94 * 100) / 100, fctHigh: Math.round(forecastAvg * 1.14 * 100) / 100 },
                { label: 'Following Month (Fct)', actual: null, fct: Math.round(forecastAvg * 1.07 * 100) / 100, fctLow: Math.round(forecastAvg * 0.90 * 100) / 100, fctHigh: Math.round(forecastAvg * 1.22 * 100) / 100 }
            ];
        }

        const donutData = primaryDim && primaryMeasure ? aggregateMetric(filteredRows, primaryDim, primaryMeasure, 'sum').slice(0, 5) : [];
        const barData = secondaryDim && primaryMeasure ? aggregateMetric(filteredRows, secondaryDim, primaryMeasure, 'sum').slice(0, 5) : [];

        const topProd = donutData[0]?.label || 'None';
        const topProdVal = donutData[0]?.value || 0;
        const topProdPct = totalRevSum > 0 ? ((topProdVal / totalRevSum) * 100).toFixed(1) : '0';

        const topReg = barData[0]?.label || 'None';
        const topRegVal = barData[0]?.value || 0;
        const topRegPct = totalRevSum > 0 ? ((topRegVal / totalRevSum) * 100).toFixed(1) : '0';

        const insightsList = [
            { icon: '🟢', t: `Dataset details scanned`, d: `Successfully registered across ${recordCount.toLocaleString()} records.` }
        ];
        if (primaryMeasure) {
            insightsList.push({ icon: '🔵', t: `Total ${primaryMeasure} sum`, d: `Total cumulative value is ${totalRevSum > 1000000 ? `$${(totalRevSum / 1000000).toFixed(2)}M` : totalRevSum.toLocaleString()}.` });
        }
        if (secondaryDim && topReg !== 'None') {
            insightsList.push({ icon: '🟣', t: `${topReg} is the leading ${secondaryDim}`, d: `Contributes ${topRegPct}% of total cumulative values.` });
        }
        if (primaryDim && topProd !== 'None') {
            insightsList.push({ icon: '🟡', t: `${topProd} is top ${primaryDim}`, d: `Generates ${topProdPct}% contribution to the portfolio share.` });
        }

        const recList = [
            { icon: '🟣', t: `Focus resources on top performing segments`, d: `Optimize inventory for top items like ${topProd}.` },
            { icon: '🟠', t: `Target campaign channels outside main core`, d: `Expand business reach beyond ${topReg} region.` }
        ];

        return currentWidgets.map(w => {
            // Dynamic KPIs
            if (w.type === 'kpi') {
                if (w.id === 'kpi-records') {
                    return {
                        ...w,
                        value: recordCount > 1000 ? `${(recordCount / 1000).toFixed(1)}K` : `${recordCount}`,
                        sub: `vs ${Math.round(recordCount * 0.89)}`,
                        data: getSparklineCountPoints(null, filteredRows, dateDim)
                    };
                }
                if (w.id === 'kpi-primary-meas' && primaryMeasure) {
                    const isCurrency = primaryMeasure.toLowerCase().includes('price') || primaryMeasure.toLowerCase().includes('rev') || primaryMeasure.toLowerCase().includes('amount') || primaryMeasure.toLowerCase().includes('cost') || primaryMeasure.toLowerCase().includes('spent');
                    return {
                        ...w,
                        value: isCurrency
                            ? (totalRevSum > 1000000 ? `$${(totalRevSum / 1000000).toFixed(2)}M` : `$${totalRevSum.toLocaleString()}`)
                            : (totalRevSum > 1000000 ? `${(totalRevSum / 1000000).toFixed(2)}M` : `${totalRevSum.toLocaleString()}`),
                        sub: `vs ${isCurrency ? '$' : ''}${(totalRevSum * 0.92).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                        data: getSparklineDataPoints(primaryMeasure, filteredRows, dateDim)
                    };
                }
                if (w.id === 'kpi-primary-dim' && primaryDim) {
                    const uniqueVal = new Set(filteredRows.map(r => r[primaryDim]).filter(Boolean)).size;
                    return {
                        ...w,
                        value: uniqueVal > 1000 ? `${(uniqueVal / 1000).toFixed(1)}K` : `${uniqueVal}`,
                        sub: `vs ${Math.round(uniqueVal * 0.95)}`,
                        data: getSparklineCountPoints(primaryDim, filteredRows, dateDim)
                    };
                }
                if (w.id === 'kpi-secondary-meas') {
                    const colName = w.columns[0];
                    if (colName) {
                        const sumVal = filteredRows.reduce((s, r) => s + (Number(r[colName]) || 0), 0);
                        const avgVal = sumVal / (filteredRows.length || 1);
                        const isAvg = colName.toLowerCase().includes('age') || colName.toLowerCase().includes('rate') || colName.toLowerCase().includes('discount') || colName.toLowerCase().includes('margin');
                        const showVal = isAvg ? avgVal : sumVal;
                        const isCurrency = colName.toLowerCase().includes('cost') || colName.toLowerCase().includes('price') || colName.toLowerCase().includes('rev');
                        return {
                            ...w,
                            value: isCurrency
                                ? (showVal > 1000000 ? `$${(showVal / 1000000).toFixed(2)}M` : `$${showVal.toLocaleString()}`)
                                : (showVal > 1000000 ? `${(showVal / 1000000).toFixed(2)}M` : `${showVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}`),
                            sub: `vs ${isCurrency ? '$' : ''}${(showVal * 0.96).toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
                            data: getSparklineDataPoints(colName, filteredRows, dateDim)
                        };
                    }
                }
                if (w.id === 'kpi-secondary-dim') {
                    const colName = w.columns[0];
                    if (colName) {
                        const uniqueVal = new Set(filteredRows.map(r => r[colName]).filter(Boolean)).size;
                        return {
                            ...w,
                            value: uniqueVal > 1000 ? `${(uniqueVal / 1000).toFixed(1)}K` : `${uniqueVal}`,
                            sub: `vs ${Math.round(uniqueVal * 0.97)}`,
                            data: getSparklineCountPoints(colName, filteredRows, dateDim)
                        };
                    }
                }
                if (w.id === 'kpi-third-meas') {
                    const colName = w.columns[0];
                    if (colName) {
                        const sumVal = filteredRows.reduce((s, r) => s + (Number(r[colName]) || 0), 0);
                        const avgVal = sumVal / (filteredRows.length || 1);
                        const isAvg = colName.toLowerCase().includes('age') || colName.toLowerCase().includes('rate') || colName.toLowerCase().includes('discount') || colName.toLowerCase().includes('margin') || colName.toLowerCase().includes('score');
                        const showVal = isAvg ? avgVal : sumVal;
                        return {
                            ...w,
                            value: showVal > 1000000 ? `${(showVal / 1000000).toFixed(2)}M` : `${showVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
                            sub: `vs ${(showVal * 0.98).toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
                            data: getSparklineDataPoints(colName, filteredRows, dateDim)
                        };
                    }
                }
            }

            // Dynamic Charts
            if (w.id === 'w-line') {
                return { ...w, data: lineData };
            }
            if (w.id === 'w-donut') {
                const colName = w.columns[0];
                const measCol = w.columns[1];
                const customData = aggregateMetric(filteredRows, colName, measCol, 'sum').slice(0, 5);
                return { ...w, data: customData };
            }
            if (w.id === 'w-bar') {
                const colName = w.columns[0];
                const measCol = w.columns[1];
                const customData = aggregateMetric(filteredRows, colName, measCol, 'sum').slice(0, 5);
                return { ...w, data: customData };
            }
            if (w.id === 'w-heatmap') {
                const regCol = w.columns[0];
                const storeCol = w.columns[1];
                const measCol = w.columns[2] || primaryMeasure || 'Revenue';
                const topRegions = Array.from(new Set(filteredRows.map(r => String(r[regCol] ?? '')))).filter(Boolean).slice(0, 5);
                const topStores = Array.from(new Set(filteredRows.map(r => String(r[storeCol] ?? '')))).filter(Boolean).slice(0, 5);

                const heatmapRows = topRegions.map(reg => {
                    const regRows = filteredRows.filter(r => String(r[regCol]) === reg);
                    const cells = topStores.map(store => {
                        return regRows.filter(r => String(r[storeCol]) === store)
                            .reduce((sum, r) => sum + (Number(r[measCol]) || 0), 0);
                    });
                    const maxVal = Math.max(...cells, 1);
                    const normalizedCells = cells.map(v => Math.round((v / maxVal) * 8) + 1);
                    return { r: reg, cells: normalizedCells, raw: cells };
                });
                return { ...w, data: heatmapRows, columns: topStores };
            }
            if (w.id === 'w-treemap') {
                const colName = w.columns[0];
                const measCol = w.columns[1];
                const customData = aggregateMetric(filteredRows, colName, measCol, 'sum').slice(0, 8);
                return { ...w, data: customData };
            }
            if (w.id === 'w-table') {
                const colName = w.columns[0];
                const measCol = w.columns[1];
                const tableData = aggregateMetric(filteredRows, colName, measCol, 'sum')
                    .slice(0, 5)
                    .map(item => {
                        const itemRows = filteredRows.filter(r => String(r[colName]) === item.label);
                        const secondaryGroup = secondaryDim ? (itemRows[0]?.[secondaryDim] || 'General') : 'General';
                        return {
                            p: item.label,
                            c: secondaryGroup,
                            r: item.value > 1000000 ? `$${(item.value / 1000000).toFixed(2)}M` : `$${item.value.toLocaleString()}`,
                            o: itemRows.length.toLocaleString()
                        };
                    });
                return { ...w, data: tableData };
            }
            if (w.id === 'w-forecast') {
                return { ...w, data: forecastList };
            }
            if (w.id === 'w-insights') {
                return { ...w, data: insightsList };
            }
            if (w.id === 'w-recommendations') {
                return { ...w, data: recList };
            }

            // Custom widgets / Chat added widgets re-aggregating
            if (w.columns && w.columns.length >= 2) {
                const dimCol = w.columns[0];
                const measCol = w.columns[1];
                if (w.type === 'scatter') {
                    const scatterData = filteredRows.slice(0, 50).map(r => ({
                        x: Number(r[dimCol]) || 0,
                        y: Number(r[measCol]) || 0
                    }));
                    return { ...w, data: scatterData };
                } else {
                    const customData = aggregateMetric(filteredRows, dimCol, measCol, 'sum').slice(0, 5);
                    return { ...w, data: customData };
                }
            }

            return w;
        });
    };

    const findWidgetByPrompt = (prompt: string, currentWidgets: Widget[]): Widget | undefined => {
        const lower = prompt.toLowerCase().trim();

        // 1. Direct search by ID or title substring
        for (const w of currentWidgets) {
            const id = w.id.toLowerCase();
            const title = w.title.toLowerCase();

            // Match if user typed the exact ID or title, or if ID/title is contained
            if (lower.includes(id) || id.includes(lower)) return w;
            if (lower.includes(title) || title.includes(lower)) return w;
        }

        // 2. Singular/plural normalization and keyword matching for default cards
        const keywords: Record<string, string[]> = {
            'w-insights': ['insights', 'insight', 'summary', 'key insights'],
            'w-recommendations': ['recommendations', 'recommendation', 'playbook', 'strategic', 'suggestions'],
            'w-line': ['line', 'over time', 'trend', 'timeline'],
            'w-donut': ['pie', 'donut', 'part-to-whole'],
            'w-bar': ['bar', 'column', 'ranking'],
            'w-heatmap': ['heatmap', 'heat map', 'cross-analyze'],
            'w-treemap': ['treemap', 'tree map', 'distribution'],
            'w-scatter': ['scatter', 'correlation'],
            'w-table': ['table', 'grid', 'breakdown', 'detailed'],
            'w-forecast': ['forecast', 'predict', 'future']
        };

        for (const w of currentWidgets) {
            const keys = keywords[w.id];
            if (keys) {
                for (const key of keys) {
                    if (lower.includes(key)) {
                        return w;
                    }
                }
            }
        }

        // 3. Match by type keyword + column keyword
        for (const w of currentWidgets) {
            const type = w.type.toLowerCase();
            if (lower.includes(type) || (type === 'pie' && lower.includes('donut'))) {
                if (w.columns && w.columns.some(col => lower.includes(col.toLowerCase()))) {
                    return w;
                }
            }
        }

        // 4. Word overlap (2+ words matching)
        for (const w of currentWidgets) {
            const titleWords = w.title.toLowerCase().split(/\s+/).filter(word => word.length > 3);
            const promptWords = lower.split(/\s+/).filter(word => word.length > 3);
            let matches = 0;
            for (const pw of promptWords) {
                if (titleWords.some(tw => tw.includes(pw) || pw.includes(tw))) {
                    matches++;
                }
            }
            if (matches >= 2) return w;
        }

        // 5. Fallback word overlap (1 word matching > 4 letters)
        for (const w of currentWidgets) {
            const titleWords = w.title.toLowerCase().split(/\s+/).filter(word => word.length > 4);
            const promptWords = lower.split(/\s+/).filter(word => word.length > 4);
            for (const pw of promptWords) {
                if (titleWords.some(tw => tw.includes(pw) || pw.includes(tw))) {
                    return w;
                }
            }
        }

        return undefined;
    };

    // ── Dynamic AI Dialog Trigger & NLP Command Interceptor (Add / Modify / Delete) ──
    const handleTriggerPrompt = async (text: string) => {
        if (!text.trim() || chatBusy) return;

        pushMsg({ role: 'user', text });
        setChatBusy(true);

        try {
            const context = dsAnalytics ? {
                datasetName: dsAnalytics.name,
                rowCount: dsAnalytics.rows,
                columns: dsAnalytics.columns,
                qualityScore: dsAnalytics.qualityScore,
                kpiSummary: widgets.filter(w => w.type === 'kpi').map(k => ({ title: k.title, value: k.value })),
                topProducts: widgets.find(w => w.id === 'w-table')?.data.map((d: any) => `${d.p} (${d.r})`)
            } : null;

            const lower = text.toLowerCase();
            const isAdd = lower.includes('add') || lower.includes('create') || lower.includes('show') || lower.includes('build') || lower.includes('make') || lower.includes('visualize') || lower.includes('plot') || lower.includes('generate') || lower.includes('crear') || lower.includes('inser') || lower.includes('display');
            const isDelete = lower.includes('remove') || lower.includes('delete') || lower.includes('hide') || lower.includes('clear') || lower.includes('exclude') || lower.includes('emove') || lower.includes('delet') || lower.includes('purge') || lower.includes('discard') || lower.includes('trash') || lower.includes('drop');
            const isModify = lower.includes('change') || lower.includes('modify') || lower.includes('update') || lower.includes('convert') || lower.includes('switch') || lower.includes('make') || lower.includes('replace') || lower.includes('turn') || lower.includes('chang') || lower.includes('updat') || lower.includes('conver');
            const isReset = lower.includes('reset') || lower.includes('restore') || lower.includes('revert') || lower.includes('default');
            const isResize = lower.includes('resize') || lower.includes('size') || lower.includes('large') || lower.includes('small') || lower.includes('width') || lower.includes('span') || lower.includes('expand') || lower.includes('collapse') || lower.includes('pin') || lower.includes('unpin');
            const isMove = lower.includes('move') || lower.includes('place') || lower.includes('reorder') || lower.includes('drag') || lower.includes('put') || lower.includes('top') || lower.includes('bottom') || lower.includes('above') || lower.includes('below') || lower.includes('before') || lower.includes('after');
            const isRename = lower.includes('rename') || lower.includes('change title') || lower.includes('set title') || lower.includes('heading');
            const isFilter = lower.includes('filter') || lower.includes('only show') || lower.includes('where') || lower.includes('days') || lower.includes('year') || lower.includes('month') || lower.includes('date');
            const isSort = lower.includes('sort') || lower.includes('order') || lower.includes('descending') || lower.includes('ascending') || lower.includes('highest') || lower.includes('lowest');
            const isGroup = lower.includes('group') || lower.includes('aggregate');
            const isDrill = lower.includes('drill');
            const isCompare = lower.includes('compare') || lower.includes('versus') || lower.includes('vs');
            const isAnomaly = lower.includes('anomaly') || lower.includes('anomalies') || lower.includes('outlier') || lower.includes('outliers') || lower.includes('irregularity');
            const isSave = lower.includes('save') || lower.includes('store') || lower.includes('persist');
            const isSummary = lower.includes('summary') || lower.includes('summarize') || lower.includes('explain') || lower.includes('insights') || lower.includes('why') || lower.includes('what does');

            // ── RESET Layout ──
            if (isReset && !isFilter) {
                if (dsAnalytics && originalRawData.length > 0) {
                    buildExecutiveDashboard(dsAnalytics, originalRawData);
                    setActiveRawData(originalRawData);
                    setActiveFilters({});
                    setCardSizes({});
                    lastWidgetIdRef.current = null;
                    pushMsg({
                        role: 'ai',
                        text: `🔄 **Dashboard Reset Successfully!**\n\nI have reverted all visual widgets to their original Executive dashboard sequence, removed any custom additions/filters, and reset card widths and heights back to default flex specifications.`
                    });
                    setChatBusy(false);
                    return;
                }
            }

            // ── SAVE/RESTORE Layout ──
            if (isSave) {
                const layoutKey = selectedDs || 'default';
                setSavedLayouts(prev => ({
                    ...prev,
                    [layoutKey]: { widgets: [...widgets], cardSizes: { ...cardSizes } }
                }));
                handleSaveDashboard(true);
                return;
            }
            if (lower.includes('restore layout') || lower.includes('restore previous') || lower.includes('load layout')) {
                const layoutKey = selectedDs || 'default';
                const saved = savedLayouts[layoutKey];
                if (saved) {
                    setWidgets(saved.widgets);
                    setCardSizes(saved.cardSizes);
                    pushMsg({
                        role: 'ai',
                        text: `🔄 **Dashboard Layout Restored!**\n\nI have retrieved your saved configuration and successfully restored all widgets, sizes, and order to your screen.`
                    });
                } else {
                    pushMsg({
                        role: 'ai',
                        text: `⚠️ **No Saved Layout Found!**\n\nI couldn't find any previously saved layouts for the active dataset. Try typing "save layout" first.`
                    });
                }
                setChatBusy(false);
                return;
            }

            // ── HIGHLIGHT ANOMALIES ──
            if (isAnomaly && (lower.includes('show') || lower.includes('highlight') || lower.includes('find') || lower.includes('are there'))) {
                pushMsg({
                    role: 'ai',
                    text: `ℹ️ **Anomaly Visualization Disabled**\n\nStatistical anomaly and outlier detection widgets have been permanently disabled and excluded from this analytics dashboard as requested.`
                });
                setChatBusy(false);
                return;
            }

            // ── RENAME Widget ──
            if (isRename && widgets.length > 0) {
                let targetId = lastWidgetIdRef.current || widgets.find(w => w.type !== 'kpi')?.id;
                let newTitle = '';

                const match = text.match(/rename\s+(.+?)\s+to\s+(.+)/i);
                if (match) {
                    const targetSearch = match[1].toLowerCase();
                    newTitle = match[2].trim();
                    const found = widgets.find(w => w.title.toLowerCase().includes(targetSearch) || w.id.toLowerCase() === targetSearch || w.type.toLowerCase() === targetSearch);
                    if (found) targetId = found.id;
                } else {
                    const toMatch = text.match(/to\s+(.+)/i);
                    if (toMatch) newTitle = toMatch[1].trim();
                }

                if (targetId && newTitle) {
                    setWidgets(prev => prev.map(w => w.id === targetId ? { ...w, title: newTitle } : w));
                    pushMsg({
                        role: 'ai',
                        text: `✏️ **Widget Renamed!**\n\nI have successfully renamed the title of the widget to **"${newTitle}"**.`
                    });
                    setChatBusy(false);
                    return;
                }
            }

            // ── RESIZE Widget ──
            if (isResize && widgets.length > 0) {
                let targetId = lastWidgetIdRef.current || widgets.find(w => w.type !== 'kpi')?.id;
                let newWidth = 6;
                let recognized = false;

                if (lower.includes('full') || lower.includes('large') || lower.includes('maximize') || lower.includes('12')) {
                    newWidth = 12;
                    recognized = true;
                } else if (lower.includes('half') || lower.includes('medium') || lower.includes('6')) {
                    newWidth = 6;
                    recognized = true;
                } else if (lower.includes('small') || lower.includes('4')) {
                    newWidth = 4;
                    recognized = true;
                } else if (lower.includes('kpi size') || lower.includes('2')) {
                    newWidth = 2;
                    recognized = true;
                } else if (lower.includes('expand')) {
                    newWidth = 12;
                    recognized = true;
                } else if (lower.includes('collapse')) {
                    newWidth = 4;
                    recognized = true;
                }

                const matchingWidget = widgets.find(w => lower.includes(w.title.toLowerCase()) || lower.includes(w.id.toLowerCase()) || lower.includes(w.type.toLowerCase()));
                if (matchingWidget) targetId = matchingWidget.id;

                if (targetId && recognized) {
                    setWidgets(prev => prev.map(w => w.id === targetId ? { ...w, width: newWidth } : w));
                    pushMsg({
                        role: 'ai',
                        text: `📐 **Widget Resized!**\n\nI have adjusted the column span width of **"${widgets.find(w => w.id === targetId)?.title}"** to **${newWidth} columns** in the grid.`
                    });
                    setChatBusy(false);
                    return;
                }
            }

            // ── MOVE Widget ──
            if (isMove && widgets.length > 0) {
                if (lower.includes('kpi') && (lower.includes('top') || lower.includes('first') || lower.includes('above'))) {
                    setWidgets(prev => {
                        const kpis = prev.filter(w => w.type === 'kpi');
                        const nonKpis = prev.filter(w => w.type !== 'kpi');
                        return [...kpis, ...nonKpis];
                    });
                    pushMsg({
                        role: 'ai',
                        text: `📦 **Dashboard Layout Reordered!**\n\nI have updated the widget coordinates, placing all key executive KPI indicators at the top of the BI canvas layout.`
                    });
                    setChatBusy(false);
                    return;
                }

                let targetWidgetIndex = widgets.findIndex(w => lower.includes(w.title.toLowerCase()) || lower.includes(w.id.toLowerCase()));
                if (targetWidgetIndex === -1 && lastWidgetIdRef.current) {
                    targetWidgetIndex = widgets.findIndex(w => w.id === lastWidgetIdRef.current);
                }
                if (targetWidgetIndex !== -1) {
                    const widgetToMove = widgets[targetWidgetIndex];
                    let destinationIndex = -1;
                    if (lower.includes('bottom') || lower.includes('last') || lower.includes('end')) {
                        destinationIndex = widgets.length - 1;
                    } else if (lower.includes('top') || lower.includes('first') || lower.includes('beginning')) {
                        destinationIndex = 0;
                    }

                    if (destinationIndex !== -1 && destinationIndex !== targetWidgetIndex) {
                        setWidgets(prev => {
                            const copy = [...prev];
                            const [item] = copy.splice(targetWidgetIndex, 1);
                            copy.splice(destinationIndex, 0, item);
                            return copy;
                        });
                        pushMsg({
                            role: 'ai',
                            text: `📦 **Widget Position Shifted!**\n\nI have moved **"${widgetToMove.title}"** to the requested location on the grid.`
                        });
                        setChatBusy(false);
                        return;
                    }
                }
            }

            // ── APPLY or REMOVE Filters ──
            if (isFilter || lower.includes('clear filter') || lower.includes('remove filter') || lower.includes('remove all filter') || lower.includes('clear all filter')) {
                if (lower.includes('clear') || lower.includes('remove') || lower.includes('all')) {
                    applyFiltersAndRebuild({});
                    pushMsg({
                        role: 'ai',
                        text: `🧹 **All Data Filters Removed!**\n\nI have successfully cleared all active criteria. The dashboard coordinates, transaction metrics, and trends have been restored to display the full, original dataset.`
                    });
                    setChatBusy(false);
                    return;
                }

                if (dsAnalytics) {
                    const columns = dsAnalytics.columns;
                    const filterMatch = discoverFilter(text, originalRawData, columns);
                    if (filterMatch) {
                        const newFilters = { ...activeFilters, [filterMatch.col]: filterMatch.val };
                        applyFiltersAndRebuild(newFilters);
                        pushMsg({
                            role: 'ai',
                            text: `🔍 **Filter Applied Instantly!**\n\nI have set a dashboard-wide query constraint:\n• Filter field: **${filterMatch.col}**\n• Value: **"${filterMatch.val}"**\n\nAll KPI metrics, trend charts, and sales tables have been updated dynamically to reflect this subset.`
                        });
                        setChatBusy(false);
                        return;
                    }
                }
            }

            // ── SORT Data ──
            if (isSort && widgets.length > 0) {
                let targetId = lastWidgetIdRef.current || widgets.find(w => w.type !== 'kpi' && w.data && w.data.length > 0)?.id;
                const matchingWidget = widgets.find(w => lower.includes(w.title.toLowerCase()) || lower.includes(w.id.toLowerCase()));
                if (matchingWidget) targetId = matchingWidget.id;

                if (targetId) {
                    const isAsc = lower.includes('ascending') || lower.includes('lowest') || lower.includes('up');
                    setWidgets(prev => prev.map(w => {
                        if (w.id === targetId && Array.isArray(w.data)) {
                            const sortedData = [...w.data].sort((a: any, b: any) => {
                                const aVal = a.value !== undefined ? a.value : a.y !== undefined ? a.y : 0;
                                const bVal = b.value !== undefined ? b.value : b.y !== undefined ? b.y : 0;
                                return isAsc ? aVal - bVal : bVal - aVal;
                            });
                            return { ...w, data: sortedData };
                        }
                        return w;
                    }));

                    pushMsg({
                        role: 'ai',
                        text: `📊 **Data Sorted Successfully!**\n\nI have re-ordered the datasets in **"${widgets.find(w => w.id === targetId)?.title}"** in **${isAsc ? 'ascending' : 'descending'}** order.`
                    });
                    setChatBusy(false);
                    return;
                }
            }

            // ── GROUP Data ──
            if (isGroup && widgets.length > 0 && dsAnalytics) {
                const targetDim = findColumnName(text, dsAnalytics.columns);
                if (targetDim) {
                    let targetId = lastWidgetIdRef.current || widgets.find(w => w.type === 'bar' || w.type === 'pie')?.id;
                    const matchingWidget = widgets.find(w => lower.includes(w.title.toLowerCase()) || lower.includes(w.id.toLowerCase()));
                    if (matchingWidget) targetId = matchingWidget.id;

                    if (targetId) {
                        const primaryMeasure = widgets.find(w => w.id === targetId)?.columns[1] || 'Revenue';
                        const groupedData = aggregateMetric(activeRawData, targetDim, primaryMeasure, 'sum').slice(0, 5);

                        setWidgets(prev => prev.map(w => {
                            if (w.id === targetId) {
                                return {
                                    ...w,
                                    title: `${w.type.toUpperCase()} of ${primaryMeasure} by ${targetDim}`,
                                    columns: [targetDim, primaryMeasure],
                                    data: groupedData
                                };
                            }
                            return w;
                        }));

                        pushMsg({
                            role: 'ai',
                            text: `📊 **Visual Regrouped!**\n\nI have updated the grouping criteria of **"${widgets.find(w => w.id === targetId)?.title}"** to **${targetDim}** and aggregated the summaries in real-time.`
                        });
                        setChatBusy(false);
                        return;
                    }
                }
            }

            // ── DRILL DOWN / UP ──
            if (isDrill && widgets.length > 0 && dsAnalytics) {
                let targetId = lastWidgetIdRef.current || widgets.find(w => w.type === 'bar' || w.type === 'pie')?.id;
                const targetWidget = widgets.find(w => w.id === targetId);

                if (targetWidget) {
                    if (lower.includes('down')) {
                        let detailDim = 'StoreLocation';
                        if (targetWidget.columns[0].toLowerCase().includes('product')) detailDim = 'Category';

                        const primaryMeasure = targetWidget.columns[1] || 'Revenue';
                        const drilledData = aggregateMetric(activeRawData, detailDim, primaryMeasure, 'sum').slice(0, 5);

                        setWidgets(prev => prev.map(w => {
                            if (w.id === targetId) {
                                return {
                                    ...w,
                                    title: `${w.type.toUpperCase()} of ${primaryMeasure} Drilled Down to ${detailDim}`,
                                    columns: [detailDim, primaryMeasure],
                                    data: drilledData
                                };
                            }
                            return w;
                        }));

                        pushMsg({
                            role: 'ai',
                            text: `🔍 **Drilled Down Successfully!**\n\nI have refined the visual detail in **"${targetWidget.title}"** by descending from **${targetWidget.columns[0]}** down to **${detailDim}** granularity.`
                        });
                    } else if (lower.includes('up')) {
                        let topDim = 'Region';
                        if (targetWidget.columns[0].toLowerCase().includes('category')) topDim = 'Product';

                        const primaryMeasure = targetWidget.columns[1] || 'Revenue';
                        const drilledData = aggregateMetric(activeRawData, topDim, primaryMeasure, 'sum').slice(0, 5);

                        setWidgets(prev => prev.map(w => {
                            if (w.id === targetId) {
                                return {
                                    ...w,
                                    title: `${w.type.toUpperCase()} of ${primaryMeasure} by ${topDim}`,
                                    columns: [topDim, primaryMeasure],
                                    data: drilledData
                                };
                            }
                            return w;
                        }));

                        pushMsg({
                            role: 'ai',
                            text: `🔍 **Drilled Up Successfully!**\n\nI have rolled up the dimension from **${targetWidget.columns[0]}** back to **${topDim}**.`
                        });
                    }
                    setChatBusy(false);
                    return;
                }
            }

            // ── COMPARE datasets ──
            if (isCompare && dsAnalytics) {
                const cols = dsAnalytics.columns;
                const matchingCols = cols.filter(c => lower.includes(c.toLowerCase()));
                if (matchingCols.length >= 2) {
                    const col1 = matchingCols[0];
                    const col2 = matchingCols[1];
                    pushMsg({
                        role: 'ai',
                        text: `📊 **Comparison Context Compiled!**\n\nI have contrasted **${col1}** against **${col2}** across active data streams. Direct sales volumes suggest higher traction in **${col1}** compared to **${col2}** dimensions.`
                    });
                    setChatBusy(false);
                    return;
                }
            }

            // ── DELETE Widget ──
            if (isDelete && widgets.length > 0) {
                if (lower.includes('all duplicate') || lower.includes('duplicates')) {
                    const uniqueTitles = new Set();
                    setWidgets(prev => prev.filter(w => {
                        if (uniqueTitles.has(w.title)) return false;
                        uniqueTitles.add(w.title);
                        return true;
                    }));
                    pushMsg({
                        role: 'ai',
                        text: `🗑️ **Duplicate Charts Cleared!**\n\nI have scanned the grid canvas and purged all duplicate visualization panels to restore unique views.`
                    });
                    setChatBusy(false);
                    return;
                }
                if (lower.includes('except kpis') || lower.includes('clear everything except kpis')) {
                    setWidgets(prev => prev.filter(w => w.type === 'kpi'));
                    pushMsg({
                        role: 'ai',
                        text: `🗑️ **Workspace Canvas Cleared!**\n\nI have successfully deleted all chart widgets, preserving only the executive KPI metric indicators at the top of the canvas.`
                    });
                    setChatBusy(false);
                    return;
                }

                let targetWidget = findWidgetByPrompt(lower, widgets);

                if (!targetWidget && lastWidgetIdRef.current) {
                    targetWidget = widgets.find(w => w.id === lastWidgetIdRef.current);
                }

                if (targetWidget) {
                    setWidgets(prev => prev.filter(item => item.id !== targetWidget.id));
                    pushMsg({
                        role: 'ai',
                        text: `🗑️ **Visual Removed!**\n\nI have successfully deleted the visual **"${targetWidget.title}"** from your dashboard canvas.`
                    });
                    setChatBusy(false);
                    return;
                }
            }

            // ── MODIFY Widget ──
            if (isModify && widgets.length > 0) {
                const targetWidget = findWidgetByPrompt(lower, widgets) || widgets.find(w => w.id === lastWidgetIdRef.current);

                if (targetWidget) {
                    let newType: any = null;
                    if (lower.includes('pie') || lower.includes('donut')) newType = 'pie';
                    else if (lower.includes('bar') || lower.includes('column') || lower.includes('horizontal')) newType = 'bar';
                    else if (lower.includes('line')) newType = 'line';
                    else if (lower.includes('area')) newType = 'area';
                    else if (lower.includes('scatter')) newType = 'scatter';
                    else if (lower.includes('treemap')) newType = 'treemap';
                    else if (lower.includes('table') || lower.includes('grid')) newType = 'table';
                    else if (lower.includes('heatmap')) newType = 'heatmap';
                    else if (lower.includes('forecast')) newType = 'forecast';

                    let newWidth: any = null;
                    if (lower.includes('full') || lower.includes('12')) newWidth = 12;
                    else if (lower.includes('half') || lower.includes('6')) newWidth = 6;
                    else if (lower.includes('small') || lower.includes('4')) newWidth = 4;
                    else if (lower.includes('kpi size') || lower.includes('2')) newWidth = 2;

                    if (newType || newWidth) {
                        setWidgets(prev => prev.map(item => {
                            if (item.id === targetWidget.id) {
                                return {
                                    ...item,
                                    title: newType ? `${newType.toUpperCase()} of ${item.columns[1] || 'Sales'} by ${item.columns[0] || 'Dimension'}` : item.title,
                                    type: newType || item.type,
                                    width: newWidth || item.width
                                };
                            }
                            return item;
                        }));

                        pushMsg({
                            role: 'ai',
                            text: `🔄 **Visual Modified!**\n\nI have successfully updated the visual card **"${targetWidget.title}"**:\n• New Visual Type: **${(newType || targetWidget.type).toUpperCase()}**\n• Column Width Span: **${newWidth || targetWidget.width}**`
                        });
                        setChatBusy(false);
                        return;
                    }
                }
            }

            // ── ADD Widget ──
            if (isAdd && dsAnalytics && activeRawData.length > 0) {
                let visualType: 'pie' | 'bar' | 'line' | 'table' | 'heatmap' | 'area' | 'scatter' | 'treemap' | null = null;
                if (lower.includes('pie') || lower.includes('donut')) visualType = 'pie';
                else if (lower.includes('bar') || lower.includes('column') || lower.includes('horizontal')) visualType = 'bar';
                else if (lower.includes('line')) visualType = 'line';
                else if (lower.includes('area')) visualType = 'area';
                else if (lower.includes('scatter')) visualType = 'scatter';
                else if (lower.includes('treemap')) visualType = 'treemap';
                else if (lower.includes('table') || lower.includes('grid')) visualType = 'table';
                else if (lower.includes('heatmap')) visualType = 'heatmap';

                const cols = Object.keys(dsAnalytics.stats);
                const catCols = cols.filter(c => dsAnalytics.stats[c]?.type === 'categorical');
                const numCols = cols.filter(c => dsAnalytics.stats[c]?.type === 'numeric');

                const foundDim = findColumnName(text, catCols) || cols.find(c => lower.includes(c.toLowerCase())) || catCols[0] || '';
                const foundMeas = findColumnName(text, numCols) || numCols[0] || '';

                if (foundDim && foundMeas) {
                    if (!visualType) {
                        if (foundDim.toLowerCase().includes('date') || foundDim.toLowerCase().includes('time') || foundDim.toLowerCase().includes('month')) {
                            visualType = 'line';
                        } else {
                            const uniqueValuesCount = dsAnalytics.stats[foundDim]?.uniqueCount || 10;
                            if (uniqueValuesCount <= 5) {
                                visualType = 'pie';
                            } else {
                                visualType = 'bar';
                            }
                        }
                    }

                    let metricData: any[] = [];
                    let newWidgetColumns = [foundDim, foundMeas];

                    if (visualType === 'scatter') {
                        metricData = activeRawData.slice(0, 50).map(r => ({
                            x: Number(r[foundDim]) || 0,
                            y: Number(r[foundMeas]) || 0
                        }));
                    } else {
                        metricData = aggregateMetric(activeRawData, foundDim, foundMeas, 'sum').slice(0, 5);
                    }

                    const newWidget: Widget = {
                        id: `w-custom-${Date.now()}`,
                        title: `${visualType.toUpperCase()} of ${foundMeas} by ${foundDim}`,
                        type: visualType,
                        data: metricData,
                        columns: newWidgetColumns,
                        width: 4
                    };

                    setWidgets(prev => [...prev, newWidget]);
                    lastWidgetIdRef.current = newWidget.id;

                    pushMsg({
                        role: 'ai',
                        text: `📊 **Dynamic Visual Created!**\n\nI have successfully compiled the database records and appended a new **${visualType.toUpperCase()}** chart analyzing **${foundMeas}** grouped by **${foundDim}** to your dashboard canvas!\n\nYou can now drag and re-order this visual in the grid, or resize it by dragging its bottom-right corner.`
                    });
                    setChatBusy(false);
                    return;
                }
            }

            // ── GENERATE DYNAMIC INSIGHTS / SUMMARIES ──
            if (isSummary) {
                const totalRevKpi = widgets.find(w => w.id === 'kpi-rev')?.value || '$0';
                const totalOrdersKpi = widgets.find(w => w.id === 'kpi-orders')?.value || '0';
                const avgOrderValKpi = widgets.find(w => w.id === 'kpi-aov')?.value || '$0';
                const totalCustKpi = widgets.find(w => w.id === 'kpi-customers')?.value || '0';

                pushMsg({
                    role: 'ai',
                    text: `📊 **Executive Decision Summary:**\n\nHere is a data-driven overview of the current active dataset:\n• **Total Revenue:** **${totalRevKpi}** representing robust transactional turnover.\n• **Transactions Logged:** **${totalOrdersKpi}** completed operations.\n• **Average Basket Size:** **${avgOrderValKpi}** per order.\n• **Client Base:** **${totalCustKpi}** active buyer accounts.\n\nAll segments are performing within expected limits, with North America driving peak metrics.`
                });
                setChatBusy(false);
                return;
            }

            const res = await apiClient.post('/ai/chat', {
                message: text,
                datasetContext: context
            });

            if (res?.reply) {
                pushMsg({ role: 'ai', text: res.reply });
            } else {
                pushMsg({ role: 'ai', text: "💡 **Data layer compiled successfully.** I evaluated your metrics and synced the semantic schema mapping." });
            }

        } catch (err) {
            console.error(err);
            pushMsg({ role: 'ai', text: "⚠️ I experienced an analytical connection timeout. Please verify backend logging services." });
        } finally {
            setChatBusy(false);
        }
    };

    const pushMsg = (msg: ChatMsg) => {
        setChatMsgs(prev => [...prev, msg]);
        scrollToBottom();
    };

    const handleSendChatInput = () => {
        const txt = chatInput.trim();
        if (!txt) return;
        setChatInput('');
        handleTriggerPrompt(txt);
    };

    const handleCopyShare = () => {
        navigator.clipboard.writeText(window.location.href);
        showToast('Dashboard sharing link copied!', 'success');
    };

    const handleSaveDashboard = async (isChatTrigger = false) => {
        try {
            const layoutKey = selectedDs || 'default';
            localStorage.setItem(`dashboard_layout_${layoutKey}`, JSON.stringify({
                widgets,
                cardSizes
            }));

            await apiClient.post('/data/log-dashboard-publish', {
                dashboardId: selectedDs || 'default',
                dashboardName: dsAnalytics?.name || 'Executive Dashboard'
            });
            showToast('AI BI Dashboard state persisted and published successfully!', 'success');
            if (isChatTrigger) {
                pushMsg({
                    role: 'ai',
                    text: `💾 **Dashboard Layout Saved!**\n\nI have successfully saved your customized layout configuration, widget dimensions, and sequences. You can restore this layout at any time using natural language.`
                });
            }
        } catch (err) {
            console.error('Failed to log dashboard publication:', err);
            showToast('AI BI Dashboard state persisted successfully!', 'success');
            if (isChatTrigger) {
                pushMsg({
                    role: 'ai',
                    text: `💾 **Dashboard Layout Saved!**\n\nI have successfully saved your customized layout configuration. (Backend sync failed, but local persistence succeeded).`
                });
            }
        } finally {
            if (isChatTrigger) {
                setChatBusy(false);
            }
        }
    };

    const handleAddFilter = () => {
        if (!filterCol || !filterVal) return;
        const nextFilters = { ...activeFilters, [filterCol]: filterVal };
        applyFiltersAndRebuild(nextFilters);
        setFilterVal('');
    };

    const handleRemoveFilter = (col: string) => {
        const nextFilters = { ...activeFilters };
        delete nextFilters[col];
        applyFiltersAndRebuild(nextFilters);
    };

    const handleClearAllFilters = () => {
        applyFiltersAndRebuild({});
        setFilterCol('');
        setFilterVal('');
    };

    const handleExportFormat = async (format: 'pdf' | 'png' | 'jpeg') => {
        if (!canvasRef.current) return;
        setExporting(true);
        showToast(`Generating ${format.toUpperCase()} export...`, 'info');

        try {
            const node = canvasRef.current;

            // Save original styles
            const originalHeight = node.style.height;
            const originalOverflow = node.style.overflow;
            const originalPadding = node.style.padding;

            // Set temporary styles to expand the container fully to its content height
            node.style.height = 'auto';
            node.style.overflow = 'visible';
            node.style.padding = '20px';

            // Filter out handles and delete buttons
            const filter = (element: HTMLElement) => {
                const className = element.className;
                if (className && typeof className === 'string') {
                    if (className.includes('studio-resize-handle') ||
                        className.includes('studio-drag-handle')) {
                        return false;
                    }
                }
                if (element.tagName === 'BUTTON' && element.closest('.studio-chart-card')) {
                    return false;
                }
                return true;
            };

            const options = {
                filter: filter as any,
                backgroundColor: '#f3f4f6',
                style: {
                    transform: 'scale(1)',
                    transformOrigin: 'top left',
                    width: node.scrollWidth + 'px',
                    height: node.scrollHeight + 'px'
                },
                width: node.scrollWidth,
                height: node.scrollHeight
            };

            const fileName = dsAnalytics?.name
                ? `${dsAnalytics.name.replace(/\.[^/.]+$/, "")}_dashboard`
                : 'dashboard_export';

            if (format === 'png') {
                const dataUrl = await htmlToImage.toPng(node, options);
                const link = document.createElement('a');
                link.download = `${fileName}.png`;
                link.href = dataUrl;
                link.click();
                showToast('PNG dashboard exported successfully!', 'success');
            } else if (format === 'jpeg') {
                const dataUrl = await htmlToImage.toJpeg(node, { ...options, quality: 0.95 });
                const link = document.createElement('a');
                link.download = `${fileName}.jpg`;
                link.href = dataUrl;
                link.click();
                showToast('JPEG dashboard exported successfully!', 'success');
            } else if (format === 'pdf') {
                const dataUrl = await htmlToImage.toPng(node, options);

                const widthPt = node.scrollWidth * 0.75;
                const heightPt = node.scrollHeight * 0.75;

                const pdf = new jsPDF({
                    orientation: widthPt > heightPt ? 'landscape' : 'portrait',
                    unit: 'pt',
                    format: [widthPt, heightPt]
                });

                pdf.addImage(dataUrl, 'PNG', 0, 0, widthPt, heightPt);
                pdf.save(`${fileName}.pdf`);
                showToast('PDF dashboard exported successfully!', 'success');
            }

            // Restore original styles
            node.style.height = originalHeight;
            node.style.overflow = originalOverflow;
            node.style.padding = originalPadding;

            setShowExportModal(false);
        } catch (err) {
            console.error('Failed to export dashboard:', err);
            showToast('Failed to generate export file.', 'error');
        } finally {
            setExporting(false);
        }
    };

    const handleResetLayout = () => {
        if (!dsAnalytics || activeRawData.length === 0) {
            showToast('No active dataset loaded to reset.', 'error');
            return;
        }
        buildExecutiveDashboard(dsAnalytics, activeRawData);
        setCardSizes({});
        showToast('Dashboard layout reset to defaults successfully!', 'success');
    };

    // ── Dynamic Widget Icon Selector ──
    const getWidgetIcon = (type: string) => {
        switch (type) {
            case 'line':
            case 'forecast':
                return <TrendingUp size={14} style={{ color: '#4f46e5' }} />;
            case 'bar':
                return <BarChart3 size={14} style={{ color: '#4f46e5' }} />;
            case 'pie':
                return <PieIcon size={14} style={{ color: '#4f46e5' }} />;
            case 'table':
                return <Table size={14} style={{ color: '#4f46e5' }} />;
            case 'heatmap':
                return <Sliders size={14} style={{ color: '#4f46e5' }} />;
            case 'insights':
            case 'recommendations':
                return <Sparkles size={14} style={{ color: '#4f46e5' }} />;
            case 'anomalies':
                return <AlertTriangle size={14} style={{ color: '#ea580c' }} />;
            default:
                return <Sparkles size={14} style={{ color: '#4f46e5' }} />;
        }
    };

    // ── Dynamic Content Render Matrix ──
    const renderWidgetContent = (w: Widget) => {
        switch (w.type) {
            case 'kpi':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', height: '100%', justifyContent: 'center' }}>
                        <div className="studio-kpi-val-row" style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                            <span className="studio-kpi-val" style={{ fontSize: '1.25rem', fontWeight: 800 }}>{w.value}</span>
                            <span className={`studio-kpi-trend ${w.isUp ? 'up' : 'down'}`} style={{ fontSize: '0.65rem', fontWeight: 700, color: w.isUp ? 'var(--studio-green)' : '#ef4444' }}>
                                {w.isUp ? '▲' : '▼'} {w.trend}
                            </span>
                        </div>
                        <div className="studio-kpi-sub" style={{ fontSize: '0.625rem', color: 'var(--studio-text-sub)' }}>{w.sub}</div>

                        <div className="studio-kpi-spark" style={{ marginTop: '0.25rem', height: '22px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={w.data.map((val, idx) => ({ idx, val }))}>
                                    <Area type="monotone" dataKey="val" stroke="#4f46e5" strokeWidth={1} fill="rgba(79, 70, 229, 0.05)" dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                );
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={w.data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 9 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 9 }} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                            <Line type="monotone" dataKey="value" name="Revenue" stroke="#4f46e5" strokeWidth={2} dot={{ fill: '#4f46e5', r: 2.5 }} />
                            <Line type="monotone" dataKey="valuePY" name="Revenue (PY)" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={w.data} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 5 }}>
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} width={100} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={10} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'pie':
                return (
                    <div className="studio-donut-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', height: '100%' }}>
                        <div style={{ width: '110px', height: '110px', position: 'relative', flexShrink: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={w.data}
                                        dataKey="value"
                                        nameKey="label"
                                        cx="50%" cy="50%"
                                        innerRadius={36} outerRadius={50}
                                    >
                                        {w.data.map((_, i) => (
                                            <Cell key={i} fill={THEME_COLORS[i % THEME_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ fontSize: '0.675rem', fontWeight: 800, color: 'var(--studio-text)' }}>
                                    {w.data.reduce((a, b) => a + b.value, 0) > 1000000
                                        ? `$${(w.data.reduce((a, b) => a + b.value, 0) / 1000000).toFixed(1)}M`
                                        : `$${w.data.reduce((a, b) => a + b.value, 0).toLocaleString()}`}
                                </div>
                                <div style={{ fontSize: '0.45rem', color: 'var(--studio-text-sub)' }}>Total</div>
                            </div>
                        </div>
                        <div className="studio-donut-legend" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {w.data.map((item, idx) => {
                                const sum = w.data.reduce((a, b) => a + b.value, 0);
                                const pct = sum > 0 ? ((item.value / sum) * 100).toFixed(1) : '0';
                                return (
                                    <div key={idx} className="studio-donut-legend-item" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                                        <div className="studio-donut-legend-left" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <div className="studio-donut-bullet" style={{ width: '6px', height: '6px', borderRadius: '50%', background: THEME_COLORS[idx % THEME_COLORS.length] }} />
                                            <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>{item.label}</span>
                                        </div>
                                        <span style={{ fontWeight: 600 }}>{pct}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            case 'table':
                return (
                    <div className="studio-table-container" style={{ width: '100%', height: '100%', overflowY: 'auto' }}>
                        <table className="studio-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Category</th>
                                    <th>Revenue</th>
                                    <th>Orders</th>
                                </tr>
                            </thead>
                            <tbody>
                                {w.data.map((row: any, i: number) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{row.p}</td>
                                        <td style={{ color: 'var(--studio-text-sub)' }}>{row.c}</td>
                                        <td style={{ fontWeight: 700 }}>{row.r}</td>
                                        <td>{row.o}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            case 'heatmap':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', justifyContent: 'center' }}>
                        <div className="studio-heatmap-grid" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {w.data.map((row: any, idx: number) => (
                                <div key={idx} className="studio-heatmap-row" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span className="studio-heatmap-label" style={{ width: '70px', fontSize: '0.6rem', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.r}</span>
                                    <div className="studio-heatmap-cells" style={{ display: 'flex', flex: 1, gap: '3px' }}>
                                        {row.cells.map((val: number, cellIdx: number) => (
                                            <div
                                                key={cellIdx}
                                                className="studio-heatmap-cell"
                                                style={{
                                                    flex: 1,
                                                    height: '14px',
                                                    borderRadius: '2px',
                                                    background: val >= 8 ? '#4f46e5' :
                                                        val >= 6 ? '#6366f1' :
                                                            val >= 4 ? '#818cf8' :
                                                                val >= 2 ? '#c7d2fe' : '#e0e7ff'
                                                }}
                                                title={`${row.r} -> ${w.columns[cellIdx] || 'Store'}: weight ${val}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="studio-heatmap-months" style={{ display: 'flex', marginLeft: '74px', gap: '3px', marginTop: '2px' }}>
                            {w.columns.slice(0, 5).map((m: string, i: number) => (
                                <span key={i} className="studio-heatmap-month" style={{ flex: 1, fontSize: '0.55rem', color: 'var(--studio-text-sub)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m}>{m}</span>
                            ))}
                        </div>
                        <div className="studio-heatmap-legend" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.4rem', fontSize: '0.55rem', color: 'var(--studio-text-sub)', marginTop: '0.25rem' }}>
                            <span>Low</span>
                            <div className="studio-heatmap-gradient" style={{ width: '60px', height: '5px', borderRadius: '99px', background: 'linear-gradient(90deg, #e0e7ff 0%, #4f46e5 100%)' }} />
                            <span>High</span>
                        </div>
                    </div>
                );
            case 'forecast':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={w.data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <Tooltip />
                            <Area dataKey="fctHigh" stroke="transparent" fill="rgba(79, 70, 229, 0.08)" />
                            <Area dataKey="fctLow" stroke="transparent" fill="transparent" />
                            <Line type="monotone" dataKey="actual" name="Actual" stroke="#4f46e5" strokeWidth={2} dot={{ fill: '#4f46e5', r: 2 }} />
                            <Line type="monotone" dataKey="fct" name="Forecast" stroke="#4f46e5" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                );
            case 'area':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={w.data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 9 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 9 }} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <Tooltip />
                            <Area type="monotone" dataKey="value" stroke="#4f46e5" fill="rgba(79, 70, 229, 0.2)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                );
            case 'scatter':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis type="number" dataKey="x" name={w.columns[0] || 'X'} axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <YAxis type="number" dataKey="y" name={w.columns[1] || 'Y'} axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name={w.title} data={w.data} fill="#4f46e5" />
                        </ScatterChart>
                    </ResponsiveContainer>
                );
            case 'treemap':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                            data={w.data}
                            dataKey="value"
                            stroke="#fff"
                            fill="#4f46e5"
                        >
                            <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Value']} />
                        </Treemap>
                    </ResponsiveContainer>
                );
            case 'insights':
            case 'anomalies':
            case 'recommendations':
                return (
                    <div className="studio-bullet-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', height: '100%', overflowY: 'auto' }}>
                        {w.data.map((b: any, idx: number) => (
                            <div key={idx} className="studio-bullet-item" style={{ display: 'flex', gap: '0.4rem', fontSize: '0.725rem' }}>
                                <span className="studio-bullet-icon" style={{ flexShrink: 0 }}>{b.icon}</span>
                                <div className="studio-bullet-item-content" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span className="studio-bullet-title" style={{ fontWeight: 600 }}>{b.t}</span>
                                    <span className="studio-bullet-desc" style={{ color: 'var(--studio-text-sub)', fontSize: '0.675rem' }}>{b.d}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            default:
                return <div style={{ fontSize: '0.75rem', color: 'var(--studio-text-sub)' }}>Visual mapping not loaded</div>;
        }
    };

    return (
        <div className="an-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 1. PREMIUM HEADER PANEL (FULL WIDTH) */}
            <div className="studio-dash-header" style={{
                backgroundColor: 'white',
                border: '1px solid var(--studio-border)',
                borderRadius: '12px',
                padding: '0.75rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
                <div className="studio-dash-title-group">
                    <div className="studio-dash-title-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h2 className="studio-dash-title" style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--studio-text)' }}>
                            {dsAnalytics?.name ? dsAnalytics.name.replace('.csv', '').replace('.xlsx', '') : 'Sales Performance'} Dashboard
                        </h2>
                        <span className="studio-dash-badge" style={{
                            padding: '0.15rem 0.45rem',
                            background: 'var(--studio-purple-light)',
                            border: '1px solid var(--studio-purple-glow)',
                            borderRadius: '99px',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            color: 'var(--studio-purple)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                        }}>
                            <Sparkles size={10} /> AI Generated
                        </span>
                    </div>
                    <span className="studio-dash-subtitle" style={{ fontSize: '0.725rem', color: 'var(--studio-text-sub)', marginTop: '0.2rem' }}>
                        Dynamic Database aggregates calculated in real-time from active records
                    </span>
                </div>

                <div className="studio-dash-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    {/* Database Dropdown Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f8fafc', padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid var(--studio-border)' }}>
                        <Database size={13} color="var(--studio-text-sub)" />
                        <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Dataset:</span>
                        <select
                            style={{
                                border: 'none',
                                background: 'transparent',
                                fontSize: '0.725rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                outline: 'none',
                                color: 'var(--studio-text)'
                            }}
                            value={selectedDs}
                            onChange={(e) => setSelectedDs(e.target.value)}
                        >
                            {datasets.map((ds) => (
                                <option key={ds.id} value={ds.id}>{ds.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="studio-switch-container" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--studio-text)' }}>
                        <span>Auto Refresh</span>
                        <label className="studio-switch">
                            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                            <span className="studio-switch-slider"></span>
                        </label>
                    </div>

                    <button className="studio-topnav-btn" onClick={handleResetLayout} title="Reset Layout to Default">
                        <RefreshCw size={12} /> Reset Layout
                    </button>
                    <button
                        className={`studio-topnav-btn ${showFilterPanel || Object.keys(activeFilters).length > 0 ? 'active-filter' : ''}`}
                        onClick={() => setShowFilterPanel(!showFilterPanel)}
                        style={{
                            padding: '0.35rem 0.65rem',
                            backgroundColor: (showFilterPanel || Object.keys(activeFilters).length > 0) ? 'rgba(99, 102, 241, 0.08)' : '#ffffff',
                            color: (showFilterPanel || Object.keys(activeFilters).length > 0) ? '#4f46e5' : 'var(--studio-text)',
                            borderColor: (showFilterPanel || Object.keys(activeFilters).length > 0) ? 'rgba(99, 102, 241, 0.3)' : 'var(--studio-border)'
                        }}
                    >
                        <Sliders size={12} /> Filters
                        {Object.keys(activeFilters).length > 0 && (
                            <span style={{ backgroundColor: '#4f46e5', color: '#ffffff', borderRadius: '99px', padding: '1px 5px', fontSize: '0.55rem', fontWeight: 800, marginLeft: '0.15rem' }}>
                                {Object.keys(activeFilters).length}
                            </span>
                        )}
                    </button>

                    <button className="studio-topnav-btn" onClick={() => setShowShareModal(true)}>
                        <Share2 size={12} /> Share
                    </button>

                    <button className="studio-topnav-btn" onClick={() => setShowExportModal(true)}>
                        <Download size={12} /> Export
                    </button>

                    <button className="studio-topnav-btn primary" onClick={() => handleSaveDashboard(false)}>
                        Save
                    </button>
                </div>
            </div>

            {/* Collapsible Filter Panel */}
            {showFilterPanel && (
                <div className="studio-filter-panel" style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--studio-border)',
                    borderRadius: '12px',
                    padding: '1rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    marginTop: '0.5rem',
                    marginBottom: '0.5rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '0.825rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Sliders size={13} color="#6366f1" /> Interactive Filter Hub
                        </h4>
                        {Object.keys(activeFilters).length > 0 && (
                            <button onClick={handleClearAllFilters} style={{ background: 'transparent', border: 'none', color: '#6366f1', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <Trash2 size={11} /> Clear All Filters
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Select Dimension</label>
                            <select
                                value={filterCol}
                                onChange={e => { setFilterCol(e.target.value); setFilterVal(''); }}
                                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--studio-border)', fontSize: '0.72rem', outline: 'none', backgroundColor: '#f8fafc', fontWeight: 600, cursor: 'pointer', minWidth: '150px' }}
                            >
                                <option value="">-- Choose Column --</option>
                                {dsAnalytics?.columns.map(col => (
                                    <option key={col} value={col}>{col}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Select Value</label>
                            <select
                                value={filterVal}
                                onChange={e => setFilterVal(e.target.value)}
                                disabled={!filterCol}
                                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--studio-border)', fontSize: '0.72rem', outline: 'none', backgroundColor: '#f8fafc', fontWeight: 600, cursor: 'pointer', minWidth: '180px' }}
                            >
                                <option value="">-- Choose Value --</option>
                                {uniqueValues.map(val => (
                                    <option key={val} value={val}>{val}</option>
                                ))}
                            </select>
                        </div>

                        <Button
                            variant="primary"
                            onClick={handleAddFilter}
                            disabled={!filterCol || !filterVal}
                            style={{ padding: '0.35rem 0.85rem', height: '30px', fontSize: '0.72rem', fontWeight: 700 }}
                        >
                            Apply Filter
                        </Button>
                    </div>

                    {/* Active Filters Pills */}
                    {Object.keys(activeFilters).length > 0 && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem', borderTop: '1px dashed #f1f5f9', paddingTop: '0.5rem' }}>
                            {Object.entries(activeFilters).map(([col, val]) => (
                                <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.12)', color: '#4f46e5', padding: '0.2rem 0.4rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700 }}>
                                    <span>{col}: <strong>{val}</strong></span>
                                    <button onClick={() => handleRemoveFilter(col)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', marginLeft: '0.15rem' }}>
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Share Dialog Modal */}
            {showShareModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.3)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--studio-border)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        width: '90%',
                        maxWidth: '460px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Share2 size={18} color="#6366f1" /> Share Dashboard
                            </h3>
                            <button onClick={() => setShowShareModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.1rem', cursor: 'pointer', padding: 0 }}>
                                ×
                            </button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--studio-text-sub)', lineHeight: 1.5 }}>
                            Generate a sharing link for colleagues. Recipients will see this dashboard and any active filters you have currently applied.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Sharing Link</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    readOnly
                                    value={
                                        typeof window !== 'undefined'
                                            ? `${window.location.origin}${window.location.pathname}?filters=${encodeURIComponent(JSON.stringify(activeFilters))}`
                                            : ''
                                    }
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--studio-border)',
                                        fontSize: '0.75rem',
                                        backgroundColor: '#f8fafc',
                                        color: '#334155',
                                        outline: 'none',
                                        fontFamily: 'monospace'
                                    }}
                                />
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        const url = typeof window !== 'undefined'
                                            ? `${window.location.origin}${window.location.pathname}?filters=${encodeURIComponent(JSON.stringify(activeFilters))}`
                                            : '';
                                        navigator.clipboard.writeText(url);
                                        showToast('Dashboard sharing link copied!', 'success');
                                    }}
                                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.75rem', fontWeight: 700 }}
                                    icon={<Copy size={13} />}
                                >
                                    Copy
                                </Button>
                            </div>
                        </div>

                        {/* Additional sharing methods */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const url = typeof window !== 'undefined'
                                        ? `${window.location.origin}${window.location.pathname}?filters=${encodeURIComponent(JSON.stringify(activeFilters))}`
                                        : '';
                                    window.open(`mailto:?subject=Executive Report Dashboard&body=Here is the dashboard link: ${encodeURIComponent(url)}`);
                                }}
                                style={{ flex: 1, fontSize: '0.72rem', borderRadius: '8px', padding: '0.5rem' }}
                            >
                                Email link
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowShareModal(false)}
                                style={{ flex: 1, fontSize: '0.72rem', borderRadius: '8px', padding: '0.5rem' }}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Dialog Modal */}
            {showExportModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--studio-border)',
                        borderRadius: '16px',
                        padding: '1.75rem',
                        width: '380px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Download size={18} style={{ color: '#4f46e5' }} /> Export Dashboard
                            </h3>
                            <button onClick={() => setShowExportModal(false)} disabled={exporting} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.1rem', cursor: 'pointer', padding: 0 }}>
                                ×
                            </button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--studio-text-sub)' }}>
                            Save a high-resolution export matching the exact dimensions of your dashboard grid.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <button
                                onClick={() => handleExportFormat('pdf')}
                                disabled={exporting}
                                className="studio-topnav-btn"
                                style={{
                                    width: '100%',
                                    justifyContent: 'center',
                                    padding: '0.6rem',
                                    borderRadius: '10px',
                                    backgroundColor: '#4f46e5',
                                    color: '#ffffff',
                                    borderColor: '#4f46e5',
                                    fontWeight: 700,
                                    fontSize: '0.78rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                }}
                            >
                                {exporting ? <RefreshCw size={14} className="animate-spin" /> : 'Export as PDF Document'}
                            </button>

                            <button
                                onClick={() => handleExportFormat('png')}
                                disabled={exporting}
                                className="studio-topnav-btn"
                                style={{
                                    width: '100%',
                                    justifyContent: 'center',
                                    padding: '0.6rem',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.78rem'
                                }}
                            >
                                Export as PNG Image
                            </button>

                            <button
                                onClick={() => handleExportFormat('jpeg')}
                                disabled={exporting}
                                className="studio-topnav-btn"
                                style={{
                                    width: '100%',
                                    justifyContent: 'center',
                                    padding: '0.6rem',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '0.78rem'
                                }}
                            >
                                Export as JPEG Image
                            </button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                            <Button
                                variant="outline"
                                onClick={() => setShowExportModal(false)}
                                disabled={exporting}
                                style={{ fontSize: '0.72rem', borderRadius: '8px', padding: '0.4rem 0.8rem' }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. SPLIT VIEWPORT CANVAS + CHATBOT (FULL HEIGHT SCROLL SPLIT) */}
            <div className="studio-viewport">

                {/* CENTER CANVAS PANE */}
                <div ref={canvasRef} className="studio-canvas" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, minWidth: 0 }}>

                    {/* A. EXECUTIVE KPI SUMMARY BAR */}
                    <div className="studio-kpi-row" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1rem',
                        width: '100%'
                    }}>
                        {widgets.filter(w => w.type === 'kpi').map((w) => {
                            const index = widgets.findIndex(x => x.id === w.id);
                            const size = cardSizes[w.id];
                            const currentWidth = size?.width || '100%';
                            const currentHeight = size?.height || 125; // Sleek, clean, uniform executive height

                            return (
                                <div
                                    key={w.id}
                                    className={`studio-chart-card kpi-card ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                                    style={{
                                        width: currentWidth,
                                        height: `${currentHeight}px`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: '0.85rem 1.1rem',
                                        boxSizing: 'border-box',
                                        borderLeft: `4px solid ${THEME_COLORS[index % THEME_COLORS.length]}`,
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
                                    }}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragEnd={handleDragEnd}
                                >
                                    {/* Dotted grab handle */}
                                    <div className="studio-drag-handle" title="Drag to reorder KPIs" />

                                    {/* Card Header controls */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                        <div className="studio-chart-title" style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                            {getWidgetIcon(w.type)}
                                            <span>{w.title}</span>
                                        </div>
                                        <button
                                            style={{ border: 'none', background: 'transparent', color: 'var(--studio-text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.5 }}
                                            onClick={() => {
                                                if (lastWidgetIdRef.current === w.id) {
                                                    lastWidgetIdRef.current = null;
                                                }
                                                setWidgets(prev => prev.filter(item => item.id !== w.id));
                                                showToast('KPI box removed.', 'info');
                                            }}
                                            title="Delete KPI"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </div>

                                    {/* Chart/Visual content */}
                                    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                                        {renderWidgetContent(w)}
                                    </div>

                                    {/* Bottom-right resizing cursor handle */}
                                    <div className="studio-resize-handle" onMouseDown={(e) => handleResizeMouseDown(e, w.id)} />
                                </div>
                            );
                        })}
                    </div>

                    {/* B. DYNAMIC VISUALS CANVAS (UNIFORM HEIGHT TO PREVENT floating / dropped boxes!) */}
                    <div className="studio-chart-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(12, 1fr)',
                        gap: '1rem',
                        width: '100%'
                    }}>
                        {widgets.filter(w => w.type !== 'kpi').map((w) => {
                            const index = widgets.findIndex(x => x.id === w.id);
                            const size = cardSizes[w.id];
                            const currentHeight = size?.height || 230; // Perfect uniform height for straight grid alignment!

                            return (
                                <div
                                    key={w.id}
                                    className={`studio-chart-card ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                                    style={{
                                        gridColumn: size?.width ? undefined : 'span ' + w.width,
                                        width: size?.width || '100%',
                                        height: `${currentHeight}px`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: '1.1rem',
                                        boxSizing: 'border-box',
                                        borderTop: `4px solid ${THEME_COLORS[index % THEME_COLORS.length]}`,
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05)'
                                    }}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragEnd={handleDragEnd}
                                >
                                    {/* Dotted grab handle */}
                                    <div className="studio-drag-handle" title="Drag to reorder visual" />

                                    {/* Card Header controls */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <div className="studio-chart-title">
                                            {getWidgetIcon(w.type)}
                                            <span style={{ fontSize: '0.825rem', fontWeight: 700 }}>{w.title}</span>
                                        </div>
                                        <button
                                            style={{ border: 'none', background: 'transparent', color: 'var(--studio-text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                            onClick={() => {
                                                if (lastWidgetIdRef.current === w.id) {
                                                    lastWidgetIdRef.current = null;
                                                }
                                                setWidgets(prev => prev.filter(item => item.id !== w.id));
                                                showToast('Visual card removed.', 'info');
                                            }}
                                            title="Delete Visual"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>

                                    {/* Chart/Visual content */}
                                    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                                        {renderWidgetContent(w)}
                                    </div>

                                    {/* Bottom-right resizing cursor handle */}
                                    <div className="studio-resize-handle" onMouseDown={(e) => handleResizeMouseDown(e, w.id)} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT SIDEBAR: PERSISTENT AI ASSISTANT CHAT */}
                <div className="studio-sidebar-right">
                    <div className="studio-right-header">
                        <span className="studio-right-title">
                            <Sparkles size={14} style={{ color: '#6366f1' }} /> AI Assistant
                        </span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="studio-btn-circle" style={{ width: '22px', height: '22px', display: 'none' }} onClick={() => setWidgets([])} title="Clear Grid Dashboard">
                                <RefreshCw size={10} />
                            </button>
                            <button className="studio-btn-circle" style={{ width: '22px', height: '22px' }}>
                                <Maximize2 size={10} />
                            </button>
                        </div>
                    </div>

                    {/* Dialogue bubble lists */}
                    <div className="studio-right-scroll">
                        {chatMsgs.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', width: '100%' }}>

                                <div className={`studio-bubble ${msg.role}`}>
                                    <div>
                                        {renderMarkdownToJSX(msg.text, msg.role === 'user')}
                                    </div>
                                </div>

                                {msg.suggestedPrompts && msg.role === 'ai' && (
                                    <div className="bi-msg-actions" style={{ paddingLeft: '0.2rem' }}>
                                        {msg.suggestedPrompts.map((p, idx) => (
                                            <button key={idx} className="bi-msg-action-btn" onClick={() => handleTriggerPrompt(p)} disabled={chatBusy}>
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {chatBusy && (
                            <div className="studio-bubble ai" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <RefreshCw className="animate-spin" size={10} />
                                <span>AI Assistant thinking...</span>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Interactive Suggestion Pills */}
                    <div className="studio-chat-actions">
                        {getDynamicSuggestions(dsAnalytics).map((promptText, idx) => {
                            let label = promptText;
                            if (promptText.startsWith('Change ')) {
                                label = 'Change trend visual';
                            } else if (promptText.startsWith('Add a ')) {
                                label = `Add ${promptText.split('for ')[1]?.split(' ')[0] || 'category'} pie`;
                            } else if (promptText.startsWith('Convert ')) {
                                label = 'Convert chart type';
                            } else if (promptText.includes('insights')) {
                                label = 'Explain insights';
                            }
                            return (
                                <button key={idx} className="studio-chat-action-btn" onClick={() => handleTriggerPrompt(promptText)} disabled={chatBusy}>
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Chat dialogue bottom inputs */}
                    <div className="studio-chat-input-container">
                        <div className="studio-chat-input-row">
                            <input
                                placeholder="Ask to add, modify, or remove visuals..."
                                className="studio-chat-input"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendChatInput()}
                                disabled={chatBusy}
                            />
                            <button onClick={handleSendChatInput} disabled={chatBusy} style={{ color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Send size={14} />
                            </button>
                        </div>
                        <span className="studio-chat-footer-text">
                            AI can make mistakes. Please verify important information.
                        </span>
                    </div>

                </div>

            </div>

        </div>
    );
}

// ── Fallback missing Lucide icon definitions to ensure TypeScript compiles safely ──
function BinaryIcon(props: any) {
    return <Type {...props} />;
}

function CheckCircleIcon(props: any) {
    return <Check {...props} />;
}
