'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
    ShieldCheck,
    ShieldAlert,
    Shield,
    Sparkles,
    CheckCircle2,
    Info,
    ChevronDown,
    Trash2,
    Eye,
    RefreshCw,
    Upload,
    FileSpreadsheet,
    Globe,
    Plus,
    Table,
    ArrowRight,
    X,
    User,
    Brain,
    Link2
} from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/components/providers/AuthProvider';
import * as XLSX from 'xlsx';
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
    createdAt: string;
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
        color: 'rgba(14, 165, 233, 0.08)',
        iconColor: '#0ea5e9',
        description: 'Connect to standard relational database streams'
    },
    {
        id: 'mongo',
        name: 'MongoDB',
        type: 'NoSQL DB',
        icon: FileJson,
        color: 'rgba(16, 185, 129, 0.08)',
        iconColor: '#10b981',
        description: 'Pull document schema collections automatically'
    },
    {
        id: 'api',
        name: 'REST API',
        type: 'HTTP Webhook',
        icon: Share2,
        color: 'rgba(139, 92, 246, 0.08)',
        iconColor: '#8b5cf6',
        description: 'Synchronize REST APIs and webhook payloads'
    },
];

/* ─── Client Schema Inference ──────────────────────────── */

function inferSchema(data: Record<string, any>[]): any[] {
    if (!data.length) return [];
    const first = data[0];
    return Object.keys(first).map(key => {
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

    // Connector Configuration
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

    // ── Fetch active connected datasets ──────────────────────
    const fetchDatasets = useCallback(async () => {
        setLoadingList(true);
        try {
            const res = await apiClient.get('/data/datasets');
            if (Array.isArray(res)) {
                const mapped = res.map((d: any) => {
                    let rowsCount = 0;
                    let colsCount = 0;
                    try {
                        const parsedData = JSON.parse(d.rawData);
                        if (Array.isArray(parsedData)) rowsCount = parsedData.length;
                    } catch { /* ignore */ }
                    try {
                        const parsedSchema = JSON.parse(d.inferredSchema);
                        if (Array.isArray(parsedSchema)) colsCount = parsedSchema.length;
                    } catch { /* ignore */ }

                    return {
                        id: d.id,
                        name: d.name,
                        source: d.source || 'file',
                        type: d.source || 'file',
                        rows: rowsCount,
                        columns: colsCount,
                        quality: d.quality ?? 95,
                        status: d.status ? d.status.toLowerCase() : 'ingested',
                        owner: d.owner?.role ? getRoleDisplayName(d.owner.role) : (d.owner?.name || 'System'),
                        createdAt: d.createdAt
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

    useEffect(() => {
        fetchDatasets();
    }, [fetchDatasets]);

    const updateConfig = (key: keyof ConnectorConfig, value: string) => {
        setConnectorConfig(prev => ({ ...prev, [key]: value }));
    };

    // ── Load Dataset detailed profile ────────────────────────
    const handleOpenDetails = async (datasetId: string, tab: string = 'preview') => {
        setModalTab(tab);
        setLoadingDetails(true);
        setSelectedDetails(null);
        try {
            const res = await apiClient.get(`/data/datasets/${datasetId}`);
            if (res?.success && res?.data) {
                setSelectedDetails(res.data);
            } else {
                showToast('Failed to load dataset details.', 'error');
            }
        } catch {
            showToast('Failed to fetch dataset details from backend.', 'error');
        } finally {
            setLoadingDetails(false);
        }
    };

    // ── Delete active dataset ────────────────────────────────
    const handleDelete = async (datasetId: string) => {
        setDeletingId(datasetId);
        setConfirmDeleteId(null);
        try {
            const res = await apiClient.delete(`/data/datasets/${datasetId}`);
            if (res?.success) {
                showToast('Dataset deleted successfully.', 'success');
                setDatasets(prev => prev.filter(d => d.id !== datasetId));
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

    // ── File upload parser & map wizard bootstrap ───────────
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
                const lines = text.split('\n').filter(l => l.trim().length > 0);
                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                jsonData = lines.slice(1).map(line => {
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
                    createdAt: new Date().toISOString()
                },
                schema: fields.map(f => ({
                    name: f.name,
                    type: f.type,
                    null_percentage: 0,
                    sample_values: jsonData.slice(0, 3).map(r => String(r[f.name] ?? ''))
                })),
                preview_columns: fields.map(f => f.name),
                preview_rows: jsonData.slice(0, 10).map(row => fields.map(f => row[f.name])),
                ai_insights: {
                    summary: '',
                    quality_score: 100,
                    missing_value_analysis: '',
                    preprocessing_suggestions: [],
                    anomaly_warnings: []
                }
            });

            setParsedFileData(jsonData);
            setUploadProgress(100);
            showToast(`"${file.name}" uploaded and parsed. Ready to configure mapping.`, 'success');
        } catch (err: any) {
            showToast(err.message || 'File analysis failed. Check formatting.', 'error');
            setUploadProgress(0);
        } finally {
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
            }, 1000);
        }
    };

    // ── Save custom Schema & Ingest ──────────────────────────
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
                if (res?.contract?.id) {
                    localStorage.setItem('dcs_selected_contract_id', res.contract.id);
                }
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

    // ── Connection test ──────────────────────────────────────
    const handleTestConnection = async () => {
        if (activeConnector === 'postgres') {
            if (!connectorConfig.pgHost || !connectorConfig.pgDatabase || !connectorConfig.pgUsername) {
                showToast('PostgreSQL host, database, and username are required.', 'error'); return;
            }
        } else if (activeConnector === 'mongo') {
            if (!connectorConfig.mongoUri) {
                showToast('MongoDB connection URI is required.', 'error'); return;
            }
        } else if (activeConnector === 'api') {
            if (!connectorConfig.apiUrl) {
                showToast('API Endpoint URL is required.', 'error'); return;
            }
        }

        setConnectionStatus('testing');
        setConnectionMessage('');
        setConnectionMeta(null);

        try {
            let configPayload: any = {};
            if (activeConnector === 'postgres') {
                configPayload = {
                    host: connectorConfig.pgHost,
                    port: parseInt(connectorConfig.pgPort || '5432') || 5432,
                    database: connectorConfig.pgDatabase,
                    username: connectorConfig.pgUsername,
                    password: connectorConfig.pgPassword,
                };
            } else if (activeConnector === 'mongo') {
                configPayload = {
                    connectionUri: connectorConfig.mongoUri,
                    database: connectorConfig.mongoDatabase,
                };
            } else if (activeConnector === 'api') {
                configPayload = {
                    url: connectorConfig.apiUrl,
                    method: connectorConfig.apiMethod || 'GET',
                    headers: connectorConfig.apiHeaders,
                };
            }

            const res = await apiClient.post('/data/connectors/test', {
                connectorType: activeConnector,
                config: configPayload,
            });

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

    // ── Pull and ingest ──────────────────────────────────────
    const handleImportConnector = async () => {
        setImporting(true);
        try {
            let configPayload: any = {};
            let sourceName = connectorConfig.pipelineName || 'Connector Stream';

            if (activeConnector === 'postgres') {
                const table = connectorConfig.pgTable || connectionMeta?.tables?.[0] || 'users';
                configPayload = {
                    host: connectorConfig.pgHost,
                    port: parseInt(connectorConfig.pgPort || '5432') || 5432,
                    database: connectorConfig.pgDatabase,
                    username: connectorConfig.pgUsername,
                    password: connectorConfig.pgPassword,
                    table,
                };
                sourceName = connectorConfig.pipelineName || `${connectorConfig.pgDatabase}.${table}`;
            } else if (activeConnector === 'mongo') {
                const coll = connectorConfig.mongoCollection || connectionMeta?.collections?.[0] || 'users';
                configPayload = {
                    connectionUri: connectorConfig.mongoUri,
                    database: connectorConfig.mongoDatabase,
                    collection: coll,
                };
                sourceName = connectorConfig.pipelineName || `${connectorConfig.mongoDatabase || 'db'}.${coll}`;
            } else if (activeConnector === 'api') {
                configPayload = {
                    url: connectorConfig.apiUrl,
                    method: connectorConfig.apiMethod || 'GET',
                    headers: connectorConfig.apiHeaders,
                    body: connectorConfig.apiBody,
                };
                try { sourceName = connectorConfig.pipelineName || new URL(connectorConfig.apiUrl || '').hostname; } catch { /* ignore */ }
            }

            const res = await apiClient.post('/data/connectors/pull', {
                connectorType: activeConnector,
                config: configPayload,
                pipelineName: sourceName,
                enforcementMode,
            });

            if (res?.dataset) {
                showToast(`Connector "${sourceName}" pulled and dataset validated!`, 'success');
                setActiveConnector(null);
                setConnectionStatus('idle');
                setConnectionMessage('');
                setConnectionMeta(null);
                setConnectorConfig({ pgPort: '5432', apiMethod: 'GET' });
                fetchDatasets();

                // Open validation details modal
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

    return (
        <div className="sources-hub-container">
            {/* Header section */}
            <div className="sources-hub-header">
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Data Source Hub</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
                        Connect to third-party databases, upload files, customize schemas mapping, and review AI validation metrics.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchDatasets} disabled={loadingList} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <RefreshCw className={loadingList ? 'animate-spin' : ''} size={14} />
                    Refresh
                </Button>
            </div>

            {/* Ingestion Wizard / Form Panel (Top Section) */}
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
            ) : activeConnector ? (
                <Card className="animate-fade-in" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                        <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Database size={18} color="var(--primary-color)" />
                            Configure {CONNECTORS.find(c => c.id === activeConnector)?.name} Connection
                        </h2>
                        <Button variant={undefined} onClick={() => { setActiveConnector(null); setConnectionStatus('idle'); setConnectionMessage(''); setConnectionMeta(null); }} style={{ height: '32px', width: '32px', borderRadius: '50%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <X size={16} />
                        </Button>
                    </div>
                    <CardContent style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '560px' }}>
                            <Input
                                label="Pipeline / Connection Name *"
                                placeholder="e.g., Enterprise Billing Database"
                                value={connectorConfig.pipelineName || ''}
                                onChange={e => updateConfig('pipelineName', e.target.value)}
                            />

                            {activeConnector === 'postgres' && (
                                <>
                                    <div className="connector-form-grid">
                                        <Input label="Database Host *" placeholder="localhost or db.company.com" value={connectorConfig.pgHost || ''} onChange={e => updateConfig('pgHost', e.target.value)} />
                                        <Input label="Port" placeholder="5432" value={connectorConfig.pgPort || ''} onChange={e => updateConfig('pgPort', e.target.value)} />
                                    </div>
                                    <Input label="Database Name *" placeholder="sales_records" value={connectorConfig.pgDatabase || ''} onChange={e => updateConfig('pgDatabase', e.target.value)} />
                                    <div className="connector-form-grid">
                                        <Input label="Username *" placeholder="postgres" value={connectorConfig.pgUsername || ''} onChange={e => updateConfig('pgUsername', e.target.value)} />
                                        <Input label="Password" type="password" placeholder="••••••••" value={connectorConfig.pgPassword || ''} onChange={e => updateConfig('pgPassword', e.target.value)} />
                                    </div>
                                    {connectionStatus === 'success' && connectionMeta?.tables && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Table to Ingest *</label>
                                            <select
                                                className="input-field"
                                                style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '0 0.75rem', background: 'var(--bg-color)', fontSize: '0.875rem' }}
                                                value={connectorConfig.pgTable || ''}
                                                onChange={e => updateConfig('pgTable', e.target.value)}
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
                                    <Input label="MongoDB Connection URI *" placeholder="mongodb://admin:pass@localhost:27017" value={connectorConfig.mongoUri || ''} onChange={e => updateConfig('mongoUri', e.target.value)} />
                                    <Input label="Database Name" placeholder="production_logs" value={connectorConfig.mongoDatabase || ''} onChange={e => updateConfig('mongoDatabase', e.target.value)} />
                                    {connectionStatus === 'success' && connectionMeta?.collections && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Collection to Ingest *</label>
                                            <select
                                                className="input-field"
                                                style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '0 0.75rem', background: 'var(--bg-color)', fontSize: '0.875rem' }}
                                                value={connectorConfig.mongoCollection || ''}
                                                onChange={e => updateConfig('mongoCollection', e.target.value)}
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
                                        <div style={{ width: '100px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>Method</label>
                                            <select
                                                className="input-field"
                                                style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '0 0.5rem', background: 'var(--bg-color)', fontSize: '0.875rem' }}
                                                value={connectorConfig.apiMethod || 'GET'}
                                                onChange={e => updateConfig('apiMethod', e.target.value)}
                                            >
                                                <option>GET</option>
                                                <option>POST</option>
                                            </select>
                                        </div>
                                        <Input label="API Endpoint URL *" placeholder="https://api.company.com/v1/metrics" value={connectorConfig.apiUrl || ''} onChange={e => updateConfig('apiUrl', e.target.value)} style={{ flex: 1 }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>Custom HTTP Headers (JSON Object, optional)</label>
                                        <textarea
                                            className="input-field connector-textarea"
                                            placeholder={'{\n  "Authorization": "Bearer token_secret",\n  "Accept": "application/json"\n}'}
                                            value={connectorConfig.apiHeaders || ''}
                                            onChange={e => updateConfig('apiHeaders', e.target.value)}
                                            rows={3}
                                            style={{ width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', padding: '0.5rem 0.75rem', background: 'var(--bg-color)' }}
                                        />
                                    </div>
                                    <div className="connector-api-hint">
                                        <AlertCircle size={14} />
                                        <span>Tip: Try <code>https://jsonplaceholder.typicode.com/users</code> for an instant mock data API test.</span>
                                    </div>
                                </>
                            )}

                            {/* Enforcement Options for Pull */}
                            <div className="enforcement-selector" style={{ marginTop: '0.5rem' }}>
                                <div className="enforcement-selector-label">
                                    <Shield size={16} color="var(--primary-color)" />
                                    <strong>Enforcement Policy Mode</strong>
                                </div>
                                <div className="enforcement-options">
                                    {([
                                        { value: 'strict', label: 'Strict Ingestion', desc: 'Reject invalid rows - only store fields that pass quality checks.', icon: '🔒' },
                                        { value: 'warning', label: 'Warning logs', desc: 'Ingest all records, but tag schema issues and trigger alerts.', icon: '⚠️' },
                                        { value: 'monitor', label: 'Silent Monitor', desc: 'Log schema profiles silently. Zero downstream interference.', icon: '👁️' },
                                    ] as const).map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`enforcement-option ${enforcementMode === opt.value ? 'selected' : ''}`}
                                            onClick={() => setEnforcementMode(opt.value)}
                                            type="button"
                                        >
                                            <span className="enforcement-option-icon">{opt.icon}</span>
                                            <div className="enforcement-option-content">
                                                <div className="enforcement-option-label">{opt.label}</div>
                                                <div className="enforcement-option-desc">{opt.desc}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Test & Action Row */}
                            <div className="connector-test-row" style={{ paddingTop: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <Button onClick={handleTestConnection} disabled={connectionStatus === 'testing'} variant="outline">
                                    {connectionStatus === 'testing' ? <><Loader2 size={14} className="animate-spin" /> Testing...</> :
                                        connectionStatus === 'success' ? <><CheckCircle size={14} color="var(--success-color)" /> Connected</> : 'Verify Connection'}
                                </Button>

                                <Button onClick={handleImportConnector} disabled={connectionStatus !== 'success' || importing}>
                                    {importing ? <><Loader2 size={14} className="animate-spin" /> Synchronizing...</> : <><ArrowRight size={14} /> Pull & Ingest Data</>}
                                </Button>

                                {connectionStatus === 'success' && (
                                    <div className="connector-status connector-status--success">
                                        <CheckCircle size={14} /> Connection active!
                                    </div>
                                )}
                                {connectionStatus === 'error' && (
                                    <div className="connector-status connector-status--error">
                                        <XCircle size={14} /> {connectionMessage || 'Connection failed.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                /* Primary Upload and Connect Section */
                <div className="sources-grid-layout">
                    {/* File Dropzone */}
                    <Card style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column' }}>
                        <CardHeader style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: '1.25rem 1.5rem' }}>
                            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Upload size={18} color="var(--primary-color)" />
                                Ingest Schema Files
                            </h2>
                        </CardHeader>
                        <CardContent style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            {isUploading ? (
                                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                                    <Loader2 className="animate-spin" size={36} color="var(--primary-color)" style={{ margin: '0 auto 1rem' }} />
                                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Parsing & Analysing File Structure...</div>
                                    <div style={{ height: '6px', width: '220px', background: 'var(--border-color)', borderRadius: '3px', margin: '0 auto 0.5rem', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--primary-color)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{uploadProgress}% processed</span>
                                </div>
                            ) : (
                                <FileDropZone onFileSelect={handleFileUpload} />
                            )}
                        </CardContent>
                    </Card>

                    {/* Third Party Connectors Grid */}
                    <Card style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                        <CardHeader style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: '1.25rem 1.5rem' }}>
                            <h2 style={{ fontSize: '1.0625rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Globe size={18} color="var(--primary-color)" />
                                Connect Third-Party Warehouses
                            </h2>
                        </CardHeader>
                        <CardContent style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {CONNECTORS.map(connector => {
                                    const Icon = connector.icon;
                                    return (
                                        <div
                                            key={connector.id}
                                            onClick={() => {
                                                setActiveConnector(connector.id);
                                                setConnectorConfig({ pgPort: '5432', apiMethod: 'GET' });
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: 'var(--radius-md)',
                                                padding: '1rem 1.25rem',
                                                cursor: 'pointer',
                                                background: 'var(--bg-color)',
                                                transition: 'all 0.2s ease'
                                            }}
                                            className="sources-item-card"
                                        >
                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: connector.color, color: connector.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Icon size={20} />
                                                </div>
                                                <div>
                                                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{connector.name}</h3>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{connector.description}</span>
                                                </div>
                                            </div>
                                            <Plus size={16} color="var(--text-secondary)" />
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Connected Data Sources List (Bottom Section) */}
            <div className="sources-list-section">
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '1rem 0 0', color: 'var(--text-primary)' }}>Connected Data Sources</h2>

                {/* Delete confirmation banner */}
                {confirmDeleteId && (
                    <div className="sources-delete-banner">
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <AlertCircle size={16} />
                            <span>Are you sure you want to permanently delete this dataset? This operation cannot be undone.</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer', height: '28px', color: 'var(--text-primary)' }}>Cancel</Button>
                            <Button variant="danger" onClick={() => handleDelete(confirmDeleteId)} style={{ fontSize: '0.75rem', padding: '4px 8px', cursor: 'pointer', height: '28px' }}>Delete</Button>
                        </div>
                    </div>
                )}

                {loadingList ? (
                    <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem', textAlign: 'center' }}>
                        <Loader2 className="animate-spin" size={32} color="var(--primary-color)" style={{ marginBottom: '0.75rem' }} />
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Loading connected data sources...</span>
                    </Card>
                ) : datasets.length === 0 ? (
                    <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', textAlign: 'center', border: '1px dashed var(--border-color)' }}>
                        <Database size={40} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.4 }} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>No Data Sources Found</h3>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '340px', margin: '0.5rem auto 0', fontSize: '0.8125rem' }}>
                            Configure a database connector or drag and drop a schema file in the tools above to ingest your first dataset.
                        </p>
                    </Card>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {datasets.map(dataset => (
                            <div
                                key={dataset.id}
                                className={`sources-item-card ${selectedDetails?.dataset?.id === dataset.id ? 'selected' : ''}`}
                                onClick={() => handleOpenDetails(dataset.id, 'preview')}
                            >
                                <div className="sources-item-content">
                                    <div className="sources-info-group">
                                        <div className="sources-avatar-icon">
                                            {dataset.source === 'postgres' || dataset.source === 'mysql' ? <Database size={20} /> :
                                             dataset.source === 'mongo' ? <FileJson size={20} /> :
                                             dataset.source === 'api' ? <Share2 size={20} /> : <FileSpreadsheet size={20} />}
                                        </div>
                                        <div>
                                             <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{dataset.name}</h3>
                                             <div className="sources-metadata">
                                                 <span style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.6875rem', letterSpacing: '0.05em' }}>{dataset.source}</span>
                                                 <span>•</span>
                                                 <span>{dataset.rows.toLocaleString()} rows</span>
                                                 <span>•</span>
                                                 <span>{dataset.columns} columns</span>
                                                 <span>•</span>
                                                 <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><User size={12} /> {dataset.owner}</span>
                                             </div>
                                        </div>
                                    </div>

                                    <div className="sources-actions-group" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                         <span className={`sources-status-pill ${dataset.status}`}>
                                             {dataset.status.replace(/_/g, ' ')}
                                         </span>

                                         <Button
                                             variant="outline"
                                             onClick={() => handleOpenDetails(dataset.id, 'preview')}
                                             style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', fontSize: '0.75rem', height: '32px', cursor: 'pointer' }}
                                         >
                                             <Eye size={13} />
                                             Preview
                                         </Button>

                                         <Button
                                             variant="outline"
                                             onClick={() => handleOpenDetails(dataset.id, 'schema')}
                                             style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', fontSize: '0.75rem', height: '32px', cursor: 'pointer' }}
                                         >
                                             <Table size={13} />
                                             Schema &amp; AI
                                         </Button>

                                         <Button
                                             variant="danger"
                                             onClick={() => setConfirmDeleteId(dataset.id)}
                                             disabled={deletingId === dataset.id}
                                             style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', fontSize: '0.75rem', height: '32px', cursor: 'pointer', padding: '0 0.625rem' }}
                                         >
                                             {deletingId === dataset.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                             Delete
                                         </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Profile & Detailed Analyzer Modal Popup */}
            {selectedDetails && !loadingDetails && (
                <div className="sources-modal-overlay" onClick={() => setSelectedDetails(null)}>
                    <div className="sources-modal-container" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="sources-modal-header">
                            <div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                                    <Database size={18} color="var(--primary-color)" />
                                    {selectedDetails.dataset.name} — Data Profile
                                </h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                                    {selectedDetails.dataset.rows.toLocaleString()} rows • {selectedDetails.dataset.columns} columns • Connected {new Date(selectedDetails.dataset.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <Button variant="outline" onClick={() => setSelectedDetails(null)} style={{ height: '32px', width: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                                <X size={16} />
                            </Button>
                        </div>

                        {/* Modal Body */}
                        <div className="sources-modal-body">
                            {/* Tabs Navigation */}
                            <div className="sources-modal-tabs">
                                <button className={`sources-modal-tab ${modalTab === 'preview' ? 'active' : ''}`} onClick={() => setModalTab('preview')}>Dataset Preview</button>
                                <button className={`sources-modal-tab ${modalTab === 'schema' ? 'active' : ''}`} onClick={() => setModalTab('schema')}>Schema Specification</button>
                                <button className={`sources-modal-tab ${modalTab === 'insights' ? 'active' : ''}`} onClick={() => setModalTab('insights')}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <Sparkles size={14} color="var(--primary-color)" />
                                        AI Insights &amp; Health
                                    </div>
                                </button>
                            </div>

                            {/* Tab Content: Preview */}
                            {modalTab === 'preview' && (
                                <div className="animate-fade-in">
                                    {!selectedDetails.preview_columns || selectedDetails.preview_columns.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                            No preview records available for this data source.
                                        </div>
                                    ) : (
                                        <div className="sources-preview-table-wrapper">
                                            <table className="sources-preview-table">
                                                <thead>
                                                    <tr>
                                                        {selectedDetails.preview_columns.map(col => (
                                                            <th key={col}>{col}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedDetails.preview_rows.map((row, rIdx) => (
                                                        <tr key={rIdx}>
                                                            {row.map((cell, cIdx) => (
                                                                <td key={cIdx}>
                                                                    {cell === null || cell === undefined ? (
                                                                        <span style={{ fontStyle: 'italic', opacity: 0.35 }}>null</span>
                                                                    ) : formatStr(cell)}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tab Content: Schema */}
                            {modalTab === 'schema' && (
                                <div className="animate-fade-in">
                                    {!selectedDetails.schema || selectedDetails.schema.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                            No schema columns details found for this data source.
                                        </div>
                                    ) : (
                                        <div className="sources-preview-table-wrapper">
                                            <table className="sources-preview-table">
                                                <thead style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                                                    <tr>
                                                        <th style={{ padding: '0.75rem 1rem' }}>Field / Column Name</th>
                                                        <th style={{ padding: '0.75rem 1rem' }}>Data Type</th>
                                                        <th style={{ padding: '0.75rem 1rem' }}>Nullability %</th>
                                                        <th style={{ padding: '0.75rem 1rem' }}>Inferred Samples</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedDetails.schema.map((field, idx) => (
                                                        <tr key={idx}>
                                                            <td style={{ fontWeight: 600, padding: '0.625rem 1rem' }}>{field.name}</td>
                                                            <td style={{ padding: '0.625rem 1rem' }}>
                                                                <span style={{ fontSize: '0.6875rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary-color)', padding: '0.125rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                                                                    {field.type}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.625rem 1rem' }}>{field.null_percentage}%</td>
                                                            <td style={{ color: 'var(--text-secondary)', padding: '0.625rem 1rem' }}>
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

                            {/* Tab Content: AI Insights & Data Quality */}
                            {modalTab === 'insights' && (
                                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {/* Top Row: Info cards & Quality Meter */}
                                    <div className="sources-insights-grid">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div className="sources-insight-card">
                                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    <Brain size={15} color="var(--primary-color)" />
                                                    Dataset Summary Analyzer
                                                </h4>
                                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                                                    {selectedDetails.ai_insights.summary || 'Summary insights loading...'}
                                                </p>
                                            </div>

                                            <div className="sources-insight-card">
                                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    <AlertCircle size={15} color="var(--warning-color)" />
                                                    Missing Values &amp; Null Analysis
                                                </h4>
                                                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                                                    {selectedDetails.ai_insights.missing_value_analysis || 'Analyzing column null completeness values...'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="sources-quality-meter-card">
                                            <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Overall Quality Score</span>
                                            <div className="sources-radial-container">
                                                <div className="sources-radial-pulse" />
                                                <span className="sources-radial-score">{selectedDetails.ai_insights.quality_score}%</span>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary-color)' }}>AI Ingestion Audit</span>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Preprocessing suggestions & Warnings */}
                                    <div className="sources-insights-row-grid">
                                        <div>
                                            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                <CheckCircle2 size={16} color="var(--success-color)" />
                                                AI Preprocessing Suggestions
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
                                                <ShieldAlert size={16} color="var(--danger-color)" />
                                                Anomalies &amp; Schema Warnings
                                            </h4>
                                            <ul className="sources-list-bullet">
                                                {(selectedDetails.ai_insights.anomaly_warnings || []).map((warn, idx) => (
                                                    <li key={idx} className="sources-bullet-item anomaly">
                                                        <span style={{ color: 'var(--danger-color)' }}>•</span>
                                                        <span>{warn}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════ */
/* SchemaMappingWizard (Inline Data Customization Dialog)      */
/* ══════════════════════════════════════════════════════════ */

interface SchemaMappingWizardProps {
    details: DatasetDetails;
    onCancel: () => void;
    onSave: (mappedSchema: any[], evolutionPolicy: string) => Promise<void>;
    isSaving: boolean;
    enforcementMode: EnforcementMode;
    setEnforcementMode: (mode: EnforcementMode) => void;
}

function SchemaMappingWizard({
    details,
    onCancel,
    onSave,
    isSaving,
    enforcementMode,
    setEnforcementMode
}: SchemaMappingWizardProps) {
    const [fields, setFields] = useState<any[]>([]);

    useEffect(() => {
        if (details.schema) {
            setFields(
                details.schema.map((f) => ({
                    name: f.name,
                    targetName: f.name,
                    type: f.type || 'string',
                    required: f.null_percentage === 0,
                    enabled: true,
                    null_percentage: f.null_percentage,
                    sample_values: f.sample_values || []
                }))
            );
        }
    }, [details]);

    const handleFieldChange = (index: number, key: string, value: any) => {
        setFields(prev =>
            prev.map((f, idx) => (idx === index ? { ...f, [key]: value } : f))
        );
    };

    return (
        <Card style={{ border: '1px solid var(--primary-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                        <Sparkles size={18} className="animate-pulse" color="var(--primary-color)" />
                        Ingestion Mapping Wizard: {details.dataset.name}
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.125rem 0 0' }}>
                        Customize column names, target data types, null conditions and toggles before committing.
                    </p>
                </div>
                <Button variant="outline" onClick={onCancel} disabled={isSaving} style={{ height: '32px', width: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                    <X size={16} />
                </Button>
            </div>
            <CardContent style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Column Mapping Table */}
                    <div>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>Field Customization Mapping</h3>
                        <div className="sources-preview-table-wrapper">
                            <table className="sources-preview-table">
                                <thead>
                                    <tr>
                                        <th>Source field</th>
                                        <th>Target Column Name</th>
                                        <th>Target Data Type</th>
                                        <th>Required constraint</th>
                                        <th style={{ textAlign: 'center' }}>Active status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fields.map((field, idx) => (
                                        <tr key={idx} style={{ opacity: field.enabled ? 1 : 0.4 }}>
                                            <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{field.name}</td>
                                            <td>
                                                <Input
                                                    value={field.targetName}
                                                    onChange={e => handleFieldChange(idx, 'targetName', e.target.value)}
                                                    disabled={!field.enabled}
                                                    style={{ height: '30px', fontSize: '0.75rem', fontFamily: 'monospace', width: '180px' }}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    className="input-field"
                                                    value={field.type}
                                                    onChange={e => handleFieldChange(idx, 'type', e.target.value)}
                                                    disabled={!field.enabled}
                                                    style={{ height: '30px', fontSize: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-color)', padding: '0 0.5rem', width: '130px' }}
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
                                                    className="input-field"
                                                    value={field.required ? 'required' : 'nullable'}
                                                    onChange={e => handleFieldChange(idx, 'required', e.target.value === 'required')}
                                                    disabled={!field.enabled}
                                                    style={{ height: '30px', fontSize: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-color)', padding: '0 0.5rem', width: '110px' }}
                                                >
                                                    <option value="nullable">NULLABLE</option>
                                                    <option value="required">REQUIRED</option>
                                                </select>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={field.enabled}
                                                    onChange={e => handleFieldChange(idx, 'enabled', e.target.checked)}
                                                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Footer buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                        <Button variant="outline" onClick={onCancel} disabled={isSaving} style={{ display: 'flex', gap: '0.375rem', color: 'var(--danger-color)' }}>
                            <Trash2 size={14} />
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                const mapped = fields
                                    .filter(f => f.enabled)
                                    .map(f => ({
                                        name: f.targetName || f.name,
                                        type: f.type,
                                        required: f.required,
                                        description: `Mapped target column for '${f.name}'`
                                    }));
                                onSave(mapped, enforcementMode);
                            }}
                            disabled={isSaving || fields.filter(f => f.enabled).length === 0}
                            style={{ display: 'flex', gap: '0.375rem' }}
                        >
                            {isSaving ? (
                                <><Loader2 size={14} className="animate-spin" /> Ingesting...</>
                            ) : (
                                <><CheckCircle2 size={14} /> Commit &amp; Ingest Dataset</>
                            )}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
