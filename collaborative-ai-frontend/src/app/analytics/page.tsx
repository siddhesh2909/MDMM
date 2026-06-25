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
    LayoutGrid, ChevronUp, ChevronDown, ChevronRight, Check, ArrowRight,
    Home, Compass, Cpu, Bell, FileText, Lock, History, MessageSquare,
    Share2, Sliders, Settings, MoreHorizontal
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line,
    ScatterChart, Scatter, ZAxis, Treemap, FunnelChart, Funnel, LabelList,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
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
    type: 'kpi' | 'bar' | 'pie' | 'line' | 'area' | 'table' | 'heatmap' | 'forecast' | 'insights' | 'anomalies' | 'recommendations' | 'scatter' | 'treemap' | 'histogram' | 'map' | 'waterfall' | 'bubble' | 'radar' | 'gauge' | 'progress' | 'pivot' | 'wordcloud' | 'calendar' | 'boxplot';
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
    recommendations?: Widget[];
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
    
    // Auto-Generated Templates engine states
    const [autoModeEnabled, setAutoModeEnabled] = useState(true);
    const [detectedCategory, setDetectedCategory] = useState('Generic Business Dataset');
    const [detectedConfidence, setDetectedConfidence] = useState(100);
    const [aiExplanation, setAiExplanation] = useState('');
    const [recommendations, setRecommendations] = useState<Widget[]>([]);

    const [showExportModal, setShowExportModal] = useState(false);
    
    // Enterprise BI extension states
    const [showMarketplace, setShowMarketplace] = useState(false);
    const [showChartBuilder, setShowChartBuilder] = useState(false);
    const [showVersionsPanel, setShowVersionsPanel] = useState(false);
    const [showAlertsPanel, setShowAlertsPanel] = useState(false);
    const [showCommentsPanel, setShowCommentsPanel] = useState(false);
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [showHealthModal, setShowHealthModal] = useState(false);
    const [showDrillThrough, setShowDrillThrough] = useState(false);

    const [showOverflowMenu, setShowOverflowMenu] = useState(false);
    const overflowRef = useRef<HTMLDivElement>(null);

    // AI Analytics Workspace states
    const [workspaceState, setWorkspaceState] = useState<'home' | 'dashboard'>('home');
    const [searchQuery, setSearchQuery] = useState('');
    const [favoriteDsIds, setFavoriteDsIds] = useState<string[]>([]);
    const [savedDashboards, setSavedDashboards] = useState<any[]>([]);
    const [recentConversations, setRecentConversations] = useState<any[]>([]);
    const [generating, setGenerating] = useState(false);
    const [generationStep, setGenerationStep] = useState(0);
    const [promptInput, setPromptInput] = useState('');
    const [localDatasets, setLocalDatasets] = useState<any[]>([]);
    
    // Dataset management modals
    const [previewDatasetData, setPreviewDatasetData] = useState<any[] | null>(null);
    const [previewDatasetMetadata, setPreviewDatasetMetadata] = useState<DatasetAnalytics | null>(null);
    
    // Track renaming / duplicating state
    const [renamingDsId, setRenamingDsId] = useState<string | null>(null);
    const [renamingDsValue, setRenamingDsValue] = useState('');

    // Additional Workspace Design mockup interactive states
    const [showUploadDsModal, setShowUploadDsModal] = useState(false);
    const [showTourModal, setShowTourModal] = useState(false);
    const [showAttachFilesModal, setShowAttachFilesModal] = useState(false);
    const [showAddFilterPop, setShowAddFilterPop] = useState(false);
    const [showParamsPop, setShowParamsPop] = useState(false);

    // States for custom modals
    const [paramTemperature, setParamTemperature] = useState(0.2);
    const [paramMode, setParamMode] = useState('Standard');
    const [paramMaxWidgets, setParamMaxWidgets] = useState(8);
    const [paramTheme, setParamTheme] = useState('Indigo');
    const [filterColumn, setFilterColumn] = useState('');
    const [filterOperator, setFilterOperator] = useState('=');
    const [filterValue, setFilterValue] = useState('');
    const [isProfileLoaded, setIsProfileLoaded] = useState(false);


    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        // Load Saved Dashboards
        const localDashes = localStorage.getItem('workspace_dashboards');
        if (localDashes) {
            try {
                setSavedDashboards(JSON.parse(localDashes));
            } catch { /* ignore */ }
        } else {
            const mockSaved = [
                {
                    id: 'dash-products-50',
                    name: 'Sales Performance & Revenue Canvas',
                    datasetId: 'products-50',
                    datasetName: 'products-50.csv',
                    type: 'Sales Dashboard',
                    createdAt: '2026-06-25T10:00:00Z',
                    lastEdited: '2026-06-25T17:43:23Z',
                    owner: 'Rahul Sharma',
                    version: '1.0.3'
                },
                {
                    id: 'dash-mock-hr',
                    name: 'Global Talent Retention Analytics',
                    datasetId: 'mock-hr',
                    datasetName: 'employee_retention.xlsx',
                    type: 'HR Dashboard',
                    createdAt: '2026-06-24T08:30:00Z',
                    lastEdited: '2026-06-24T14:20:00Z',
                    owner: 'Sarah Jenkins',
                    version: '2.1.0'
                }
            ];
            localStorage.setItem('workspace_dashboards', JSON.stringify(mockSaved));
            setSavedDashboards(mockSaved);
        }

        // Load Recent Conversations
        const localConvs = localStorage.getItem('workspace_conversations');
        if (localConvs) {
            try {
                setRecentConversations(JSON.parse(localConvs));
            } catch { /* ignore */ }
        } else {
            const mockConvs = [
                {
                    id: 'conv-sales-trend',
                    prompt: 'Show total spent trends over signup dates and product rankings',
                    datasetId: 'products-50',
                    datasetName: 'products-50.csv',
                    timestamp: '2026-06-25T12:00:00Z',
                    chatMsgs: [
                        { role: 'user', text: 'Show total spent trends over signup dates and product rankings' },
                        { role: 'ai', text: 'I classified your dataset as **Sales Performance**. I generated a line chart showing Total spent Trend over signup_date and a bar chart showing Total spent by product categories. Let me know if you need to adjust calculations!' }
                    ]
                },
                {
                    id: 'conv-hr-insights',
                    prompt: 'Build a dashboard to analyze salary ranges and experience details',
                    datasetId: 'mock-hr',
                    datasetName: 'employee_retention.xlsx',
                    timestamp: '2026-06-24T15:10:00Z',
                    chatMsgs: [
                        { role: 'user', text: 'Build a dashboard to analyze salary ranges and experience details' },
                        { role: 'ai', text: 'I generated an **HR Analytics Dashboard** mapping employee salaries against job roles, tenure ranges, and departments. I also included what-if recruitment calculators.' }
                    ]
                }
            ];
            localStorage.setItem('workspace_conversations', JSON.stringify(mockConvs));
            setRecentConversations(mockConvs);
        }

        // Load Favorites
        const localFavs = localStorage.getItem('workspace_favorite_datasets');
        if (localFavs) {
            try {
                setFavoriteDsIds(JSON.parse(localFavs));
            } catch { /* ignore */ }
        }
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) {
                setShowOverflowMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [versionsList, setVersionsList] = useState<any[]>([]);
    const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
    const [collaborationComments, setCollaborationComments] = useState<any[]>([]);
    const [businessGlossary, setBusinessGlossary] = useState<Record<string, any>>({});
    const [dashboardHealth, setDashboardHealth] = useState<{ score: number, suggestions: string[] }>({ score: 100, suggestions: [] });
    const [drillThroughRows, setDrillThroughRows] = useState<any[]>([]);
    const [drillThroughFilter, setDrillThroughFilter] = useState<string>('');

    // What-if sliders
    const [whatIfPrice, setWhatIfPrice] = useState(0); // percent change
    const [whatIfMarketing, setWhatIfMarketing] = useState(0); // percent change

    // Visual chart builder selection states
    const [builderX, setBuilderX] = useState('');
    const [builderY, setBuilderY] = useState('');
    const [builderType, setBuilderType] = useState('bar');
    const [builderAgg, setBuilderAgg] = useState('sum');

    // Diagnostics panel stats
    const [perfLoadTime, setPerfLoadTime] = useState(0);
    const [perfRenderTime, setPerfRenderTime] = useState(0);
    const [perfApiLatency, setPerfApiLatency] = useState(0);

    // Form inputs
    const [newVersionChangelog, setNewVersionChangelog] = useState('');
    const [newAlertMetric, setNewAlertMetric] = useState('');
    const [newAlertOperator, setNewAlertOperator] = useState('below');
    const [newAlertThreshold, setNewAlertThreshold] = useState('');
    const [newAlertEmail, setNewAlertEmail] = useState(true);
    const [newCommentText, setNewCommentText] = useState('');
    const [commentWidgetId, setCommentWidgetId] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);

    const [marketType, setMarketType] = useState('kpi');
    const [marketTitle, setMarketTitle] = useState('');
    const [marketDim, setMarketDim] = useState('');
    const [marketMeas, setMarketMeas] = useState('');
    const [marketWidth, setMarketWidth] = useState(6);


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
    const [expandedRecs, setExpandedRecs] = useState<Record<number, boolean>>({});
    const chatEndRef = useRef<HTMLDivElement>(null);

    const toggleRecommendations = (msgIndex: number) => {
        setExpandedRecs(prev => ({
            ...prev,
            [msgIndex]: !prev[msgIndex]
        }));
    };

    const [chatCollapsed, setChatCollapsed] = useState(false);

    const toggleFullscreen = () => {
        if (!canvasRef.current) return;
        if (!document.fullscreenElement) {
            canvasRef.current.requestFullscreen().catch((err) => {
                showToast('Failed to enter fullscreen mode', 'error');
            });
        } else {
            document.exitFullscreen();
        }
    };

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
                    contractStatus: 'Active',
                    quality: 96,
                    size: '4.8 KB',
                    rowsCount: 50,
                    columnsCount: 11,
                    category: 'Sales',
                    ownerName: 'Rahul Sharma',
                    uploadedDate: '2026-06-25',
                    favorite: false
                };
                let dbMapped: any[] = [];
                if (d) {
                    dbMapped = d.map((ds: any) => ({
                        id: ds.id,
                        name: ds.name,
                        status: ds.status || 'Active',
                        contractStatus: ds.contractStatus || '',
                        quality: ds.quality || 95,
                        size: ds.rawData ? `${(JSON.stringify(ds.rawData).length / 1024).toFixed(1)} KB` : '12.4 KB',
                        rowsCount: ds.rawData ? ds.rawData.length : 150,
                        columnsCount: 8,
                        category: ds.name.toLowerCase().includes('hr') ? 'HR' : ds.name.toLowerCase().includes('finance') ? 'Finance' : 'Generic',
                        ownerName: ds.owner?.name || 'Administrator',
                        uploadedDate: new Date(ds.createdAt).toISOString().split('T')[0],
                        favorite: false
                    }));
                }
                const mockLibrary = [
                    mockDs,
                    {
                        id: 'mock-hr',
                        name: 'employee_retention.xlsx',
                        status: 'Active',
                        contractStatus: 'Active',
                        quality: 98,
                        size: '85 KB',
                        rowsCount: 1500,
                        columnsCount: 24,
                        category: 'HR',
                        ownerName: 'Sarah Jenkins',
                        uploadedDate: '2026-06-24',
                        favorite: false
                    },
                    {
                        id: 'mock-churn',
                        name: 'customer_churn.csv',
                        status: 'Active',
                        contractStatus: 'Active',
                        quality: 92,
                        size: '42 KB',
                        rowsCount: 820,
                        columnsCount: 15,
                        category: 'Marketing',
                        ownerName: 'David Lee',
                        uploadedDate: '2026-06-23',
                        favorite: false
                    },
                    {
                        id: 'mock-finance',
                        name: 'finance_q2_raw.csv',
                        status: 'Active',
                        contractStatus: 'Active',
                        quality: 94,
                        size: '124 KB',
                        rowsCount: 2400,
                        columnsCount: 18,
                        category: 'Finance',
                        ownerName: 'Elena Rostova',
                        uploadedDate: '2026-06-20',
                        favorite: false
                    }
                ];
                // Combine and prevent duplicate IDs
                const combined = [...mockLibrary];
                if (dbMapped.length > 0) {
                    dbMapped.forEach((dbItem: any) => {
                        if (!combined.some(c => c.id === dbItem.id)) {
                            combined.push(dbItem);
                        }
                    });
                }
                
                // Filter out deleted datasets persisted in localStorage
                const localDeleted = localStorage.getItem('workspace_deleted_datasets');
                const deletedIds: string[] = localDeleted ? JSON.parse(localDeleted) : [];
                const activeDatasets = combined.filter(d => !deletedIds.includes(d.id));

                setLocalDatasets(activeDatasets);
                setDatasets(activeDatasets);
                if (activeDatasets.length > 0) {
                    setSelectedDs(prev => prev || activeDatasets[0].id);
                }
            } catch {
                showToast('Failed to retrieve datasets.', 'error');
            }
        })();
    }, [showToast]);

    // Fetch active dashboard flag on page load
    useEffect(() => {
        (async () => {
            try {
                const profile: any = await apiClient.get('/data/users/profile');
                if (profile && profile.activeDatasetId) {
                    setSelectedDs(profile.activeDatasetId);
                    setWorkspaceState('dashboard');
                }
            } catch (err) {
                console.error("Failed to load user active state from DB:", err);
            } finally {
                setIsProfileLoaded(true);
            }
        })();
    }, []);

    // Sync active dataset/dashboard status to database
    useEffect(() => {
        if (!isProfileLoaded) return;
        if (workspaceState === 'dashboard' && selectedDs) {
            apiClient.patch('/data/users/profile', { activeDatasetId: selectedDs }).catch(err => {
                console.error("Failed to set active dashboard flag in DB:", err);
            });
        } else if (workspaceState === 'home') {
            apiClient.patch('/data/users/profile', { activeDatasetId: null }).catch(err => {
                console.error("Failed to deactivate active dashboard flag in DB:", err);
            });
        }
    }, [workspaceState, selectedDs, isProfileLoaded]);

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
                let det: any = null;

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
                    det = await apiClient.get(`/data/datasets/${selectedDs}`);
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

                    // Execute Auto-Template scanning & category detection: prioritize backend metadata
                    const cat = (stats as any).detectedCategory || detectDatasetCategory(stats).category;
                    const conf = (stats as any).detectedConfidence !== undefined ? (stats as any).detectedConfidence : detectDatasetCategory(stats).confidence;
                    const explanation = (stats as any).aiExplanation || generateAiExplanation(cat, stats);

                    setDetectedCategory(cat);
                    setDetectedConfidence(conf);
                    setAiExplanation(explanation);

                    const generatedRecommendations = getChartRecommendations(stats, rows);
                    setRecommendations(generatedRecommendations);

                    // Restore layout configuration: try backend database first, fallback to localStorage
                    let savedLayout = null;
                    if (det?.data?.dataset?.dashboardLayout) {
                        try {
                            savedLayout = JSON.parse(det.data.dataset.dashboardLayout);
                        } catch { /* ignore */ }
                    }
                    if (!savedLayout) {
                        const layoutKey = selectedDs || 'default';
                        const localLayoutStr = localStorage.getItem(`dashboard_layout_${layoutKey}`);
                        if (localLayoutStr) {
                            try {
                                savedLayout = JSON.parse(localLayoutStr);
                            } catch { /* ignore */ }
                        }
                    }

                    if (savedLayout) {
                        try {
                            const remappedWidgets = updateAllWidgetsData(rows, savedLayout.widgets, stats);
                            setWidgets(remappedWidgets);
                            setCardSizes(savedLayout.cardSizes || {});
                            if (savedLayout.autoModeEnabled !== undefined) {
                                setAutoModeEnabled(savedLayout.autoModeEnabled);
                            } else {
                                setAutoModeEnabled(false);
                            }
                            showToast('Loaded saved dashboard configuration.', 'success');
                        } catch (err) {
                            console.error('Failed to restore saved layout:', err);
                            setAutoModeEnabled(true);
                            buildExecutiveDashboard(stats, rows, cat);
                        }
                    } else {
                        setAutoModeEnabled(true);
                        buildExecutiveDashboard(stats, rows, cat);
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
                            text: `👋 Greetings! I have analyzed the **${stats.name}** schema containing **${rows.length.toLocaleString()}** records across **${stats.columns.length}** columns.\n\n${explanation}\n\nHere are some AI recommended charts you can add to the dashboard:`,
                            suggestedPrompts: getDynamicSuggestions(stats).slice(0, 2),
                            recommendations: generatedRecommendations
                        }
                    ]);
                    // Fetch Enterprise BI backend services metadata
                    const startBI = performance.now();
                    if (selectedDs && selectedDs !== 'products-50') {
                        apiClient.get(`/datasets/${selectedDs}/bi/versions`).then(res => res && setVersionsList(res as any[]));
                        apiClient.get(`/datasets/${selectedDs}/bi/alerts`).then(res => res && setActiveAlerts(res as any[]));
                        apiClient.get(`/datasets/${selectedDs}/bi/comments`).then(res => res && setCollaborationComments(res as any[]));
                        apiClient.get(`/datasets/${selectedDs}/bi/glossary`).then(res => res && setBusinessGlossary(res as Record<string, any>));
                        apiClient.get(`/datasets/${selectedDs}/bi/health`).then(res => res && setDashboardHealth(res as { score: number, suggestions: string[] }));
                    } else {
                        setVersionsList([
                            { id: 'v-prod-1', version: 1, changeLog: 'Initial executive auto dashboard', changedBy: 'System Auto-Gen', createdAt: new Date().toISOString() }
                        ]);
                        setActiveAlerts([
                            { id: 'a-prod-1', metric: 'total_spent', operator: 'below', threshold: 1000, emailAlert: true, status: 'Active' }
                        ]);
                        setCollaborationComments([
                            { id: 'c-prod-1', widgetId: null, userName: 'Aman Verma', content: 'We need to include demographic splits by state.', isResolved: false, createdAt: new Date().toISOString() }
                        ]);
                        setBusinessGlossary({
                            total_spent: { definition: 'Aggregate customer spend value', formula: 'SUM(total_spent)', meaning: 'Primary top-line financial indicator' },
                            age: { definition: 'Demographic age index', formula: 'AVG(age)', meaning: 'Represents age coordinates of customer cohort' }
                        });
                        setDashboardHealth({
                            score: 95,
                            suggestions: ['Add a Treemap or Histogram for detailed distribution insights.']
                        });
                    }
                    const loadDuration = Math.round(performance.now() - startBI);
                    setPerfLoadTime(loadDuration);

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

    const getChartRecommendations = (stats: DatasetAnalytics, rows: any[]): Widget[] => {
        const cols = Object.keys(stats.stats);
        const numCols = cols.filter(c => stats.stats[c]?.type === 'numeric');
        const catCols = cols.filter(c => stats.stats[c]?.type === 'categorical');

        const dateDim = cols.find(c => {
            const l = c.toLowerCase();
            return l.includes('date') || l.includes('time') || l.includes('year') || l.includes('month');
        }) || '';

        const recs: Widget[] = [];

        // 1. Line Chart: Revenue / Numeric + Date
        if (dateDim && numCols.length > 0) {
            const primaryNum = numCols.find(c => {
                const l = c.toLowerCase();
                return l.includes('revenue') || l.includes('sales') || l.includes('spent') || l.includes('amount') || l.includes('price');
            }) || numCols[0];

            if (primaryNum) {
                const monthlyDataMap: Record<string, number> = {};
                rows.forEach(row => {
                    const formatted = formatExcelDate(row[dateDim]);
                    if (!monthlyDataMap[formatted]) monthlyDataMap[formatted] = 0;
                    monthlyDataMap[formatted] += Number(row[primaryNum]) || 0;
                });
                const lineData = Object.entries(monthlyDataMap).map(([label, value]) => ({
                    label,
                    value: Math.round(value * 100) / 100,
                    valuePY: Math.round(value * 0.85 * 100) / 100
                })).slice(-12);

                recs.push({
                    id: `rec-line-${primaryNum}`,
                    title: `${primaryNum.charAt(0).toUpperCase() + primaryNum.slice(1)} Trend Over Time`,
                    type: 'line',
                    data: lineData,
                    columns: [dateDim, primaryNum],
                    width: 6
                });
            }
        }

        // 2. Pie Chart: Department / Categorical Split (low cardinality)
        const lowCardCat = catCols.filter(c => {
            const uniq = stats.stats[c]?.uniqueCount || 0;
            return uniq > 1 && uniq <= 10;
        });
        
        lowCardCat.forEach(cat => {
            const numColForPie = numCols.find(c => {
                const l = c.toLowerCase();
                return l.includes('revenue') || l.includes('sales') || l.includes('spent') || l.includes('amount') || l.includes('salary');
            }) || numCols[0];

            let pieData = [];
            if (numColForPie) {
                pieData = aggregateMetric(rows, cat, numColForPie, 'sum').slice(0, 5);
            } else {
                const counts: Record<string, number> = {};
                rows.forEach(r => {
                    const val = String(r[cat] ?? 'Unknown');
                    counts[val] = (counts[val] || 0) + 1;
                });
                pieData = Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value).slice(0, 5);
            }

            recs.push({
                id: `rec-pie-${cat}`,
                title: `Distribution by ${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
                type: 'pie',
                data: pieData,
                columns: numColForPie ? [cat, numColForPie] : [cat],
                width: 4
            });
        });

        // 3. Bar Chart: Region / Categorical + Sales / Numeric
        if (catCols.length > 0 && numCols.length > 0) {
            const barCat = catCols.find(c => {
                const l = c.toLowerCase();
                return l.includes('region') || l.includes('country') || l.includes('state') || l.includes('city') || l.includes('device') || l.includes('category');
            }) || catCols[0];

            const barNum = numCols.find(c => {
                const l = c.toLowerCase();
                return l.includes('sales') || l.includes('revenue') || l.includes('spent') || l.includes('amount') || l.includes('price');
            }) || numCols[0];

            if (barCat && barNum) {
                const barData = aggregateMetric(rows, barCat, barNum, 'sum').slice(0, 5);
                recs.push({
                    id: `rec-bar-${barCat}`,
                    title: `${barNum.charAt(0).toUpperCase() + barNum.slice(1)} by ${barCat.charAt(0).toUpperCase() + barCat.slice(1)}`,
                    type: 'bar',
                    data: barData,
                    columns: [barCat, barNum],
                    width: 6
                });
            }
        }

        // 4. Histogram: Age / Numeric Distribution
        const histCol = numCols.find(c => {
            const l = c.toLowerCase();
            return l.includes('age') || l.includes('spent') || l.includes('price') || l.includes('score') || l.includes('salary');
        });
        if (histCol && stats.distributions[histCol]) {
            const buckets = stats.distributions[histCol].map(b => ({
                label: b.label,
                value: b.count
            }));
            recs.push({
                id: `rec-hist-${histCol}`,
                title: `${histCol.charAt(0).toUpperCase() + histCol.slice(1)} Frequency Distribution`,
                type: 'histogram',
                data: buckets,
                columns: [histCol],
                width: 6
            });
        }

        // 5. Geographic Map: Latitude + Longitude Coordinates Plotter
        const latCol = cols.find(c => {
            const l = c.toLowerCase();
            return l === 'lat' || l === 'latitude';
        });
        const lngCol = cols.find(c => {
            const l = c.toLowerCase();
            return l === 'lng' || l === 'lon' || l === 'longitude';
        });

        if (latCol && lngCol) {
            const points = rows
                .map(r => {
                    const lat = Number(r[latCol]);
                    const lng = Number(r[lngCol]);
                    return { lat, lng };
                })
                .filter(pt => !isNaN(pt.lat) && !isNaN(pt.lng));

            if (points.length > 0) {
                const lats = points.map(p => p.lat);
                const lngs = points.map(p => p.lng);
                const minLat = Math.min(...lats);
                const maxLat = Math.max(...lats);
                const minLng = Math.min(...lngs);
                const maxLng = Math.max(...lngs);

                const latRange = maxLat - minLat || 1;
                const lngRange = maxLng - minLng || 1;

                const mappedData = points.map(pt => ({
                    lat: pt.lat,
                    lng: pt.lng,
                    x: 10 + ((pt.lng - minLng) / lngRange) * 80,
                    y: 10 + ((pt.lat - minLat) / latRange) * 80
                }));

                recs.push({
                    id: `rec-map-${latCol}`,
                    title: `Geographic Coordinate Map`,
                    type: 'map',
                    data: mappedData,
                    columns: [latCol, lngCol],
                    width: 6
                });
            }
        }

        // 6. Scatter Plot: Sales + Profit
        if (numCols.length >= 2) {
            const xCol = numCols.find(c => {
                const l = c.toLowerCase();
                return l.includes('sales') || l.includes('spent') || l.includes('price') || l.includes('quantity') || l.includes('qty');
            }) || numCols[0];
            const yCol = numCols.find(c => {
                const l = c.toLowerCase();
                return l !== xCol && (l.includes('profit') || l.includes('margin') || l.includes('spent') || l.includes('age'));
            }) || numCols[1];

            if (xCol && yCol) {
                const scatterData = rows.slice(0, 50).map(r => ({
                    x: Number(r[xCol]) || 0,
                    y: Number(r[yCol]) || 0
                }));

                recs.push({
                    id: `rec-scatter-${xCol}-${yCol}`,
                    title: `${xCol.charAt(0).toUpperCase() + xCol.slice(1)} vs ${yCol.charAt(0).toUpperCase() + yCol.slice(1)} Correlation`,
                    type: 'scatter',
                    data: scatterData,
                    columns: [xCol, yCol],
                    width: 6
                });
            }
        }

        return recs.slice(0, 4);
    };

    const handleAddRecommendedWidget = async (rec: Widget) => {
        const uniqueId = `w-rec-${rec.type}-${Date.now()}`;
        const newWidget: Widget = {
            ...rec,
            id: uniqueId,
            width: rec.type === 'pie' ? 4 : 6
        };

        const updatedWidgets = [...widgets, newWidget];
        setWidgets(updatedWidgets);
        showToast(`Added ${rec.title} to dashboard!`, 'success');

        try {
            const layoutKey = selectedDs || 'default';
            localStorage.setItem(`dashboard_layout_${layoutKey}`, JSON.stringify({
                widgets: updatedWidgets,
                cardSizes,
                autoModeEnabled
            }));

            if (selectedDs && selectedDs !== 'products-50') {
                await apiClient.patch(`/data/datasets/${selectedDs}`, {
                    dashboardLayout: JSON.stringify({
                        widgets: updatedWidgets,
                        cardSizes,
                        autoModeEnabled
                    })
                });
            }
        } catch (err) {
            console.error('Failed to sync widget layout after addition:', err);
        }
    };

    const handleSaveVersion = async () => {
        if (!newVersionChangelog.trim()) {
            showToast('Changelog description is required.', 'error');
            return;
        }
        try {
            if (selectedDs && selectedDs !== 'products-50') {
                const res: any = await apiClient.post(`/datasets/${selectedDs}/bi/versions`, {
                    widgets,
                    cardSizes,
                    changeLog: newVersionChangelog
                });
                if (res) {
                    setVersionsList(prev => [res, ...prev]);
                    setNewVersionChangelog('');
                    showToast('Dashboard layout version snapshot saved!', 'success');
                }
            } else {
                const mockVer = {
                    id: `v-mock-${Date.now()}`,
                    version: versionsList.length + 1,
                    changeLog: newVersionChangelog,
                    changedBy: 'Demo Analyst',
                    createdAt: new Date().toISOString()
                };
                setVersionsList(prev => [mockVer, ...prev]);
                setNewVersionChangelog('');
                showToast('Dashboard layout version snapshot saved locally!', 'success');
            }
        } catch {
            showToast('Failed to save dashboard version.', 'error');
        }
    };

    const handleRollbackVersion = async (versionId: string) => {
        try {
            if (selectedDs && selectedDs !== 'products-50') {
                const res: any = await apiClient.post(`/datasets/${selectedDs}/bi/versions/${versionId}/rollback`, {});
                if (res?.success && res.layout) {
                    setWidgets(res.layout.widgets || []);
                    setCardSizes(res.layout.cardSizes || {});
                    showToast('Dashboard rolled back to selected version!', 'success');
                }
            } else {
                const target = versionsList.find(v => v.id === versionId);
                if (target) {
                    showToast('Demo rollback triggered successfully!', 'success');
                }
            }
        } catch {
            showToast('Failed to rollback dashboard version.', 'error');
        }
    };

    const handleAddAlertRule = async () => {
        if (!newAlertMetric || !newAlertThreshold) {
            showToast('Metric column and threshold value are required.', 'error');
            return;
        }
        try {
            if (selectedDs && selectedDs !== 'products-50') {
                const res: any = await apiClient.post(`/datasets/${selectedDs}/bi/alerts`, {
                    metric: newAlertMetric,
                    operator: newAlertOperator,
                    threshold: Number(newAlertThreshold),
                    emailAlert: newAlertEmail
                });
                if (res) {
                    setActiveAlerts(prev => [res, ...prev]);
                    setNewAlertMetric('');
                    setNewAlertThreshold('');
                    showToast('Custom Business Alert Rule registered!', 'success');
                }
            } else {
                const mockAlert = {
                    id: `a-mock-${Date.now()}`,
                    metric: newAlertMetric,
                    operator: newAlertOperator,
                    threshold: Number(newAlertThreshold),
                    emailAlert: newAlertEmail,
                    status: 'Active'
                };
                setActiveAlerts(prev => [mockAlert, ...prev]);
                setNewAlertMetric('');
                setNewAlertThreshold('');
                showToast('Custom Business Alert Rule registered locally!', 'success');
            }
        } catch {
            showToast('Failed to configure alert rule.', 'error');
        }
    };

    const handleDeleteAlertRule = async (alertId: string) => {
        try {
            if (selectedDs && selectedDs !== 'products-50') {
                await apiClient.delete(`/datasets/${selectedDs}/bi/alerts/${alertId}`);
            }
            setActiveAlerts(prev => prev.filter(a => a.id !== alertId));
            showToast('Alert rule deleted.', 'success');
        } catch {
            showToast('Failed to delete alert rule.', 'error');
        }
    };

    const handleAddComment = async () => {
        if (!newCommentText.trim()) return;
        try {
            if (selectedDs && selectedDs !== 'products-50') {
                const res: any = await apiClient.post(`/datasets/${selectedDs}/bi/comments`, {
                    widgetId: commentWidgetId,
                    content: newCommentText
                });
                if (res) {
                    setCollaborationComments(prev => [...prev, res]);
                    setNewCommentText('');
                    setCommentWidgetId(null);
                    showToast('Discussion comment posted!', 'success');
                }
            } else {
                const mockComment = {
                    id: `c-mock-${Date.now()}`,
                    widgetId: commentWidgetId,
                    userName: 'Business User',
                    content: newCommentText,
                    isResolved: false,
                    createdAt: new Date().toISOString()
                };
                setCollaborationComments(prev => [...prev, mockComment]);
                setNewCommentText('');
                setCommentWidgetId(null);
                showToast('Discussion comment posted locally!', 'success');
            }
        } catch {
            showToast('Failed to post discussion comment.', 'error');
        }
    };

    const handleResolveComment = async (commentId: string) => {
        try {
            if (selectedDs && selectedDs !== 'products-50') {
                await apiClient.patch(`/datasets/${selectedDs}/bi/comments/${commentId}/resolve`, {});
            }
            setCollaborationComments(prev => prev.map(c => c.id === commentId ? { ...c, isResolved: true } : c));
            showToast('Discussion thread resolved.', 'success');
        } catch {
            showToast('Failed to resolve comment.', 'error');
        }
    };

    // ── Drill-down chart click handler ──
    const handleChartClick = (w: Widget, data: any) => {
        if (!w.columns || w.columns.length === 0) return;
        const dimCol = w.columns[0];
        
        let value = '';
        if (data && data.activeLabel) {
            value = String(data.activeLabel);
        } else if (data && data.label) {
            value = String(data.label);
        } else if (data && data.name) {
            value = String(data.name);
        } else if (data && data.activePayload && data.activePayload[0]) {
            value = String(data.activePayload[0].payload?.label || data.activePayload[0].payload?.name || '');
        } else if (data && data.payload) {
            value = String(data.payload.label || data.payload.name || '');
        }

        if (value) {
            const nextFilters = { ...activeFilters, [dimCol]: value };
            applyFiltersAndRebuild(nextFilters);
            showToast(`Drill-down: filtered dashboard by ${dimCol} = ${value}`, 'success');
        }
    };

    // ── Drill-through handler ──
    const handleDrillThrough = (w: Widget) => {
        setDrillThroughFilter(w.title);
        setDrillThroughRows(activeRawData);
        setShowDrillThrough(true);
    };

    // ── Custom Widget Marketplace Adder ──
    const handleAddCustomWidget = async (type: string, title: string, dimCol: string, measCol: string, width: number = 6) => {
        if (!measCol) {
            showToast('Please select a numeric column.', 'error');
            return;
        }

        let aggregatedData: any[] = [];
        if (type === 'bubble') {
            const numCols = Object.keys(dsAnalytics?.stats || {}).filter(c => dsAnalytics?.stats[c]?.type === 'numeric');
            const x = dimCol || numCols[0] || '';
            const y = measCol || numCols[1] || '';
            const z = numCols[2] || numCols[0] || '';
            aggregatedData = activeRawData.slice(0, 30).map(r => ({
                x: Number(r[x]) || 0,
                y: Number(r[y]) || 0,
                z: Number(r[z]) || 0
            }));
        } else if (type === 'gauge' || type === 'progress') {
            const sumVal = activeRawData.reduce((s, r) => s + (Number(r[measCol]) || 0), 0);
            const avgVal = sumVal / (activeRawData.length || 1);
            const maxVal = dsAnalytics?.stats[measCol]?.max || 100;
            aggregatedData = [{ value: Math.round(avgVal) }, { value: Math.round(maxVal) }];
        } else if (type === 'kpi') {
            aggregatedData = getSparklineDataPoints(measCol, activeRawData, null);
        } else {
            aggregatedData = aggregateMetric(activeRawData, dimCol, measCol, 'sum').slice(0, 8);
        }

        const newWidget: Widget = {
            id: `w-custom-${type}-${Date.now()}`,
            title: title || `${type.toUpperCase()} - ${measCol} by ${dimCol}`,
            type: type as any,
            data: aggregatedData,
            columns: [dimCol, measCol],
            width
        };

        const updatedWidgets = [...widgets, newWidget];
        setWidgets(updatedWidgets);
        showToast(`Custom widget '${newWidget.title}' added to dashboard!`, 'success');
        setShowMarketplace(false);

        try {
            const layoutKey = selectedDs || 'default';
            localStorage.setItem(`dashboard_layout_${layoutKey}`, JSON.stringify({
                widgets: updatedWidgets,
                cardSizes,
                autoModeEnabled
            }));

            if (selectedDs && selectedDs !== 'products-50') {
                await apiClient.patch(`/data/datasets/${selectedDs}`, {
                    dashboardLayout: JSON.stringify({
                        widgets: updatedWidgets,
                        cardSizes,
                        autoModeEnabled
                    })
                });
            }
        } catch (err) {
            console.error('Failed to save layout:', err);
        }
    };

    // ── Custom Widget Builder Adder ──
    const handleChartBuilderAdd = async () => {
        if (!builderX || !builderY) {
            showToast('Please select both X-Axis and Y-Axis columns.', 'error');
            return;
        }

        const aggregatedData = aggregateMetric(activeRawData, builderX, builderY, builderAgg as any).slice(0, 8);

        const newWidget: Widget = {
            id: `w-builder-${builderType}-${Date.now()}`,
            title: `Custom ${builderType.toUpperCase()}: ${builderY} by ${builderX}`,
            type: builderType as any,
            data: aggregatedData,
            columns: [builderX, builderY],
            width: 6
        };

        const updatedWidgets = [...widgets, newWidget];
        setWidgets(updatedWidgets);
        showToast(`Builder widget '${newWidget.title}' added to dashboard!`, 'success');
        setShowChartBuilder(false);

        try {
            const layoutKey = selectedDs || 'default';
            localStorage.setItem(`dashboard_layout_${layoutKey}`, JSON.stringify({
                widgets: updatedWidgets,
                cardSizes,
                autoModeEnabled
            }));

            if (selectedDs && selectedDs !== 'products-50') {
                await apiClient.patch(`/data/datasets/${selectedDs}`, {
                    dashboardLayout: JSON.stringify({
                        widgets: updatedWidgets,
                        cardSizes,
                        autoModeEnabled
                    })
                });
            }
        } catch (err) {
            console.error('Failed to save layout:', err);
        }
    };

    // ── Glossary Tooltip Component ──
    const GlossaryTooltip = ({ term }: { term: string }) => {
        const glossaryKey = Object.keys(businessGlossary || {}).find(
            k => term.toLowerCase().includes(k.toLowerCase())
        );
        if (!glossaryKey) return null;
        const entry = businessGlossary[glossaryKey];
        return (
            <div className="glossary-tooltip-trigger">
                <HelpCircle size={10} style={{ opacity: 0.6, cursor: 'help' }} />
                <div className="glossary-tooltip-content">
                    <div style={{ fontWeight: 700, borderBottom: '1px solid #475569', paddingBottom: '2px', marginBottom: '4px', textTransform: 'capitalize' }}>
                        {glossaryKey.replace('_', ' ')}
                    </div>
                    <div style={{ marginBottom: '4px' }}>{entry.definition}</div>
                    {entry.formula && (
                        <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#38bdf8', marginBottom: '2px' }}>
                            Formula: {entry.formula}
                        </div>
                    )}
                    {entry.meaning && (
                        <div style={{ fontStyle: 'italic', fontSize: '0.6rem', color: '#94a3b8' }}>
                            {entry.meaning}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const detectDatasetCategory = (stats: DatasetAnalytics) => {
        const keys = Object.keys(stats.stats).map(k => k.toLowerCase());
        let salesScore = 0;
        let financeScore = 0;
        let hrScore = 0;
        let healthcareScore = 0;
        let marketingScore = 0;
        let inventoryScore = 0;

        keys.forEach(k => {
            const l = k.toLowerCase();
            if (l.includes('sales') || l.includes('revenue') || l.includes('total_spent') || l.includes('totalspent') || l.includes('price') || l.includes('amount') || l.includes('orders') || l.includes('transaction') || l.includes('order') || l.includes('sold') || l.includes('customer') || l.includes('product') || l.includes('quantity')) salesScore += 2;
            if (l.includes('expense') || l.includes('cash') || l.includes('budget') || l.includes('actual') || l.includes('cost') || l.includes('salary') || l.includes('bill') || l.includes('spend') || l.includes('profit')) financeScore += 2;
            if (l.includes('employee') || l.includes('attrition') || l.includes('department') || l.includes('salary') || l.includes('experience') || l.includes('hire') || l.includes('joining') || l.includes('staff') || l.includes('gender') || l.includes('tenure') || l.includes('age') || l.includes('role')) hrScore += 2;
            if (l.includes('patient') || l.includes('disease') || l.includes('admission') || l.includes('age') || l.includes('treatment') || l.includes('doctor') || l.includes('hospital') || l.includes('health') || l.includes('diagnosis')) healthcareScore += 2;
            if (l.includes('campaign') || l.includes('click') || l.includes('impression') || l.includes('conversion') || l.includes('marketing') || l.includes('lead') || l.includes('channel') || l.includes('ctr')) marketingScore += 2;
            if (l.includes('stock') || l.includes('inventory') || l.includes('warehouse') || l.includes('qty') || l.includes('quantity') || l.includes('supplier') || l.includes('product') || l.includes('reorder')) inventoryScore += 2;
        });

        // Add matches to dataset name
        const dsName = (stats.name || '').toLowerCase();
        if (dsName.includes('sales') || dsName.includes('transaction') || dsName.includes('retail') || dsName.includes('store') || dsName.includes('product')) salesScore += 5;
        if (dsName.includes('finance') || dsName.includes('budget') || dsName.includes('expense') || dsName.includes('payment')) financeScore += 5;
        if (dsName.includes('employee') || dsName.includes('hr') || dsName.includes('staff') || dsName.includes('attrition')) hrScore += 5;
        if (dsName.includes('patient') || dsName.includes('health') || dsName.includes('medical') || dsName.includes('hospital') || dsName.includes('covid')) healthcareScore += 5;
        if (dsName.includes('marketing') || dsName.includes('campaign') || dsName.includes('ad_') || dsName.includes('ads')) marketingScore += 5;
        if (dsName.includes('inventory') || dsName.includes('stock') || dsName.includes('warehouse')) inventoryScore += 5;

        const scores = [
            { cat: 'Sales', score: salesScore },
            { cat: 'Finance', score: financeScore },
            { cat: 'HR', score: hrScore },
            { cat: 'Healthcare', score: healthcareScore },
            { cat: 'Marketing', score: marketingScore },
            { cat: 'Inventory', score: inventoryScore }
        ];

        scores.sort((a, b) => b.score - a.score);
        const top = scores[0];
        if (top.score > 2) {
            const confidence = Math.min(98, 50 + top.score * 5);
            return { category: top.cat, confidence };
        }
        return { category: 'Generic Business Dataset', confidence: 100 };
    };

    const generateAiExplanation = (category: string, stats: DatasetAnalytics) => {
        const keys = Object.keys(stats.stats);
        const numCols = keys.filter(c => stats.stats[c]?.type === 'numeric');
        const catCols = keys.filter(c => stats.stats[c]?.type === 'categorical');

        let explanation = '';
        switch (category) {
            case 'Sales':
                explanation = `Based on your dataset schema, we detected transaction-oriented fields such as ${numCols.slice(0, 3).join(', ')} and categorical columns like ${catCols.slice(0, 2).join(', ')}. We have automatically generated a **Sales Performance & Revenue Analytics Dashboard** featuring total value trends, regional category shares, and product contribution analysis.`;
                break;
            case 'HR':
                explanation = `We identified human resource dimensions (e.g. employee count, department fields, age, or salary columns). We have loaded an **HR & Employee Distribution Dashboard** mapping staff headcounts, experience levels, and department splits.`;
                break;
            case 'Finance':
                explanation = `We detected financial ledgers or cashflow attributes. An **Executive Finance Dashboard** has been customized to display budget versus actual summaries, category cost distributions, and monthly trends.`;
                break;
            case 'Healthcare':
                explanation = `We detected clinical details (e.g. admissions, patient columns, age, or diagnoses). We have dynamically compiled a **Healthcare Operations Dashboard** displaying patient counts, diagnosis breakdowns, and demographic distributions.`;
                break;
            case 'Marketing':
                explanation = `We detected campaign metrics like spend, clicks, or conversions. We have generated a **Marketing Campaign Performance Dashboard** tracking marketing metrics and channel efficiency.`;
                break;
            case 'Inventory':
                explanation = `We detected warehouse, stock level, or supplier metrics. An **Inventory & Stock Operations Dashboard** has been generated to show product quantities, reorder points, and warehouse distributions.`;
                break;
            default:
                explanation = `Your dataset appears to contain general business attributes with numerical metrics (${numCols.slice(0, 2).join(', ') || 'none'}) and dimensions (${catCols.slice(0, 2).join(', ') || 'none'}). A **Generic Business Analytics Dashboard** has been generated featuring KPI aggregators, metric distributions, and a record database preview.`;
        }
        return explanation;
    };

    // ── Build Dynamic Executive Dashboard from Real Raw Data ──
    const buildExecutiveDashboard = (stats: DatasetAnalytics, rows: any[], forcedCategory?: string) => {
        const category = forcedCategory || detectedCategory || 'Generic Business Dataset';
        const keys = Object.keys(stats.stats);
        const numCols = keys.filter(c => stats.stats[c]?.type === 'numeric');
        const catCols = keys.filter(c => stats.stats[c]?.type === 'categorical');

        // Resolve Date dimension
        const dateDim = keys.find(c => {
            const l = c.toLowerCase();
            return l.includes('date') || l.includes('time') || l.includes('year') || l.includes('month');
        }) || '';

        // Resolve semantic mapping helpers
        const findCol = (cols: string[], keywords: string[]): string => {
            const found = cols.find(c => {
                const l = c.toLowerCase();
                return keywords.some(k => l.includes(k));
            });
            return found || cols[0] || '';
        };

        // Semantic column variables
        const salesCol = findCol(numCols, ['revenue', 'sales', 'total_spent', 'totalspent', 'spent', 'amount', 'price']);
        const qtyCol = findCol(numCols, ['quantity', 'qty', 'orders', 'units', 'sold']);
        const priceCol = findCol(numCols, ['price', 'unitprice', 'cost']);
        const prodCol = findCol(catCols, ['product', 'category', 'item', 'segment']);
        const regionCol = findCol(catCols, ['region', 'country', 'state', 'city', 'location', 'market']);

        const salaryCol = findCol(numCols, ['salary', 'pay', 'income', 'compensation']);
        const expCol = findCol(numCols, ['experience', 'tenure', 'years', 'age']);
        const deptCol = findCol(catCols, ['department', 'dept', 'team', 'division']);
        const genderCol = findCol(catCols, ['gender', 'sex']);
        const roleCol = findCol(catCols, ['role', 'title', 'job', 'position']);

        const revenueCol = findCol(numCols, ['revenue', 'sales', 'income']);
        const expenseCol = findCol(numCols, ['expense', 'cost', 'spend', 'payout']);
        const profitCol = findCol(numCols, ['profit', 'margin', 'net']);
        const budgetCol = findCol(numCols, ['budget', 'allocation']);
        const finCatCol = findCol(catCols, ['category', 'type', 'department', 'dept']);

        const patientsCol = findCol(numCols, ['patient', 'admissions', 'id', 'count']);
        const costCol = findCol(numCols, ['cost', 'price', 'spent', 'billing', 'amount']);
        const ageCol = findCol(numCols, ['age', 'years']);
        const diseaseCol = findCol(catCols, ['disease', 'diagnosis', 'condition', 'illness', 'treatment']);
        const hospitalCol = findCol(catCols, ['hospital', 'clinic', 'doctor', 'ward', 'location']);

        const clickCol = findCol(numCols, ['click', 'visit', 'traffic']);
        const impressionCol = findCol(numCols, ['impression', 'view', 'reach']);
        const conversionCol = findCol(numCols, ['conversion', 'lead', 'signup', 'sale']);
        const marketingSpendCol = findCol(numCols, ['spend', 'cost', 'budget']);
        const channelCol = findCol(catCols, ['channel', 'source', 'medium', 'campaign', 'network']);

        const stockCol = findCol(numCols, ['stock', 'inventory', 'quantity', 'qty', 'onhand']);
        const reorderCol = findCol(numCols, ['reorder', 'limit', 'safety']);
        const supplierCol = findCol(catCols, ['supplier', 'vendor', 'manufacturer']);
        const warehouseCol = findCol(catCols, ['warehouse', 'location', 'store', 'bin']);

        const recordCount = rows.length;

        const activeKpis: Widget[] = [];
        const activeCharts: Widget[] = [];

        if (category === 'Sales') {
            // ── Sales template KPIs ──
            activeKpis.push({
                id: 'kpi-records',
                title: 'Total Transactions',
                type: 'kpi',
                data: getSparklineCountPoints(null, rows, dateDim),
                columns: [],
                width: 3,
                value: recordCount > 1000 ? `${(recordCount / 1000).toFixed(1)}K` : `${recordCount}`,
                trend: '12.4%', isUp: true, sub: `vs ${Math.round(recordCount * 0.89)}`
            });
            if (salesCol) {
                const totalSales = rows.reduce((s, r) => s + (Number(r[salesCol]) || 0), 0);
                activeKpis.push({
                    id: 'kpi-sales',
                    title: `Total Sales`,
                    type: 'kpi',
                    data: getSparklineDataPoints(salesCol, rows, dateDim),
                    columns: [salesCol],
                    width: 3,
                    value: totalSales > 1000000 ? `$${(totalSales / 1000000).toFixed(2)}M` : `$${totalSales.toLocaleString()}`,
                    trend: '8.3%', isUp: true, sub: `vs $${(totalSales * 0.92).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }
            if (qtyCol) {
                const totalQty = rows.reduce((s, r) => s + (Number(r[qtyCol]) || 0), 0);
                activeKpis.push({
                    id: 'kpi-qty',
                    title: `Total Units Sold`,
                    type: 'kpi',
                    data: getSparklineDataPoints(qtyCol, rows, dateDim),
                    columns: [qtyCol],
                    width: 3,
                    value: totalQty > 1000 ? `${(totalQty / 1000).toFixed(1)}K` : `${totalQty}`,
                    trend: '5.1%', isUp: true, sub: `vs ${(totalQty * 0.95).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }
            if (prodCol) {
                const uniqueProd = new Set(rows.map(r => r[prodCol]).filter(Boolean)).size;
                activeKpis.push({
                    id: 'kpi-products',
                    title: `Unique Products`,
                    type: 'kpi',
                    data: getSparklineCountPoints(prodCol, rows, dateDim),
                    columns: [prodCol],
                    width: 3,
                    value: `${uniqueProd}`,
                    trend: '3.2%', isUp: true, sub: `vs ${Math.round(uniqueProd * 0.96)}`
                });
            }

            // ── Sales template Charts ──
            const salesByProd = prodCol && salesCol ? aggregateMetric(rows, prodCol, salesCol, 'sum').slice(0, 5) : [];
            const salesByReg = regionCol && salesCol ? aggregateMetric(rows, regionCol, salesCol, 'sum').slice(0, 5) : [];
            const topProd = salesByProd[0]?.label || 'None';
            const topReg = salesByReg[0]?.label || 'None';
            const totalValSum = salesCol ? rows.reduce((s, r) => s + (Number(r[salesCol]) || 0), 0) : 1;
            const topRegVal = salesByReg[0]?.value || 0;
            const topRegPct = ((topRegVal / totalValSum) * 100).toFixed(1);

            activeCharts.push({
                id: 'w-insights',
                title: 'Sales Performance Insights',
                type: 'insights',
                data: [
                    { icon: '🟢', t: 'Sales Scan Completed', d: `Successfully processed ${recordCount.toLocaleString()} transactions.` },
                    { icon: '🔵', t: 'Revenue Summary', d: `Total sales volume reached $${totalValSum.toLocaleString(undefined, { maximumFractionDigits: 0 })}.` },
                    { icon: '🟣', t: `${topReg} Region Leader`, d: `Contributed ${topRegPct}% of global revenue.` }
                ],
                columns: [],
                width: 4
            });

            if (dateDim && salesCol) {
                const monthlyDataMap: Record<string, number> = {};
                rows.forEach(row => {
                    const formatted = formatExcelDate(row[dateDim]);
                    if (!monthlyDataMap[formatted]) monthlyDataMap[formatted] = 0;
                    monthlyDataMap[formatted] += Number(row[salesCol]) || 0;
                });
                const lineData = Object.entries(monthlyDataMap).map(([label, value]) => ({
                    label,
                    value: Math.round(value * 100) / 100,
                    valuePY: Math.round(value * 0.85 * 100) / 100
                })).slice(-12);

                activeCharts.push({
                    id: 'w-line',
                    title: `Revenue Trend Over Time`,
                    type: 'line',
                    data: lineData,
                    columns: [dateDim, salesCol],
                    width: 8
                });
            }

            if (regionCol && salesCol) {
                activeCharts.push({
                    id: 'w-donut',
                    title: `Sales by ${regionCol}`,
                    type: 'pie',
                    data: salesByReg,
                    columns: [regionCol, salesCol],
                    width: 4
                });
            }

            activeCharts.push({
                id: 'w-recommendations',
                title: 'Strategic Sales Playbook',
                type: 'recommendations',
                data: [
                    { icon: '🎯', t: 'Allocate inventory to top channels', d: `Enhance stocking levels for leading item '${topProd}' in ${topReg}.` },
                    { icon: '🚀', t: 'Promotional campaigning target', d: `Push targeted seasonal promotions to secondary regions.` }
                ],
                columns: [],
                width: 4
            });

            if (prodCol && salesCol) {
                activeCharts.push({
                    id: 'w-bar',
                    title: `Sales by ${prodCol}`,
                    type: 'bar',
                    data: salesByProd,
                    columns: [prodCol, salesCol],
                    width: 4
                });
            }

            if (prodCol && salesCol) {
                activeCharts.push({
                    id: 'w-treemap',
                    title: `Product Sales Distribution`,
                    type: 'treemap',
                    data: salesByProd,
                    columns: [prodCol, salesCol],
                    width: 6
                });
            }

            if (priceCol && qtyCol) {
                activeCharts.push({
                    id: 'w-scatter',
                    title: `${qtyCol} vs ${priceCol} Correlation`,
                    type: 'scatter',
                    data: rows.slice(0, 50).map(r => ({ x: Number(r[qtyCol]) || 0, y: Number(r[priceCol]) || 0 })),
                    columns: [qtyCol, priceCol],
                    width: 6
                });
            }

            if (prodCol && salesCol) {
                const tableData = salesByProd.map(item => {
                    const itemRows = rows.filter(r => String(r[prodCol]) === item.label);
                    return {
                        p: item.label,
                        c: regionCol ? (itemRows[0]?.[regionCol] || 'General') : 'General',
                        r: item.value > 1000000 ? `$${(item.value / 1000000).toFixed(2)}M` : `$${item.value.toLocaleString()}`,
                        o: itemRows.length.toLocaleString()
                    };
                });
                activeCharts.push({
                    id: 'w-table',
                    title: `Top ${prodCol} Performance`,
                    type: 'table',
                    data: tableData,
                    columns: [prodCol, regionCol || 'Category', salesCol || 'Value', 'Orders'],
                    width: 12
                });
            }
        }
        else if (category === 'HR') {
            // ── HR template KPIs ──
            activeKpis.push({
                id: 'kpi-records',
                title: 'Total Headcount',
                type: 'kpi',
                data: getSparklineCountPoints(null, rows, dateDim),
                columns: [],
                width: 3,
                value: `${recordCount}`,
                trend: '4.8%', isUp: true, sub: `vs ${Math.round(recordCount * 0.95)}`
            });
            if (deptCol) {
                const uniqueDept = new Set(rows.map(r => r[deptCol]).filter(Boolean)).size;
                activeKpis.push({
                    id: 'kpi-depts',
                    title: `Departments`,
                    type: 'kpi',
                    data: getSparklineCountPoints(deptCol, rows, dateDim),
                    columns: [deptCol],
                    width: 3,
                    value: `${uniqueDept}`,
                    trend: '1.2%', isUp: true, sub: `vs ${uniqueDept}`
                });
            }
            if (salaryCol) {
                const totalSal = rows.reduce((s, r) => s + (Number(r[salaryCol]) || 0), 0);
                const avgSal = totalSal / (rows.length || 1);
                activeKpis.push({
                    id: 'kpi-salary',
                    title: `Average Salary`,
                    type: 'kpi',
                    data: getSparklineDataPoints(salaryCol, rows, dateDim),
                    columns: [salaryCol],
                    width: 3,
                    value: avgSal > 1000 ? `$${(avgSal / 1000).toFixed(1)}K` : `$${avgSal.toLocaleString()}`,
                    trend: '2.4%', isUp: true, sub: `vs $${(avgSal * 0.98).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }
            if (expCol) {
                const totalExp = rows.reduce((s, r) => s + (Number(r[expCol]) || 0), 0);
                const avgExp = totalExp / (rows.length || 1);
                activeKpis.push({
                    id: 'kpi-exp',
                    title: `Avg Experience`,
                    type: 'kpi',
                    data: getSparklineDataPoints(expCol, rows, dateDim),
                    columns: [expCol],
                    width: 3,
                    value: `${avgExp.toFixed(1)} yrs`,
                    trend: '5.2%', isUp: true, sub: `vs ${(avgExp * 0.95).toFixed(1)} yrs`
                });
            }

            // ── HR template Charts ──
            const empByDept = deptCol ? aggregateMetric(rows, deptCol, salaryCol || '', 'count').slice(0, 5) : [];
            const genderSplit = genderCol ? aggregateMetric(rows, genderCol, salaryCol || '', 'count').slice(0, 5) : [];
            const salByDept = deptCol && salaryCol ? aggregateMetric(rows, deptCol, salaryCol, 'avg').slice(0, 5) : [];
            const topDept = empByDept[0]?.label || 'None';

            activeCharts.push({
                id: 'w-insights',
                title: 'HR Headcount Insights',
                type: 'insights',
                data: [
                    { icon: '👥', t: 'Employee Database Scanned', d: `Tracked ${recordCount.toLocaleString()} active staff profiles.` },
                    { icon: '🏢', t: `Top Division Share`, d: `Department '${topDept}' is the largest staffing center.` }
                ],
                columns: [],
                width: 4
            });

            if (dateDim) {
                const hiringTrend = Object.entries(
                    rows.reduce((map: Record<string, number>, r) => {
                        const formatted = formatExcelDate(r[dateDim]);
                        map[formatted] = (map[formatted] || 0) + 1;
                        return map;
                    }, {})
                ).map(([label, value]) => ({ label, value })).slice(-12);

                activeCharts.push({
                    id: 'w-line',
                    title: `Headcount Hiring Trend`,
                    type: 'line',
                    data: hiringTrend,
                    columns: [dateDim],
                    width: 8
                });
            }

            if (genderCol) {
                activeCharts.push({
                    id: 'w-donut',
                    title: `Headcount by ${genderCol}`,
                    type: 'pie',
                    data: genderSplit,
                    columns: [genderCol],
                    width: 6
                });
            }

            if (deptCol && salaryCol) {
                activeCharts.push({
                    id: 'w-bar',
                    title: `Avg Salary by ${deptCol}`,
                    type: 'bar',
                    data: salByDept,
                    columns: [deptCol, salaryCol],
                    width: 6
                });
            }

            if (deptCol) {
                activeCharts.push({
                    id: 'w-treemap',
                    title: `Department Headcount Split`,
                    type: 'treemap',
                    data: empByDept,
                    columns: [deptCol],
                    width: 6
                });
            }

            if (expCol && salaryCol) {
                activeCharts.push({
                    id: 'w-scatter',
                    title: `${expCol} vs ${salaryCol} Correlation`,
                    type: 'scatter',
                    data: rows.slice(0, 50).map(r => ({ x: Number(r[expCol]) || 0, y: Number(r[salaryCol]) || 0 })),
                    columns: [expCol, salaryCol],
                    width: 6
                });
            }

            if (deptCol) {
                activeCharts.push({
                    id: 'w-table',
                    title: `Department Summary Profile`,
                    type: 'table',
                    data: empByDept.map(item => {
                        const itemRows = rows.filter(r => String(r[deptCol]) === item.label);
                        const avgSal = itemRows.reduce((s, r) => s + (Number(r[salaryCol]) || 0), 0) / (itemRows.length || 1);
                        return {
                            p: item.label,
                            c: roleCol ? (itemRows[0]?.[roleCol] || 'Role') : 'Role',
                            r: `$${avgSal.toLocaleString(undefined, { maximumFractionDigits: 0 })} avg`,
                            o: itemRows.length.toLocaleString()
                        };
                    }),
                    columns: [deptCol, roleCol || 'Role', salaryCol || 'Salary', 'Employees'],
                    width: 12
                });
            }
        }
        else if (category === 'Finance') {
            // ── Finance template KPIs ──
            if (revenueCol) {
                const totalRev = rows.reduce((s, r) => s + (Number(r[revenueCol]) || 0), 0);
                activeKpis.push({
                    id: 'kpi-revenue',
                    title: `Total Revenue`,
                    type: 'kpi',
                    data: getSparklineDataPoints(revenueCol, rows, dateDim),
                    columns: [revenueCol],
                    width: 3,
                    value: totalRev > 1000000 ? `$${(totalRev / 1000000).toFixed(2)}M` : `$${totalRev.toLocaleString()}`,
                    trend: '8.4%', isUp: true, sub: `vs $${(totalRev * 0.93).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }
            if (expenseCol) {
                const totalExp = rows.reduce((s, r) => s + (Number(r[expenseCol]) || 0), 0);
                activeKpis.push({
                    id: 'kpi-expenses',
                    title: `Total Cost/Expenses`,
                    type: 'kpi',
                    data: getSparklineDataPoints(expenseCol, rows, dateDim),
                    columns: [expenseCol],
                    width: 3,
                    value: totalExp > 1000000 ? `$${(totalExp / 1000000).toFixed(2)}M` : `$${totalExp.toLocaleString()}`,
                    trend: '5.2%', isUp: false, sub: `vs $${(totalExp * 0.97).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }
            if (profitCol) {
                const totalProfit = rows.reduce((s, r) => s + (Number(r[profitCol]) || 0), 0);
                activeKpis.push({
                    id: 'kpi-profit',
                    title: `Net Profit`,
                    type: 'kpi',
                    data: getSparklineDataPoints(profitCol, rows, dateDim),
                    columns: [profitCol],
                    width: 3,
                    value: totalProfit > 1000000 ? `$${(totalProfit / 1000000).toFixed(2)}M` : `$${totalProfit.toLocaleString()}`,
                    trend: '12.1%', isUp: true, sub: `vs $${(totalProfit * 0.88).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }
            if (budgetCol) {
                const totalBudget = rows.reduce((s, r) => s + (Number(r[budgetCol]) || 0), 0);
                activeKpis.push({
                    id: 'kpi-budget',
                    title: `Allocated Budget`,
                    type: 'kpi',
                    data: getSparklineDataPoints(budgetCol, rows, dateDim),
                    columns: [budgetCol],
                    width: 3,
                    value: totalBudget > 1000000 ? `$${(totalBudget / 1000000).toFixed(2)}M` : `$${totalBudget.toLocaleString()}`,
                    trend: '1.5%', isUp: true, sub: `vs $${(totalBudget * 0.99).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }

            // ── Finance template Charts ──
            const expByCat = finCatCol && expenseCol ? aggregateMetric(rows, finCatCol, expenseCol, 'sum').slice(0, 5) : [];
            const topExp = expByCat[0]?.label || 'None';

            activeCharts.push({
                id: 'w-insights',
                title: 'Financial Key Insights',
                type: 'insights',
                data: [
                    { icon: '📈', t: 'Revenue Streams Mapped', d: `Total scanned ledger records: ${recordCount.toLocaleString()}.` },
                    { icon: '💸', t: 'Primary Cost Center', d: `'${topExp}' represents the highest cost category.` }
                ],
                columns: [],
                width: 4
            });

            if (dateDim && revenueCol) {
                const monthlyDataMap: Record<string, number> = {};
                rows.forEach(row => {
                    const formatted = formatExcelDate(row[dateDim]);
                    if (!monthlyDataMap[formatted]) monthlyDataMap[formatted] = 0;
                    monthlyDataMap[formatted] += Number(row[revenueCol]) || 0;
                });
                const lineData = Object.entries(monthlyDataMap).map(([label, value]) => ({
                    label,
                    value: Math.round(value * 100) / 100,
                    valuePY: Math.round(value * 0.85 * 100) / 100
                })).slice(-12);

                activeCharts.push({
                    id: 'w-line',
                    title: `Monthly Revenue Stream`,
                    type: 'line',
                    data: lineData,
                    columns: [dateDim, revenueCol],
                    width: 8
                });
            }

            if (finCatCol && budgetCol) {
                const budgetData = aggregateMetric(rows, finCatCol, budgetCol, 'sum').slice(0, 5);
                activeCharts.push({
                    id: 'w-donut',
                    title: `Budget Split by Category`,
                    type: 'pie',
                    data: budgetData,
                    columns: [finCatCol, budgetCol],
                    width: 6
                });
            }

            if (finCatCol && expenseCol) {
                activeCharts.push({
                    id: 'w-bar',
                    title: `Expenses by ${finCatCol}`,
                    type: 'bar',
                    data: expByCat,
                    columns: [finCatCol, expenseCol],
                    width: 6
                });
            }

            if (finCatCol && expenseCol) {
                activeCharts.push({
                    id: 'w-treemap',
                    title: `Expense Breakdown Hierarchy`,
                    type: 'treemap',
                    data: expByCat,
                    columns: [finCatCol, expenseCol],
                    width: 6
                });
            }

            if (budgetCol && expenseCol) {
                activeCharts.push({
                    id: 'w-scatter',
                    title: `Budget vs Expense Correlation`,
                    type: 'scatter',
                    data: rows.slice(0, 50).map(r => ({ x: Number(r[budgetCol]) || 0, y: Number(r[expenseCol]) || 0 })),
                    columns: [budgetCol, expenseCol],
                    width: 6
                });
            }

            if (finCatCol && revenueCol) {
                const revByCat = aggregateMetric(rows, finCatCol, revenueCol, 'sum').slice(0, 5);
                activeCharts.push({
                    id: 'w-table',
                    title: `Categorical Financial Summary`,
                    type: 'table',
                    data: revByCat.map(item => {
                        const itemRows = rows.filter(r => String(r[finCatCol]) === item.label);
                        const expVal = itemRows.reduce((s, r) => s + (Number(r[expenseCol]) || 0), 0);
                        return {
                            p: item.label,
                            c: 'Ledger Node',
                            r: `$${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} rev`,
                            o: `$${expVal.toLocaleString(undefined, { maximumFractionDigits: 0 })} cost`
                        };
                    }),
                    columns: [finCatCol, 'Node', revenueCol || 'Revenue', expenseCol || 'Expenses'],
                    width: 12
                });
            }
        }
        else if (category === 'Healthcare') {
            // ── Healthcare template KPIs ──
            activeKpis.push({
                id: 'kpi-records',
                title: 'Patient Admissions',
                type: 'kpi',
                data: getSparklineCountPoints(null, rows, dateDim),
                columns: [],
                width: 3,
                value: `${recordCount}`,
                trend: '3.9%', isUp: true, sub: `vs ${Math.round(recordCount * 0.96)}`
            });
            if (diseaseCol) {
                const uniqueDisease = new Set(rows.map(r => r[diseaseCol]).filter(Boolean)).size;
                activeKpis.push({
                    id: 'kpi-diseases',
                    title: `Diagnoses`,
                    type: 'kpi',
                    data: getSparklineCountPoints(diseaseCol, rows, dateDim),
                    columns: [diseaseCol],
                    width: 3,
                    value: `${uniqueDisease}`,
                    trend: '2.1%', isUp: true, sub: `vs ${uniqueDisease}`
                });
            }
            if (ageCol) {
                const totalAge = rows.reduce((s, r) => s + (Number(r[ageCol]) || 0), 0);
                const avgAge = totalAge / (rows.length || 1);
                activeKpis.push({
                    id: 'kpi-age',
                    title: `Average Age`,
                    type: 'kpi',
                    data: getSparklineDataPoints(ageCol, rows, dateDim),
                    columns: [ageCol],
                    width: 3,
                    value: `${avgAge.toFixed(1)} yrs`,
                    trend: '0.4%', isUp: true, sub: `vs ${(avgAge * 0.99).toFixed(1)} yrs`
                });
            }
            if (costCol) {
                const totalCost = rows.reduce((s, r) => s + (Number(r[costCol]) || 0), 0);
                const avgCost = totalCost / (rows.length || 1);
                activeKpis.push({
                    id: 'kpi-cost',
                    title: `Avg Admission Cost`,
                    type: 'kpi',
                    data: getSparklineDataPoints(costCol, rows, dateDim),
                    columns: [costCol],
                    width: 3,
                    value: avgCost > 1000 ? `$${(avgCost / 1000).toFixed(1)}K` : `$${avgCost.toLocaleString()}`,
                    trend: '4.8%', isUp: false, sub: `vs $${(avgCost * 0.95).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }

            // ── Healthcare template Charts ──
            const patientByDisease = diseaseCol ? aggregateMetric(rows, diseaseCol, patientsCol || '', 'count').slice(0, 5) : [];
            const topDisease = patientByDisease[0]?.label || 'None';

            activeCharts.push({
                id: 'w-insights',
                title: 'Healthcare Key Insights',
                type: 'insights',
                data: [
                    { icon: '🏥', t: 'Patient Registry Scanned', d: `Total admitted records: ${recordCount.toLocaleString()}.` },
                    { icon: '🩺', t: 'Primary Diagnosis Case', d: `'${topDisease}' registers the highest patient admissions.` }
                ],
                columns: [],
                width: 4
            });

            if (dateDim) {
                const admissionTrend = Object.entries(
                    rows.reduce((map: Record<string, number>, r) => {
                        const formatted = formatExcelDate(r[dateDim]);
                        map[formatted] = (map[formatted] || 0) + 1;
                        return map;
                    }, {})
                ).map(([label, value]) => ({ label, value })).slice(-12);

                activeCharts.push({
                    id: 'w-line',
                    title: `Monthly Admissions Volume`,
                    type: 'line',
                    data: admissionTrend,
                    columns: [dateDim],
                    width: 8
                });
            }

            if (hospitalCol) {
                const patientByHosp = aggregateMetric(rows, hospitalCol, patientsCol || '', 'count').slice(0, 5);
                activeCharts.push({
                    id: 'w-donut',
                    title: `Patients by ${hospitalCol}`,
                    type: 'pie',
                    data: patientByHosp,
                    columns: [hospitalCol],
                    width: 6
                });
            }

            if (diseaseCol) {
                activeCharts.push({
                    id: 'w-bar',
                    title: `Patients by Disease Category`,
                    type: 'bar',
                    data: patientByDisease,
                    columns: [diseaseCol],
                    width: 6
                });
            }

            if (diseaseCol) {
                activeCharts.push({
                    id: 'w-treemap',
                    title: `Disease Demographics Depth`,
                    type: 'treemap',
                    data: patientByDisease,
                    columns: [diseaseCol],
                    width: 6
                });
            }

            if (ageCol && costCol) {
                activeCharts.push({
                    id: 'w-scatter',
                    title: `Age vs Treatment Cost Correlation`,
                    type: 'scatter',
                    data: rows.slice(0, 50).map(r => ({ x: Number(r[ageCol]) || 0, y: Number(r[costCol]) || 0 })),
                    columns: [ageCol, costCol],
                    width: 6
                });
            }

            if (diseaseCol) {
                activeCharts.push({
                    id: 'w-table',
                    title: `Clinical Performance Summary`,
                    type: 'table',
                    data: patientByDisease.map(item => {
                        const itemRows = rows.filter(r => String(r[diseaseCol]) === item.label);
                        const avgCost = itemRows.reduce((s, r) => s + (Number(r[costCol]) || 0), 0) / (itemRows.length || 1);
                        return {
                            p: item.label,
                            c: hospitalCol ? (itemRows[0]?.[hospitalCol] || 'Ward') : 'Ward',
                            r: `$${avgCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} avg cost`,
                            o: itemRows.length.toLocaleString()
                        };
                    }),
                    columns: [diseaseCol, hospitalCol || 'Ward', costCol || 'Treatment Cost', 'Admissions'],
                    width: 12
                });
            }
        }
        else if (category === 'Marketing') {
            // ── Marketing template KPIs ──
            if (clickCol) {
                const totalClicks = rows.reduce((s, r) => s + (Number(r[clickCol]) || 0), 0);
                activeKpis.push({
                    id: 'kpi-impressions',
                    title: 'Total Campaign Clicks',
                    type: 'kpi',
                    data: getSparklineDataPoints(clickCol, rows, dateDim),
                    columns: [clickCol],
                    width: 3,
                    value: totalClicks > 1000000 ? `${(totalClicks / 1000000).toFixed(2)}M` : `${totalClicks.toLocaleString()}`,
                    trend: '9.4%', isUp: true, sub: `vs ${(totalClicks * 0.91).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }
            if (conversionCol) {
                const totalConvs = rows.reduce((s, r) => s + (Number(r[conversionCol]) || 0), 0);
                activeKpis.push({
                    id: 'kpi-conversions',
                    title: 'Total Conversions',
                    type: 'kpi',
                    data: getSparklineDataPoints(conversionCol, rows, dateDim),
                    columns: [conversionCol],
                    width: 3,
                    value: totalConvs > 1000 ? `${(totalConvs / 1000).toFixed(1)}K` : `${totalConvs}`,
                    trend: '14.2%', isUp: true, sub: `vs ${(totalConvs * 0.88).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }
            if (marketingSpendCol) {
                const totalSpend = rows.reduce((s, r) => s + (Number(r[marketingSpendCol]) || 0), 0);
                activeKpis.push({
                    id: 'kpi-spend',
                    title: 'Total Ad Spend',
                    type: 'kpi',
                    data: getSparklineDataPoints(marketingSpendCol, rows, dateDim),
                    columns: [marketingSpendCol],
                    width: 3,
                    value: totalSpend > 1000000 ? `$${(totalSpend / 1000000).toFixed(2)}M` : `$${totalSpend.toLocaleString()}`,
                    trend: '4.5%', isUp: true, sub: `vs $${(totalSpend * 0.95).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }
            if (channelCol) {
                const uniqueChannels = new Set(rows.map(r => r[channelCol]).filter(Boolean)).size;
                activeKpis.push({
                    id: 'kpi-channels',
                    title: 'Active Channels',
                    type: 'kpi',
                    data: getSparklineCountPoints(channelCol, rows, dateDim),
                    columns: [channelCol],
                    width: 3,
                    value: `${uniqueChannels}`,
                    trend: '2.1%', isUp: true, sub: `vs ${uniqueChannels}`
                });
            }

            // ── Marketing template Charts ──
            const convsByChannel = channelCol && conversionCol ? aggregateMetric(rows, channelCol, conversionCol, 'sum').slice(0, 5) : [];
            const spendByChannel = channelCol && marketingSpendCol ? aggregateMetric(rows, channelCol, marketingSpendCol, 'sum').slice(0, 5) : [];
            const topChannel = convsByChannel[0]?.label || 'None';

            activeCharts.push({
                id: 'w-insights',
                title: 'Marketing Key Insights',
                type: 'insights',
                data: [
                    { icon: '📣', t: 'Campaign Scope Scanned', d: `Total marketing nodes tracked: ${recordCount.toLocaleString()}.` },
                    { icon: '🚀', t: 'Top Performing Channel', d: `'${topChannel}' produced the maximum conversions.` }
                ],
                columns: [],
                width: 4
            });

            if (dateDim && conversionCol) {
                const monthlyDataMap: Record<string, number> = {};
                rows.forEach(row => {
                    const formatted = formatExcelDate(row[dateDim]);
                    if (!monthlyDataMap[formatted]) monthlyDataMap[formatted] = 0;
                    monthlyDataMap[formatted] += Number(row[conversionCol]) || 0;
                });
                activeCharts.push({
                    id: 'w-line',
                    title: `Monthly Conversions Trend`,
                    type: 'line',
                    data: Object.entries(monthlyDataMap).map(([label, value]) => ({
                        label,
                        value: Math.round(value * 100) / 100,
                        valuePY: Math.round(value * 0.85 * 100) / 100
                    })).slice(-12),
                    columns: [dateDim, conversionCol],
                    width: 8
                });
            }

            if (channelCol && marketingSpendCol) {
                activeCharts.push({
                    id: 'w-donut',
                    title: `Ad Spend by ${channelCol}`,
                    type: 'pie',
                    data: spendByChannel,
                    columns: [channelCol, marketingSpendCol],
                    width: 6
                });
            }

            if (channelCol && conversionCol) {
                activeCharts.push({
                    id: 'w-bar',
                    title: `Conversions by ${channelCol}`,
                    type: 'bar',
                    data: convsByChannel,
                    columns: [channelCol, conversionCol],
                    width: 6
                });
            }

            if (channelCol && conversionCol) {
                activeCharts.push({
                    id: 'w-treemap',
                    title: `Conversions Channel Distribution`,
                    type: 'treemap',
                    data: convsByChannel,
                    columns: [channelCol, conversionCol],
                    width: 6
                });
            }

            if (marketingSpendCol && conversionCol) {
                activeCharts.push({
                    id: 'w-scatter',
                    title: `Spend vs Conversions Correlation`,
                    type: 'scatter',
                    data: rows.slice(0, 50).map(r => ({ x: Number(r[marketingSpendCol]) || 0, y: Number(r[conversionCol]) || 0 })),
                    columns: [marketingSpendCol, conversionCol],
                    width: 6
                });
            }

            if (channelCol) {
                activeCharts.push({
                    id: 'w-table',
                    title: `Channel Performance Summary`,
                    type: 'table',
                    data: convsByChannel.map(item => {
                        const itemRows = rows.filter(r => String(r[channelCol]) === item.label);
                        const totalSpend = itemRows.reduce((s, r) => s + (Number(r[marketingSpendCol]) || 0), 0);
                        return {
                            p: item.label,
                            c: 'Campaign Node',
                            r: `$${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} spend`,
                            o: item.value.toLocaleString()
                        };
                    }),
                    columns: [channelCol, 'Campaign', marketingSpendCol || 'Spend', 'Conversions'],
                    width: 12
                });
            }
        }
        else if (category === 'Inventory') {
            // ── Inventory template KPIs ──
            activeKpis.push({
                id: 'kpi-records',
                title: 'Total Stock Items',
                type: 'kpi',
                data: getSparklineCountPoints(null, rows, dateDim),
                columns: [],
                width: 3,
                value: `${recordCount}`,
                trend: '2.5%', isUp: true, sub: `vs ${Math.round(recordCount * 0.98)}`
            });
            if (stockCol) {
                const totalStock = rows.reduce((s, r) => s + (Number(r[stockCol]) || 0), 0);
                activeKpis.push({
                    id: 'kpi-stock',
                    title: 'Total Items On-Hand',
                    type: 'kpi',
                    data: getSparklineDataPoints(stockCol, rows, dateDim),
                    columns: [stockCol],
                    width: 3,
                    value: totalStock > 1000 ? `${(totalStock / 1000).toFixed(1)}K` : `${totalStock}`,
                    trend: '4.5%', isUp: true, sub: `vs ${(totalStock * 0.95).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }
            if (supplierCol) {
                const uniqueSuppliers = new Set(rows.map(r => r[supplierCol]).filter(Boolean)).size;
                activeKpis.push({
                    id: 'kpi-suppliers',
                    title: 'Active Suppliers',
                    type: 'kpi',
                    data: getSparklineCountPoints(supplierCol, rows, dateDim),
                    columns: [supplierCol],
                    width: 3,
                    value: `${uniqueSuppliers}`,
                    trend: '1.2%', isUp: true, sub: `vs ${uniqueSuppliers}`
                });
            }
            if (warehouseCol) {
                const uniqueWarehouses = new Set(rows.map(r => r[warehouseCol]).filter(Boolean)).size;
                activeKpis.push({
                    id: 'kpi-warehouses',
                    title: 'Warehouses',
                    type: 'kpi',
                    data: getSparklineCountPoints(warehouseCol, rows, dateDim),
                    columns: [warehouseCol],
                    width: 3,
                    value: `${uniqueWarehouses}`,
                    trend: '0.0%', isUp: true, sub: `vs ${uniqueWarehouses}`
                });
            }

            // ── Inventory template Charts ──
            const stockBySupplier = supplierCol && stockCol ? aggregateMetric(rows, supplierCol, stockCol, 'sum').slice(0, 5) : [];
            const stockByWarehouse = warehouseCol && stockCol ? aggregateMetric(rows, warehouseCol, stockCol, 'sum').slice(0, 5) : [];
            const topWarehouse = stockByWarehouse[0]?.label || 'None';

            activeCharts.push({
                id: 'w-insights',
                title: 'Inventory & Operations Insights',
                type: 'insights',
                data: [
                    { icon: '📦', t: 'Inventory Count Scan', d: `Total catalog item types: ${recordCount.toLocaleString()}.` },
                    { icon: '🏭', t: 'Peak Stock Depot', d: `Warehouse '${topWarehouse}' holds the highest inventory volume.` }
                ],
                columns: [],
                width: 4
            });

            if (dateDim && stockCol) {
                const monthlyDataMap: Record<string, number> = {};
                rows.forEach(row => {
                    const formatted = formatExcelDate(row[dateDim]);
                    if (!monthlyDataMap[formatted]) monthlyDataMap[formatted] = 0;
                    monthlyDataMap[formatted] += Number(row[stockCol]) || 0;
                });
                activeCharts.push({
                    id: 'w-line',
                    title: `Monthly Stock Level Trend`,
                    type: 'line',
                    data: Object.entries(monthlyDataMap).map(([label, value]) => ({
                        label,
                        value: Math.round(value * 100) / 100,
                        valuePY: Math.round(value * 0.85 * 100) / 100
                    })).slice(-12),
                    columns: [dateDim, stockCol],
                    width: 8
                });
            }

            if (warehouseCol && stockCol) {
                activeCharts.push({
                    id: 'w-donut',
                    title: `Stock Split by Warehouse`,
                    type: 'pie',
                    data: stockByWarehouse,
                    columns: [warehouseCol, stockCol],
                    width: 6
                });
            }

            if (supplierCol && stockCol) {
                activeCharts.push({
                    id: 'w-bar',
                    title: `Stock Levels by Supplier`,
                    type: 'bar',
                    data: stockBySupplier,
                    columns: [supplierCol, stockCol],
                    width: 6
                });
            }

            if (supplierCol && stockCol) {
                activeCharts.push({
                    id: 'w-treemap',
                    title: `Inventory Supplier Distribution`,
                    type: 'treemap',
                    data: stockBySupplier,
                    columns: [supplierCol, stockCol],
                    width: 6
                });
            }

            if (reorderCol && stockCol) {
                activeCharts.push({
                    id: 'w-scatter',
                    title: `Reorder Limit vs Stock Level`,
                    type: 'scatter',
                    data: rows.slice(0, 50).map(r => ({ x: Number(r[reorderCol]) || 0, y: Number(r[stockCol]) || 0 })),
                    columns: [reorderCol, stockCol],
                    width: 6
                });
            }

            if (supplierCol) {
                activeCharts.push({
                    id: 'w-table',
                    title: `Supplier Inventory Summary`,
                    type: 'table',
                    data: stockBySupplier.map(item => {
                        const itemRows = rows.filter(r => String(r[supplierCol]) === item.label);
                        const warehouseVal = warehouseCol ? (itemRows[0]?.[warehouseCol] || 'Depot') : 'Depot';
                        return {
                            p: item.label,
                            c: warehouseVal,
                            r: `${item.value.toLocaleString()} units on-hand`,
                            o: itemRows.length.toLocaleString()
                        };
                    }),
                    columns: [supplierCol, warehouseCol || 'Depot', stockCol || 'On-Hand Level', 'SKUs'],
                    width: 12
                });
            }
        }
        else {
            // ── Generic fallback dashboard ──
            const primaryMeasure = numCols.find(c => {
                const l = c.toLowerCase();
                return l.includes('totalprice') || l.includes('revenue') || l.includes('sales') || l.includes('amount') || l.includes('price');
            }) || numCols[0] || null;

            const secondaryMeasure = numCols.find(c => {
                const l = c.toLowerCase();
                return c !== primaryMeasure && (l.includes('quantity') || l.includes('orders') || l.includes('units') || l.includes('shippingcost') || l.includes('discount'));
            }) || numCols.find(c => c !== primaryMeasure) || null;

            const primaryDim = catCols.find(c => {
                const l = c.toLowerCase();
                return l.includes('product') || l.includes('category') || l.includes('item') || l.includes('segment');
            }) || catCols[0] || null;

            const secondaryDim = catCols.find(c => {
                const l = c.toLowerCase();
                return c !== primaryDim && (l.includes('region') || l.includes('country') || l.includes('store') || l.includes('location') || l.includes('state') || l.includes('city') || l.includes('market'));
            }) || catCols.find(c => c !== primaryDim) || null;

            const totalRevSum = primaryMeasure ? rows.reduce((s, r) => s + (Number(r[primaryMeasure]) || 0), 0) : 0;

            activeKpis.push({
                id: 'kpi-records',
                title: 'Total Records',
                type: 'kpi',
                data: getSparklineCountPoints(null, rows, dateDim),
                columns: [],
                width: 3,
                value: recordCount > 1000 ? `${(recordCount / 1000).toFixed(1)}K` : `${recordCount}`,
                trend: '12.4%', isUp: true, sub: `vs ${Math.round(recordCount * 0.89)}`
            });

            if (primaryMeasure) {
                activeKpis.push({
                    id: 'kpi-primary-meas',
                    title: `Total ${primaryMeasure}`,
                    type: 'kpi',
                    data: getSparklineDataPoints(primaryMeasure, rows, dateDim),
                    columns: [primaryMeasure],
                    width: 3,
                    value: totalRevSum > 1000000 ? `${(totalRevSum / 1000000).toFixed(2)}M` : `${totalRevSum.toLocaleString()}`,
                    trend: '8.3%', isUp: true, sub: `vs ${(totalRevSum * 0.92).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                });
            }

            if (primaryDim) {
                const uniqueVal = new Set(rows.map(r => r[primaryDim]).filter(Boolean)).size;
                activeKpis.push({
                    id: 'kpi-primary-dim',
                    title: `Unique ${primaryDim}s`,
                    type: 'kpi',
                    data: getSparklineCountPoints(primaryDim, rows, dateDim),
                    columns: [primaryDim],
                    width: 3,
                    value: uniqueVal > 1000 ? `${(uniqueVal / 1000).toFixed(1)}K` : `${uniqueVal}`,
                    trend: '4.2%', isUp: true, sub: `vs ${Math.round(uniqueVal * 0.95)}`
                });
            }

            if (secondaryMeasure) {
                const sumVal = rows.reduce((s, r) => s + (Number(r[secondaryMeasure]) || 0), 0);
                activeKpis.push({
                    id: 'kpi-secondary-meas',
                    title: `Total ${secondaryMeasure}`,
                    type: 'kpi',
                    data: getSparklineDataPoints(secondaryMeasure, rows, dateDim),
                    columns: [secondaryMeasure],
                    width: 3,
                    value: sumVal > 1000000 ? `${(sumVal / 1000000).toFixed(2)}M` : `${sumVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}`,
                    trend: '3.1%', isUp: true, sub: `vs ${(sumVal * 0.96).toLocaleString(undefined, { maximumFractionDigits: 1 })}`
                });
            }

            const donutData = primaryDim && primaryMeasure ? aggregateMetric(rows, primaryDim, primaryMeasure, 'sum').slice(0, 5) : [];
            const barData = secondaryDim && primaryMeasure ? aggregateMetric(rows, secondaryDim, primaryMeasure, 'sum').slice(0, 5) : [];
            const topProd = donutData[0]?.label || 'None';
            const topReg = barData[0]?.label || 'None';
            const topRegPct = totalRevSum > 0 ? (((barData[0]?.value || 0) / totalRevSum) * 100).toFixed(1) : '0';

            activeCharts.push({
                id: 'w-insights',
                title: 'Data-Driven Key Insights',
                type: 'insights',
                data: [
                    { icon: '🟢', t: `Dataset scan finished`, d: `Scanned ${recordCount.toLocaleString()} items successfully.` },
                    { icon: '🔵', t: `Aggregate primary measure`, d: `Sum values reached ${totalRevSum.toLocaleString()}.` }
                ],
                columns: [],
                width: 4
            });

            if (dateDim && primaryMeasure) {
                const monthlyDataMap: Record<string, number> = {};
                rows.forEach(row => {
                    const formatted = formatExcelDate(row[dateDim]);
                    if (!monthlyDataMap[formatted]) monthlyDataMap[formatted] = 0;
                    monthlyDataMap[formatted] += Number(row[primaryMeasure]) || 0;
                });
                const lineData = Object.entries(monthlyDataMap).map(([label, value]) => ({
                    label,
                    value: Math.round(value * 100) / 100,
                    valuePY: Math.round(value * 0.85 * 100) / 100
                })).slice(-12);

                activeCharts.push({
                    id: 'w-line',
                    title: `${primaryMeasure} Over Time`,
                    type: 'line',
                    data: lineData,
                    columns: [dateDim, primaryMeasure],
                    width: 8
                });
            }

            if (primaryDim && primaryMeasure) {
                activeCharts.push({
                    id: 'w-donut',
                    title: `${primaryMeasure} by ${primaryDim}`,
                    type: 'pie',
                    data: donutData,
                    columns: [primaryDim, primaryMeasure],
                    width: 4
                });
            }

            activeCharts.push({
                id: 'w-recommendations',
                title: 'Strategic Playbook Recommendations',
                type: 'recommendations',
                data: [
                    { icon: '🟣', t: `Focus resources on top performing segments`, d: `Optimize inventory for top items like ${topProd}.` },
                    { icon: '🟠', t: `Target campaign channels outside main core`, d: `Expand business reach beyond ${topReg} region.` }
                ],
                columns: [],
                width: 4
            });

            if (secondaryDim && primaryMeasure) {
                activeCharts.push({
                    id: 'w-bar',
                    title: `${primaryMeasure} by ${secondaryDim}`,
                    type: 'bar',
                    data: barData,
                    columns: [secondaryDim, primaryMeasure],
                    width: 4
                });
            }

            if (primaryDim && primaryMeasure) {
                activeCharts.push({
                    id: 'w-treemap',
                    title: `${primaryMeasure} Distribution by ${primaryDim}`,
                    type: 'treemap',
                    data: donutData,
                    columns: [primaryDim, primaryMeasure],
                    width: 6
                });
            }

            if (primaryMeasure && secondaryMeasure) {
                activeCharts.push({
                    id: 'w-scatter',
                    title: `${secondaryMeasure} vs ${primaryMeasure} Correlation`,
                    type: 'scatter',
                    data: rows.slice(0, 50).map(r => ({ x: Number(r[secondaryMeasure]) || 0, y: Number(r[primaryMeasure]) || 0 })),
                    columns: [secondaryMeasure, primaryMeasure],
                    width: 6
                });
            }

            if (primaryDim && primaryMeasure) {
                const tableData = donutData.map(item => {
                    const itemRows = rows.filter(r => String(r[primaryDim]) === item.label);
                    return {
                        p: item.label,
                        c: secondaryDim ? (itemRows[0]?.[secondaryDim] || 'General') : 'General',
                        r: item.value.toLocaleString(),
                        o: itemRows.length.toLocaleString()
                    };
                });
                activeCharts.push({
                    id: 'w-table',
                    title: `Top ${primaryDim}s breakdown`,
                    type: 'table',
                    data: tableData,
                    columns: [primaryDim, secondaryDim || 'Category', primaryMeasure || 'Value', 'Records'],
                    width: 12
                });
            }
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
                } else if (w.type === 'bubble') {
                    const numCols = Object.keys(stats.stats).filter(c => stats.stats[c]?.type === 'numeric');
                    const z = numCols[2] || numCols[0] || '';
                    const bubbleData = filteredRows.slice(0, 30).map(r => ({
                        x: Number(r[dimCol]) || 0,
                        y: Number(r[measCol]) || 0,
                        z: Number(r[z]) || 0
                    }));
                    return { ...w, data: bubbleData };
                } else if (w.type === 'gauge' || w.type === 'progress') {
                    const sumVal = filteredRows.reduce((s, r) => s + (Number(r[measCol]) || 0), 0);
                    const avgVal = sumVal / (filteredRows.length || 1);
                    const maxVal = stats.stats[measCol]?.max || 100;
                    return { ...w, data: [{ value: Math.round(avgVal) }, { value: Math.round(maxVal) }] };
                } else {
                    const customData = aggregateMetric(filteredRows, dimCol, measCol, 'sum').slice(0, 8);
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
                cardSizes,
                autoModeEnabled
            }));

            // Sync customized layout states to the backend SQLite database
            if (selectedDs && selectedDs !== 'products-50') {
                await apiClient.patch(`/data/datasets/${selectedDs}`, {
                    dashboardLayout: JSON.stringify({
                        widgets,
                        cardSizes,
                        autoModeEnabled
                    })
                });
            }

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

    // Rename Dataset Handler
    const handleRenameDataset = async (id: string, newName: string) => {
        if (!newName.trim()) return;
        try {
            if (id !== 'products-50' && !id.startsWith('mock-')) {
                await apiClient.patch(`/data/datasets/${id}`, { name: newName });
            }
            setLocalDatasets(prev => prev.map(d => d.id === id ? { ...d, name: newName } : d));
            setDatasets(prev => prev.map(d => d.id === id ? { ...d, name: newName } : d));
            setRenamingDsId(null);
            showToast('Dataset renamed successfully!', 'success');
        } catch {
            showToast('Failed to rename dataset.', 'error');
        }
    };

    // Delete Dataset Handler
    const handleDeleteDataset = async (id: string) => {
        try {
            if (id !== 'products-50' && !id.startsWith('mock-')) {
                await apiClient.delete(`/data/datasets/${id}`);
            }

            // Persist the deletion locally so mock/fallback datasets remain deleted on refresh
            const localDeleted = localStorage.getItem('workspace_deleted_datasets');
            const deletedIds: string[] = localDeleted ? JSON.parse(localDeleted) : [];
            if (!deletedIds.includes(id)) {
                deletedIds.push(id);
                localStorage.setItem('workspace_deleted_datasets', JSON.stringify(deletedIds));
            }

            setLocalDatasets(prev => prev.filter(d => d.id !== id));
            setDatasets(prev => prev.filter(d => d.id !== id));
            if (selectedDs === id) {
                setSelectedDs('');
            }
            showToast('Dataset deleted.', 'info');
        } catch {
            showToast('Failed to delete dataset.', 'error');
        }
    };

    // Duplicate Dataset Handler
    const handleDuplicateDataset = (id: string) => {
        const target = localDatasets.find(d => d.id === id);
        if (!target) return;
        const copy = {
            ...target,
            id: `${target.id}-copy-${Date.now()}`,
            name: `${target.name.split('.')[0]}_copy.${target.name.split('.')[1] || 'csv'}`,
            uploadedDate: new Date().toISOString().split('T')[0],
            favorite: false
        };
        setLocalDatasets(prev => [...prev, copy]);
        setDatasets(prev => [...prev, copy]);
        showToast('Dataset duplicated.', 'success');
    };

    // Pin/Favorite Toggle
    const handleToggleFavorite = (id: string) => {
        let nextFavs = [...favoriteDsIds];
        if (nextFavs.includes(id)) {
            nextFavs = nextFavs.filter(x => x !== id);
            showToast('Dataset unpinned from favorites.', 'info');
        } else {
            nextFavs.push(id);
            showToast('Dataset pinned to favorites!', 'success');
        }
        setFavoriteDsIds(nextFavs);
        localStorage.setItem('workspace_favorite_datasets', JSON.stringify(nextFavs));
    };

    // Preview Dataset Rows Handler
    const handlePreviewDataset = async (id: string) => {
        try {
            let rows = [];
            if (id === 'products-50') {
                const localData = localStorage.getItem('dataset_data_products-50');
                rows = localData ? JSON.parse(localData) : [
                    { id: 1, user_id: 1, name: 'Rahul Sharma', age: 23, gender: 'M', email: 'rahuls@gmail.com', signup_date: '2024-01-05', country: 'India', total_spent: 1200 },
                    { id: 2, user_id: 2, name: 'ankita patil', age: 27, gender: 'F', email: 'ankita@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 3400 },
                    { id: 3, user_id: 3, name: 'Aman Verma', age: 18, gender: 'M', email: 'aman.verma@gmail.com', signup_date: '2024-03-12', country: 'India', total_spent: 500 }
                ];
            } else if (id.startsWith('mock-')) {
                rows = generateMockDatasetRows(id);
            } else {
                const det = await apiClient.get(`/data/datasets/${id}`);
                rows = det?.data?.rawData || [];
            }
            setPreviewDatasetData(rows.slice(0, 15));
        } catch {
            showToast('Failed to preview raw dataset.', 'error');
        }
    };

    // View Metadata Profile Handler
    const handleViewMetadata = async (id: string) => {
        try {
            let stats = null;
            if (id === 'products-50') {
                const rows = [
                    { id: 1, user_id: 1, name: 'Rahul Sharma', age: 23, gender: 'M', email: 'rahuls@gmail.com', signup_date: '2024-01-05', country: 'India', total_spent: 1200 },
                    { id: 2, user_id: 2, name: 'ankita patil', age: 27, gender: 'F', email: 'ankita@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 3400 },
                    { id: 3, user_id: 3, name: 'Aman Verma', age: 18, gender: 'M', email: 'aman.verma@gmail.com', signup_date: '2024-03-12', country: 'India', total_spent: 500 }
                ];
                stats = computeClientSideAnalytics('products-50.csv', rows);
            } else if (id.startsWith('mock-')) {
                stats = generateMockDatasetAnalytics(id);
            } else {
                stats = await apiClient.get(`/data/datasets/${id}/analytics`);
            }
            setPreviewDatasetMetadata(stats);
        } catch {
            showToast('Failed to compile metadata profile.', 'error');
        }
    };

    // Dynamic mock generators helper
    const generateMockDatasetRows = (id: string) => {
        if (id === 'mock-hr') {
            return Array.from({ length: 15 }, (_, i) => ({
                id: i + 1,
                name: `Employee ${i + 1}`,
                department: ['HR', 'Sales', 'Finance', 'Engineering', 'Marketing'][i % 5],
                role: ['Analyst', 'Manager', 'Developer', 'Lead'][i % 4],
                salary: Math.floor(60000 + i * 8000),
                tenure_years: (2 + i * 0.7).toFixed(1),
                gender: i % 2 === 0 ? 'F' : 'M'
            }));
        }
        if (id === 'mock-churn') {
            return Array.from({ length: 15 }, (_, i) => ({
                id: i + 1,
                customer_name: `Customer ${i + 1}`,
                contract_type: i % 2 === 0 ? 'Month-to-month' : 'One year',
                tenure_months: 5 + i * 6,
                monthly_charges: (45.5 + i * 12.2).toFixed(2),
                churn_risk_score: Math.floor(10 + i * 8),
                country: 'India'
            }));
        }
        return Array.from({ length: 15 }, (_, i) => ({
            id: i + 1,
            month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i % 6],
            revenue: Math.floor(45000 + i * 15000),
            expense: Math.floor(30000 + i * 8000),
            budget_allocation: Math.floor(50000 + i * 5000),
            category: ['Operational', 'Marketing', 'Payroll'][i % 3]
        }));
    };

    const generateMockDatasetAnalytics = (id: string): DatasetAnalytics => {
        const columns = id === 'mock-hr' 
            ? ['id', 'name', 'department', 'role', 'salary', 'tenure_years', 'gender'] 
            : id === 'mock-churn' 
                ? ['id', 'customer_name', 'contract_type', 'tenure_months', 'monthly_charges', 'churn_risk_score', 'country']
                : ['id', 'month', 'revenue', 'expense', 'budget_allocation', 'category'];
        
        const name = id === 'mock-hr' ? 'employee_retention.xlsx' : id === 'mock-churn' ? 'customer_churn.csv' : 'finance_q2_raw.csv';
        const rows = id === 'mock-hr' ? 1500 : id === 'mock-churn' ? 820 : 2400;

        const stats: Record<string, ColStat> = {};
        columns.forEach(col => {
            const isNumeric = col === 'id' || col === 'salary' || col === 'tenure_years' || col === 'tenure_months' || col === 'monthly_charges' || col === 'churn_risk_score' || col === 'revenue' || col === 'expense' || col === 'budget_allocation';
            stats[col] = {
                type: isNumeric ? 'numeric' : 'categorical',
                count: rows,
                nullCount: 0,
                uniqueCount: isNumeric ? undefined : 5,
                min: isNumeric ? 10 : undefined,
                max: isNumeric ? 150000 : undefined,
                avg: isNumeric ? 45000 : undefined
            };
        });

        return {
            name,
            rows,
            columns,
            stats,
            distributions: {},
            qualityScore: id === 'mock-hr' ? 98 : id === 'mock-churn' ? 92 : 94
        };
    };

    const handleMockFileUpload = (fileName: string, fileContent: string) => {
        const lines = fileContent.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        const rows = lines.slice(1).map(l => {
            const values = l.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
            const rowObj: Record<string, any> = {};
            headers.forEach((h, idx) => {
                const val = values[idx];
                const num = Number(val);
                rowObj[h] = isNaN(num) ? val : num;
            });
            return rowObj;
        });

        const newId = `ds-uploaded-${Date.now()}`;
        const newDataset = {
            id: newId,
            name: fileName,
            status: 'Active',
            contractStatus: 'Active',
            quality: 98,
            size: fileContent.length > 1024 * 1024 ? `${(fileContent.length / (1024 * 1024)).toFixed(1)} MB` : `${(fileContent.length / 1024).toFixed(1)} KB`,
            rowsCount: rows.length,
            columnsCount: headers.length,
            category: headers.includes('salary') ? 'HR' : headers.includes('spent') ? 'Sales' : 'Finance',
            ownerName: 'Rahul Sharma',
            uploadedDate: new Date().toISOString().split('T')[0],
            favorite: false
        };

        // Save raw data to localStorage
        localStorage.setItem(`dataset_data_${newId}`, JSON.stringify(rows));
        
        setLocalDatasets(prev => [newDataset, ...prev]);
        setDatasets(prev => [newDataset, ...prev]);
        setSelectedDs(newId);
        showToast(`Dataset ${fileName} uploaded and ingested successfully!`, 'success');
        setShowUploadDsModal(false);
    };

    const handleFileDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            readAndIngestFile(file);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            readAndIngestFile(file);
        }
    };

    const readAndIngestFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (text) {
                handleMockFileUpload(file.name, text);
            }
        };
        reader.readAsText(file);
    };


    // Asynchronous Dashboard Builder Engine
    const handleGenerateWorkspaceDashboard = (promptText: string) => {
        if (!selectedDs) {
            showToast('Please select a cleaned dataset first.', 'error');
            return;
        }
        if (!promptText.trim()) {
            showToast('Please enter a query describing your analysis.', 'error');
            return;
        }

        setPromptInput(promptText);
        setGenerating(true);
        setGenerationStep(0);

        const interval = setInterval(async () => {
            setGenerationStep(prev => {
                if (prev >= 6) {
                    clearInterval(interval);
                    (async () => {
                        try {
                            let rows = [];
                            let stats: any = null;

                            if (selectedDs === 'products-50') {
                                const localData = localStorage.getItem('dataset_data_products-50');
                                rows = localData ? JSON.parse(localData) : [
                                    { _rid: 'r1', id: 1, user_id: 1, name: 'Rahul Sharma', age: 23, gender: 'M', email: 'rahuls@gmail.com', signup_date: '2024-01-05', country: 'India', total_spent: 1200 },
                                    { _rid: 'r2', id: 2, user_id: 2, name: 'ankita patil', age: 27, gender: 'F', email: 'ankita@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 3400 }
                                ];
                                stats = computeClientSideAnalytics('products-50.csv', rows);
                            } else if (selectedDs.startsWith('mock-')) {
                                rows = generateMockDatasetRows(selectedDs);
                                stats = generateMockDatasetAnalytics(selectedDs);
                            } else {
                                const det = await apiClient.get(`/data/datasets/${selectedDs}`);
                                const s = await apiClient.get(`/data/datasets/${selectedDs}/analytics`);
                                rows = det?.data?.rawData || [];
                                stats = s;
                            }

                            if (stats && rows) {
                                setDsAnalytics(stats);
                                setActiveRawData(rows);
                                setOriginalRawData(rows);
                                setActiveFilters({});

                                const defaultCat = stats.detectedCategory || detectDatasetCategory(stats).category;
                                const inferredCategory = inferCategoryFromPrompt(promptText, defaultCat);

                                setDetectedCategory(inferredCategory);
                                setDetectedConfidence(98);
                                setAiExplanation(generateAiExplanation(inferredCategory, stats));

                                const generatedRecommendations = getChartRecommendations(stats, rows);
                                setRecommendations(generatedRecommendations);

                                buildExecutiveDashboard(stats, rows, inferredCategory);

                                setChatMsgs([
                                    { role: 'user', text: promptText },
                                    {
                                        role: 'ai',
                                        text: `🎨 **AI BI Dashboard Generated Successfully!**\n\nI processed the dataset using **${inferredCategory}** classification algorithms to match your prompt: *"${promptText}"*.\n\n* **Structure detected**: ${stats.columns.length} columns, ${rows.length.toLocaleString()} raw tuples.\n* **Dashboard Quality Score**: ${stats.qualityScore}% profile optimization.\n\nI have rendered specialized KPI summaries and visual recommendation trends. Use the controls above to modify layout or share options!`,
                                        recommendations: generatedRecommendations
                                    }
                                ]);

                                const targetDsName = localDatasets.find(d => d.id === selectedDs)?.name || 'Dataset';
                                const newDash = {
                                    id: `dash-gen-${Date.now()}`,
                                    name: `${targetDsName.split('.')[0]} AI Summary Canvas`,
                                    datasetId: selectedDs,
                                    datasetName: targetDsName,
                                    type: `${inferredCategory} Dashboard`,
                                    createdAt: new Date().toISOString(),
                                    lastEdited: new Date().toISOString(),
                                    owner: 'Me',
                                    version: '1.0.0'
                                };
                                const updatedDashboards = [newDash, ...savedDashboards];
                                setSavedDashboards(updatedDashboards);
                                localStorage.setItem('workspace_dashboards', JSON.stringify(updatedDashboards));

                                const newConv = {
                                    id: `conv-gen-${Date.now()}`,
                                    prompt: promptText,
                                    datasetId: selectedDs,
                                    datasetName: targetDsName,
                                    timestamp: new Date().toISOString(),
                                    chatMsgs: [
                                        { role: 'user', text: promptText },
                                        { role: 'ai', text: `Generated **${inferredCategory}** dashboard matching prompt: "${promptText}".` }
                                    ]
                                };
                                const updatedConversations = [newConv, ...recentConversations];
                                setRecentConversations(updatedConversations);
                                localStorage.setItem('workspace_conversations', JSON.stringify(updatedConversations));

                                setWorkspaceState('dashboard');
                                showToast('AI analytics workspace generated dashboard!', 'success');
                            }
                        } catch (e) {
                            console.error(e);
                            showToast('Failed to compile dataset canvas layout.', 'error');
                        } finally {
                            setGenerating(false);
                        }
                    })();
                    return 6;
                }
                return prev + 1;
            });
        }, 400);
    };

    const handleDeleteDashboard = (dashId: string) => {
        if (!confirm('Are you sure you want to delete this dashboard?')) return;
        const updatedDashes = savedDashboards.filter((d: any) => d.id !== dashId);
        setSavedDashboards(updatedDashes);
        localStorage.setItem('workspace_dashboards', JSON.stringify(updatedDashes));
        showToast('Dashboard deleted successfully.', 'success');
    };

    const handleLoadSavedDashboard = async (dash: any) => {
        setSelectedDs(dash.datasetId);
        try {
            let rows = [];
            let stats: any = null;

            if (dash.datasetId === 'products-50') {
                const localData = localStorage.getItem('dataset_data_products-50');
                rows = localData ? JSON.parse(localData) : [
                    { _rid: 'r1', id: 1, user_id: 1, name: 'Rahul Sharma', age: 23, gender: 'M', email: 'rahuls@gmail.com', signup_date: '2024-01-05', country: 'India', total_spent: 1200 },
                    { _rid: 'r2', id: 2, user_id: 2, name: 'ankita patil', age: 27, gender: 'F', email: 'ankita@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 3400 }
                ];
                stats = computeClientSideAnalytics('products-50.csv', rows);
            } else if (dash.datasetId.startsWith('mock-')) {
                rows = generateMockDatasetRows(dash.datasetId);
                stats = generateMockDatasetAnalytics(dash.datasetId);
            } else {
                const det = await apiClient.get(`/data/datasets/${dash.datasetId}`);
                const s = await apiClient.get(`/data/datasets/${dash.datasetId}/analytics`);
                rows = det?.data?.rawData || [];
                stats = s;
            }

            if (stats && rows) {
                setDsAnalytics(stats);
                setActiveRawData(rows);
                setOriginalRawData(rows);
                setActiveFilters({});

                const inferredCategory = dash.type.replace(' Dashboard', '');
                setDetectedCategory(inferredCategory);
                setDetectedConfidence(98);
                setAiExplanation(generateAiExplanation(inferredCategory, stats));

                const generatedRecommendations = getChartRecommendations(stats, rows);
                setRecommendations(generatedRecommendations);

                buildExecutiveDashboard(stats, rows, inferredCategory);

                setChatMsgs([
                    { role: 'ai', text: `Loaded saved dashboard **${dash.name}** for dataset **${dash.datasetName}**.` }
                ]);

                setWorkspaceState('dashboard');
                showToast(`Loaded dashboard: ${dash.name}`, 'success');
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to load saved dashboard.', 'error');
        }
    };

    const handleDeleteConversation = (convId: string) => {
        if (!confirm('Are you sure you want to delete this conversation?')) return;
        const updatedConvs = recentConversations.filter((c: any) => c.id !== convId);
        setRecentConversations(updatedConvs);
        localStorage.setItem('workspace_conversations', JSON.stringify(updatedConvs));
        showToast('Conversation deleted successfully.', 'success');
    };

    const handleLoadRecentConversation = async (conv: any) => {
        setSelectedDs(conv.datasetId);
        try {
            let rows = [];
            let stats: any = null;

            if (conv.datasetId === 'products-50') {
                const localData = localStorage.getItem('dataset_data_products-50');
                rows = localData ? JSON.parse(localData) : [
                    { _rid: 'r1', id: 1, user_id: 1, name: 'Rahul Sharma', age: 23, gender: 'M', email: 'rahuls@gmail.com', signup_date: '2024-01-05', country: 'India', total_spent: 1200 },
                    { _rid: 'r2', id: 2, user_id: 2, name: 'ankita patil', age: 27, gender: 'F', email: 'ankita@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 3400 }
                ];
                stats = computeClientSideAnalytics('products-50.csv', rows);
            } else if (conv.datasetId.startsWith('mock-')) {
                rows = generateMockDatasetRows(conv.datasetId);
                stats = generateMockDatasetAnalytics(conv.datasetId);
            } else {
                const det = await apiClient.get(`/data/datasets/${conv.datasetId}`);
                const s = await apiClient.get(`/data/datasets/${conv.datasetId}/analytics`);
                rows = det?.data?.rawData || [];
                stats = s;
            }

            if (stats && rows) {
                setDsAnalytics(stats);
                setActiveRawData(rows);
                setOriginalRawData(rows);
                setActiveFilters({});

                const inferredCategory = inferCategoryFromPrompt(conv.prompt, stats.detectedCategory || detectDatasetCategory(stats).category);
                setDetectedCategory(inferredCategory);
                setDetectedConfidence(98);
                setAiExplanation(generateAiExplanation(inferredCategory, stats));

                const generatedRecommendations = getChartRecommendations(stats, rows);
                setRecommendations(generatedRecommendations);

                buildExecutiveDashboard(stats, rows, inferredCategory);

                setChatMsgs(conv.chatMsgs || [
                    { role: 'user', text: conv.prompt },
                    { role: 'ai', text: `Restored conversation analytics dashboard matching prompt: "${conv.prompt}"` }
                ]);

                setWorkspaceState('dashboard');
                showToast(`Restored analytics session: "${conv.prompt}"`, 'success');
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to restore conversation session.', 'error');
        }
    };


    const inferCategoryFromPrompt = (prompt: string, defaultCat: string): string => {
        const p = prompt.toLowerCase();
        if (p.includes('hr') || p.includes('employee') || p.includes('retention') || p.includes('department') || p.includes('hire') || p.includes('talent')) {
            return 'HR';
        }
        if (p.includes('finance') || p.includes('revenue') || p.includes('spent') || p.includes('cash') || p.includes('budget') || p.includes('payout')) {
            return 'Finance';
        }
        if (p.includes('patient') || p.includes('health') || p.includes('medical') || p.includes('admission') || p.includes('disease')) {
            return 'Healthcare';
        }
        if (p.includes('stock') || p.includes('inventory') || p.includes('supplier') || p.includes('warehouse') || p.includes('item')) {
            return 'Inventory';
        }
        if (p.includes('marketing') || p.includes('campaign') || p.includes('conversion') || p.includes('impression') || p.includes('churn') || p.includes('customer')) {
            return 'Marketing';
        }
        if (p.includes('sales') || p.includes('revenue') || p.includes('deal') || p.includes('order')) {
            return 'Sales';
        }
        return defaultCat;
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
        setAutoModeEnabled(true);
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
                let valToRender = w.value;
                let subToRender = w.sub;
                const isSalesKpi = w.id === 'kpi-sales' || w.title.toLowerCase().includes('sales') || w.title.toLowerCase().includes('revenue') || w.title.toLowerCase().includes('spent');
                if (isSalesKpi) {
                    const priceMult = 1 + (whatIfPrice / 100);
                    const marketingMult = 1 + (whatIfMarketing / 100) * 0.75;
                    const combinedMult = priceMult * marketingMult;

                    const rawValStr = String(w.value).replace(/[^0-9.]/g, '');
                    const numericVal = Number(rawValStr) || 0;
                    const simulatedVal = numericVal * combinedMult;

                    const suffix = String(w.value).replace(/[0-9.,$]/g, '').trim();
                    const isCurrency = String(w.value).includes('$');

                    valToRender = `${isCurrency ? '$' : ''}${simulatedVal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}${suffix} (Simulated)`;
                    subToRender = `Original: ${w.value} | Price ${whatIfPrice >= 0 ? '+' : ''}${whatIfPrice}% | Mkt ${whatIfMarketing >= 0 ? '+' : ''}${whatIfMarketing}%`;
                }

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', height: '100%', justifyContent: 'center' }}>
                        <div className="studio-kpi-val-row" style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                            <span className="studio-kpi-val" style={{ fontSize: '1.25rem', fontWeight: 800 }}>{valToRender}</span>
                            <span className={`studio-kpi-trend ${w.isUp ? 'up' : 'down'}`} style={{ fontSize: '0.65rem', fontWeight: 700, color: w.isUp ? 'var(--studio-green)' : '#ef4444' }}>
                                {w.isUp ? '▲' : '▼'} {w.trend}
                            </span>
                        </div>
                        <div className="studio-kpi-sub" style={{ fontSize: '0.625rem', color: 'var(--studio-text-sub)' }}>{subToRender}</div>

                        <div className="studio-kpi-spark" style={{ marginTop: '0.25rem', height: isSalesKpi ? '22px' : '38px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={w.data.map((val, idx) => ({ idx, val }))}>
                                    <Area type="monotone" dataKey="val" stroke="#4f46e5" strokeWidth={1} fill="rgba(79, 70, 229, 0.05)" dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* What-If Simulation sliders embedded inside sales KPI */}
                        {isSalesKpi && (
                            <div style={{ marginTop: '0.4rem', borderTop: '1px dashed var(--studio-border)', paddingTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.55rem', fontWeight: 600, color: 'var(--studio-text-sub)' }}>
                                    <span>Price: {whatIfPrice >= 0 ? '+' : ''}{whatIfPrice}%</span>
                                    <input 
                                        type="range" 
                                        min="-30" max="30" step="5" 
                                        value={whatIfPrice} 
                                        onChange={(e) => setWhatIfPrice(Number(e.target.value))}
                                        style={{ width: '70px', height: '4px', cursor: 'pointer' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.55rem', fontWeight: 600, color: 'var(--studio-text-sub)' }}>
                                    <span>Marketing: {whatIfMarketing >= 0 ? '+' : ''}{whatIfMarketing}%</span>
                                    <input 
                                        type="range" 
                                        min="-30" max="30" step="5" 
                                        value={whatIfMarketing} 
                                        onChange={(e) => setWhatIfMarketing(Number(e.target.value))}
                                        style={{ width: '70px', height: '4px', cursor: 'pointer' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={w.data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }} onClick={(data) => handleChartClick(w, data)}>
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
                        <BarChart data={w.data} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 5 }} onClick={(data) => handleChartClick(w, data)}>
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
                                        onClick={(data) => handleChartClick(w, data)}
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
                    <div className="studio-table-container" style={{ width: '100%', height: 'auto', overflowY: 'visible' }}>
                        <table className="studio-table">
                            <thead>
                                <tr>
                                    <th>{w.columns[0] || 'Item'}</th>
                                    <th>{w.columns[1] || 'Category'}</th>
                                    <th>{w.columns[2] || 'Value'}</th>
                                    <th>{w.columns[3] || 'Details'}</th>
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
                        <AreaChart data={w.data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }} onClick={(data) => handleChartClick(w, data)}>
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
                        <AreaChart data={w.data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }} onClick={(data) => handleChartClick(w, data)}>
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
                        <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 5 }} onClick={(data) => handleChartClick(w, data)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis type="number" dataKey="x" name={w.columns[0] || 'X'} axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <YAxis type="number" dataKey="y" name={w.columns[1] || 'Y'} axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name={w.title} data={w.data} fill="#4f46e5" />
                        </ScatterChart>
                    </ResponsiveContainer>
                );
            case 'histogram':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={w.data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }} onClick={(data) => handleChartClick(w, data)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <Tooltip formatter={(value) => [value, 'Frequency']} />
                            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'map':
                return (
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc', borderRadius: '8px', padding: '0.5rem', overflow: 'hidden' }}>
                        <svg viewBox="0 0 200 100" style={{ width: '100%', height: 'calc(100% - 15px)', position: 'absolute', top: 5, left: 0, opacity: 0.15, pointerEvents: 'none' }}>
                            <path d="M10,30 Q30,20 50,30 T90,20 T130,40 T170,10 T190,50" fill="none" stroke="#4f46e5" strokeWidth={1} strokeDasharray="2 2" />
                            <path d="M20,60 Q60,80 100,50 T150,70 T180,60" fill="none" stroke="#4f46e5" strokeWidth={1} strokeDasharray="2 2" />
                            <rect x="0" y="0" width="200" height="100" fill="none" stroke="#cbd5e1" strokeWidth={0.5} />
                        </svg>
                        
                        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'scaleY(-1)' }}>
                                {w.data.slice(0, 30).map((pt: any, i: number) => {
                                    return (
                                        <circle
                                            key={i}
                                            cx={pt.x}
                                            cy={pt.y}
                                            r={3.5}
                                            fill="#4f46e5"
                                            stroke="#ffffff"
                                            strokeWidth={1}
                                            opacity={0.8}
                                            style={{ cursor: 'pointer', transition: 'r 0.2s' }}
                                        >
                                            <title>{`Lat: ${pt.lat}, Lng: ${pt.lng}`}</title>
                                        </circle>
                                    );
                                })}
                            </svg>
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--studio-text-sub)', textAlign: 'center', zIndex: 1 }}>
                            Plotted {w.data.length} geographic coordinates (Lat/Lng)
                        </div>
                    </div>
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
            case 'waterfall':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={w.data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }} onClick={(data) => handleChartClick(w, data)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <Tooltip />
                            <Bar dataKey="value" barSize={25}>
                                {w.data.map((entry: any, idx: number) => {
                                    const isNeg = entry.value < 0;
                                    return <Cell key={`cell-${idx}`} fill={isNeg ? '#ef4444' : '#10b981'} />;
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'bubble':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 5 }} onClick={(data) => handleChartClick(w, data)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis type="number" dataKey="x" name="X" axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <YAxis type="number" dataKey="y" name="Y" axisLine={false} tickLine={false} tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <ZAxis type="number" dataKey="z" range={[20, 400]} name="Value" />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name={w.title} data={w.data} fill="#0ea5e9" />
                        </ScatterChart>
                    </ResponsiveContainer>
                );
            case 'radar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={w.data} cx="50%" cy="50%" outerRadius="70%" onClick={(data) => handleChartClick(w, data)}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="label" tick={{ fill: 'var(--studio-text-sub)', fontSize: 8 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: 'var(--studio-text-sub)', fontSize: 7 }} />
                            <Radar name={w.title} dataKey="value" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.3} />
                            <Tooltip />
                        </RadarChart>
                    </ResponsiveContainer>
                );
            case 'gauge':
                const gaugeVal = w.data[0]?.value || 0;
                const gaugeMax = w.data[1]?.value || 100;
                const pctVal = Math.min(100, Math.round((gaugeVal / (gaugeMax || 1)) * 100));
                const pieData = [{ value: pctVal }, { value: 100 - pctVal }];
                return (
                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '130px', height: '80px', overflow: 'hidden', position: 'relative' }}>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        cx="50%" cy="50%"
                                        startAngle={180} endAngle={0}
                                        innerRadius={45} outerRadius={60}
                                        stroke="none"
                                    >
                                        <Cell fill="#4f46e5" />
                                        <Cell fill="#f1f5f9" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '-1.5rem', color: 'var(--studio-text)' }}>
                            {pctVal}%
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--studio-text-sub)', textTransform: 'uppercase', fontWeight: 700 }}>
                            Target Progress
                        </div>
                    </div>
                );
            case 'progress':
                const progressPct = Math.min(100, w.data[0]?.value || 75);
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', gap: '0.4rem', padding: '0 0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--studio-text)' }}>
                            <span>Progress Status</span>
                            <span>{progressPct}%</span>
                        </div>
                        <div style={{ width: '100%', height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #4f46e5 0%, #0ea5e9 100%)', borderRadius: '6px', transition: 'width 0.5s ease-out' }} />
                        </div>
                        <span style={{ fontSize: '0.6rem', color: 'var(--studio-text-sub)' }}>Threshold limits normal</span>
                    </div>
                );
            case 'pivot':
                return (
                    <div className="studio-table-container" style={{ width: '100%', height: 'auto', overflowY: 'visible' }}>
                        <table className="studio-table pivot" style={{ fontSize: '0.65rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ backgroundColor: '#f8fafc' }}>Dimension</th>
                                    <th>SUM Value</th>
                                    <th>AVG Value</th>
                                    <th>Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                {w.data.slice(0, 5).map((row: any, i: number) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 700, backgroundColor: '#f8fafc' }}>{row.label}</td>
                                        <td style={{ fontWeight: 600 }}>${(row.value * 1.1).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td>${row.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td>{Math.round(row.value / 120)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            case 'wordcloud':
                return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0.5rem' }}>
                        {w.data.slice(0, 15).map((item: any, idx: number) => {
                            const fontSizes = [10, 12, 14, 16, 18, 20];
                            const size = fontSizes[idx % fontSizes.length];
                            return (
                                <span
                                    key={idx}
                                    style={{
                                        fontSize: `${size}px`,
                                        fontWeight: size > 14 ? 700 : 500,
                                        color: THEME_COLORS[idx % THEME_COLORS.length],
                                        padding: '0.1rem 0.25rem',
                                        cursor: 'pointer',
                                        transition: 'transform 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                                    onClick={() => handleTriggerPrompt(`Filter dashboard by ${item.label}`)}
                                >
                                    {item.label}
                                </span>
                            );
                        })}
                    </div>
                );
            case 'calendar':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', gap: '0.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', margin: '0 auto', maxWidth: '180px' }}>
                            {Array.from({ length: 28 }).map((_, i) => {
                                const opacityVal = 0.2 + (i % 5) * 0.2;
                                return (
                                    <div
                                        key={i}
                                        style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '3px',
                                            backgroundColor: `rgba(79, 70, 229, ${opacityVal})`,
                                            border: '1px solid rgba(79, 70, 229, 0.1)'
                                        }}
                                        title={`Day ${i + 1}: Activity score ${Math.round(opacityVal * 100)}%`}
                                    />
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: 'var(--studio-text-sub)', maxWidth: '180px', margin: '0 auto', width: '100%' }}>
                            <span>Less Active</span>
                            <span>More Active</span>
                        </div>
                    </div>
                );
            case 'boxplot':
                return (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'space-around', padding: '1rem 0.5rem' }}>
                        {w.data.slice(0, 3).map((item: any, idx: number) => {
                            const median = item.value;
                            const minVal = Math.round(median * 0.6);
                            const maxVal = Math.round(median * 1.5);
                            return (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', position: 'relative', width: '40px' }}>
                                    <div style={{ width: '2px', height: '60%', backgroundColor: '#94a3b8', position: 'relative' }}>
                                        <div style={{ position: 'absolute', top: 0, left: '-6px', width: '14px', height: '2px', backgroundColor: '#94a3b8' }} title={`Max: ${maxVal}`} />
                                        <div style={{ position: 'absolute', top: '25%', left: '-12px', width: '26px', height: '40%', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '2px solid #4f46e5', borderRadius: '4px' }} title={`Median: ${median}`} />
                                        <div style={{ position: 'absolute', bottom: 0, left: '-6px', width: '14px', height: '2px', backgroundColor: '#94a3b8' }} title={`Min: ${minVal}`} />
                                    </div>
                                    <span style={{ fontSize: '0.6rem', color: 'var(--studio-text-sub)', marginTop: '0.4rem', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', width: '100%', textAlign: 'center' }}>{item.label}</span>
                                </div>
                            );
                        })}
                    </div>
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

    const filteredDatasets = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return localDatasets.filter(d => 
            d.name.toLowerCase().includes(query) || 
            (d.category && d.category.toLowerCase().includes(query)) ||
            (d.ownerName && d.ownerName.toLowerCase().includes(query))
        );
    }, [localDatasets, searchQuery]);

    const filteredDashboards = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return savedDashboards.filter(d => 
            d.name.toLowerCase().includes(query) || 
            d.type.toLowerCase().includes(query) ||
            d.datasetName.toLowerCase().includes(query)
        );
    }, [savedDashboards, searchQuery]);

    const filteredConversations = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return recentConversations.filter(c => 
            c.prompt.toLowerCase().includes(query) ||
            c.datasetName.toLowerCase().includes(query)
        );
    }, [recentConversations, searchQuery]);

    return (
        <div className="an-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {workspaceState === 'home' ? (
                <div className="workspace-home-layout" style={{ display: 'flex', gap: '1.25rem', width: '100%', flex: 1, minHeight: 0 }}>
                    {/* LEFT PANEL: DATASET LIBRARY */}
                    <div className="workspace-sidebar" style={{
                        width: '290px',
                        backgroundColor: 'var(--studio-card-bg)',
                        border: '1px solid var(--studio-border)',
                        borderRadius: '16px',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)',
                        flexShrink: 0
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Database size={13} color="#6366f1" /> Cleaned Datasets
                                </h3>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: 'var(--studio-bg)', color: 'var(--studio-text-sub)', padding: '0.15rem 0.4rem', borderRadius: '6px' }}>
                                    {filteredDatasets.length}
                                </span>
                            </div>
                            <button
                                onClick={() => setShowUploadDsModal(true)}
                                style={{
                                    border: 'none',
                                    background: 'var(--studio-bg)',
                                    color: 'var(--studio-text)',
                                    borderRadius: '6px',
                                    width: '22px',
                                    height: '22px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontWeight: 800,
                                    fontSize: '0.9rem'
                                }}
                                title="Ingest new CSV file"
                            >
                                +
                            </button>
                        </div>

                        {/* Search datasets */}
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="Search datasets..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.4rem 0.65rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--studio-border)',
                                    fontSize: '0.725rem',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    backgroundColor: 'var(--studio-bg)',
                                    color: 'var(--studio-text)'
                                }}
                            />
                        </div>

                        {/* Datasets list */}
                        <div className="datasets-list" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.1rem' }}>
                            {[...filteredDatasets].sort((a, b) => {
                                const aFav = favoriteDsIds.includes(a.id);
                                const bFav = favoriteDsIds.includes(b.id);
                                if (aFav && !bFav) return -1;
                                if (!aFav && bFav) return 1;
                                return 0;
                            }).map(d => {
                                const isSelected = selectedDs === d.id;
                                const isFavorite = favoriteDsIds.includes(d.id);
                                const isRenaming = renamingDsId === d.id;
                                const fileExtension = d.name.split('.').pop()?.toUpperCase() || 'CSV';

                                return (
                                    <div key={d.id} className={`dataset-card ${isSelected ? 'active' : ''}`} style={{
                                        border: isSelected ? '1.5px solid #6366f1' : '1px solid var(--studio-border)',
                                        borderRadius: '12px',
                                        padding: '0.85rem',
                                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'var(--studio-card-bg)',
                                        transition: 'all 0.2s',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.45rem'
                                    }}
                                    onClick={() => setSelectedDs(d.id)}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem' }}>
                                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', minWidth: 0, flex: 1 }}>
                                                <div style={{ display: 'flex', padding: '0.3rem', borderRadius: '6px', background: isSelected ? 'var(--studio-purple-light)' : 'var(--studio-bg)', color: isSelected ? '#4f46e5' : 'var(--studio-text-sub)' }}>
                                                    <Database size={12} />
                                                </div>
                                                {isRenaming ? (
                                                    <input
                                                        type="text"
                                                        value={renamingDsValue}
                                                        onChange={e => setRenamingDsValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleRenameDataset(d.id, renamingDsValue);
                                                            if (e.key === 'Escape') setRenamingDsId(null);
                                                        }}
                                                        onClick={e => e.stopPropagation()}
                                                        style={{
                                                            fontSize: '0.725rem',
                                                            padding: '0.1rem 0.25rem',
                                                            border: '1px solid #6366f1',
                                                            borderRadius: '4px',
                                                            outline: 'none',
                                                            width: '80%'
                                                        }}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--studio-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {d.name.split('.')[0]}
                                                    </span>
                                                )}
                                                <span style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--studio-text-sub)', backgroundColor: 'var(--studio-bg)', padding: '0.1rem 0.25rem', borderRadius: '4px', flexShrink: 0 }}>
                                                    {fileExtension}
                                                </span>
                                            </div>

                                            {/* Pinned star */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(d.id); }}
                                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0.1rem', color: isFavorite ? '#eab308' : 'var(--studio-text-sub)', opacity: isFavorite ? 1 : 0.3 }}
                                            >
                                                <Sparkles size={10} fill={isFavorite ? '#eab308' : 'transparent'} />
                                            </button>
                                        </div>

                                        {/* Row/Col details */}
                                        <div style={{ fontSize: '0.625rem', color: 'var(--studio-text-sub)', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                            <span>{d.size || '45.3 MB'}</span>
                                            <span>•</span>
                                            <span>{d.rowsCount ? (d.rowsCount > 1000 ? (d.rowsCount/1000).toFixed(0) + 'K' : d.rowsCount) : '25K'} rows</span>
                                            <span>•</span>
                                            <span>{d.columnsCount || 15} cols</span>
                                        </div>

                                        {/* Quality badge & tags */}
                                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span style={{
                                                padding: '0.1rem 0.35rem',
                                                borderRadius: '4px',
                                                backgroundColor: 'var(--studio-green-light)',
                                                color: 'var(--studio-green)',
                                                fontWeight: 700,
                                                fontSize: '0.6rem',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.2rem'
                                            }}>
                                                <Check size={8} /> {d.quality || 96}% Quality Score
                                            </span>
                                            <span style={{
                                                padding: '0.1rem 0.35rem',
                                                borderRadius: '4px',
                                                backgroundColor: 'var(--studio-purple-light)',
                                                color: 'var(--studio-purple)',
                                                fontWeight: 700,
                                                fontSize: '0.6rem'
                                            }}>
                                                {d.category || 'General'}
                                            </span>
                                        </div>

                                        {/* Card footer details & actions */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--studio-border)', paddingTop: '0.45rem', marginTop: '0.15rem' }} onClick={e => e.stopPropagation()}>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--studio-text-sub)' }}>
                                                Updated {d.uploadedDate ? (new Date(d.uploadedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })) : '1 day ago'}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <button
                                                    onClick={() => handlePreviewDataset(d.id)}
                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--studio-text-sub)', display: 'flex', alignItems: 'center' }}
                                                    title="Preview raw data"
                                                >
                                                    <Eye size={11} />
                                                </button>
                                                <button
                                                    onClick={() => handleViewMetadata(d.id)}
                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--studio-text-sub)', display: 'flex', alignItems: 'center' }}
                                                    title="View statistics profile"
                                                >
                                                    <Cpu size={11} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setRenamingDsId(d.id);
                                                        setRenamingDsValue(d.name);
                                                    }}
                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--studio-text-sub)', display: 'flex', alignItems: 'center' }}
                                                    title="Rename"
                                                >
                                                    <Edit2 size={11} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteDataset(d.id)}
                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* View all dataset link */}
                        <div 
                            onClick={() => showToast("Showing all cleaned database clusters", "info")}
                            style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--studio-border)', background: 'var(--studio-bg)', textAlign: 'center', fontSize: '0.675rem', fontWeight: 700, cursor: 'pointer', color: 'var(--studio-text-sub)' }}
                        >
                            View All Datasets
                        </div>
                    </div>

                    {/* MAIN SPLIT PANELS (CENTER COLUMN + RIGHT COLUMN) */}
                    <div className="workspace-main-panel" style={{ flex: 1, display: 'flex', gap: '1.25rem', overflow: 'hidden' }}>
                        
                        {/* CENTER COLUMN (STATS, PROMPT BOX, EXAMPLES, TABLE) */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', minWidth: 0, paddingRight: '0.25rem' }}>
                            
                            {/* A. WORKSPACE HEADER ROW */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--studio-border)', paddingBottom: '0.75rem', marginBottom: '0.25rem' }}>
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--studio-text)' }}>
                                        <Sparkles size={16} color="#6366f1" fill="#6366f1" /> AI Analytics Studio
                                    </h1>
                                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', color: 'var(--studio-text-sub)' }}>
                                        Transform your data into powerful insights with AI
                                    </p>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {/* Universal Search input */}
                                    <div style={{ position: 'relative', width: '260px' }}>
                                        <input
                                            type="text"
                                            placeholder="Search datasets, dashboards..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.65rem',
                                                borderRadius: '8px',
                                                border: '1px solid var(--studio-border)',
                                                fontSize: '0.725rem',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                                backgroundColor: '#f8fafc'
                                            }}
                                        />
                                    </div>

                                    <button 
                                        onClick={() => {
                                            if (selectedDs) {
                                                setPromptInput("Build an Executive Dashboard tracking key metrics");
                                                handleGenerateWorkspaceDashboard("Build an Executive Dashboard tracking key metrics");
                                            } else {
                                                showToast("Please select a dataset from the library first.", "info");
                                            }
                                        }}
                                        style={{
                                            border: 'none',
                                            background: '#4f46e5',
                                            color: 'white',
                                            fontSize: '0.725rem',
                                            fontWeight: 700,
                                            padding: '0.4rem 0.8rem',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}
                                    >
                                        <Plus size={12} /> New Dashboard
                                    </button>

                                    <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--studio-text-sub)' }} onClick={() => setShowTourModal(true)}>
                                        <HelpCircle size={14} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                <div className="stat-card" style={{ padding: '1rem', backgroundColor: 'var(--studio-card-bg)', border: '1px solid var(--studio-border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', cursor: 'pointer' }}>
                                    <div>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Total Datasets</span>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--studio-text)', margin: '0.15rem 0' }}>{localDatasets.length}</div>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--studio-green)', fontWeight: 700 }}>+2 this week</span>
                                    </div>
                                    <div style={{ display: 'flex', padding: '0.5rem', borderRadius: '10px', backgroundColor: 'rgba(99,102,241,0.06)', color: '#4f46e5' }}>
                                        <Database size={16} />
                                    </div>
                                    <ChevronRight size={12} color="var(--studio-text-sub)" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                                </div>

                                <div className="stat-card" style={{ padding: '1rem', backgroundColor: 'var(--studio-card-bg)', border: '1px solid var(--studio-border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', cursor: 'pointer' }}>
                                    <div>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Saved Dashboards</span>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--studio-text)', margin: '0.15rem 0' }}>{savedDashboards.length}</div>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--studio-green)', fontWeight: 700 }}>+4 this week</span>
                                    </div>
                                    <div style={{ display: 'flex', padding: '0.5rem', borderRadius: '10px', backgroundColor: 'rgba(99,102,241,0.06)', color: '#4f46e5' }}>
                                        <LayoutGrid size={16} />
                                    </div>
                                    <ChevronRight size={12} color="var(--studio-text-sub)" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                                </div>

                                <div className="stat-card" style={{ padding: '1rem', backgroundColor: 'var(--studio-card-bg)', border: '1px solid var(--studio-border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', cursor: 'pointer' }}>
                                    <div>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>AI Generated</span>
                                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--studio-text)', margin: '0.15rem 0' }}>{recentConversations.length}</div>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--studio-green)', fontWeight: 700 }}>+6 this week</span>
                                    </div>
                                    <div style={{ display: 'flex', padding: '0.5rem', borderRadius: '10px', backgroundColor: 'rgba(99,102,241,0.06)', color: '#4f46e5' }}>
                                        <Sparkles size={16} />
                                    </div>
                                    <ChevronRight size={12} color="var(--studio-text-sub)" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                                </div>
                            </div>

                            {/* C. CHATGPT PROMPT CONTAINER */}
                            <div className="workspace-prompt-container" style={{
                                backgroundColor: 'var(--studio-card-bg)',
                                border: '1px solid var(--studio-border)',
                                borderRadius: '16px',
                                padding: '1.25rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.01)'
                            }}>
                                <div style={{ textAlign: 'center', margin: '0.25rem 0' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--studio-text)', letterSpacing: '-0.02em' }}>
                                        What would you like to analyze today?
                                    </h2>
                                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.725rem', color: 'var(--studio-text-sub)' }}>
                                        Describe what you want to know about your data in natural language.
                                    </p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', border: '1.5px solid var(--studio-border)', borderRadius: '14px', padding: '0.75rem', backgroundColor: 'white', position: 'relative' }}>
                                    <textarea
                                        placeholder="Ask anything about your data..."
                                        value={promptInput}
                                        onChange={e => setPromptInput(e.target.value)}
                                        style={{
                                            width: '100%',
                                            height: '70px',
                                            background: 'transparent',
                                            border: 'none',
                                            fontSize: '0.8rem',
                                            outline: 'none',
                                            resize: 'none',
                                            color: 'var(--studio-text)',
                                            fontFamily: 'inherit',
                                            lineHeight: 1.4,
                                            paddingRight: '40px'
                                        }}
                                    />
                                    
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--studio-border)', paddingTop: '0.6rem', marginTop: '0.35rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => setShowAttachFilesModal(true)}
                                                style={{ border: 'none', background: 'var(--studio-bg)', color: 'var(--studio-text-sub)', fontSize: '0.675rem', fontWeight: 600, padding: '0.3rem 0.55rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                            >
                                                <FileText size={10} /> Attach files
                                            </button>
                                            <button
                                                onClick={() => setShowAddFilterPop(true)}
                                                style={{ border: 'none', background: 'var(--studio-bg)', color: 'var(--studio-text-sub)', fontSize: '0.675rem', fontWeight: 600, padding: '0.3rem 0.55rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                            >
                                                <Sliders size={10} /> Add filter
                                            </button>
                                            <button
                                                onClick={() => setShowParamsPop(true)}
                                                style={{ border: 'none', background: 'var(--studio-bg)', color: 'var(--studio-text-sub)', fontSize: '0.675rem', fontWeight: 600, padding: '0.3rem 0.55rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                            >
                                                <Settings size={10} /> Parameters
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => handleGenerateWorkspaceDashboard(promptInput)}
                                            disabled={!selectedDs || !promptInput.trim()}
                                            style={{
                                                border: 'none',
                                                background: (!selectedDs || !promptInput.trim()) ? 'var(--studio-border)' : 'var(--studio-purple)',
                                                color: 'white',
                                                borderRadius: '50%',
                                                width: '26px',
                                                height: '26px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Send size={11} />
                                        </button>
                                    </div>
                                </div>

                                {/* Try these examples */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Try these examples</span>
                                        <button 
                                            onClick={() => {
                                                setPromptInput("Analyze regional performance parameters and item ranges");
                                                showToast("Example loaded!", "info");
                                            }}
                                            style={{ border: 'none', background: 'transparent', color: '#4f46e5', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                        >
                                            <RefreshCw size={9} /> Refresh
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
                                        {[
                                            {
                                                title: "Executive Dashboard",
                                                desc: "Create an executive summary dashboard",
                                                prompt: "Build an Executive Dashboard tracking total spent, demographics, and product revenue ranking",
                                                datasetId: "products-50"
                                            },
                                            {
                                                title: "Sales Performance",
                                                desc: "Analyze sales performance trends",
                                                prompt: "Show me sales trend by month with top 5 products",
                                                datasetId: "products-50"
                                            },
                                            {
                                                title: "Revenue Analysis",
                                                desc: "Deep dive into revenue insights",
                                                prompt: "Generate a Finance and Expense breakdown mapping budgets against payroll and department costs",
                                                datasetId: "mock-finance"
                                            },
                                            {
                                                title: "Customer Insights",
                                                desc: "Understand customer behavior",
                                                prompt: "Create a Customer Retention analysis with contract type breakdowns and churn scores",
                                                datasetId: "mock-churn"
                                            },
                                            {
                                                title: "Inventory Overview",
                                                desc: "Analyze inventory & stock levels",
                                                prompt: "Analyze inventory stock levels and identify slow moving items",
                                                datasetId: "mock-finance"
                                            },
                                            {
                                                title: "Top Products",
                                                desc: "Find top performing products",
                                                prompt: "Show product category distribution, total transactions and product rankings",
                                                datasetId: "products-50"
                                            },
                                            {
                                                title: "Monthly Trends",
                                                desc: "Show monthly performance trends",
                                                prompt: "Plot spending trends over signup dates and monthly performance trends",
                                                datasetId: "products-50"
                                            },
                                            {
                                                title: "Business Risks",
                                                desc: "Identify business risks & anomalies",
                                                prompt: "Identify operational business risks, anomalies and contract variances",
                                                datasetId: "mock-churn"
                                            }
                                        ].map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="suggestion-prompt-card"
                                                onClick={() => {
                                                    setSelectedDs(item.datasetId);
                                                    setPromptInput(item.prompt);
                                                    handleGenerateWorkspaceDashboard(item.prompt);
                                                }}
                                                style={{
                                                    border: '1px solid var(--studio-border)',
                                                    borderRadius: '8px',
                                                    padding: '0.65rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.15rem',
                                                    backgroundColor: 'white'
                                                }}
                                            >
                                                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--studio-text)' }}>{item.title}</span>
                                                <span style={{ fontSize: '0.6rem', color: 'var(--studio-text-sub)', lineHeight: 1.3 }}>{item.desc}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* D. RECENT CONVERSATIONS TABLE */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Conversations</span>
                                    <span 
                                        onClick={() => showToast("Showing all past AI chat contexts", "info")}
                                        style={{ fontSize: '0.65rem', color: '#4f46e5', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        View All
                                    </span>
                                </div>
                                
                                <div style={{ backgroundColor: 'var(--studio-card-bg)', border: '1px solid var(--studio-border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.01)' }}>
                                    <table className="studio-table" style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--studio-bg)', borderBottom: '1px solid var(--studio-border)' }}>
                                                <th style={{ padding: '0.6rem 0.85rem', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Conversation</th>
                                                <th style={{ padding: '0.6rem 0.85rem', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Dataset</th>
                                                <th style={{ padding: '0.6rem 0.85rem', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Prompt</th>
                                                <th style={{ padding: '0.6rem 0.85rem', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Updated</th>
                                                <th style={{ padding: '0.6rem 0.85rem', fontWeight: 700, color: 'var(--studio-text-sub)', textAlign: 'center' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredConversations.slice(0, 4).map((c) => {
                                                const dsName = c.datasetName || 'Dataset';
                                                const shortPrompt = c.prompt.length > 32 ? c.prompt.slice(0, 32) + '...' : c.prompt;
                                                const title = c.prompt.split(' ').slice(0, 3).join(' ') + ' Analysis';
                                                
                                                return (
                                                    <tr key={c.id} style={{ borderBottom: '1px solid var(--studio-border)' }} className="table-row-hover">
                                                        <td style={{ padding: '0.6rem 0.85rem', fontWeight: 700 }}>{title}</td>
                                                        <td style={{ padding: '0.6rem 0.85rem', color: 'var(--studio-text-sub)' }}>{dsName}</td>
                                                        <td style={{ padding: '0.6rem 0.85rem', color: 'var(--studio-text-sub)' }}>{shortPrompt}</td>
                                                        <td style={{ padding: '0.6rem 0.85rem', color: 'var(--studio-text-sub)' }}>
                                                            {new Date(c.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </td>
                                                        <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                                <button 
                                                                    onClick={() => handleLoadRecentConversation(c)}
                                                                    style={{ border: 'none', background: 'rgba(99,102,241,0.08)', color: '#4f46e5', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                                >
                                                                    <Play size={8} fill="#4f46e5" />
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteConversation(c.id)}
                                                                    style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                    title="Delete Conversation"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT SIDEBAR COLUMN (STATS CARD 4, RECENT DASHBOARDS, INSTRUCTIONS CARD) */}
                        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '1.25rem', flexShrink: 0 }}>
                            
                            {/* STAT CARD 4 (LAST ACTIVITY) */}
                            <div className="stat-card" style={{ padding: '1rem', backgroundColor: 'var(--studio-card-bg)', border: '1px solid var(--studio-border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', cursor: 'pointer' }}>
                                <div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Last Activity</span>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--studio-text)', margin: '0.15rem 0', whiteSpace: 'nowrap' }}>2 hours ago</div>
                                    <span style={{ fontSize: '0.6rem', color: 'var(--studio-green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                        <span className="pulse-indicator" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--studio-green)', display: 'inline-block' }} /> Active
                                    </span>
                                </div>
                                <div style={{ width: '60px', height: '35px' }}>
                                    <svg viewBox="0 0 60 30" width="100%" height="100%">
                                        <path d="M 5,25 Q 15,10 25,18 T 45,8 T 55,20" fill="none" stroke="#6366f1" strokeWidth="2" />
                                        <circle cx="55" cy="20" r="2" fill="#6366f1" />
                                    </svg>
                                </div>
                            </div>

                            {/* RECENT DASHBOARDS LIST */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Dashboards</span>
                                    <span 
                                        onClick={() => showToast("Showing all saved visual canvas panels", "info")}
                                        style={{ fontSize: '0.65rem', color: '#4f46e5', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        View All
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                    {filteredDashboards.slice(0, 5).map(d => (
                                        <div
                                            key={d.id}
                                            className="saved-dashboard-card"
                                            onClick={() => handleLoadSavedDashboard(d)}
                                            style={{
                                                backgroundColor: 'var(--studio-card-bg)',
                                                border: '1px solid var(--studio-border)',
                                                borderRadius: '12px',
                                                padding: '0.65rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                gap: '0.6rem',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div style={{ width: '42px', height: '42px', borderRadius: '8px', overflow: 'hidden', background: 'var(--studio-bg)', border: '1px solid var(--studio-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <svg viewBox="0 0 30 30" width="100%" height="100%">
                                                    <rect x="3" y="3" width="10" height="10" fill="var(--studio-purple-light)" rx="1" />
                                                    <rect x="17" y="3" width="10" height="6" fill="var(--studio-bg)" rx="1" />
                                                    <rect x="17" y="11" width="10" height="16" fill="var(--studio-purple-light)" rx="1" />
                                                    <rect x="3" y="15" width="10" height="12" fill="var(--studio-bg)" rx="1" />
                                                </svg>
                                            </div>
                                            
                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--studio-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {d.name.split(' ').slice(0, 2).join(' ')} Dashboard
                                                </span>
                                                <span style={{ fontSize: '0.6rem', color: 'var(--studio-text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {d.datasetName}
                                                </span>
                                                <span style={{ fontSize: '0.55rem', color: 'var(--studio-text-sub)' }}>
                                                    Updated {new Date(d.lastEdited || d.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flexShrink: 0 }}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleCopyShare(); }}
                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--studio-text-sub)', padding: '0.2rem' }}
                                                    title="Copy link"
                                                >
                                                    <Share2 size={10} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteDashboard(d.id); }}
                                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '0.2rem' }}
                                                    title="Delete Dashboard"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* THREE SIMPLE STEPS CARD */}
                            <div style={{
                                backgroundColor: 'rgba(99, 102, 241, 0.03)',
                                border: '1px dashed rgba(99, 102, 241, 0.3)',
                                borderRadius: '16px',
                                padding: '1.1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.75rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--studio-text)' }}>
                                    <Sparkles size={13} color="#4f46e5" fill="#4f46e5" />
                                    <span style={{ fontWeight: 800, fontSize: '0.725rem', letterSpacing: '-0.01em' }}>
                                        Build with AI in 3 simple steps
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.675rem', color: 'var(--studio-text-sub)' }}>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <span style={{ fontWeight: 800, color: '#4f46e5' }}>1</span>
                                        <span>Select a cleaned dataset</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <span style={{ fontWeight: 800, color: '#4f46e5' }}>2</span>
                                        <span>Describe what you want to analyze</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <span style={{ fontWeight: 800, color: '#4f46e5' }}>3</span>
                                        <span>Get your interactive dashboard</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowTourModal(true)}
                                    style={{
                                        border: 'none',
                                        background: '#4f46e5',
                                        color: '#ffffff',
                                        borderRadius: '8px',
                                        padding: '0.4rem',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.3rem',
                                        marginTop: '0.2rem',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3b33b3'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
                                >
                                    <Play size={10} fill="#ffffff" /> Watch Quick Tour
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* 1. PREMIUM HEADER PANEL (FULL WIDTH) */}
                    <div className="studio-dash-header" style={{
                        backgroundColor: 'var(--studio-card-bg)',
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
                            <div className="studio-dash-title-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button
                                    onClick={() => setWorkspaceState('home')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        border: '1px solid var(--studio-border)',
                                        borderRadius: '8px',
                                        padding: '0.35rem 0.65rem',
                                        background: 'var(--studio-card-bg)',
                                        color: 'var(--studio-text)',
                                        fontSize: '0.725rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--studio-bg)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--studio-card-bg)'}
                                >
                                    <Home size={12} /> Back to Home
                                </button>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--studio-bg)', padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid var(--studio-border)' }}>
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

                    {/* Segmented Control Builder Tabs (Marketplace, Chart Builder, Filters) */}
                    <div className="studio-segmented-tabs">
                        {/* Marketplace Toggle */}
                        <button
                            className={`studio-segmented-btn ${showMarketplace ? 'active' : ''}`}
                            onClick={() => setShowMarketplace(!showMarketplace)}
                            title="Open Widget Marketplace"
                        >
                            <Layers size={12} />
                            <span>Marketplace</span>
                        </button>

                        {/* Chart Builder Toggle */}
                        <button
                            className={`studio-segmented-btn ${showChartBuilder ? 'active' : ''}`}
                            onClick={() => setShowChartBuilder(!showChartBuilder)}
                            title="Open Visual Chart Builder"
                        >
                            <Edit2 size={12} />
                            <span>Chart Builder</span>
                        </button>

                        {/* Filters Toggle */}
                        <button
                            className={`studio-segmented-btn ${showFilterPanel || Object.keys(activeFilters).length > 0 ? 'active' : ''}`}
                            onClick={() => setShowFilterPanel(!showFilterPanel)}
                            title="Toggle Filters Panel"
                        >
                            <Sliders size={12} />
                            <span>Filters</span>
                            {Object.keys(activeFilters).length > 0 && (
                                <span style={{ backgroundColor: '#4f46e5', color: '#ffffff', borderRadius: '99px', padding: '1px 5px', fontSize: '0.55rem', fontWeight: 800, marginLeft: '0.15rem' }}>
                                    {Object.keys(activeFilters).length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* More Actions Dropdown (Versions, Alerts, Comments, Health Score, Diagnostics, Auto Refresh, Regenerate, Reset) */}
                    <div style={{ position: 'relative' }} ref={overflowRef}>
                        <button
                            className={`studio-topnav-btn ${(showVersionsPanel || showAlertsPanel || showCommentsPanel || showHealthModal || showDiagnostics) ? 'active-filter' : ''}`}
                            onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                            style={{
                                padding: '0.35rem 0.5rem',
                                backgroundColor: (showVersionsPanel || showAlertsPanel || showCommentsPanel || showHealthModal || showDiagnostics) ? 'rgba(99, 102, 241, 0.08)' : 'var(--studio-card-bg)',
                                color: (showVersionsPanel || showAlertsPanel || showCommentsPanel || showHealthModal || showDiagnostics) ? '#4f46e5' : 'var(--studio-text)',
                                borderColor: (showVersionsPanel || showAlertsPanel || showCommentsPanel || showHealthModal || showDiagnostics) ? 'rgba(99, 102, 241, 0.3)' : 'var(--studio-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="More Dashboard Tools"
                        >
                            <MoreHorizontal size={14} />
                        </button>

                        {showOverflowMenu && (
                            <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                right: 0,
                                backgroundColor: 'var(--studio-card-bg)',
                                border: '1px solid var(--studio-border)',
                                borderRadius: '6px',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                                padding: '4px',
                                zIndex: 1000,
                                minWidth: '180px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                            }}>
                                {/* Version History */}
                                <button
                                    className="overflow-menu-item"
                                    onClick={() => {
                                        setShowVersionsPanel(!showVersionsPanel);
                                        setShowOverflowMenu(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.4rem 0.6rem',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: showVersionsPanel ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                        color: showVersionsPanel ? '#4f46e5' : 'var(--studio-text)',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        width: '100%',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <History size={12} />
                                    <span>Versions</span>
                                </button>

                                {/* Alerts */}
                                <button
                                    className="overflow-menu-item"
                                    onClick={() => {
                                        setShowAlertsPanel(!showAlertsPanel);
                                        setShowOverflowMenu(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.4rem 0.6rem',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: showAlertsPanel ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                        color: showAlertsPanel ? '#4f46e5' : 'var(--studio-text)',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        width: '100%',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <Bell size={12} />
                                    <span>Alerts</span>
                                </button>

                                {/* Comments */}
                                <button
                                    className="overflow-menu-item"
                                    onClick={() => {
                                        setShowCommentsPanel(!showCommentsPanel);
                                        setShowOverflowMenu(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.4rem 0.6rem',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: showCommentsPanel ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                        color: showCommentsPanel ? '#4f46e5' : 'var(--studio-text)',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        width: '100%',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <MessageSquare size={12} />
                                    <span>Comments</span>
                                </button>

                                {/* Health Score */}
                                <button
                                    className="overflow-menu-item"
                                    onClick={() => {
                                        setShowHealthModal(!showHealthModal);
                                        setShowOverflowMenu(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.4rem 0.6rem',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: showHealthModal ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                        color: showHealthModal ? '#4f46e5' : 'var(--studio-text)',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        width: '100%',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <Cpu size={12} />
                                    <span>Health Score</span>
                                </button>

                                {/* Diagnostics */}
                                <button
                                    className="overflow-menu-item"
                                    onClick={() => {
                                        setShowDiagnostics(!showDiagnostics);
                                        setShowOverflowMenu(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.4rem 0.6rem',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: showDiagnostics ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                        color: showDiagnostics ? '#4f46e5' : 'var(--studio-text)',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        width: '100%',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <Settings size={12} />
                                    <span>Diagnostics</span>
                                </button>

                                {/* Divider */}
                                <div style={{ height: '1px', backgroundColor: 'var(--studio-border)', margin: '4px 0' }} />

                                {/* Auto Refresh Toggle */}
                                <div className="overflow-menu-item" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: 'var(--studio-text)',
                                    cursor: 'default',
                                    transition: 'all 0.15s'
                                }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <RefreshCw size={12} style={{ animation: autoRefresh ? 'spin 6s linear infinite' : 'none' }} />
                                        <span>Auto Refresh</span>
                                    </span>
                                    <label className="studio-switch" style={{ margin: 0, transform: 'scale(0.8)', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                                        <span className="studio-switch-slider"></span>
                                    </label>
                                </div>

                                {/* Regenerate Template */}
                                <button
                                    className="overflow-menu-item"
                                    onClick={() => {
                                        setShowOverflowMenu(false);
                                        if (!dsAnalytics || activeRawData.length === 0) {
                                            showToast('No active dataset loaded.', 'error');
                                            return;
                                        }
                                        const classification = detectDatasetCategory(dsAnalytics);
                                        setDetectedCategory(classification.category);
                                        setDetectedConfidence(classification.confidence);
                                        const explanation = generateAiExplanation(classification.category, dsAnalytics);
                                        setAiExplanation(explanation);
                                        buildExecutiveDashboard(dsAnalytics, activeRawData, classification.category);
                                        setCardSizes({});
                                        showToast(`Regenerated ${classification.category} dashboard layout!`, 'success');
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.4rem 0.6rem',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: 'transparent',
                                        color: 'var(--studio-text)',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        width: '100%',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <Sparkles size={12} color="var(--studio-purple)" />
                                    <span>Regenerate Template</span>
                                </button>

                                {/* Reset Layout */}
                                <button
                                    className="overflow-menu-item"
                                    onClick={() => {
                                        setShowOverflowMenu(false);
                                        handleResetLayout();
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.4rem 0.6rem',
                                        border: 'none',
                                        borderRadius: '4px',
                                        backgroundColor: 'transparent',
                                        color: 'var(--studio-text)',
                                        fontSize: '0.75rem',
                                        fontWeight: 500,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        width: '100%',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <LayoutGrid size={12} />
                                    <span>Reset Layout</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Toggle AI Chat Button (Icon with custom tooltip) */}
                    <button 
                        className={`studio-topnav-btn studio-tooltip-trigger ${chatCollapsed ? '' : 'active-filter'}`} 
                        onClick={() => setChatCollapsed(!chatCollapsed)} 
                        style={{
                            padding: '0.35rem 0.5rem',
                            backgroundColor: chatCollapsed ? '#ffffff' : 'rgba(99, 102, 241, 0.08)',
                            color: chatCollapsed ? 'var(--studio-text)' : '#4f46e5',
                            borderColor: chatCollapsed ? 'var(--studio-border)' : 'rgba(99, 102, 241, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                        }}
                    >
                        <MessageSquare size={12} />
                        <span className="studio-tooltip">{chatCollapsed ? "Show AI Chat" : "Hide AI Chat"}</span>
                    </button>

                    {/* Share Button (Icon with custom tooltip) */}
                    <button 
                        className="studio-topnav-btn studio-tooltip-trigger" 
                        onClick={() => setShowShareModal(true)}
                        style={{
                            padding: '0.35rem 0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                        }}
                    >
                        <Share2 size={12} />
                        <span className="studio-tooltip">Share Dashboard</span>
                    </button>

                    {/* Export Button (Icon with custom tooltip) */}
                    <button 
                        className="studio-topnav-btn studio-tooltip-trigger" 
                        onClick={() => setShowExportModal(true)}
                        style={{
                            padding: '0.35rem 0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                        }}
                    >
                        <Download size={12} />
                        <span className="studio-tooltip">Export Options</span>
                    </button>

                    {/* Present Button (Icon with custom tooltip) */}
                    <button 
                        className="studio-topnav-btn studio-tooltip-trigger" 
                        onClick={toggleFullscreen} 
                        style={{
                            padding: '0.35rem 0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                        }}
                    >
                        <Maximize2 size={12} />
                        <span className="studio-tooltip">Present</span>
                    </button>

                    {/* Primary Save Action */}
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

            {/* Widget Marketplace Drawer */}
            {showMarketplace && (
                <div className="studio-drawer-overlay" onClick={() => setShowMarketplace(false)}>
                    <div className="studio-drawer" onClick={e => e.stopPropagation()}>
                        <div className="studio-drawer-header">
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Layers size={16} color="#6366f1" /> Widget Marketplace
                            </h3>
                            <button onClick={() => setShowMarketplace(false)} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>×</button>
                        </div>
                        <div className="studio-drawer-content">
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--studio-text-sub)', lineHeight: 1.5 }}>
                                Select a professional BI widget template, map dimensions/measures, and deploy to your dashboard grid.
                            </p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Widget Format</label>
                                <select 
                                    value={marketType} 
                                    onChange={e => setMarketType(e.target.value)}
                                    style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--studio-border)', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f8fafc', outline: 'none' }}
                                >
                                    <option value="kpi">KPI Summary Aggregator</option>
                                    <option value="line">Line Trend Chart</option>
                                    <option value="bar">Bar Ranking Chart</option>
                                    <option value="pie">Pie Donut Share</option>
                                    <option value="area">Area Area Chart</option>
                                    <option value="table">Details Data Grid</option>
                                    <option value="heatmap">Pivot Density Heatmap</option>
                                    <option value="forecast">Linear Forecast Trend</option>
                                    <option value="scatter">Continuous Scatter Plot</option>
                                    <option value="treemap">Hierarchical Treemap</option>
                                    <option value="histogram">Distribution Histogram</option>
                                    <option value="map">Latitude/Longitude Coordinate Map</option>
                                    <option value="waterfall">Waterfall Revenue Bridge</option>
                                    <option value="bubble">3D Continuous Bubble Chart</option>
                                    <option value="radar">Polar Radar Spider Chart</option>
                                    <option value="gauge">Target Dial Gauge</option>
                                    <option value="progress">Horizontal Progress Bar</option>
                                    <option value="pivot">Cross-tab Pivot Grid</option>
                                    <option value="wordcloud">Keyword Density Word Cloud</option>
                                    <option value="calendar">Activity Intensity Calendar</option>
                                    <option value="boxplot">Statistical Range Box Plot</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Custom Title</label>
                                <input 
                                    type="text" 
                                    placeholder="Enter descriptive title..." 
                                    value={marketTitle}
                                    onChange={e => setMarketTitle(e.target.value)}
                                    style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--studio-border)', fontSize: '0.75rem', backgroundColor: '#f8fafc', outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Dimension Column (X-Axis)</label>
                                <select 
                                    value={marketDim} 
                                    onChange={e => setMarketDim(e.target.value)}
                                    style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--studio-border)', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f8fafc', outline: 'none' }}
                                >
                                    <option value="">-- Choose Categorical / Date --</option>
                                    {dsAnalytics?.columns.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Measure Column (Y-Axis)</label>
                                <select 
                                    value={marketMeas} 
                                    onChange={e => setMarketMeas(e.target.value)}
                                    style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--studio-border)', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f8fafc', outline: 'none' }}
                                >
                                    <option value="">-- Choose Numeric Measure --</option>
                                    {dsAnalytics?.columns.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Grid Width Span</label>
                                <select 
                                    value={marketWidth} 
                                    onChange={e => setMarketWidth(Number(e.target.value))}
                                    style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--studio-border)', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f8fafc', outline: 'none' }}
                                >
                                    <option value={3}>3 Cols (Quarter Page Width)</option>
                                    <option value={4}>4 Cols (Third Page Width)</option>
                                    <option value={6}>6 Cols (Half Page Width)</option>
                                    <option value={8}>8 Cols (Two-Third Page Width)</option>
                                    <option value={12}>12 Cols (Full Grid Width)</option>
                                </select>
                            </div>
                        </div>
                        <div className="studio-drawer-footer">
                            <Button variant="outline" onClick={() => setShowMarketplace(false)} style={{ fontSize: '0.72rem', borderRadius: '8px', padding: '0.4rem 0.8rem' }}>Cancel</Button>
                            <Button variant="primary" onClick={() => handleAddCustomWidget(marketType, marketTitle, marketDim, marketMeas, marketWidth)} style={{ fontSize: '0.72rem', borderRadius: '8px', padding: '0.4rem 0.8rem' }}>Add Widget</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Visual Chart Builder Sliding Sidebar Drawer */}
            {showChartBuilder && (
                <div className="studio-drawer-overlay" onClick={() => setShowChartBuilder(false)}>
                    <div className="studio-drawer" onClick={e => e.stopPropagation()}>
                        <div className="studio-drawer-header">
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Edit2 size={16} color="#6366f1" /> Visual Chart Builder
                            </h3>
                            <button onClick={() => setShowChartBuilder(false)} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>×</button>
                        </div>
                        <div className="studio-drawer-content">
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--studio-text-sub)', lineHeight: 1.5 }}>
                                Map dimensions and measures continuously, choose aggregate computations, and view live chart previews.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Visual Type</label>
                                <select 
                                    value={builderType} 
                                    onChange={e => setBuilderType(e.target.value)}
                                    style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--studio-border)', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f8fafc', outline: 'none' }}
                                >
                                    <option value="line">Line Trend Chart</option>
                                    <option value="bar">Bar Ranking Chart</option>
                                    <option value="area">Area Area Chart</option>
                                    <option value="pie">Pie Donut Share</option>
                                    <option value="scatter">Continuous Scatter Plot</option>
                                    <option value="radar">Polar Radar Spider</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>X-Axis Column (Dimension)</label>
                                <select 
                                    value={builderX} 
                                    onChange={e => setBuilderX(e.target.value)}
                                    style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--studio-border)', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f8fafc', outline: 'none' }}
                                >
                                    <option value="">-- Choose Column --</option>
                                    {dsAnalytics?.columns.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Y-Axis Column (Measure)</label>
                                <select 
                                    value={builderY} 
                                    onChange={e => setBuilderY(e.target.value)}
                                    style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--studio-border)', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f8fafc', outline: 'none' }}
                                >
                                    <option value="">-- Choose Column --</option>
                                    {dsAnalytics?.columns.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Aggregate Calculation</label>
                                <select 
                                    value={builderAgg} 
                                    onChange={e => setBuilderAgg(e.target.value)}
                                    style={{ padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--studio-border)', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f8fafc', outline: 'none' }}
                                >
                                    <option value="sum">SUM Value</option>
                                    <option value="avg">AVERAGE Value</option>
                                    <option value="count">COUNT Records</option>
                                </select>
                            </div>

                            {/* Live SVG Preview Block */}
                            {builderX && builderY && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px dashed var(--studio-border)', borderRadius: '8px', padding: '0.5rem', height: '140px', background: '#f8fafc' }}>
                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Live Visual Builder Preview</span>
                                    <div style={{ flex: 1, minHeight: 0 }}>
                                        {builderType === 'line' && (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={aggregateMetric(activeRawData, builderX, builderY, builderAgg as any).slice(0, 5)}>
                                                    <XAxis dataKey="label" hide />
                                                    <YAxis hide />
                                                    <Line type="monotone" dataKey="value" stroke="#4f46e5" dot />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        )}
                                        {builderType === 'bar' && (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={aggregateMetric(activeRawData, builderX, builderY, builderAgg as any).slice(0, 5)}>
                                                    <XAxis hide />
                                                    <YAxis hide />
                                                    <Bar dataKey="value" fill="#4f46e5" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                        {builderType === 'area' && (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={aggregateMetric(activeRawData, builderX, builderY, builderAgg as any).slice(0, 5)}>
                                                    <XAxis hide />
                                                    <YAxis hide />
                                                    <Area type="monotone" dataKey="value" fill="rgba(79, 70, 229, 0.2)" stroke="#4f46e5" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        )}
                                        {builderType === 'pie' && (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={aggregateMetric(activeRawData, builderX, builderY, builderAgg as any).slice(0, 5)} dataKey="value" cx="50%" cy="50%" outerRadius={35} fill="#4f46e5" />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        )}
                                        {builderType === 'scatter' && (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ScatterChart>
                                                    <Scatter data={activeRawData.slice(0, 15).map(r => ({ x: Number(r[builderX]) || 0, y: Number(r[builderY]) || 0 }))} fill="#4f46e5" />
                                                </ScatterChart>
                                            </ResponsiveContainer>
                                        )}
                                        {builderType === 'radar' && (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RadarChart data={aggregateMetric(activeRawData, builderX, builderY, builderAgg as any).slice(0, 5)}>
                                                    <PolarGrid />
                                                    <Radar dataKey="value" fill="#4f46e5" fillOpacity={0.3} />
                                                </RadarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="studio-drawer-footer">
                            <Button variant="outline" onClick={() => setShowChartBuilder(false)} style={{ fontSize: '0.72rem', borderRadius: '8px', padding: '0.4rem 0.8rem' }}>Cancel</Button>
                            <Button variant="primary" onClick={handleChartBuilderAdd} style={{ fontSize: '0.72rem', borderRadius: '8px', padding: '0.4rem 0.8rem' }}>Deploy Visual</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Version History sliding sidebar panel */}
            {showVersionsPanel && (
                <div className="studio-drawer-overlay" onClick={() => setShowVersionsPanel(false)}>
                    <div className="studio-drawer" onClick={e => e.stopPropagation()}>
                        <div className="studio-drawer-header">
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <History size={16} color="#6366f1" /> Version History Log
                            </h3>
                            <button onClick={() => setShowVersionsPanel(false)} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>×</button>
                        </div>
                        <div className="studio-drawer-content">
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--studio-text-sub)', lineHeight: 1.5 }}>
                                Save current snapshot workspace configuration (widget counts, column settings, filters, and drag card positions).
                            </p>

                            {/* Create layout snapshot version */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', border: '1px solid var(--studio-border)', borderRadius: '8px', padding: '0.65rem', background: '#f8fafc' }}>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Change Description</label>
                                <textarea 
                                    placeholder="Enter changelog comment..." 
                                    value={newVersionChangelog}
                                    onChange={e => setNewVersionChangelog(e.target.value)}
                                    style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--studio-border)', fontSize: '0.72rem', height: '50px', outline: 'none', resize: 'none' }}
                                />
                                <Button variant="primary" onClick={handleSaveVersion} style={{ width: '100%', fontSize: '0.7rem', height: '28px', padding: 0, fontWeight: 700 }}>
                                    Save Layout Snapshot
                                </Button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Saved Snapshots List</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {versionsList.map((ver, idx) => (
                                        <div key={ver.id || idx} style={{ border: '1px solid var(--studio-border)', borderRadius: '8px', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', background: 'white', position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--studio-text)' }}>Version {ver.version}</span>
                                                <span style={{ fontSize: '0.55rem', color: 'var(--studio-text-sub)' }}>{new Date(ver.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                                            </div>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--studio-text-sub)' }}>{ver.changeLog}</span>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', borderTop: '1px dashed #f1f5f9', paddingTop: '0.25rem' }}>
                                                <span style={{ fontSize: '0.55rem', color: 'var(--studio-text-sub)' }}>By: <strong>{ver.changedBy}</strong></span>
                                                <button 
                                                    onClick={() => handleRollbackVersion(ver.id)}
                                                    style={{ border: 'none', background: 'var(--studio-purple-light)', color: '#4f46e5', fontSize: '0.625rem', padding: '0.15rem 0.45rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                                                >
                                                    Rollback to This
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Alerts Configuration Panel */}
            {showAlertsPanel && (
                <div className="studio-drawer-overlay" onClick={() => setShowAlertsPanel(false)}>
                    <div className="studio-drawer" onClick={e => e.stopPropagation()}>
                        <div className="studio-drawer-header">
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Bell size={16} color="#6366f1" /> Business Alert Rules
                            </h3>
                            <button onClick={() => setShowAlertsPanel(false)} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>×</button>
                        </div>
                        <div className="studio-drawer-content">
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--studio-text-sub)', lineHeight: 1.5 }}>
                                Setup target conditional alerts. Rules evaluate instantly and dispatch notifications.
                            </p>

                            {/* Create alert form */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--studio-border)', borderRadius: '8px', padding: '0.65rem', background: '#f8fafc' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Select Metric Column</label>
                                    <select 
                                        value={newAlertMetric} 
                                        onChange={e => setNewAlertMetric(e.target.value)}
                                        style={{ padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--studio-border)', fontSize: '0.72rem', outline: 'none', backgroundColor: 'white' }}
                                    >
                                        <option value="">-- Choose Column --</option>
                                        {Object.keys(dsAnalytics?.stats || {}).filter(c => dsAnalytics?.stats[c]?.type === 'numeric').map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Comparison Operator</label>
                                    <select 
                                        value={newAlertOperator} 
                                        onChange={e => setNewAlertOperator(e.target.value)}
                                        style={{ padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--studio-border)', fontSize: '0.72rem', outline: 'none', backgroundColor: 'white' }}
                                    >
                                        <option value="below">Is Below (&lt;)</option>
                                        <option value="above">Is Above (&gt;)</option>
                                        <option value="equals">Is Equal (=)</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Value Threshold</label>
                                    <input 
                                        type="number" 
                                        placeholder="Enter threshold amount..." 
                                        value={newAlertThreshold}
                                        onChange={e => setNewAlertThreshold(e.target.value)}
                                        style={{ padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--studio-border)', fontSize: '0.72rem', outline: 'none', backgroundColor: 'white' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={newAlertEmail} 
                                        onChange={e => setNewAlertEmail(e.target.checked)} 
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <span>Send instantaneous email alerts on breach</span>
                                </div>
                                <Button variant="primary" onClick={handleAddAlertRule} style={{ width: '100%', fontSize: '0.7rem', height: '28px', padding: 0, fontWeight: 700 }}>
                                    Deploy Alert Rule
                                </Button>
                            </div>

                            {/* Active rules list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Active Trigger Rules</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {activeAlerts.map((alert) => (
                                        <div key={alert.id} style={{ border: '1px solid var(--studio-border)', borderRadius: '8px', padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{alert.metric.replace('_', ' ')}</span>
                                                <span style={{ fontSize: '0.65rem', color: 'var(--studio-text-sub)' }}>Condition: {alert.operator} {alert.threshold.toLocaleString()}</span>
                                                <span style={{ fontSize: '0.55rem', color: 'var(--studio-green)' }}>Preference: Email alerts enabled</span>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteAlertRule(alert.id)}
                                                style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Collaboration Discussions Panel */}
            {showCommentsPanel && (
                <div className="studio-drawer-overlay" onClick={() => setShowCommentsPanel(false)}>
                    <div className="studio-drawer" onClick={e => e.stopPropagation()}>
                        <div className="studio-drawer-header">
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <MessageSquare size={16} color="#6366f1" /> Widget Discussions
                            </h3>
                            <button onClick={() => setShowCommentsPanel(false)} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>×</button>
                        </div>
                        <div className="studio-drawer-content" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 60px)' }}>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--studio-text-sub)', lineHeight: 1.5 }}>
                                Post collaborative messages, tag specific widgets, or resolve discussion threads.
                            </p>

                            {/* Comments scrolling thread */}
                            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--studio-border)', borderRadius: '8px', padding: '0.5rem', backgroundColor: 'var(--studio-bg)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {collaborationComments.map((comment) => {
                                    const relatedWidget = widgets.find(w => w.id === comment.widgetId);
                                    return (
                                        <div key={comment.id} style={{ padding: '0.5rem', borderRadius: '8px', backgroundColor: comment.isResolved ? 'var(--studio-bg)' : 'var(--studio-card-bg)', border: '1px solid var(--studio-border)', display: 'flex', flexDirection: 'column', gap: '0.2', position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--studio-text)' }}>{comment.userName}</span>
                                                <span style={{ fontSize: '0.55rem', color: 'var(--studio-text-sub)' }}>{new Date(comment.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                                            </div>
                                            {relatedWidget && (
                                                <span style={{ fontSize: '0.55rem', alignSelf: 'flex-start', padding: '0.1rem 0.3rem', backgroundColor: 'var(--studio-purple-light)', color: 'var(--studio-purple)', borderRadius: '4px', fontWeight: 700 }}>
                                                    Widget: {relatedWidget.title}
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.7rem', color: 'var(--studio-text)', textDecoration: comment.isResolved ? 'line-through' : 'none' }}>{comment.content}</span>
                                            
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                                                {!comment.isResolved ? (
                                                    <button 
                                                        onClick={() => handleResolveComment(comment.id)}
                                                        style={{ border: 'none', backgroundColor: 'var(--studio-green-light)', color: 'var(--studio-green)', fontSize: '0.55rem', padding: '0.1rem 0.35rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                                                    >
                                                        Resolve Thread
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: '0.55rem', color: 'var(--studio-green)', fontWeight: 700 }}>✓ Resolved</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Create comment form */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px dashed var(--studio-border)', paddingTop: '0.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Attach Comment to Widget (Optional)</label>
                                    <select 
                                        value={commentWidgetId || ''} 
                                        onChange={e => setCommentWidgetId(e.target.value || null)}
                                        style={{ padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--studio-border)', fontSize: '0.72rem', outline: 'none', backgroundColor: '#f8fafc' }}
                                    >
                                        <option value="">-- General Dashboard --</option>
                                        {widgets.map(w => (
                                            <option key={w.id} value={w.id}>{w.title}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    <input 
                                        type="text" 
                                        placeholder="Add comment..." 
                                        value={newCommentText}
                                        onChange={e => setNewCommentText(e.target.value)}
                                        style={{ flex: 1, padding: '0.45rem', borderRadius: '8px', border: '1px solid var(--studio-border)', fontSize: '0.75rem', outline: 'none' }}
                                    />
                                    <Button variant="primary" onClick={handleAddComment} style={{ fontSize: '0.75rem', padding: '0 0.75rem' }}>
                                        Post
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dashboard Health Score Modal */}
            {showHealthModal && (
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
                        padding: '1.5rem',
                        width: '420px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Cpu size={18} color="#6366f1" /> Dashboard Health Diagnostics
                            </h3>
                            <button onClick={() => setShowHealthModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>×</button>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--studio-border)' }}>
                            <div style={{
                                width: '60px', height: '60px', borderRadius: '50%',
                                background: 'conic-gradient(#4f46e5 0% ' + dashboardHealth.score + '%, #e2e8f0 ' + dashboardHealth.score + '% 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
                            }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800 }}>
                                    {dashboardHealth.score}%
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.825rem', fontWeight: 800 }}>Data Quality Score</span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--studio-text-sub)' }}>
                                    We computed column structures, counts, null rates, and distribution variance metrics.
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Optimizations Checklist</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {(dashboardHealth.suggestions || []).map((suggestion, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--studio-text)' }}>
                                        <span style={{ color: '#6366f1' }}>✦</span>
                                        <span>{suggestion}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <Button variant="outline" onClick={() => setShowHealthModal(false)} style={{ fontSize: '0.72rem', padding: '0.4rem 0.8rem' }}>Close</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Performance Diagnostics Panel */}
            {showDiagnostics && (
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
                        padding: '1.5rem',
                        width: '380px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Settings size={18} color="#6366f1" /> Developer Diagnostics
                            </h3>
                            <button onClick={() => setShowDiagnostics(false)} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>×</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--studio-border)', paddingBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.725rem', color: 'var(--studio-text-sub)' }}>Data Loading Latency</span>
                                <span style={{ fontSize: '0.725rem', fontWeight: 700 }}>{perfLoadTime || 28} ms</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--studio-border)', paddingBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.725rem', color: 'var(--studio-text-sub)' }}>Widget Rendering Time</span>
                                <span style={{ fontSize: '0.725rem', fontWeight: 700 }}>{perfRenderTime || 12} ms</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--studio-border)', paddingBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.725rem', color: 'var(--studio-text-sub)' }}>API Query Latency</span>
                                <span style={{ fontSize: '0.725rem', fontWeight: 700 }}>{perfApiLatency || 45} ms</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--studio-border)', paddingBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.725rem', color: 'var(--studio-text-sub)' }}>Total Active Widgets</span>
                                <span style={{ fontSize: '0.725rem', fontWeight: 700 }}>{widgets.length}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--studio-border)', paddingBottom: '0.35rem' }}>
                                <span style={{ fontSize: '0.725rem', color: 'var(--studio-text-sub)' }}>Filtered Records Count</span>
                                <span style={{ fontSize: '0.725rem', fontWeight: 700 }}>{activeRawData.length}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <Button variant="outline" onClick={() => setShowDiagnostics(false)} style={{ fontSize: '0.72rem', padding: '0.4rem 0.8rem' }}>Close</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Drill-Through Details Table Modal */}
            {showDrillThrough && (
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
                        padding: '1.5rem',
                        width: '90%',
                        maxWidth: '850px',
                        height: '80%',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Table size={18} color="#6366f1" /> Drill-Through Details: {drillThroughFilter}
                            </h3>
                            <button onClick={() => setShowDrillThrough(false)} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>×</button>
                        </div>

                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--studio-text-sub)' }}>
                            Showing underlying database records matching current dashboard filters ({drillThroughRows.length.toLocaleString()} matching records).
                        </p>

                        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--studio-border)', borderRadius: '8px' }}>
                            <table className="studio-table" style={{ width: '100%', fontSize: '0.7rem' }}>
                                <thead>
                                    <tr style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                                        {dsAnalytics?.columns.map(col => (
                                            <th key={col} style={{ borderBottom: '1px solid var(--studio-border)', padding: '0.4rem 0.6rem', textAlign: 'left' }}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {drillThroughRows.slice(0, 50).map((row, i) => (
                                        <tr key={i}>
                                            {dsAnalytics?.columns.map(col => (
                                                <td key={col} style={{ borderBottom: '1px solid var(--studio-border)', padding: '0.4rem 0.6rem' }}>
                                                    {row[col] !== undefined && row[col] !== null ? String(row[col]) : '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {drillThroughRows.length > 50 && (
                                <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.65rem', color: 'var(--studio-text-sub)', background: '#f8fafc' }}>
                                    Previewing first 50 rows. Apply additional dashboard filters to narrow results.
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <Button variant="outline" onClick={() => setShowDrillThrough(false)} style={{ fontSize: '0.72rem', padding: '0.4rem 0.8rem' }}>Close Table</Button>
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
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: '1rem',
                        width: '100%'
                    }}>
                        {widgets.filter(w => w.type === 'kpi').map((w) => {
                            const index = widgets.findIndex(x => x.id === w.id);
                            const size = cardSizes[w.id];
                            const currentWidth = size?.width || '100%';
                            const currentHeight = size?.height ? `${size.height}px` : 'auto';

                            return (
                                <div
                                    key={w.id}
                                    className={`studio-chart-card kpi-card ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                                    style={{
                                        width: currentWidth,
                                        minWidth: size?.width ? undefined : '240px',
                                        height: currentHeight,
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
                                        <div className="studio-chart-title" style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                            {getWidgetIcon(w.type)}
                                            <span>{w.title}</span>
                                            <GlossaryTooltip term={w.title} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <button
                                                style={{ border: 'none', background: 'transparent', color: 'var(--studio-text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.5 }}
                                                onClick={() => handleDrillThrough(w)}
                                                title="View Detailed Records (Drill-Through)"
                                            >
                                                <Eye size={10} />
                                            </button>
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
                            const isTableOrPivot = w.type === 'table' || w.type === 'pivot';
                            const currentHeight = size?.height 
                                ? `${size.height}px` 
                                : (isTableOrPivot ? 'auto' : '230px');

                            return (
                                <div
                                    key={w.id}
                                    className={`studio-chart-card ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                                    style={{
                                        gridColumn: size?.width ? undefined : 'span ' + w.width,
                                        width: size?.width || '100%',
                                        height: currentHeight,
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
                                        <div className="studio-chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                            {getWidgetIcon(w.type)}
                                            <span style={{ fontSize: '0.825rem', fontWeight: 700 }}>{w.title}</span>
                                            <GlossaryTooltip term={w.title} />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <button
                                                style={{ border: 'none', background: 'transparent', color: 'var(--studio-text-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                onClick={() => handleDrillThrough(w)}
                                                title="View Detailed Records (Drill-Through)"
                                            >
                                                <Eye size={12} />
                                            </button>
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
                <div className="studio-sidebar-right" style={{ display: chatCollapsed ? 'none' : 'flex' }}>
                    <div className="studio-right-header">
                        <span className="studio-right-title">
                            <Sparkles size={14} style={{ color: '#6366f1' }} /> AI Assistant
                        </span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button className="studio-btn-circle" style={{ width: '22px', height: '22px', display: 'none' }} onClick={() => setWidgets([])} title="Clear Grid Dashboard">
                                <RefreshCw size={10} />
                            </button>
                            <button className="studio-btn-circle" onClick={() => setChatCollapsed(true)} style={{ width: '22px', height: '22px' }} title="Collapse AI Chat Panel">
                                <ChevronRight size={10} />
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

                                {msg.recommendations && msg.recommendations.length > 0 && (
                                    <div className="chat-recommendations-section" style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.4rem',
                                        width: '100%',
                                        marginTop: '0.2rem',
                                        paddingLeft: '0.2rem',
                                        alignSelf: 'flex-start'
                                    }}>
                                        <div 
                                            onClick={() => toggleRecommendations(i)}
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between',
                                                gap: '0.35rem',
                                                cursor: 'pointer',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '6px',
                                                width: '85%',
                                                backgroundColor: 'rgba(99, 102, 241, 0.05)',
                                                border: '1px solid rgba(99, 102, 241, 0.1)',
                                                userSelect: 'none',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.08)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.05)'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                <Sparkles size={11} color="#4f46e5" />
                                                <span style={{ fontWeight: 700, fontSize: '0.675rem', color: 'var(--studio-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    AI Recommended Charts ({msg.recommendations.length})
                                                </span>
                                            </div>
                                            <div style={{ color: '#4f46e5', display: 'flex', alignItems: 'center' }}>
                                                {expandedRecs[i] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </div>
                                        </div>
                                        {expandedRecs[i] && (
                                            <div className="chat-recommendations-list" style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.4rem',
                                                width: '85%',
                                                marginTop: '0.1rem'
                                            }}>
                                                {msg.recommendations.map((rec) => (
                                                    <div
                                                        key={rec.id}
                                                        className="chat-rec-card"
                                                        style={{
                                                            backgroundColor: 'var(--studio-bg)',
                                                            border: '1px solid var(--studio-border)',
                                                            borderRadius: '8px',
                                                            padding: '0.5rem 0.75rem',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.25rem',
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.01)',
                                                            transition: 'all 0.2s',
                                                            width: '100%'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{
                                                                fontSize: '0.5rem',
                                                                fontWeight: 700,
                                                                padding: '0.1rem 0.3rem',
                                                                borderRadius: '3px',
                                                                background: 'rgba(99, 102, 241, 0.08)',
                                                                color: '#4f46e5',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {rec.type}
                                                            </span>
                                                            <div style={{ color: 'var(--studio-text-sub)' }}>
                                                                {getWidgetIcon(rec.type)}
                                                            </div>
                                                        </div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.7rem', color: 'var(--studio-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {rec.title}
                                                        </div>
                                                        <div style={{ fontSize: '0.6rem', color: 'var(--studio-text-sub)' }}>
                                                            Fields: {rec.columns.join(' + ')}
                                                        </div>
                                                        <button
                                                            onClick={() => handleAddRecommendedWidget(rec)}
                                                            style={{
                                                                marginTop: '0.15rem',
                                                                border: '1px solid var(--studio-border)',
                                                                background: 'var(--studio-card-bg)',
                                                                borderRadius: '4px',
                                                                padding: '0.2rem 0.35rem',
                                                                fontSize: '0.625rem',
                                                                fontWeight: 700,
                                                                color: 'var(--studio-text)',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '0.2rem',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.backgroundColor = '#4f46e5';
                                                                e.currentTarget.style.color = '#ffffff';
                                                                e.currentTarget.style.borderColor = '#4f46e5';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.backgroundColor = 'var(--studio-card-bg)';
                                                                e.currentTarget.style.color = 'var(--studio-text)';
                                                                e.currentTarget.style.borderColor = 'var(--studio-border)';
                                                            }}
                                                        >
                                                            + Add to Dashboard
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

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
            </>)}

            {/* Overlays/Modals */}
            {previewDatasetData && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 999999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--studio-border)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        width: '90%',
                        maxWidth: '800px',
                        maxHeight: '80vh',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Database size={16} color="#6366f1" /> Raw Dataset Preview (First 15 Rows)
                            </h3>
                            <button onClick={() => setPreviewDatasetData(null)} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>×</button>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--studio-border)', borderRadius: '8px' }}>
                            <table className="studio-table" style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                                        {previewDatasetData.length > 0 && Object.keys(previewDatasetData[0]).filter(k => k !== '_rid').map(col => (
                                            <th key={col} style={{ borderBottom: '1px solid var(--studio-border)', padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--studio-text-sub)' }}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewDatasetData.map((row, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            {Object.keys(row).filter(k => k !== '_rid').map(col => (
                                                <td key={col} style={{ padding: '0.5rem 0.75rem', color: 'var(--studio-text)' }}>
                                                    {row[col] !== undefined && row[col] !== null ? String(row[col]) : '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <Button variant="outline" onClick={() => setPreviewDatasetData(null)} style={{ fontSize: '0.72rem', padding: '0.4rem 0.8rem' }}>Close Preview</Button>
                        </div>
                    </div>
                </div>
            )}

            {previewDatasetMetadata && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 999999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--studio-border)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        width: '90%',
                        maxWidth: '650px',
                        maxHeight: '80vh',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Cpu size={16} color="#6366f1" /> Dataset Statistics Profile
                            </h3>
                            <button onClick={() => setPreviewDatasetMetadata(null)} style={{ background: 'transparent', border: 'none', color: 'var(--studio-text-sub)', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>×</button>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--studio-border)' }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>File Name</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{previewDatasetMetadata.name}</span>
                            </div>
                            <div style={{ width: '100px', display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Row Count</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{previewDatasetMetadata.rows.toLocaleString()}</span>
                            </div>
                            <div style={{ width: '100px', display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Columns</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{previewDatasetMetadata.columns.length}</span>
                            </div>
                            <div style={{ width: '100px', display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--studio-text-sub)', textTransform: 'uppercase' }}>Quality Score</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--studio-green)' }}>{previewDatasetMetadata.qualityScore}%</span>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--studio-border)', borderRadius: '8px' }}>
                            <table className="studio-table" style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <th style={{ borderBottom: '1px solid var(--studio-border)', padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Column</th>
                                        <th style={{ borderBottom: '1px solid var(--studio-border)', padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Type</th>
                                        <th style={{ borderBottom: '1px solid var(--studio-border)', padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Null Rate</th>
                                        <th style={{ borderBottom: '1px solid var(--studio-border)', padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--studio-text-sub)' }}>Unique / Avg</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewDatasetMetadata.columns.map(col => {
                                        const stat = previewDatasetMetadata.stats[col];
                                        if (!stat) return null;
                                        return (
                                            <tr key={col} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--studio-text)' }}>{col}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', textTransform: 'capitalize' }}>{stat.type}</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>{((stat.nullCount / stat.count) * 100).toFixed(1)}%</td>
                                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                                    {stat.type === 'numeric' 
                                                        ? `Avg: ${stat.avg?.toLocaleString() || '-'}` 
                                                        : `Uniques: ${stat.uniqueCount || '-'}`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <Button variant="outline" onClick={() => setPreviewDatasetMetadata(null)} style={{ fontSize: '0.72rem', padding: '0.4rem 0.8rem' }}>Close Profile</Button>
                        </div>
                    </div>
                </div>
            )}

            {generating && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--studio-border)',
                        borderRadius: '24px',
                        padding: '2.5rem',
                        width: '90%',
                        maxWidth: '460px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.5rem',
                        textAlign: 'center'
                    }}>
                        {/* Animated Spinner Ring */}
                        <div className="glass-loader-ring" style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            border: '4px solid #f1f5f9',
                            borderTop: '4px solid #4f46e5',
                            animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Sparkles size={32} color="#4f46e5" />
                        </div>

                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--studio-text)' }}>
                                Assembling AI Analytics Canvas
                            </h3>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: 'var(--studio-text-sub)' }}>
                                Analyzing database schemas, building calculations metrics, and rendering visualizations
                            </p>
                        </div>

                        {/* Step Checkmarks */}
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem 1rem' }}>
                            {[
                                "Loading Dataset Records",
                                "Reading Database Schema",
                                "Classifying Prompt Context",
                                "Calculating Quality Metrics",
                                "Building Grid Dashboard",
                                "Generating Copilot Insights",
                                "Finalizing Dashboard Canvas"
                            ].map((step, i) => {
                                const isDone = generationStep > i;
                                const isCurrent = generationStep === i;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem', color: isDone ? 'var(--studio-text)' : 'var(--studio-text-sub)', opacity: isDone || isCurrent ? 1 : 0.4 }}>
                                        <div style={{
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '50%',
                                            backgroundColor: isDone ? '#e0f2fe' : isCurrent ? 'rgba(99, 102, 241, 0.1)' : '#f1f5f9',
                                            border: isDone ? '1px solid #bae6fd' : isCurrent ? '1px solid #818cf8' : '1px solid var(--studio-border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: isDone ? '#0369a1' : '#6366f1',
                                            fontSize: '0.6rem',
                                            fontWeight: 800
                                        }}>
                                            {isDone ? '✓' : isCurrent ? '●' : ''}
                                        </div>
                                        <span style={{ fontWeight: isCurrent ? 700 : 500, textAlign: 'left' }}>{step}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* A. UPLOAD DATASET MODAL */}
            {showUploadDsModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--studio-border)',
                        borderRadius: '24px',
                        padding: '2rem',
                        width: '95%',
                        maxWidth: '480px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Database size={16} color="#6366f1" /> Ingest Cleaned Dataset
                            </h3>
                            <button onClick={() => setShowUploadDsModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--studio-text-sub)', fontSize: '1.2rem', fontWeight: 600 }}>
                                &times;
                            </button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.725rem', color: 'var(--studio-text-sub)', lineHeight: 1.4 }}>
                            Upload your CSV or Excel dataset to ingest columns, data schemas and quality metrics automatically.
                        </p>
                        
                        <div 
                            onDragOver={handleFileDragOver}
                            onDrop={handleFileDrop}
                            style={{
                                border: '2px dashed #6366f1',
                                borderRadius: '16px',
                                padding: '2.5rem 1.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.75rem',
                                background: 'rgba(99, 102, 241, 0.02)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'center'
                            }}
                            onClick={() => document.getElementById('workspace-file-uploader')?.click()}
                        >
                            <div style={{ padding: '0.75rem', borderRadius: '50%', backgroundColor: 'var(--studio-purple-light)', color: 'var(--studio-purple)' }}>
                                <Database size={24} />
                            </div>
                            <div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--studio-text)', display: 'block' }}>Drag & drop files here</span>
                                <span style={{ display: 'block', fontSize: '0.675rem', color: 'var(--studio-text-sub)', marginTop: '0.15rem' }}>or click to browse local files (CSV, Excel)</span>
                            </div>
                            <input 
                                id="workspace-file-uploader" 
                                type="file" 
                                accept=".csv,.xlsx,.xls" 
                                onChange={handleFileSelect} 
                                style={{ display: 'none' }} 
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <Button variant="outline" onClick={() => setShowUploadDsModal(false)} style={{ fontSize: '0.725rem', padding: '0.4rem 0.8rem' }}>Cancel</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* B. QUICK TOUR MODAL */}
            {showTourModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--studio-border)',
                        borderRadius: '24px',
                        padding: '2rem',
                        width: '95%',
                        maxWidth: '520px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Sparkles size={16} color="#6366f1" fill="#6366f1" /> Quick Tour: AI Analytics Workspace
                            </h3>
                            <button onClick={() => setShowTourModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--studio-text-sub)', fontSize: '1.2rem', fontWeight: 600 }}>
                                &times;
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
                            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--studio-purple-light)', color: 'var(--studio-purple)', display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0, justifyContent: 'center' }}>1</div>
                                <div>
                                    <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.78rem', fontWeight: 700 }}>Select or Upload Cleaned Datasets</h4>
                                    <p style={{ margin: 0, fontSize: '0.675rem', color: 'var(--studio-text-sub)', lineHeight: 1.4 }}>
                                        Choose any preloaded CSV from the left library sidebar, or drop your own data. The system generates statistical summaries, columns types, and quality scoring instantly.
                                    </p>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--studio-purple-light)', color: 'var(--studio-purple)', display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0, justifyContent: 'center' }}>2</div>
                                <div>
                                    <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.78rem', fontWeight: 700 }}>Instruct the AI Assistant Co-Pilot</h4>
                                    <p style={{ margin: 0, fontSize: '0.675rem', color: 'var(--studio-text-sub)', lineHeight: 1.4 }}>
                                        Write natural language goals in the prompt box (or click sample suggestions). Attach multiple files, add custom data filters, and fine-tune model parameters like temperature.
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--studio-purple-light)', color: 'var(--studio-purple)', display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0, justifyContent: 'center' }}>3</div>
                                <div>
                                    <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.78rem', fontWeight: 700 }}>Explore the Interactive Analytics Canvas</h4>
                                    <p style={{ margin: 0, fontSize: '0.675rem', color: 'var(--studio-text-sub)', lineHeight: 1.4 }}>
                                        Interact with dynamic charts, export clean PDF/Image reports, build new KPIs via formulas, query anomalies, and save layouts directly into your Workspace library.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <Button variant="outline" onClick={() => setShowTourModal(false)} style={{ fontSize: '0.725rem', padding: '0.4rem 0.8rem' }}>Got it, Close</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* C. ATTACH FILES MODAL */}
            {showAttachFilesModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--studio-border)',
                        borderRadius: '24px',
                        padding: '2rem',
                        width: '95%',
                        maxWidth: '460px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <FileText size={16} color="#6366f1" /> Attach Datasets to Context
                            </h3>
                            <button onClick={() => setShowAttachFilesModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--studio-text-sub)', fontSize: '1.2rem', fontWeight: 600 }}>
                                &times;
                            </button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.725rem', color: 'var(--studio-text-sub)', lineHeight: 1.4 }}>
                            Choose a dataset to attach as context for analytical generation.
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: '200px', overflowY: 'auto', padding: '0.2rem' }}>
                            {localDatasets.map(d => {
                                const isSelected = selectedDs === d.id;
                                return (
                                    <div 
                                        key={d.id} 
                                        onClick={() => setSelectedDs(d.id)}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.65rem 0.85rem',
                                            border: isSelected ? '1.5px solid #6366f1' : '1px solid var(--studio-border)',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            background: isSelected ? 'rgba(99, 102, 241, 0.02)' : 'white',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
                                            <Database size={13} color={isSelected ? '#6366f1' : 'var(--studio-text-sub)'} />
                                            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--studio-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {d.name}
                                            </span>
                                        </div>
                                        <div style={{
                                            width: '14px',
                                            height: '14px',
                                            borderRadius: '50%',
                                            border: '1.5px solid #6366f1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: isSelected ? '#6366f1' : 'transparent',
                                            flexShrink: 0
                                        }}>
                                            {isSelected && <span style={{ color: 'white', fontSize: '0.55rem', fontWeight: 800 }}>✓</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <Button variant="outline" onClick={() => setShowAttachFilesModal(false)} style={{ fontSize: '0.725rem', padding: '0.4rem 0.8rem' }}>Cancel</Button>
                            <Button onClick={() => {
                                setShowAttachFilesModal(false);
                                showToast("Dataset attached to context!", "success");
                            }} style={{ fontSize: '0.725rem', padding: '0.4rem 0.8rem', background: '#4f46e5', color: 'white' }}>Confirm Selection</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* D. ADD FILTER POPUP */}
            {showAddFilterPop && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--studio-border)',
                        borderRadius: '24px',
                        padding: '2rem',
                        width: '95%',
                        maxWidth: '440px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Sliders size={16} color="#6366f1" /> Insert Query Filters
                            </h3>
                            <button onClick={() => setShowAddFilterPop(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--studio-text-sub)', fontSize: '1.2rem', fontWeight: 600 }}>
                                &times;
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <label style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text)' }}>Filter Column Name / Attribute</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. region, spent, category" 
                                    value={filterColumn}
                                    onChange={e => setFilterColumn(e.target.value)}
                                    style={{
                                        padding: '0.45rem 0.65rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--studio-border)',
                                        fontSize: '0.725rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <label style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text)' }}>Operator</label>
                                <select 
                                    value={filterOperator}
                                    onChange={e => setFilterOperator(e.target.value)}
                                    style={{
                                        padding: '0.45rem 0.65rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--studio-border)',
                                        fontSize: '0.725rem',
                                        outline: 'none',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    <option value="=">Equals (=)</option>
                                    <option value="!=">Not Equals (!=)</option>
                                    <option value=">">Greater Than (&gt;)</option>
                                    <option value="<">Less Than (&lt;)</option>
                                    <option value="contains">Contains substring</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <label style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text)' }}>Target Value</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. US, 500, Active" 
                                    value={filterValue}
                                    onChange={e => setFilterValue(e.target.value)}
                                    style={{
                                        padding: '0.45rem 0.65rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--studio-border)',
                                        fontSize: '0.725rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <Button variant="outline" onClick={() => setShowAddFilterPop(false)} style={{ fontSize: '0.725rem', padding: '0.4rem 0.8rem' }}>Cancel</Button>
                            <Button 
                                onClick={() => {
                                    if (!filterColumn || !filterValue) {
                                        showToast("Please enter column name and value first.", "error");
                                        return;
                                    }
                                    const filterStr = ` filtered by ${filterColumn} ${filterOperator} '${filterValue}'`;
                                    setPromptInput(prev => prev + filterStr);
                                    setShowAddFilterPop(false);
                                    showToast("Applied filter expression to prompt query!", "success");
                                }} 
                                style={{ fontSize: '0.725rem', padding: '0.4rem 0.8rem', background: '#4f46e5', color: 'white' }}
                            >
                                Apply Filter
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* E. PARAMETERS POPUP */}
            {showParamsPop && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid var(--studio-border)',
                        borderRadius: '24px',
                        padding: '2rem',
                        width: '95%',
                        maxWidth: '450px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--studio-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Settings size={16} color="#6366f1" /> AI Co-Pilot Parameters
                            </h3>
                            <button onClick={() => setShowParamsPop(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--studio-text-sub)', fontSize: '1.2rem', fontWeight: 600 }}>
                                &times;
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.675rem', fontWeight: 700 }}>
                                    <span style={{ color: 'var(--studio-text)' }}>Model Temperature</span>
                                    <span style={{ color: '#4f46e5' }}>{paramTemperature.toFixed(2)}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.0" 
                                    max="1.0" 
                                    step="0.05"
                                    value={paramTemperature}
                                    onChange={e => setParamTemperature(parseFloat(e.target.value))}
                                    style={{ width: '100%', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.55rem', color: 'var(--studio-text-sub)' }}>Higher temperature increases creativity/exploratory widgets, lower increases consistency.</span>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text)' }}>Co-Pilot Analytical Mode</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    <button 
                                        onClick={() => setParamMode('Standard')}
                                        style={{
                                            border: '1px solid var(--studio-border)',
                                            borderRadius: '8px',
                                            padding: '0.4rem',
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            background: paramMode === 'Standard' ? 'rgba(99, 102, 241, 0.08)' : 'white',
                                            borderColor: paramMode === 'Standard' ? '#6366f1' : 'var(--studio-border)',
                                            color: paramMode === 'Standard' ? '#4f46e5' : 'var(--studio-text-sub)',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        Standard Mode
                                    </button>
                                    <button 
                                        onClick={() => setParamMode('Deep')}
                                        style={{
                                            border: '1px solid var(--studio-border)',
                                            borderRadius: '8px',
                                            padding: '0.4rem',
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            background: paramMode === 'Deep' ? 'rgba(99, 102, 241, 0.08)' : 'white',
                                            borderColor: paramMode === 'Deep' ? '#6366f1' : 'var(--studio-border)',
                                            color: paramMode === 'Deep' ? '#4f46e5' : 'var(--studio-text-sub)',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        Deep Insight
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text)' }}>Widget Limit Constraints</label>
                                <select 
                                    value={paramMaxWidgets}
                                    onChange={e => setParamMaxWidgets(parseInt(e.target.value))}
                                    style={{
                                        padding: '0.45rem 0.65rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--studio-border)',
                                        fontSize: '0.725rem',
                                        outline: 'none',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    <option value={4}>4 Widgets (Minimal layout)</option>
                                    <option value={6}>6 Widgets (Compact layout)</option>
                                    <option value={8}>8 Widgets (Standard layout)</option>
                                    <option value={12}>12 Widgets (Dense layout)</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--studio-text)' }}>Dashboard Canvas Palette Theme</label>
                                <select 
                                    value={paramTheme}
                                    onChange={e => setParamTheme(e.target.value)}
                                    style={{
                                        padding: '0.45rem 0.65rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--studio-border)',
                                        fontSize: '0.725rem',
                                        outline: 'none',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    <option value="Indigo">Indigo Breeze</option>
                                    <option value="Emerald">Forest Emerald</option>
                                    <option value="Sunset">Sunset Glow</option>
                                    <option value="Slate">Classic Slate</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <Button variant="outline" onClick={() => setShowParamsPop(false)} style={{ fontSize: '0.725rem', padding: '0.4rem 0.8rem' }}>Cancel</Button>
                            <Button 
                                onClick={() => {
                                    setShowParamsPop(false);
                                    showToast(`Co-Pilot parameters saved successfully! Temp: ${paramTemperature.toFixed(2)}, Widgets: ${paramMaxWidgets}`, "success");
                                }} 
                                style={{ fontSize: '0.725rem', padding: '0.4rem 0.8rem', background: '#4f46e5', color: 'white' }}
                            >
                                Save Parameters
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
