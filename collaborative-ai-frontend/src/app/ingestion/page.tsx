'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FileDropZone } from './FileDropZone';
import {
    Database,
    FileJson,
    Share2,
    CheckCircle,
    XCircle,
    Loader2,
    AlertCircle,
    Shield,
    Sparkles,
    CheckCircle2,
    ChevronDown,
    Trash2,
    Eye,
    Upload,
    FileSpreadsheet,
    Globe,
    Plus,
    Table,
    ArrowRight,
    X,
    Brain,
    Link2,
    Lock,
    Users,
    Search,
    SlidersHorizontal,
    Grid,
    List,
    MoreVertical,
    TrendingUp,
    BarChart2,
    HardDrive,
    ShieldAlert,
    Edit3,
} from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';
import { apiClient } from '@/lib/apiClient';
import { useAuth, AuthUser } from '@/components/providers/AuthProvider';
import * as XLSX from 'xlsx';
import { ShareModal } from '@/components/ui/ShareModal';
import { Modal } from '@/components/ui/Modal';
import './ingestion.css';

function getRoleDisplayName(role: string): string {
    if (role === 'Admin') return 'Admin';
    if (role === 'Analyst' || role === 'Data Steward' || role === 'Data Engineer' || role === 'Data Analyst') {
        return 'Analyst';
    }
    return 'Business User';
}

/* ─── Types ─────────────────────────────────────────────── */

interface Dataset {
    id: string;
    name: string;
    source: string;
    type: string;
    rows: number;
    columns: number;
    quality: number;
    status: string;
    owner: string;
    ownerName: string;
    ownerRole: string;
    visibility: string;
    createdAt: string;
    ownerId: string;
    sharedWith: string;
}

interface SchemaField {
    name: string;
    type: string;
    null_percentage: number;
    sample_values: string[];
}

interface AiInsights {
    summary: string;
    quality_score: number;
    missing_value_analysis: string;
    preprocessing_suggestions: string[];
    anomaly_warnings: string[];
}

interface DatasetDetails {
    dataset: Dataset;
    schema: SchemaField[];
    preview_columns: string[];
    preview_rows: any[][];
    ai_insights: AiInsights;
}

type EnforcementMode = 'strict' | 'warning' | 'monitor';

interface ConnectorConfig {
    pgHost?: string;
    pgPort?: string;
    pgDatabase?: string;
    pgUsername?: string;
    pgPassword?: string;
    pgTable?: string;
    mongoUri?: string;
    mongoDatabase?: string;
    mongoCollection?: string;
    apiUrl?: string;
    apiMethod?: string;
    apiHeaders?: string;
    apiBody?: string;
    pipelineName?: string;
}

/* ─── Constants ─────────────────────────────────────────── */

const CONNECTORS = [
    {
        id: 'postgres',
        name: 'PostgreSQL',
        type: 'Relational DB',
        icon: Database,
        color: 'rgba(14,165,233,0.08)',
        iconColor: '#0ea5e9',
        description: 'Connect to PostgreSQL database',
    },
    {
        id: 'mongo',
        name: 'MongoDB',
        type: 'NoSQL DB',
        icon: FileJson,
        color: 'rgba(16,185,129,0.08)',
        iconColor: '#10b981',
        description: 'Connect to MongoDB collections',
    },
    {
        id: 'api',
        name: 'REST API',
        type: 'HTTP Webhook',
        icon: Share2,
        color: 'rgba(139,92,246,0.08)',
        iconColor: '#8b5cf6',
        description: 'Connect to REST API endpoints',
    },
];

/* ─── Client Schema Inference ──────────────────────────── */

function inferSchema(data: Record<string, any>[]): any[] {
    if (!data.length) return [];
    const first = data[0];
    return Object.keys(first).map((key) => {
        const val = first[key];
        let type = 'String';
        if (val !== null && val !== undefined && val !== '') {
            if (typeof val === 'number') {
                type = Number.isInteger(val) ? 'Integer' : 'Float';
            } else if (typeof val === 'boolean') {
                type = 'Boolean';
            } else if (!isNaN(Number(val))) {
                type = Number.isInteger(Number(val)) ? 'Integer' : 'Float';
            } else if (/^(true|false)$/i.test(String(val))) {
                type = 'Boolean';
            } else if (!isNaN(Date.parse(String(val)))) {
                type = 'Date';
            }
        }
        return { name: key, type, required: true, description: `Inferred from column '${key}'` };
    });
}

const formatStr = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

/* ─── Source icon helper ─────────────────────────────────── */
function SourceIcon({ source, size = 18 }: { source: string; size?: number }) {
    const s = source.toLowerCase();
    if (s === 'postgres' || s === 'mysql') return <Database size={size} />;
    if (s === 'mongo') return <FileJson size={size} />;
    if (s === 'api') return <Share2 size={size} />;
    return <FileSpreadsheet size={size} />;
}

function sourceColors(source: string) {
    const s = source.toLowerCase();
    if (s === 'postgres' || s === 'mysql') return { bg: 'rgba(14,165,233,0.08)', color: '#0ea5e9' };
    if (s === 'mongo') return { bg: 'rgba(16,185,129,0.08)', color: '#10b981' };
    if (s === 'api') return { bg: 'rgba(139,92,246,0.08)', color: '#8b5cf6' };
    return { bg: 'rgba(99,102,241,0.08)', color: 'var(--primary-color)' };
}

function typeBadgeClass(source: string, type: string) {
    const s = (source || type).toLowerCase();
    if (s === 'postgres' || s === 'mysql') return 'catalog-badge-type csv';
    if (s === 'mongo') return 'catalog-badge-type json';
    if (s === 'api') return 'catalog-badge-type json';
    if (s === 'xlsx' || s === 'xls' || s === 'excel') return 'catalog-badge-type excel';
    return 'catalog-badge-type csv';
}

function typeBadgeLabel(source: string, type: string) {
    const s = source.toLowerCase();
    if (s === 'postgres' || s === 'mysql') return 'SQL';
    if (s === 'mongo') return 'NoSQL';
    if (s === 'api') return 'API';
    return type.toUpperCase();
}

function getInitials(name: string): string {
    if (!name) return 'S';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

/* ══════════════════════════════════════════════════════════ */
/* Ingestion & Sources Dashboard Hub                          */
/* ══════════════════════════════════════════════════════════ */

export default function IngestionPage() {
    const router = useRouter();
    const [activeConnector, setActiveConnector] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [selectedDetails, setSelectedDetails] = useState<DatasetDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [mappingDetails, setMappingDetails] = useState<DatasetDetails | null>(null);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [modalTab, setModalTab] = useState<string>('preview');
    const [parsedFileData, setParsedFileData] = useState<Record<string, any>[]>([]);
    const [enforcementMode, setEnforcementMode] = useState<EnforcementMode>('monitor');

    const [connectorConfig, setConnectorConfig] = useState<ConnectorConfig>({
        pgPort: '5432',
        apiMethod: 'GET',
    });
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [connectionMessage, setConnectionMessage] = useState('');
    const [connectionMeta, setConnectionMeta] = useState<any>(null);
    const [importing, setImporting] = useState(false);

    const { user } = useAuth();
    const { showToast } = useToast();

    const [sharingDatasetId, setSharingDatasetId] = useState<string | null>(null);
    const [sharingDatasetName, setSharingDatasetName] = useState<string>('');
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('newest');
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
    const [catalogViewMode, setCatalogViewMode] = useState<'grid' | 'list'>('list');

    /* dataset filtering states */
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [filterSource, setFilterSource] = useState('all');
    const [filterQuality, setFilterQuality] = useState('all');
    const [filterVisibility, setFilterVisibility] = useState('all');

    /* pagination */
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;

    const [renamingDatasetId, setRenamingDatasetId] = useState<string | null>(null);
    const [renamingDatasetName, setRenamingDatasetName] = useState<string>('');
    const [renamingLoading, setRenamingLoading] = useState<boolean>(false);

    const [scrollTarget, setScrollTarget] = useState<'connectors' | 'upload' | null>(null);

    useEffect(() => {
        const handleOutsideClick = () => setActiveDropdownId(null);
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, []);

    useEffect(() => {
        if (scrollTarget && !activeConnector && !mappingDetails && !selectedDetails) {
            const id = scrollTarget === 'connectors' ? 'connectors-section' : 'upload-section';
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                setScrollTarget(null);
            }
        }
    }, [scrollTarget, activeConnector, mappingDetails, selectedDetails]);

    /* ── Fetch datasets ── */
    const fetchDatasets = useCallback(async () => {
        setLoadingList(true);
        try {
            const res = await apiClient.get('/data/datasets');
            if (Array.isArray(res)) {
                const mapped = res.map((d: any) => {
                    let rowsCount = 0, colsCount = 0;
                    try { const p = JSON.parse(d.rawData); if (Array.isArray(p)) rowsCount = p.length; } catch { }
                    try { const p = JSON.parse(d.inferredSchema); if (Array.isArray(p)) colsCount = p.length; } catch { }
                    return {
                        id: d.id,
                        name: d.name,
                        source: d.source || 'file',
                        type: d.source || 'file',
                        rows: rowsCount,
                        columns: colsCount,
                        quality: d.quality ?? 95,
                        status: d.status ? d.status.toLowerCase() : 'ingested',
                        ownerName: d.owner?.name || 'System',
                        ownerRole: d.owner?.role ? getRoleDisplayName(d.owner.role) : 'System',
                        owner: d.owner?.role ? getRoleDisplayName(d.owner.role) : (d.owner?.name || 'System'),
                        visibility: d.visibility || 'private',
                        createdAt: d.createdAt,
                        ownerId: d.ownerId,
                        sharedWith: d.sharedWith || '[]',
                    };
                });
                setDatasets(mapped);
            }
        } catch {
            showToast('Failed to load active connected data sources.', 'error');
        } finally {
            setLoadingList(false);
        }
    }, [showToast]);

    useEffect(() => { fetchDatasets(); }, [fetchDatasets]);

    const handleRenameDataset = async () => {
        if (!renamingDatasetId) return;
        if (!renamingDatasetName.trim()) {
            showToast('Dataset name cannot be empty', 'error');
            return;
        }
        setRenamingLoading(true);
        try {
            const res = await apiClient.patch(`/data/datasets/${renamingDatasetId}`, {
                name: renamingDatasetName.trim()
            });
            if (res) {
                showToast('Dataset renamed successfully', 'success');
                setRenamingDatasetId(null);
                setRenamingDatasetName('');
                fetchDatasets();
            } else {
                showToast('Failed to rename dataset', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to rename dataset', 'error');
        } finally {
            setRenamingLoading(false);
        }
    };

    /* KPI computed values */
    const totalDatasets = datasets.length;
    const totalRows = datasets.reduce((a, d) => a + (d.rows || 0), 0);
    const avgQuality = datasets.length > 0
        ? Math.round(datasets.reduce((a, d) => a + (d.quality || 0), 0) / datasets.length)
        : 95;
    const storageMB = (totalRows * 0.12) / 1024;
    const storageDisplay = storageMB > 1024
        ? `${(storageMB / 1024).toFixed(1)} GB`
        : `${storageMB.toFixed(1)} MB`;

    /* Filtered + sorted datasets */
    const filteredDatasets = useMemo(() => {
        let result = [...datasets];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (d) =>
                    d.name.toLowerCase().includes(q) ||
                    d.source.toLowerCase().includes(q) ||
                    (d.ownerName && d.ownerName.toLowerCase().includes(q)) ||
                    (d.owner && d.owner.toLowerCase().includes(q)),
            );
        }

        // Filter by source type
        if (filterSource !== 'all') {
            result = result.filter((d) => d.source.toLowerCase() === filterSource);
        }

        // Filter by quality score range
        if (filterQuality !== 'all') {
            if (filterQuality === 'high') {
                result = result.filter((d) => d.quality >= 90);
            } else if (filterQuality === 'medium') {
                result = result.filter((d) => d.quality >= 70 && d.quality < 90);
            } else if (filterQuality === 'low') {
                result = result.filter((d) => d.quality < 70);
            }
        }

        // Filter by visibility setting
        if (filterVisibility !== 'all') {
            result = result.filter((d) => d.visibility.toLowerCase() === filterVisibility);
        }

        if (sortOrder === 'newest') result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        else if (sortOrder === 'oldest') result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        else if (sortOrder === 'rows-desc') result.sort((a, b) => b.rows - a.rows);
        else if (sortOrder === 'quality-desc') result.sort((a, b) => b.quality - a.quality);
        else if (sortOrder === 'alphabetical') result.sort((a, b) => a.name.localeCompare(b.name));
        return result;
    }, [datasets, searchQuery, sortOrder, filterSource, filterQuality, filterVisibility]);

    /* Paginated slice */
    const totalPages = Math.max(1, Math.ceil(filteredDatasets.length / PAGE_SIZE));
    const pagedDatasets = filteredDatasets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, sortOrder, filterSource, filterQuality, filterVisibility]);

    const updateConfig = (key: keyof ConnectorConfig, value: string) =>
        setConnectorConfig((prev) => ({ ...prev, [key]: value }));

    /* ── Load Dataset Details ── */
    const handleOpenDetails = async (datasetId: string, tab = 'preview') => {
        setModalTab(tab);
        setLoadingDetails(true);
        setSelectedDetails(null);
        try {
            const res = await apiClient.get(`/data/datasets/${datasetId}`);
            if (res?.success && res?.data) setSelectedDetails(res.data);
            else showToast('Failed to load dataset details.', 'error');
        } catch {
            showToast('Failed to fetch dataset details from backend.', 'error');
        } finally {
            setLoadingDetails(false);
        }
    };

    /* ── Delete ── */
    const handleDelete = async (datasetId: string) => {
        setDeletingId(datasetId);
        setConfirmDeleteId(null);
        try {
            const res = await apiClient.delete(`/data/datasets/${datasetId}`);
            if (res?.success) {
                showToast('Dataset deleted successfully.', 'success');
                setDatasets((prev) => prev.filter((d) => d.id !== datasetId));
                if (selectedDetails?.dataset?.id === datasetId) setSelectedDetails(null);
            } else {
                showToast(res?.message || 'Could not delete dataset.', 'error');
            }
        } catch {
            showToast('Failed to delete dataset from backend.', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    /* ── File Upload ── */
    const handleFileUpload = async (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['csv', 'xlsx', 'xls', 'json'].includes(ext || '')) {
            showToast(`Unsupported file type: .${ext}. Use CSV, Excel, or JSON.`, 'error');
            return;
        }
        setIsUploading(true);
        setUploadProgress(10);
        setMappingDetails(null);
        try {
            setUploadProgress(30);
            const text = await file.text();
            let jsonData: Record<string, any>[] = [];

            if (file.name.toLowerCase().endsWith('.csv')) {
                const lines = text.split('\n').filter((l) => l.trim().length > 0);
                const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
                jsonData = lines.slice(1).map((line) => {
                    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                    return headers.reduce((obj, h, i) => {
                        obj[h] = values[i] ? values[i].replace(/^"|"$/g, '').trim() : '';
                        return obj;
                    }, {} as any);
                });
            } else if (file.name.toLowerCase().endsWith('.json')) {
                try { jsonData = JSON.parse(text); } catch { throw new Error('Invalid JSON format.'); }
            } else if (file.name.toLowerCase().match(/\.xlsx?$/)) {
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            } else {
                throw new Error(`Unsupported file type: ${file.name}`);
            }

            if (!Array.isArray(jsonData)) jsonData = [jsonData];
            setUploadProgress(70);
            const fields = inferSchema(jsonData);

            setMappingDetails({
                dataset: {
                    id: 'temp-id',
                    name: file.name,
                    source: 'file',
                    type: ext || 'csv',
                    rows: jsonData.length,
                    columns: fields.length,
                    quality: 100,
                    status: 'draft',
                    owner: user?.role ? getRoleDisplayName(user.role) : 'System',
                    ownerName: user?.name || 'System',
                    ownerRole: user?.role ? getRoleDisplayName(user.role) : 'System',
                    visibility: 'private',
                    createdAt: new Date().toISOString(),
                    ownerId: user?.id || 'temp-owner-id',
                    sharedWith: '[]',
                },
                schema: fields.map((f) => ({
                    name: f.name,
                    type: f.type,
                    null_percentage: 0,
                    sample_values: jsonData.slice(0, 3).map((r) => String(r[f.name] ?? '')),
                })),
                preview_columns: fields.map((f) => f.name),
                preview_rows: jsonData.slice(0, 10).map((row) => fields.map((f) => row[f.name])),
                ai_insights: {
                    summary: '',
                    quality_score: 100,
                    missing_value_analysis: '',
                    preprocessing_suggestions: [],
                    anomaly_warnings: [],
                },
            });
            setParsedFileData(jsonData);
            setUploadProgress(100);
            showToast(`"${file.name}" uploaded and parsed. Ready to configure mapping.`, 'success');
        } catch (err: any) {
            showToast(err.message || 'File analysis failed. Check formatting.', 'error');
            setUploadProgress(0);
        } finally {
            setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 1000);
        }
    };

    /* ── Save Mapping ── */
    const handleSaveMapping = async (mappedSchema: any[], evolutionPolicy: string) => {
        if (!mappingDetails || !parsedFileData.length) return;
        setIsFinalizing(true);
        const name = mappingDetails.dataset.name;
        try {
            const res = await apiClient.post('/data/datasets', {
                name,
                rawData: JSON.stringify(parsedFileData),
                inferredSchema: JSON.stringify(mappedSchema),
                source: 'file',
                sourceUri: name,
                enforcementMode,
            });
            if (res?.dataset) {
                showToast(`"${name}" has been mapped and validation complete!`, 'success');
                setMappingDetails(null);
                setParsedFileData([]);
                if (res?.contract?.id) localStorage.setItem('dcs_selected_contract_id', res.contract.id);
                router.push('/data-contracts');
            } else {
                showToast('Ingestion pipeline failed.', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to complete dataset ingestion pipeline.', 'error');
        } finally {
            setIsFinalizing(false);
        }
    };

    /* ── Test Connection ── */
    const handleTestConnection = async () => {
        if (activeConnector === 'postgres' && (!connectorConfig.pgHost || !connectorConfig.pgDatabase || !connectorConfig.pgUsername)) {
            showToast('PostgreSQL host, database, and username are required.', 'error'); return;
        }
        if (activeConnector === 'mongo' && !connectorConfig.mongoUri) {
            showToast('MongoDB connection URI is required.', 'error'); return;
        }
        if (activeConnector === 'api' && !connectorConfig.apiUrl) {
            showToast('API Endpoint URL is required.', 'error'); return;
        }
        setConnectionStatus('testing');
        setConnectionMessage('');
        setConnectionMeta(null);
        try {
            let configPayload: any = {};
            if (activeConnector === 'postgres') {
                configPayload = { host: connectorConfig.pgHost, port: parseInt(connectorConfig.pgPort || '5432') || 5432, database: connectorConfig.pgDatabase, username: connectorConfig.pgUsername, password: connectorConfig.pgPassword };
            } else if (activeConnector === 'mongo') {
                configPayload = { connectionUri: connectorConfig.mongoUri, database: connectorConfig.mongoDatabase };
            } else if (activeConnector === 'api') {
                configPayload = { url: connectorConfig.apiUrl, method: connectorConfig.apiMethod || 'GET', headers: connectorConfig.apiHeaders };
            }
            const res = await apiClient.post('/data/connectors/test', { connectorType: activeConnector, config: configPayload });
            if (res?.success) {
                setConnectionStatus('success');
                setConnectionMessage(res.message || 'Successfully tested connector!');
                setConnectionMeta(res);
                showToast('Connection test successful!', 'success');
            } else {
                setConnectionStatus('error');
                setConnectionMessage(res?.message || 'Connection test failed.');
                showToast(res?.message || 'Connector verification failed.', 'error');
            }
        } catch (err: any) {
            setConnectionStatus('error');
            setConnectionMessage(err.message || 'Test failed.');
            showToast(err.message || 'Failed to verify connector connection.', 'error');
        }
    };

    /* ── Import Connector ── */
    const handleImportConnector = async () => {
        setImporting(true);
        try {
            let configPayload: any = {};
            let sourceName = connectorConfig.pipelineName || 'Connector Stream';
            if (activeConnector === 'postgres') {
                const table = connectorConfig.pgTable || connectionMeta?.tables?.[0] || 'users';
                configPayload = { host: connectorConfig.pgHost, port: parseInt(connectorConfig.pgPort || '5432') || 5432, database: connectorConfig.pgDatabase, username: connectorConfig.pgUsername, password: connectorConfig.pgPassword, table };
                sourceName = connectorConfig.pipelineName || `${connectorConfig.pgDatabase}.${table}`;
            } else if (activeConnector === 'mongo') {
                const coll = connectorConfig.mongoCollection || connectionMeta?.collections?.[0] || 'users';
                configPayload = { connectionUri: connectorConfig.mongoUri, database: connectorConfig.mongoDatabase, collection: coll };
                sourceName = connectorConfig.pipelineName || `${connectorConfig.mongoDatabase || 'db'}.${coll}`;
            } else if (activeConnector === 'api') {
                configPayload = { url: connectorConfig.apiUrl, method: connectorConfig.apiMethod || 'GET', headers: connectorConfig.apiHeaders, body: connectorConfig.apiBody };
                try { sourceName = connectorConfig.pipelineName || new URL(connectorConfig.apiUrl || '').hostname; } catch { }
            }
            const res = await apiClient.post('/data/connectors/pull', { connectorType: activeConnector, config: configPayload, pipelineName: sourceName, enforcementMode });
            if (res?.dataset) {
                showToast(`Connector "${sourceName}" pulled and dataset validated!`, 'success');
                setActiveConnector(null);
                setConnectionStatus('idle');
                setConnectionMessage('');
                setConnectionMeta(null);
                setConnectorConfig({ pgPort: '5432', apiMethod: 'GET' });
                fetchDatasets();
                handleOpenDetails(res.dataset.id, 'preview');
            } else {
                showToast('Pull and ingestion pipeline failed.', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Connector pull execution failed.', 'error');
        } finally {
            setImporting(false);
        }
    };

    /* ── Pagination renderer ── */
    const renderPagination = () => {
        const pages: (number | '…')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1, 2, 3);
            if (currentPage > 4) pages.push('…');
            if (currentPage > 3 && currentPage < totalPages - 2) pages.push(currentPage);
            if (currentPage < totalPages - 3) pages.push('…');
            pages.push(totalPages);
        }
        return (
            <div className="pagination-controls">
                <button className="pg-btn" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>‹</button>
                {pages.map((p, i) =>
                    p === '…' ? (
                        <span key={`dots-${i}`} className="pg-dots">…</span>
                    ) : (
                        <button key={p} className={`pg-btn${p === currentPage ? ' active' : ''}`} onClick={() => setCurrentPage(p as number)}>{p}</button>
                    ),
                )}
                <button className="pg-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>›</button>
            </div>
        );
    };

    /* ══════════════════════════════════════════════════════ */
    /* Render                                                 */
    /* ══════════════════════════════════════════════════════ */
    return (
        <div className="sources-hub-container">

            {/* ── Page Header ── */}
            <div className="sources-hub-header">
                <div>
                    <h1>Data Sources</h1>
                    <p>Manage, organize and collaborate on your datasets. Upload files or connect to third-party sources.</p>
                </div>
                <div className="header-actions-group">
                    <button
                        className="action-btn-outline"
                        onClick={() => {
                            setActiveConnector(null);
                            setMappingDetails(null);
                            setSelectedDetails(null);
                            setScrollTarget('connectors');
                        }}
                    >
                        <Link2 size={15} /> Connect Source
                    </button>
                    <button
                        className="action-btn-primary"
                        onClick={() => document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                        <Upload size={15} /> Upload Dataset <ChevronDown size={13} />
                    </button>
                </div>
            </div>

            {/* ── Wizard / Default Grid ── */}
            {mappingDetails ? (
                <div className="animate-fade-in">
                    <SchemaMappingWizard
                        details={mappingDetails}
                        onCancel={() => { setMappingDetails(null); setParsedFileData([]); }}
                        onSave={handleSaveMapping}
                        isSaving={isFinalizing}
                        enforcementMode={enforcementMode}
                        setEnforcementMode={setEnforcementMode}
                    />
                </div>
            ) : (
                /* ── Default: Upload + Connectors ── */
                <div className="sources-grid-layout">
                    {/* Upload */}
                    <div className="sources-panel" id="upload-section">
                        <div className="sources-panel-head">
                            <Upload size={17} />
                            Upload Dataset
                        </div>
                        <div className="sources-panel-body" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '220px' }}>
                            {isUploading ? (
                                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                    <Loader2 className="animate-spin" size={32} color="var(--primary-color)" style={{ margin: '0 auto 0.75rem' }} />
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Parsing &amp; analysing file structure…</div>
                                    <div style={{ height: '5px', width: '200px', background: 'var(--border-color)', borderRadius: '3px', margin: '0 auto 0.5rem', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--primary-color)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{uploadProgress}% processed</span>
                                </div>
                            ) : (
                                <FileDropZone onFileSelect={handleFileUpload} />
                            )}
                        </div>
                    </div>

                    {/* Connectors */}
                    <div className="sources-panel" id="connectors-section">
                        <div className="sources-panel-head">
                            <Globe size={17} />
                            Connect Third-Party Sources
                        </div>
                        <div className="sources-panel-body">
                            <div className="connectors-row-grid">
                                {CONNECTORS.map((connector) => {
                                    const Icon = connector.icon;
                                    return (
                                        <div
                                            key={connector.id}
                                            className="connector-card-horizontal"
                                            onClick={() => { setActiveConnector(connector.id); setConnectorConfig({ pgPort: '5432', apiMethod: 'GET' }); }}
                                        >
                                            <div className="connector-card-horizontal-icon" style={{ background: connector.color, color: connector.iconColor }}>
                                                <Icon size={18} />
                                            </div>
                                            <span className="connector-card-horizontal-plus"><Plus size={13} /></span>
                                            <div className="connector-card-horizontal-name">{connector.name}</div>
                                            <div className="connector-card-horizontal-desc">{connector.description}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <a
                                href="#"
                                className="connector-view-all-link"
                                onClick={(e) => { e.preventDefault(); showToast('More connectors coming soon!', 'info'); }}
                            >
                                View all connectors <ArrowRight size={13} />
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Active Connector Modal ── */}
            <Modal
                isOpen={activeConnector !== null}
                onClose={() => {
                    setActiveConnector(null);
                    setConnectionStatus('idle');
                    setConnectionMessage('');
                    setConnectionMeta(null);
                    setConnectorConfig({ pgPort: '5432', apiMethod: 'GET' });
                }}
                title={`Configure ${CONNECTORS.find((c) => c.id === activeConnector)?.name || ''} Connection`}
                maxWidth="600px"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <Input
                        label="Pipeline / Connection Name *"
                        placeholder="e.g., Enterprise Billing Database"
                        value={connectorConfig.pipelineName || ''}
                        onChange={(e) => updateConfig('pipelineName', e.target.value)}
                    />

                    {activeConnector === 'postgres' && (
                        <>
                            <div className="connector-form-grid">
                                <Input label="Database Host *" placeholder="localhost or db.company.com" value={connectorConfig.pgHost || ''} onChange={(e) => updateConfig('pgHost', e.target.value)} />
                                <Input label="Port" placeholder="5432" value={connectorConfig.pgPort || ''} onChange={(e) => updateConfig('pgPort', e.target.value)} />
                            </div>
                            <Input label="Database Name *" placeholder="sales_records" value={connectorConfig.pgDatabase || ''} onChange={(e) => updateConfig('pgDatabase', e.target.value)} />
                            <div className="connector-form-grid">
                                <Input label="Username *" placeholder="postgres" value={connectorConfig.pgUsername || ''} onChange={(e) => updateConfig('pgUsername', e.target.value)} />
                                <Input label="Password" type="password" placeholder="••••••••" value={connectorConfig.pgPassword || ''} onChange={(e) => updateConfig('pgPassword', e.target.value)} />
                            </div>
                            {connectionStatus === 'success' && connectionMeta?.tables && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Table to Ingest *</label>
                                    <select
                                        style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '0 0.75rem', background: 'var(--bg-color)', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                                        value={connectorConfig.pgTable || ''}
                                        onChange={(e) => updateConfig('pgTable', e.target.value)}
                                    >
                                        <option value="">-- Choose discovered table --</option>
                                        {connectionMeta.tables.map((t: string) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            )}
                        </>
                    )}

                    {activeConnector === 'mongo' && (
                        <>
                            <Input label="MongoDB Connection URI *" placeholder="mongodb://admin:pass@localhost:27017" value={connectorConfig.mongoUri || ''} onChange={(e) => updateConfig('mongoUri', e.target.value)} />
                            <Input label="Database Name" placeholder="production_logs" value={connectorConfig.mongoDatabase || ''} onChange={(e) => updateConfig('mongoDatabase', e.target.value)} />
                            {connectionStatus === 'success' && connectionMeta?.collections && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Collection to Ingest *</label>
                                    <select
                                        style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '0 0.75rem', background: 'var(--bg-color)', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                                        value={connectorConfig.mongoCollection || ''}
                                        onChange={(e) => updateConfig('mongoCollection', e.target.value)}
                                    >
                                        <option value="">-- Choose collection --</option>
                                        {connectionMeta.collections.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            )}
                        </>
                    )}

                    {activeConnector === 'api' && (
                        <>
                            <div className="connector-form-grid connector-form-grid--api">
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>Method</label>
                                    <select
                                        style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '0 0.5rem', background: 'var(--bg-color)', fontSize: '0.875rem', color: 'var(--text-primary)' }}
                                        value={connectorConfig.apiMethod || 'GET'}
                                        onChange={(e) => updateConfig('apiMethod', e.target.value)}
                                    >
                                        <option>GET</option>
                                        <option>POST</option>
                                    </select>
                                </div>
                                <Input label="API Endpoint URL *" placeholder="https://api.company.com/v1/metrics" value={connectorConfig.apiUrl || ''} onChange={(e) => updateConfig('apiUrl', e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>Custom HTTP Headers (JSON Object, optional)</label>
                                <textarea
                                    className="connector-textarea"
                                    placeholder={'{\n  "Authorization": "Bearer token_secret"\n}'}
                                    value={connectorConfig.apiHeaders || ''}
                                    onChange={(e) => updateConfig('apiHeaders', e.target.value)}
                                    rows={3}
                                    style={{ width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '0.5rem 0.75rem', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                                />
                            </div>
                            <div className="connector-api-hint">
                                <AlertCircle size={13} />
                                <span>Try <code>https://jsonplaceholder.typicode.com/users</code> for an instant mock API test.</span>
                            </div>
                        </>
                    )}

                    {/* Enforcement mode */}
                    <div className="enforcement-selector">
                        <div className="enforcement-selector-label">
                            <Shield size={15} color="var(--primary-color)" />
                            <strong>Enforcement Policy Mode</strong>
                        </div>
                        <div className="enforcement-options">
                            {([
                                { value: 'strict', label: 'Strict Ingestion', desc: 'Reject invalid rows — only store fields that pass quality checks.', icon: '🔒' },
                                { value: 'warning', label: 'Warning Logs', desc: 'Ingest all records, but tag schema issues and trigger alerts.', icon: '⚠️' },
                                { value: 'monitor', label: 'Silent Monitor', desc: 'Log schema profiles silently. Zero downstream interference.', icon: '👁️' },
                            ] as const).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={`enforcement-option${enforcementMode === opt.value ? ' selected' : ''}`}
                                    onClick={() => setEnforcementMode(opt.value)}
                                >
                                    <span className="enforcement-option-icon">{opt.icon}</span>
                                    <div>
                                        <div className="enforcement-option-label">{opt.label}</div>
                                        <div className="enforcement-option-desc">{opt.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Test & Import */}
                    <div className="connector-test-row">
                        <Button onClick={handleTestConnection} disabled={connectionStatus === 'testing'} variant="outline">
                            {connectionStatus === 'testing'
                                ? <><Loader2 size={13} className="animate-spin" /> Testing…</>
                                : connectionStatus === 'success'
                                    ? <><CheckCircle size={13} color="var(--success-color)" /> Connected</>
                                    : 'Verify Connection'}
                        </Button>
                        <Button onClick={handleImportConnector} disabled={connectionStatus !== 'success' || importing}>
                            {importing ? <><Loader2 size={13} className="animate-spin" /> Synchronising…</> : <><ArrowRight size={13} /> Pull &amp; Ingest Data</>}
                        </Button>
                        {connectionStatus === 'success' && (
                            <div className="connector-status connector-status--success">
                                <CheckCircle size={13} /> Connection active!
                            </div>
                        )}
                        {connectionStatus === 'error' && (
                            <div className="connector-status connector-status--error">
                                <XCircle size={13} /> {connectionMessage || 'Connection failed.'}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* ── KPI Row ── */}
            <div className="kpis-row-container">
                {[
                    { icon: <Database size={19} />, label: 'Total Datasets', value: totalDatasets, trend: '+12 this month', iconStyle: { background: 'rgba(99,102,241,0.08)', color: 'var(--primary-color)' } },
                    { icon: <BarChart2 size={19} />, label: 'Total Rows', value: totalRows.toLocaleString(), trend: '+8% this month', iconStyle: { background: 'rgba(16,185,129,0.08)', color: '#10b981' } },
                    { icon: <HardDrive size={19} />, label: 'Storage Used', value: storageDisplay, trend: '+15% this month', iconStyle: { background: 'rgba(245,158,11,0.08)', color: '#b45309' } },
                    { icon: <Brain size={19} />, label: 'Avg. Data Quality', value: `${avgQuality}%`, trend: '+0.4% improvement', iconStyle: { background: 'rgba(139,92,246,0.08)', color: '#7c3aed' } },
                ].map((kpi) => (
                    <div className="kpi-card-new" key={kpi.label}>
                        <div className="kpi-card-new-icon-box" style={kpi.iconStyle}>{kpi.icon}</div>
                        <div>
                            <div className="kpi-card-new-label">{kpi.label}</div>
                            <div className="kpi-card-new-value">{kpi.value}</div>
                            <div className="kpi-card-new-trend"><TrendingUp size={11} /> {kpi.trend}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Catalog ── */}
            <div className="sources-list-section">
                {/* Catalog header */}
                <div className="catalog-header-bar">
                    <h2>Dataset Catalog</h2>
                    <div className="catalog-search-panel">
                        <div className="catalog-search-input-box">
                            <Search size={14} color="var(--text-secondary)" />
                            <input
                                type="text"
                                placeholder="Search datasets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                                className={`catalog-filter-btn${showFilterDropdown ? ' active' : ''}`}
                                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                            >
                                <SlidersHorizontal size={13} /> Filters
                                {(filterSource !== 'all' || filterQuality !== 'all' || filterVisibility !== 'all') && (
                                    <span className="filter-badge-dot" />
                                )}
                            </button>

                            {showFilterDropdown && (
                                <div className="filter-dropdown-panel animate-fade-in">
                                    <div className="filter-dropdown-section">
                                        <label>Source Type</label>
                                        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                                            <option value="all">All Sources</option>
                                            <option value="file">Local File</option>
                                            <option value="postgres">PostgreSQL</option>
                                            <option value="mongo">MongoDB</option>
                                            <option value="api">REST API</option>
                                        </select>
                                    </div>
                                    <div className="filter-dropdown-section">
                                        <label>Quality Score</label>
                                        <select value={filterQuality} onChange={(e) => setFilterQuality(e.target.value)}>
                                            <option value="all">All Scores</option>
                                            <option value="high">High Quality (≥ 90%)</option>
                                            <option value="medium">Medium Quality (70% - 89%)</option>
                                            <option value="low">Low Quality (&lt; 70%)</option>
                                        </select>
                                    </div>
                                    <div className="filter-dropdown-section">
                                        <label>Visibility</label>
                                        <select value={filterVisibility} onChange={(e) => setFilterVisibility(e.target.value)}>
                                            <option value="all">All Visibilities</option>
                                            <option value="private">Private</option>
                                            <option value="organization">Organization</option>
                                        </select>
                                    </div>
                                    <div className="filter-dropdown-actions">
                                        <button
                                            className="filter-reset-btn"
                                            onClick={() => {
                                                setFilterSource('all');
                                                setFilterQuality('all');
                                                setFilterVisibility('all');
                                                setShowFilterDropdown(false);
                                            }}
                                        >
                                            Reset Filters
                                        </button>
                                        <button
                                            className="filter-apply-btn"
                                            onClick={() => setShowFilterDropdown(false)}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <select
                            className="catalog-sort-select"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                        >
                            <option value="newest">Sort by: Recently Updated</option>
                            <option value="oldest">Sort by: Oldest</option>
                            <option value="rows-desc">Sort by: Rows (High → Low)</option>
                            <option value="quality-desc">Sort by: Quality (High → Low)</option>
                            <option value="alphabetical">Sort by: Alphabetical</option>
                        </select>
                        <div className="catalog-view-toggles">
                            <button className={`catalog-view-toggle-btn${catalogViewMode === 'list' ? ' active' : ''}`} onClick={() => setCatalogViewMode('list')}><List size={13} /></button>
                            <button className={`catalog-view-toggle-btn${catalogViewMode === 'grid' ? ' active' : ''}`} onClick={() => setCatalogViewMode('grid')}><Grid size={13} /></button>
                        </div>
                    </div>
                </div>

                {/* Delete confirmation modal */}
                {confirmDeleteId && (
                    <div className="catalog-modal-overlay">
                        <div className="catalog-modal-card">
                            <div className="catalog-modal-icon-wrap danger">
                                <AlertCircle size={24} />
                            </div>
                            <h3 className="catalog-modal-title">Delete Dataset</h3>
                            <p className="catalog-modal-desc">
                                Are you sure you want to permanently delete <strong>{datasets.find(d => d.id === confirmDeleteId)?.name || 'this dataset'}</strong>? This action cannot be undone and will permanently remove all associated validation reports and quality metrics.
                            </p>
                            <div className="catalog-modal-actions">
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirmDeleteId(null)}
                                    disabled={deletingId !== null}
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={() => handleDelete(confirmDeleteId)}
                                    disabled={deletingId !== null}
                                >
                                    {deletingId === confirmDeleteId ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" style={{ marginRight: '0.5rem' }} />
                                            Deleting...
                                        </>
                                    ) : 'Delete'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}



                {loadingList ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', background: 'var(--bg-color)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                        <Loader2 className="animate-spin" size={30} color="var(--primary-color)" style={{ marginBottom: '0.75rem' }} />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Loading connected data sources…</span>
                    </div>
                ) : filteredDatasets.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', background: 'var(--bg-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
                        <Database size={38} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.35 }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>No Data Sources Found</h3>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '320px', margin: '0.5rem auto 0', fontSize: '0.8125rem' }}>
                            {searchQuery ? 'Try adjusting your search terms.' : 'Configure a database connector or upload a file above to ingest your first dataset.'}
                        </p>
                    </div>
                ) : catalogViewMode === 'grid' ? (
                    /* ── Grid view ── */
                    <div className="catalog-grid-container">
                        {pagedDatasets.map((dataset, idx) => {
                            const sc = sourceColors(dataset.source);
                            const datasetIndex = (currentPage - 1) * PAGE_SIZE + idx + 1;
                            return (
                                <div
                                    key={dataset.id}
                                    style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.125rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s' }}
                                    className="animate-fade-in"
                                    onClick={() => handleOpenDetails(dataset.id, 'preview')}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; (e.currentTarget as HTMLDivElement).style.transform = ''; }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: 'var(--text-secondary)',
                                                background: 'var(--bg-secondary)',
                                                padding: '0.125rem 0.375rem',
                                                borderRadius: 'var(--radius-sm)',
                                                border: '1px solid var(--border-color)',
                                                fontFamily: 'monospace'
                                            }}>
                                                #{datasetIndex}
                                            </span>
                                            <div className="catalog-dataset-icon-wrapper" style={{ background: sc.bg, color: sc.color }}>
                                                <SourceIcon source={dataset.source} size={17} />
                                            </div>
                                        </div>
                                        <div className="actions-cell-container" onClick={(e) => e.stopPropagation()}>
                                            <button className="actions-dots-btn" onClick={() => setActiveDropdownId(activeDropdownId === dataset.id ? null : dataset.id)}><MoreVertical size={15} /></button>
                                            {activeDropdownId === dataset.id && (
                                                <DatasetDropdown
                                                    dataset={dataset}
                                                    onView={(tab) => { setActiveDropdownId(null); handleOpenDetails(dataset.id, tab); }}
                                                    onShare={() => { setActiveDropdownId(null); setSharingDatasetId(dataset.id); setSharingDatasetName(dataset.name); setIsShareModalOpen(true); }}
                                                    onRename={() => { setActiveDropdownId(null); setRenamingDatasetId(dataset.id); setRenamingDatasetName(dataset.name); }}
                                                    onDelete={() => { setActiveDropdownId(null); setConfirmDeleteId(dataset.id); }}
                                                    currentUser={user}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="catalog-dataset-name-bold">{dataset.name}</div>
                                        <div className="catalog-dataset-desc" style={{ marginTop: 2 }}>Ingested via {dataset.source}</div>
                                    </div>
                                    <div className="catalog-dataset-tags">
                                        <span className="catalog-dataset-tag-pill">{dataset.source}</span>
                                        <span className="catalog-dataset-tag-pill">{dataset.rows.toLocaleString()} rows</span>
                                        <span className="catalog-dataset-tag-pill">{dataset.columns} cols</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.625rem' }}>
                                        <div className="catalog-owner-avatar-group">
                                            <div className="catalog-owner-avatar" style={{ width: '24px', height: '24px', fontSize: '0.6875rem', background: 'var(--primary-color)' }}>{getInitials(dataset.ownerName)}</div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{dataset.ownerName}</span>
                                        </div>
                                        <span className={`catalog-status-badge${dataset.status === 'validated' || dataset.status === 'ingested' ? ' validated' : ' in-review'}`}>
                                            <span className={`status-dot${dataset.status === 'validated' || dataset.status === 'ingested' ? ' validated' : ' in-review'}`} />
                                            {dataset.status === 'validated' || dataset.status === 'ingested' ? 'Validated' : 'In Review'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* ── List / Table view ── */
                    <div className="catalog-table-container">
                        <table className="catalog-table">
                            <thead>
                                <tr>
                                    <th style={{ paddingLeft: '1rem', width: '60px', color: 'var(--text-secondary)' }}>#</th>
                                    <th>Dataset Name</th>
                                    <th>Type</th>
                                    <th>Rows</th>
                                    <th>Columns</th>
                                    <th>Owner</th>
                                    <th>Access</th>
                                    <th>Quality</th>
                                    <th>Last Updated</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'center', width: '60px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedDatasets.map((dataset, idx) => {
                                    const sc = sourceColors(dataset.source);
                                    const isValidated = dataset.status === 'validated' || dataset.status === 'ingested';
                                    const datasetIndex = (currentPage - 1) * PAGE_SIZE + idx + 1;
                                    return (
                                        <tr key={dataset.id} onClick={() => handleOpenDetails(dataset.id, 'preview')} style={{ cursor: 'pointer' }}>
                                            <td style={{ paddingLeft: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                {datasetIndex}
                                            </td>
                                            <td>
                                                <div className="catalog-dataset-name-cell">
                                                    <div className="catalog-dataset-icon-wrapper" style={{ background: sc.bg, color: sc.color }}>
                                                        <SourceIcon source={dataset.source} size={17} />
                                                    </div>
                                                    <div>
                                                        <div className="catalog-dataset-name-bold">{dataset.name}</div>
                                                        <div className="catalog-dataset-desc">Ingested via {dataset.source}</div>
                                                        <div className="catalog-dataset-tags">
                                                            <span className="catalog-dataset-tag-pill">{dataset.source}</span>
                                                            <span className="catalog-dataset-tag-pill">v1.0.0</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span className={typeBadgeClass(dataset.source, dataset.type)}>{typeBadgeLabel(dataset.source, dataset.type)}</span></td>
                                            <td style={{ fontWeight: 600 }}>{dataset.rows.toLocaleString()}</td>
                                            <td>{dataset.columns}</td>
                                            <td>
                                                <div className="catalog-owner-avatar-group">
                                                    <div className="catalog-owner-avatar" style={{ background: 'var(--primary-color)' }}>{getInitials(dataset.ownerName)}</div>
                                                    <div>
                                                        <div className="catalog-owner-name">{dataset.ownerName}</div>
                                                        <div className="catalog-owner-role">{dataset.ownerRole}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`catalog-access-badge ${dataset.visibility.toLowerCase()}`}>
                                                    {dataset.visibility.toLowerCase() === 'private' ? <Lock size={11} /> :
                                                        dataset.visibility.toLowerCase() === 'organization' ? <Globe size={11} /> : <Users size={11} />}
                                                    <span style={{ textTransform: 'capitalize' }}>{dataset.visibility}</span>
                                                </span>
                                            </td>
                                            <td>
                                                <div className="catalog-quality-group">
                                                    <div className="catalog-quality-percentage">{dataset.quality}%</div>
                                                    <div className="catalog-quality-bar">
                                                        <div className="catalog-quality-fill" style={{ width: `${dataset.quality}%`, background: dataset.quality > 90 ? '#10b981' : '#f59e0b' }} />
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                                {new Date(dataset.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                                <div style={{ fontSize: '0.6875rem', marginTop: '2px' }}>
                                                    {new Date(dataset.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`catalog-status-badge${isValidated ? ' validated' : ' in-review'}`}>
                                                    <span className={`status-dot${isValidated ? ' validated' : ' in-review'}`} />
                                                    {isValidated ? 'Validated' : 'In Review'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                <div className="actions-cell-container">
                                                    <button className="actions-dots-btn" onClick={() => setActiveDropdownId(activeDropdownId === dataset.id ? null : dataset.id)}><MoreVertical size={15} /></button>
                                                    {activeDropdownId === dataset.id && (
                                                        <DatasetDropdown
                                                            dataset={dataset}
                                                            onView={(tab) => { setActiveDropdownId(null); handleOpenDetails(dataset.id, tab); }}
                                                            onShare={() => { setActiveDropdownId(null); setSharingDatasetId(dataset.id); setSharingDatasetName(dataset.name); setIsShareModalOpen(true); }}
                                                            onRename={() => { setActiveDropdownId(null); setRenamingDatasetId(dataset.id); setRenamingDatasetName(dataset.name); }}
                                                            onDelete={() => { setActiveDropdownId(null); setConfirmDeleteId(dataset.id); }}
                                                            alignUpward={idx >= pagedDatasets.length - 2}
                                                            currentUser={user}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Table footer / pagination */}
                        <div className="catalog-table-footer">
                            <span>
                                Showing {filteredDatasets.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to{' '}
                                {Math.min(currentPage * PAGE_SIZE, filteredDatasets.length)} of {filteredDatasets.length} datasets
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {renderPagination()}
                                <select className="pg-per-page">
                                    <option>10 / page</option>
                                    <option>25 / page</option>
                                    <option>50 / page</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Dataset Detail Modal ── */}
            {(selectedDetails || loadingDetails) && (
                <div className="sources-modal-overlay" onClick={() => { if (!loadingDetails) setSelectedDetails(null); }}>
                    <div className="sources-modal-container" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <div className="sources-modal-header">
                            <div>
                                <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                                    <Database size={17} color="var(--primary-color)" />
                                    {selectedDetails ? `${selectedDetails.dataset.name} — Data Profile` : 'Loading…'}
                                </h3>
                                {selectedDetails && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                                        {selectedDetails.dataset.rows.toLocaleString()} rows · {selectedDetails.dataset.columns} columns · Connected {new Date(selectedDetails.dataset.createdAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <Button variant="outline" onClick={() => setSelectedDetails(null)} style={{ height: '30px', width: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                <X size={14} />
                            </Button>
                        </div>

                        <div className="sources-modal-body">
                            {loadingDetails ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
                                    <Loader2 className="animate-spin" size={28} color="var(--primary-color)" style={{ marginBottom: '0.75rem' }} />
                                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Loading dataset profile…</span>
                                </div>
                            ) : selectedDetails ? (
                                <>
                                    <div className="sources-modal-tabs">
                                        {[
                                            { id: 'preview', label: 'Dataset Preview' },
                                            { id: 'schema', label: 'Schema Specification' },
                                            { id: 'insights', label: '✦ AI Insights & Health' },
                                        ].map((tab) => (
                                            <button key={tab.id} className={`sources-modal-tab${modalTab === tab.id ? ' active' : ''}`} onClick={() => setModalTab(tab.id)}>
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Preview Tab */}
                                    {modalTab === 'preview' && (
                                        <div className="animate-fade-in">
                                            {!selectedDetails.preview_columns?.length ? (
                                                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No preview records available.</div>
                                            ) : (
                                                <div className="sources-preview-table-wrapper">
                                                    <table className="sources-preview-table">
                                                        <thead><tr>{selectedDetails.preview_columns.map((col) => <th key={col}>{col}</th>)}</tr></thead>
                                                        <tbody>
                                                            {selectedDetails.preview_rows.map((row, ri) => (
                                                                <tr key={ri}>{row.map((cell, ci) => (
                                                                    <td key={ci}>{cell === null || cell === undefined ? <span style={{ fontStyle: 'italic', opacity: 0.35 }}>null</span> : formatStr(cell)}</td>
                                                                ))}</tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Schema Tab */}
                                    {modalTab === 'schema' && (
                                        <div className="animate-fade-in">
                                            {!selectedDetails.schema?.length ? (
                                                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No schema found.</div>
                                            ) : (
                                                <div className="sources-preview-table-wrapper">
                                                    <table className="sources-preview-table">
                                                        <thead><tr><th>Field / Column Name</th><th>Data Type</th><th>Nullability %</th><th>Inferred Samples</th></tr></thead>
                                                        <tbody>
                                                            {selectedDetails.schema.map((field, idx) => (
                                                                <tr key={idx}>
                                                                    <td style={{ fontWeight: 600 }}>{field.name}</td>
                                                                    <td>
                                                                        <span style={{ fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(99,102,241,0.08)', color: 'var(--primary-color)', padding: '0.125rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                                                                            {field.type}
                                                                        </span>
                                                                    </td>
                                                                    <td>{field.null_percentage}%</td>
                                                                    <td style={{ color: 'var(--text-secondary)' }}>
                                                                        {field.sample_values?.length ? field.sample_values.join(', ') : <span style={{ opacity: 0.3 }}>none</span>}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* AI Insights Tab */}
                                    {modalTab === 'insights' && (
                                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            <div className="sources-insights-grid">
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    <div className="sources-insight-card">
                                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                            <Brain size={14} color="var(--primary-color)" /> Dataset Summary Analyzer
                                                        </h4>
                                                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                                                            {selectedDetails.ai_insights.summary || 'Summary insights loading…'}
                                                        </p>
                                                    </div>
                                                    <div className="sources-insight-card">
                                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                            <AlertCircle size={14} color="#f59e0b" /> Missing Values &amp; Null Analysis
                                                        </h4>
                                                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                                                            {selectedDetails.ai_insights.missing_value_analysis || 'Analysing column null completeness…'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="sources-quality-meter-card">
                                                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Overall Quality Score</span>
                                                    <div className="sources-radial-container">
                                                        <div className="sources-radial-pulse" />
                                                        <span className="sources-radial-score">{selectedDetails.ai_insights.quality_score}%</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary-color)' }}>AI Ingestion Audit</span>
                                                </div>
                                            </div>

                                            <div className="sources-insights-row-grid">
                                                <div>
                                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        <CheckCircle2 size={15} color="#10b981" /> AI Preprocessing Suggestions
                                                    </h4>
                                                    <ul className="sources-list-bullet">
                                                        {(selectedDetails.ai_insights.preprocessing_suggestions || []).map((sug, idx) => (
                                                            <li key={idx} className="sources-bullet-item">
                                                                <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{idx + 1}.</span>
                                                                <span>{sug}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        <ShieldAlert size={15} color="#ef4444" /> Anomalies &amp; Schema Warnings
                                                    </h4>
                                                    <ul className="sources-list-bullet">
                                                        {(selectedDetails.ai_insights.anomaly_warnings || []).map((warn, idx) => (
                                                            <li key={idx} className="sources-bullet-item anomaly">
                                                                <span style={{ color: '#ef4444' }}>•</span>
                                                                <span>{warn}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Share Modal ── */}
            {sharingDatasetId && (
                <ShareModal
                    isOpen={isShareModalOpen}
                    onClose={() => { setIsShareModalOpen(false); setSharingDatasetId(null); }}
                    datasetId={sharingDatasetId}
                    datasetName={sharingDatasetName}
                    onSaveCallback={fetchDatasets}
                />
            )}

            {/* ── Rename Modal ── */}
            {renamingDatasetId && (
                <Modal
                    isOpen={!!renamingDatasetId}
                    onClose={() => { setRenamingDatasetId(null); setRenamingDatasetName(''); }}
                    title="Rename Dataset"
                    maxWidth="400px"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Dataset Name</label>
                            <Input
                                value={renamingDatasetName}
                                onChange={(e) => setRenamingDatasetName(e.target.value)}
                                placeholder="Enter new dataset name..."
                                disabled={renamingLoading}
                                style={{ height: '38px', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <Button
                                variant="outline"
                                onClick={() => { setRenamingDatasetId(null); setRenamingDatasetName(''); }}
                                disabled={renamingLoading}
                                style={{ height: '36px' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleRenameDataset}
                                disabled={renamingLoading || !renamingDatasetName.trim()}
                                style={{ height: '36px' }}
                            >
                                {renamingLoading ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" style={{ marginRight: '0.5rem' }} />
                                        Renaming...
                                    </>
                                ) : 'Save'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}


        </div>
    );
}

/* ── Client Side Permission Check Helpers ── */
const canEdit = (dataset: Dataset, currentUser: AuthUser | null): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    if (dataset.ownerId === currentUser.id) return true;
    try {
        const shared = JSON.parse(dataset.sharedWith);
        if (Array.isArray(shared)) {
            const userShare = shared.find((s: any) => s.userId === currentUser.id);
            if (userShare) {
                return ['editor', 'manager', 'owner'].includes(userShare.permission);
            }
        }
    } catch { }
    return false;
};

const canShare = (dataset: Dataset, currentUser: AuthUser | null): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    if (dataset.ownerId === currentUser.id) return true;
    try {
        const shared = JSON.parse(dataset.sharedWith);
        if (Array.isArray(shared)) {
            const userShare = shared.find((s: any) => s.userId === currentUser.id);
            if (userShare) {
                return ['manager', 'owner'].includes(userShare.permission);
            }
        }
    } catch { }
    return false;
};

const canDelete = (dataset: Dataset, currentUser: AuthUser | null): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    if (dataset.ownerId === currentUser.id) return true;
    return false;
};

/* ══════════════════════════════════════════════════════════ */
/* DatasetDropdown — extracted to avoid repetition           */
/* ══════════════════════════════════════════════════════════ */

function DatasetDropdown({ dataset, onView, onShare, onRename, onDelete, alignUpward = false, currentUser }: {
    dataset: Dataset;
    onView: (tab: string) => void;
    onShare: () => void;
    onRename: () => void;
    onDelete: () => void;
    alignUpward?: boolean;
    currentUser: AuthUser | null;
}) {
    const editAllowed = canEdit(dataset, currentUser);
    const shareAllowed = canShare(dataset, currentUser);
    const deleteAllowed = canDelete(dataset, currentUser);

    return (
        <div className={`actions-dropdown-menu${alignUpward ? ' upward' : ''}`}>
            <button className="actions-dropdown-item" onClick={() => onView('preview')}><Eye size={13} /> View Preview</button>
            {shareAllowed && <button className="actions-dropdown-item" onClick={onShare}><Share2 size={13} /> Share Dataset</button>}
            {editAllowed && <button className="actions-dropdown-item" onClick={onRename}><Edit3 size={13} /> Rename Dataset</button>}
            {deleteAllowed && (
                <>
                    <div style={{ height: '1px', background: 'var(--border-color)', margin: '2px 0' }} />
                    <button className="actions-dropdown-item delete" onClick={onDelete}><Trash2 size={13} /> Delete Dataset</button>
                </>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════ */
/* SchemaMappingWizard                                        */
/* ══════════════════════════════════════════════════════════ */

interface SchemaMappingWizardProps {
    details: DatasetDetails;
    onCancel: () => void;
    onSave: (mappedSchema: any[], evolutionPolicy: string) => Promise<void>;
    isSaving: boolean;
    enforcementMode: EnforcementMode;
    setEnforcementMode: (mode: EnforcementMode) => void;
}

function SchemaMappingWizard({ details, onCancel, onSave, isSaving, enforcementMode, setEnforcementMode }: SchemaMappingWizardProps) {
    const [fields, setFields] = useState<any[]>([]);

    useEffect(() => {
        if (details.schema) {
            setFields(details.schema.map((f) => ({
                name: f.name,
                targetName: f.name,
                type: f.type || 'string',
                required: f.null_percentage === 0,
                enabled: true,
                null_percentage: f.null_percentage,
                sample_values: f.sample_values || [],
            })));
        }
    }, [details]);

    const handleFieldChange = (index: number, key: string, value: any) =>
        setFields((prev) => prev.map((f, idx) => (idx === index ? { ...f, [key]: value } : f)));

    return (
        <div style={{ background: 'var(--bg-color)', border: '1px solid var(--primary-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                        <Sparkles size={16} color="var(--primary-color)" />
                        Ingestion Mapping Wizard: {details.dataset.name}
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                        Customise column names, target data types, null conditions and toggles before committing.
                    </p>
                </div>
                <Button variant="outline" onClick={onCancel} disabled={isSaving} style={{ height: '30px', width: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <X size={14} />
                </Button>
            </div>

            <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>Field Customisation Mapping</h3>
                        <div className="sources-preview-table-wrapper">
                            <table className="sources-preview-table">
                                <thead>
                                    <tr>
                                        <th>Source field</th>
                                        <th>Target Column Name</th>
                                        <th>Target Data Type</th>
                                        <th>Required constraint</th>
                                        <th style={{ textAlign: 'center' }}>Active</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fields.map((field, idx) => (
                                        <tr key={idx} style={{ opacity: field.enabled ? 1 : 0.4 }}>
                                            <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{field.name}</td>
                                            <td>
                                                <Input
                                                    value={field.targetName}
                                                    onChange={(e) => handleFieldChange(idx, 'targetName', e.target.value)}
                                                    disabled={!field.enabled}
                                                    style={{ height: '30px', fontSize: '0.75rem', fontFamily: 'monospace', width: '170px' }}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    value={field.type}
                                                    onChange={(e) => handleFieldChange(idx, 'type', e.target.value)}
                                                    disabled={!field.enabled}
                                                    style={{ height: '30px', fontSize: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-color)', color: 'var(--text-primary)', padding: '0 0.5rem', width: '120px' }}
                                                >
                                                    <option value="string">STRING</option>
                                                    <option value="integer">INTEGER</option>
                                                    <option value="float">FLOAT</option>
                                                    <option value="date">DATE</option>
                                                    <option value="boolean">BOOLEAN</option>
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    value={field.required ? 'required' : 'nullable'}
                                                    onChange={(e) => handleFieldChange(idx, 'required', e.target.value === 'required')}
                                                    disabled={!field.enabled}
                                                    style={{ height: '30px', fontSize: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-color)', color: 'var(--text-primary)', padding: '0 0.5rem', width: '110px' }}
                                                >
                                                    <option value="nullable">NULLABLE</option>
                                                    <option value="required">REQUIRED</option>
                                                </select>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={field.enabled}
                                                    onChange={(e) => handleFieldChange(idx, 'enabled', e.target.checked)}
                                                    style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <Button variant="outline" onClick={onCancel} disabled={isSaving} style={{ display: 'flex', gap: '0.375rem', color: 'var(--danger-color)' }}>
                            <Trash2 size={13} /> Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                const mapped = fields
                                    .filter((f) => f.enabled)
                                    .map((f) => ({ name: f.targetName || f.name, type: f.type, required: f.required, description: `Mapped target column for '${f.name}'` }));
                                onSave(mapped, enforcementMode);
                            }}
                            disabled={isSaving || fields.filter((f) => f.enabled).length === 0}
                            style={{ display: 'flex', gap: '0.375rem' }}
                        >
                            {isSaving ? <><Loader2 size={13} className="animate-spin" /> Ingesting…</> : <><CheckCircle2 size={13} /> Commit &amp; Ingest Dataset</>}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}