'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/providers/ToastProvider';
import { apiClient } from '@/lib/apiClient';
import {
    FileCode2,
    Plus,
    Search,
    ChevronRight,
    Check,
    AlertCircle,
    Clock,
    GitBranch,
    Trash2,
    Eye,
    History,
    Sparkles,
    Code2,
    Link2,
    Type,
    Hash,
    Calendar,
    ToggleLeft,
    List,
    Sliders,
    X,
    RefreshCw,
    Play,
    CheckCircle2,
    Brain,
    SlidersHorizontal,
    Info,
    Database,
    Shield,
    Layers,
    ArrowLeft,
    CheckCircle
} from 'lucide-react';
import './data-contracts.css';

/* ─── Types ─────────────────────────────────────────────── */

interface SchemaField {
    name: string;
    type: string;
    required: boolean;
    unique?: boolean;
    description?: string;
    format?: string;       // regex format pattern
    minValue?: number;
    maxValue?: number;
    enumValues?: string[]; // allowed enums
    defaultValue?: string;
    ignored?: boolean;
}

interface ContractVersion {
    id: string;
    contractId: string;
    version: string;
    schemaDef: SchemaField[];
    changeLog: string;
    changedBy: string;
    createdAt: string;
}

interface DataContract {
    id: string;
    name: string;
    domain: string;
    version: string;
    status: string;
    enforcementMode: string;
    schemaDef: SchemaField[];
    createdAt: string;
    updatedAt: string;
    dataset?: {
        id: string;
        name: string;
        source: string;
        status: string;
        createdAt: string;
    } | null;
    sampleRecords?: Record<string, any>[];
}

interface Dataset {
    id: string;
    name: string;
    source: string;
    status: string;
    inferredSchema?: string;
    rawData?: string;
    createdAt: string;
}

interface ValidationReport {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    passRate: number;
    completeness: number;
    validity: number;
    uniqueness: number;
    overallScore: number;
    issues: {
        row: number;
        field: string;
        rule: string;
        expected: string;
        actual: string;
        severity: 'error' | 'warning';
    }[];
    summary: Record<string, number>;
}

const FIELD_TYPES = ['String', 'Integer', 'Float', 'Date', 'Boolean', 'UUID', 'Time', 'Object', 'Array'];

const TYPE_ICONS: Record<string, React.ReactNode> = {
    String: <Type size={13} />,
    Integer: <Hash size={13} />,
    Float: <Hash size={13} />,
    Date: <Calendar size={13} />,
    Boolean: <ToggleLeft size={13} />,
    UUID: <Shield size={13} />,
    Time: <Clock size={13} />,
    Object: <Layers size={13} />,
    Array: <List size={13} />,
};

/* ══════════════════════════════════════════════════════════ */
export default function DataContractsPage() {
    const [contracts, setContracts] = useState<DataContract[]>([]);
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [loadingContracts, setLoadingContracts] = useState(true);
    const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
    const [selectedContract, setSelectedContract] = useState<DataContract | null>(null);
    const [contractVersions, setContractVersions] = useState<ContractVersion[]>([]);
    const [activeTab, setActiveTab] = useState<'schema' | 'rules' | 'comparison'>('schema');

    // Modals & Drawers States
    const [showNewContractModal, setShowNewContractModal] = useState(false);
    const [showRuleConfigDrawer, setShowRuleConfigDrawer] = useState(false);
    const [ruleConfigField, setRuleConfigField] = useState<SchemaField | null>(null);
    const [ruleConfigFieldIndex, setRuleConfigFieldIndex] = useState<number | null>(null);

    // Validation State
    const [isValidating, setIsValidating] = useState(false);
    const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
    const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showValidationSelect, setShowValidationSelect] = useState(false);

    // Comparison State
    const [compVersion, setCompVersion] = useState<string>('');

    // Form states for new contract
    const [newContractName, setNewContractName] = useState('');
    const [newContractDomain, setNewContractDomain] = useState('Ingestion');
    const [newContractDatasetId, setNewContractDatasetId] = useState('');
    const [newContractVersion, setNewContractVersion] = useState('1.0.0');

    const [searchQuery, setSearchQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const { showToast } = useToast();

    /* ── API Operations ─────────────────────────────────────── */
    const fetchContracts = useCallback(async () => {
        setLoadingContracts(true);
        try {
            const data = await apiClient.get('/data/contracts');
            if (data && Array.isArray(data)) {
                // Ensure schemaDef is parsed
                const parsed = data.map((c: any) => ({
                    ...c,
                    schemaDef: typeof c.schemaDef === 'string' ? JSON.parse(c.schemaDef) : c.schemaDef
                }));
                setContracts(parsed);

                const storedId = localStorage.getItem('dcs_selected_contract_id');
                if (storedId) {
                    setSelectedContractId(storedId);
                    localStorage.removeItem('dcs_selected_contract_id');
                } else if (parsed.length > 0 && !selectedContractId) {
                    setSelectedContractId(parsed[0].id);
                }
            }
        } catch {
            showToast('Could not load contracts from backend.', 'error');
        } finally {
            setLoadingContracts(false);
        }
    }, [selectedContractId, showToast]);

    const fetchDatasets = useCallback(async () => {
        try {
            const data = await apiClient.get('/data/datasets');
            if (data && Array.isArray(data)) {
                setDatasets(data);
            }
        } catch {
            // Quiet fail
        }
    }, []);

    useEffect(() => {
        const stored = localStorage.getItem('dcs_selected_contract_id');
        if (stored) {
            setSelectedContractId(stored);
            localStorage.removeItem('dcs_selected_contract_id');
        }
        fetchContracts();
        fetchDatasets();
    }, [fetchContracts, fetchDatasets]);

    const loadContractDetails = useCallback(async (id: string) => {
        try {
            const res = await apiClient.get(`/data/contracts/${id}/detail`);
            if (res) {
                setSelectedContract(res);
                setValidationReport(null); // Reset report when swapping contracts
                
                // Fetch version history
                const versions = await apiClient.get(`/data/contracts/${id}/versions`);
                if (versions && Array.isArray(versions)) {
                    setContractVersions(versions);
                    if (versions.length > 0) {
                        setCompVersion(versions[versions.length - 1].version);
                    } else {
                        setCompVersion('');
                    }
                }
            }
        } catch {
            showToast('Failed to fetch contract specifications.', 'error');
        }
    }, [showToast]);

    useEffect(() => {
        if (selectedContractId) {
            loadContractDetails(selectedContractId);
        } else {
            setSelectedContract(null);
            setContractVersions([]);
        }
    }, [selectedContractId, loadContractDetails]);

    /* ── Save Contract Edits ────────────────────────────────── */
    const handleSaveContract = async () => {
        if (!selectedContract) return;
        setIsSaving(true);
        try {
            // Auto increment minor version on save
            const vParts = selectedContract.version.split('.').map(Number);
            if (vParts.length >= 2) {
                vParts[1] = (vParts[1] || 0) + 1;
                vParts[2] = 0;
            }
            const nextVersion = vParts.join('.') || '1.1.0';

            const res = await apiClient.patch(`/data/contracts/${selectedContract.id}`, {
                name: selectedContract.name,
                domain: selectedContract.domain,
                version: nextVersion,
                schemaDef: selectedContract.schemaDef,
                enforcementMode: selectedContract.enforcementMode,
            });

            if (res) {
                // Also create a version snapshot
                await apiClient.post(`/data/contracts/${selectedContract.id}/version`, {
                    changeLog: `Published changes to version ${nextVersion}`
                });

                showToast(`Data contract published successfully as version ${nextVersion}!`, 'success');
                
                // Refresh detail and list
                loadContractDetails(selectedContract.id);
                fetchContracts();
            } else {
                showToast('Failed to save contract changes.', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error updating contract.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    /* ── Create New Contract ────────────────────────────────── */
    const handleCreateContract = async () => {
        if (!newContractName.trim()) {
            showToast('Contract Name is required.', 'error');
            return;
        }

        setLoadingContracts(true);
        setShowNewContractModal(false);

        try {
            let fieldsPayload: SchemaField[] = [];

            // If a dataset is selected, auto-import schema fields
            if (newContractDatasetId) {
                const dataset = datasets.find(d => d.id === newContractDatasetId);
                if (dataset && dataset.inferredSchema) {
                    try {
                        const parsedInferred = JSON.parse(dataset.inferredSchema);
                        fieldsPayload = parsedInferred.map((f: any) => ({
                            name: f.name,
                            type: f.type ? (f.type.charAt(0).toUpperCase() + f.type.slice(1)) : 'String',
                            required: f.required ?? true,
                            description: f.description || `Inferred field ${f.name}`
                        }));
                    } catch {
                        // ignore parse errors and proceed empty
                    }
                }
            }

            if (fieldsPayload.length === 0) {
                // default fields if no dataset selected
                fieldsPayload = [
                    { name: 'id', type: 'UUID', required: true, description: 'Unique identifier' },
                    { name: 'name', type: 'String', required: true, description: 'Display name' },
                    { name: 'created_at', type: 'Date', required: false, description: 'Creation timestamp' }
                ];
            }

            const res = await apiClient.post('/data/contracts', {
                name: newContractName,
                domain: newContractDomain || 'Ingestion',
                version: newContractVersion || '1.0.0',
                schemaDef: fieldsPayload,
                enforcementMode: 'monitor'
            });

            if (res) {
                showToast(`Governance contract "${newContractName}" registered successfully!`, 'success');
                
                // Create an initial version snapshot
                await apiClient.post(`/data/contracts/${res.id}/version`, {
                    changeLog: `Initial bootstrap of ${newContractName}`
                });

                // Reset inputs
                setNewContractName('');
                setNewContractDomain('Ingestion');
                setNewContractDatasetId('');
                setNewContractVersion('1.0.0');

                // Refresh contracts and set active
                fetchContracts();
                setSelectedContractId(res.id);
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to create contract.', 'error');
        } finally {
            setLoadingContracts(false);
        }
    };

    /* ── Toggle Contract Status Workflow ────────────────────── */
    const handleToggleStatus = async () => {
        if (!selectedContract) return;
        try {
            const res = await apiClient.patch(`/data/contracts/${selectedContract.id}/status`, {});
            if (res) {
                showToast(`Contract specifications ${res.status === 'Active' ? 'activated' : 'deactivated'} successfully!`, 'success');
                setSelectedContract(prev => prev ? { ...prev, status: res.status } : null);
                setContracts(prev => prev.map(c => c.id === selectedContract.id ? { ...c, status: res.status } : c));
            }
        } catch {
            showToast('Failed to authorize contract spec status.', 'error');
        }
    };

    /* ── Rollback Contract Snapshot ─────────────────────────── */
    const handleRollback = async (version: string) => {
        if (!selectedContract) return;
        if (!confirm(`Are you sure you want to rollback this contract to version ${version}?`)) return;
        try {
            const res = await apiClient.post(`/data/contracts/${selectedContract.id}/rollback`, { targetVersion: version });
            if (res) {
                showToast(`Contract specifications rolled back to version ${version}!`, 'success');
                loadContractDetails(selectedContract.id);
                fetchContracts();
                setActiveTab('schema');
            }
        } catch {
            showToast('Could not execute rollback. Snapshot may be invalid.', 'error');
        }
    };

    /* ── Delete Contract Agreement ─────────────────────────── */
    const handleDeleteContract = async () => {
        if (!selectedContract) return;
        if (!confirm(`Are you sure you want to permanently delete data contract "${selectedContract.name}"? This operation cannot be undone.`)) return;
        
        try {
            const res = await apiClient.delete(`/data/contracts/${selectedContract.id}`);
            if (res) {
                showToast(`Data contract "${selectedContract.name}" deleted successfully.`, 'success');
                setSelectedContractId(null);
                setSelectedContract(null);
                fetchContracts();
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to delete contract.', 'error');
        }
    };

    /* ── Validate Dataset against Spec ─────────────────────── */
    const handleValidateDataset = async () => {
        if (!selectedContract || !selectedDatasetId) return;
        setIsValidating(true);
        setValidationReport(null);
        setShowValidationSelect(false);
        try {
            const res = await apiClient.post(`/data/contracts/${selectedContract.id}/validate-dataset`, {
                datasetId: selectedDatasetId
            });
            if (res) {
                setValidationReport(res);
                setShowReportModal(true);
                showToast('Contract validation scan completed successfully!', 'success');
            }
        } catch (err: any) {
            showToast(err.message || 'Validation runtime error occurred.', 'error');
        } finally {
            setIsValidating(false);
        }
    };

    /* ── Rule Editor Side-Drawer helper ────────────────────── */
    const openRuleConfig = (field: SchemaField, index: number) => {
        setRuleConfigField({ ...field });
        setRuleConfigFieldIndex(index);
        setShowRuleConfigDrawer(true);
    };

    const applyRuleConfig = () => {
        if (!selectedContract || ruleConfigFieldIndex === null || !ruleConfigField) return;

        const updatedFields = [...selectedContract.schemaDef];
        updatedFields[ruleConfigFieldIndex] = ruleConfigField;

        setSelectedContract({
            ...selectedContract,
            schemaDef: updatedFields
        });

        setShowRuleConfigDrawer(false);
        setRuleConfigField(null);
        setRuleConfigFieldIndex(null);
        showToast('Validation rules staged locally. Click "Publish Changes" to commit.', 'info');
    };

    /* ── AI Auto-Map Generator ──────────────────────────────── */
    const handleAiAutoMap = () => {
        if (!selectedContract) return;

        // Simulate intelligent rule inference based on field names
        const mapped = selectedContract.schemaDef.map(f => {
            const field_lower = f.name.toLowerCase();
            const copy = { ...f };

            if (field_lower.includes('email')) {
                copy.format = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
                copy.description = 'Validated email format address';
            } else if (field_lower.includes('date') || field_lower.includes('at')) {
                copy.type = 'Date';
                copy.description = 'ISO timestamp Date field';
            } else if (field_lower.includes('id') || field_lower.includes('uuid')) {
                copy.required = true;
                copy.unique = true;
                copy.description = 'Unique identification primary key';
            } else if (field_lower.includes('status')) {
                copy.enumValues = ['completed', 'pending', 'cancelled', 'refunded'];
                copy.defaultValue = 'pending';
                copy.description = 'Status lifecycle enum constraint';
            }
            return copy;
        });

        setSelectedContract({ ...selectedContract, schemaDef: mapped });
        showToast('AI analyzed schema names and auto-inferred validation rules! Review them in the rules tab.', 'success');
    };

    // Filter list by search query
    const filteredContracts = contracts.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.version.includes(searchQuery)
    );

    return (
        <div className="dc-page">
            {/* Page Header */}
            <div className="dc-page-header">
                <div>
                    <h1>Data Contract Studio</h1>
                    <p>Define structural boundaries, normalizations, and compile data governance agreements dynamically</p>
                </div>
                <Button onClick={() => setShowNewContractModal(true)} icon={<Plus size={16} />}>
                    New Contract Agreement
                </Button>
            </div>

            {/* Search Bar */}
            <div className="dc-toolbar">
                <div className="dc-search">
                    <Search className="dc-search-icon" size={14} />
                    <input
                        placeholder="Search contracts by name or version..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button variant="outline" onClick={fetchContracts} disabled={loadingContracts} icon={<RefreshCw size={14} />}>
                    Sync Connection
                </Button>
            </div>

            {/* Main Layout Workspace */}
            <div className="dcs-workspace">
                {/* Contracts Sidebar List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="dc-section-title">
                        <FileCode2 size={16} /> Connection Agreements
                    </div>

                    {loadingContracts ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            <RefreshCw className="spinner" size={24} style={{ margin: '0 auto 0.75rem' }} />
                            <p style={{ fontSize: '0.8125rem' }}>Fetching contracts...</p>
                        </div>
                    ) : filteredContracts.length === 0 ? (
                        <Card className="dc-empty" style={{ padding: '2rem 1.25rem' }}>
                            <div className="dc-empty-icon" style={{ width: 48, height: 48 }}><FileCode2 size={20} /></div>
                            <h3>No contracts found</h3>
                            <p style={{ fontSize: '0.75rem' }}>Create a new governance spec to start.</p>
                        </Card>
                    ) : (
                        filteredContracts.map(contract => (
                            <Card
                                key={contract.id}
                                className={`dcs-sidebar-card ${selectedContractId === contract.id ? 'active' : ''}`}
                                onClick={() => setSelectedContractId(contract.id)}
                            >
                                <CardContent style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <FileCode2 size={16} style={{ color: 'var(--primary-color)' }} />
                                            <div>
                                                <h4 style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>{contract.name}</h4>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>v{contract.version}</span>
                                            </div>
                                        </div>
                                        <span className={`dc-recent-badge ${contract.status === 'Active' ? 'success' : 'warning'}`}>
                                            {contract.status}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        <span>{contract.schemaDef?.length || 0} fields</span>
                                        <span>•</span>
                                        <span>Domain: {contract.domain}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Master Details Workstation */}
                <div>
                    {selectedContract ? (
                        <Card style={{ overflow: 'hidden' }}>
                            {/* Card Header section */}
                            <CardHeader style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: '1.25rem 1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                            <FileCode2 size={20} style={{ color: 'var(--primary-color)' }} />
                                            {selectedContract.name}
                                        </h2>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <span>Active Spec Version {selectedContract.version}</span>
                                            <span>•</span>
                                            <span>Enforcement: {selectedContract.enforcementMode}</span>
                                            {selectedContract.status === 'Active' ? (
                                                <span style={{ color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <CheckCircle2 size={12} /> Approved Gate
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--warning-color)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <Info size={12} /> Draft Agreement
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowValidationSelect(true)}
                                            icon={<Play size={14} />}
                                            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                                        >
                                            Validate Data
                                        </Button>

                                        <Button
                                            variant="secondary"
                                            onClick={handleToggleStatus}
                                            icon={<CheckCircle2 size={14} />}
                                            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                                        >
                                            {selectedContract.status === 'Active' ? 'Deactivate spec' : 'Approve Spec'}
                                        </Button>

                                        <Button
                                            onClick={handleSaveContract}
                                            disabled={isSaving}
                                            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                                        >
                                            {isSaving ? 'Saving...' : 'Publish vNext'}
                                        </Button>

                                        <Button
                                            variant="danger"
                                            onClick={handleDeleteContract}
                                            icon={<Trash2 size={14} />}
                                            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                                        >
                                            Delete Spec
                                        </Button>
                                    </div>
                                </div>

                                {/* Sub Tab Controls */}
                                <div className="dcs-tabs-list">
                                    {[
                                        { id: 'schema', label: 'Schema Editor', icon: Code2 },
                                        { id: 'rules', label: 'Rule Configs', icon: SlidersHorizontal },
                                        { id: 'comparison', label: 'Comparison Diff', icon: History },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`dcs-tab-trigger ${activeTab === tab.id ? 'active' : ''}`}
                                        >
                                            <tab.icon size={14} />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </CardHeader>

                            {/* Dynamic Content Body */}
                            <CardContent style={{ padding: '1.5rem' }}>
                                {/* ─ TAB 1: Schema Editor ─ */}
                                {activeTab === 'schema' && (
                                    <div
                                        className="animate-fade-in"
                                        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <Button
                                                    variant="outline"
                                                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                                                    onClick={() => {
                                                        const newF: SchemaField = {
                                                            name: `new_column_${selectedContract.schemaDef.length + 1}`,
                                                            type: 'String',
                                                            required: false,
                                                            description: 'Custom field definition'
                                                        };
                                                        setSelectedContract({
                                                            ...selectedContract,
                                                            schemaDef: [...selectedContract.schemaDef, newF]
                                                        });
                                                        showToast('Staged new schema field at the bottom.', 'info');
                                                    }}
                                                    icon={<Plus size={14} />}
                                                >
                                                    Add Field
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', color: 'var(--primary-color)', borderColor: 'rgba(99, 102, 241, 0.3)' }}
                                                    onClick={handleAiAutoMap}
                                                    icon={<Sparkles size={14} />}
                                                >
                                                    AI Rule Inference
                                                </Button>
                                            </div>
                                        </div>

                                        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                                <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                                    <tr>
                                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Field Name</th>
                                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Type</th>
                                                        <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>Required</th>
                                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Staged Validation Rules</th>
                                                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>Configure</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedContract.schemaDef.map((field, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                            <td style={{ padding: '0.5rem 0.75rem' }}>
                                                                <input
                                                                    value={field.name}
                                                                    onChange={e => {
                                                                        const cpy = [...selectedContract.schemaDef];
                                                                        cpy[idx].name = e.target.value;
                                                                        setSelectedContract({ ...selectedContract, schemaDef: cpy });
                                                                    }}
                                                                    style={{
                                                                        fontFamily: 'monospace',
                                                                        fontSize: '0.75rem',
                                                                        padding: '0.25rem 0.5rem',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid var(--border-color)',
                                                                        width: '140px'
                                                                    }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '0.5rem 0.75rem' }}>
                                                                <select
                                                                    value={field.type}
                                                                    onChange={e => {
                                                                        const cpy = [...selectedContract.schemaDef];
                                                                        cpy[idx].type = e.target.value;
                                                                        setSelectedContract({ ...selectedContract, schemaDef: cpy });
                                                                    }}
                                                                    style={{
                                                                        fontSize: '0.75rem',
                                                                        padding: '0.25rem 0.5rem',
                                                                        borderRadius: '4px',
                                                                        border: '1px solid var(--border-color)',
                                                                        background: 'var(--bg-color)',
                                                                        width: '100px'
                                                                    }}
                                                                >
                                                                    {FIELD_TYPES.map(t => (
                                                                        <option key={t} value={t}>{t.toUpperCase()}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={field.required}
                                                                    onChange={e => {
                                                                        const cpy = [...selectedContract.schemaDef];
                                                                        cpy[idx].required = e.target.checked;
                                                                        setSelectedContract({ ...selectedContract, schemaDef: cpy });
                                                                    }}
                                                                    style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                                                />
                                                            </td>
                                                            <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
                                                                {field.format || field.enumValues || field.unique ? (
                                                                    <span style={{ color: 'var(--primary-color)', fontWeight: 500 }}>
                                                                        {[
                                                                            field.required && 'Required',
                                                                            field.unique && 'Unique',
                                                                            field.format && 'Regex check',
                                                                            field.enumValues && 'Enum validation'
                                                                        ].filter(Boolean).join(', ') || 'No semantic constraints'}
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                                        No specific format rules
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                                                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                                                    <button
                                                                        onClick={() => openRuleConfig(field, idx)}
                                                                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                                                        title="Field Rules Configuration"
                                                                    >
                                                                        <Sliders size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            const cpy = selectedContract.schemaDef.filter((_, i) => i !== idx);
                                                                            setSelectedContract({ ...selectedContract, schemaDef: cpy });
                                                                            showToast(`Staged deletion of '${field.name}' field.`, 'info');
                                                                        }}
                                                                        style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-color)' }}
                                                                        title="Remove Field"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* ─ TAB 2: Custom Validation Rules Engine ─ */}
                                {activeTab === 'rules' && (
                                    <div
                                        className="animate-fade-in"
                                        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>Active Field Constraints</h3>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Click configure on any field row to adjust rules</span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                            {selectedContract.schemaDef.map((field, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        padding: '1rem',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid var(--border-color)',
                                                        background: 'var(--bg-secondary)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between',
                                                        gap: '0.75rem'
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                            <code style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)' }}>{field.name}</code>
                                                            <span className={`dc-type-badge ${field.type}`}>
                                                                {TYPE_ICONS[field.type] || <Type size={12} />}
                                                                {field.type.toUpperCase()}
                                                            </span>
                                                        </div>

                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.75rem' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <span style={{ color: 'var(--text-secondary)' }}>Required:</span>
                                                                <span style={{ fontWeight: 600 }}>{field.required ? 'Strict Yes' : 'Optional'}</span>
                                                            </div>
                                                            {field.unique && (
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-color)' }}>
                                                                    <span>Uniqueness Check:</span>
                                                                    <span style={{ fontWeight: 600 }}>Enabled</span>
                                                                </div>
                                                            )}
                                                            {field.format && (
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: 'column', gap: '0.125rem' }}>
                                                                    <span style={{ color: 'var(--text-secondary)' }}>Format Regex:</span>
                                                                    <code style={{ fontSize: '0.6875rem', background: 'var(--bg-color)', border: '1px solid var(--border-color)', padding: '2px 4px', borderRadius: '3px', wordBreak: 'break-all' }}>{field.format}</code>
                                                                </div>
                                                            )}
                                                            {field.enumValues && field.enumValues.length > 0 && (
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: 'column', gap: '0.125rem' }}>
                                                                    <span style={{ color: 'var(--text-secondary)' }}>Allowed Enums:</span>
                                                                    <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>{field.enumValues.join(', ')}</span>
                                                                </div>
                                                            )}
                                                            {field.description && (
                                                                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.25rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.25rem', color: 'var(--text-secondary)' }}>
                                                                    <span style={{ fontSize: '0.6875rem', fontStyle: 'italic' }}>{field.description}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <Button
                                                        variant="outline"
                                                        style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                        onClick={() => openRuleConfig(field, idx)}
                                                        icon={<Sliders size={12} />}
                                                    >
                                                        Modify Constraints
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ─ TAB 3: Schema Comparison / Evolution Timeline ─ */}
                                {activeTab === 'comparison' && (
                                    <div
                                        className="animate-fade-in"
                                        style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem' }}
                                    >
                                        {/* Left timeline section */}
                                        <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
                                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', marginTop: 0 }}>
                                                <History size={16} /> Evolution Snapshots
                                            </h4>

                                            {contractVersions.length === 0 ? (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                                    No history snapshots recorded yet. Publish changes to register a snapshot.
                                                </div>
                                            ) : (
                                                <div className="dcs-timeline">
                                                    {contractVersions.map((hist, index) => (
                                                        <div key={index} className="dcs-timeline-node">
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                                                                <span>v{hist.version}</span>
                                                                <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{new Date(hist.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <p style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', margin: '0.125rem 0 0.5rem' }}>{hist.changeLog || 'Spec version release'}</p>
                                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                                <Button
                                                                    variant={compVersion === hist.version ? 'primary' : 'outline'}
                                                                    style={{ padding: '2px 6px', fontSize: '0.625rem', height: 'auto' }}
                                                                    onClick={() => setCompVersion(hist.version)}
                                                                >
                                                                    Diff
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    style={{ padding: '2px 6px', fontSize: '0.625rem', height: 'auto', color: 'var(--danger-color)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                                    onClick={() => handleRollback(hist.version)}
                                                                >
                                                                    Rollback
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Right comparison Diff view */}
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                    <SlidersHorizontal size={16} /> Diff: Active Spec vs {compVersion ? `v${compVersion}` : 'Select snapshot'}
                                                </h4>
                                            </div>

                                            {!compVersion ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}>
                                                    <Info size={28} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                                    <p style={{ fontSize: '0.75rem' }}>Select any snapshot node in the timeline to compare specifications dynamically.</p>
                                                </div>
                                            ) : (
                                                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                                                        <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                                            <tr>
                                                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Field Key</th>
                                                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Active Spec Type</th>
                                                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Snapshot v{compVersion} Spec</th>
                                                                <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Delta Review</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(() => {
                                                                const snap = contractVersions.find(v => v.version === compVersion);
                                                                if (!snap) return null;

                                                                const activeFields = selectedContract.schemaDef || [];
                                                                const snapFields = snap.schemaDef || [];

                                                                const allFieldNames = Array.from(new Set([
                                                                    ...activeFields.map(f => f.name),
                                                                    ...snapFields.map(f => f.name)
                                                                ]));

                                                                return allFieldNames.map(name => {
                                                                    const activeF = activeFields.find(f => f.name === name);
                                                                    const snapF = snapFields.find(f => f.name === name);

                                                                    let deltaClass = '';
                                                                    let deltaText = 'Unchanged';

                                                                    if (activeF && !snapF) {
                                                                        deltaClass = 'dc-recent-badge success';
                                                                        deltaText = '[ADDED] Field introduced in draft';
                                                                    } else if (!activeF && snapF) {
                                                                        deltaClass = 'dc-recent-badge error';
                                                                        deltaText = '[DELETED] Field removed in snapshot';
                                                                    } else if (activeF && snapF && (
                                                                        activeF.type !== snapF.type ||
                                                                        activeF.required !== snapF.required ||
                                                                        activeF.format !== snapF.format ||
                                                                        activeF.unique !== snapF.unique ||
                                                                        JSON.stringify(activeF.enumValues) !== JSON.stringify(snapF.enumValues)
                                                                    )) {
                                                                        deltaClass = 'dc-recent-badge warning';
                                                                        deltaText = '[MODIFIED] Format or types constraints changed';
                                                                    }

                                                                    return (
                                                                        <tr key={name} style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
                                                                            <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}>{name}</td>
                                                                            <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                                                {activeF ? `${activeF.type.toUpperCase()} ${activeF.required ? '(Req)' : ''}` : <span style={{ opacity: 0.3 }}>none</span>}
                                                                            </td>
                                                                            <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                                                {snapF ? `${snapF.type.toUpperCase()} ${snapF.required ? '(Req)' : ''}` : <span style={{ opacity: 0.3 }}>none</span>}
                                                                            </td>
                                                                            <td style={{ padding: '0.5rem 0.75rem' }}>
                                                                                {deltaClass ? (
                                                                                    <span className={deltaClass} style={{ fontSize: '0.625rem', padding: '2px 6px' }}>
                                                                                        {deltaText}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.6875rem' }}>Unchanged</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                });
                                                            })()}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', textAlign: 'center' }}>
                            <FileCode2 size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.4 }} />
                            <h3>Select a Contract Spec</h3>
                            <p style={{ color: 'var(--text-secondary)', maxWidth: '340px', margin: '0.5rem auto 0', fontSize: '0.875rem' }}>
                                Choose an connection agreement from the list on the left to edit schema definitions, configure active check rules, and view lineage maps.
                            </p>
                        </Card>
                    )}
                </div>
            </div>

            {/* ── Rule Config Side-Drawer ── */}
            {showRuleConfigDrawer && ruleConfigField && (
                <div
                    className="dcs-drawer animate-slide-left"
                    style={{ animation: 'slideInRight 0.3s ease' }}
                >
                        <div className="dcs-drawer-header">
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                <SlidersHorizontal size={18} style={{ color: 'var(--primary-color)' }} />
                                Configure: {ruleConfigField.name}
                            </h3>
                            <button onClick={() => setShowRuleConfigDrawer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="dcs-drawer-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Field Name</label>
                                <Input
                                    value={ruleConfigField.name}
                                    onChange={e => setRuleConfigField({ ...ruleConfigField, name: e.target.value })}
                                    style={{ fontSize: '0.8125rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Data Type</label>
                                <select
                                    value={ruleConfigField.type}
                                    onChange={e => setRuleConfigField({ ...ruleConfigField, type: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-color)' }}
                                >
                                    {FIELD_TYPES.map(t => (
                                        <option key={t} value={t}>{t.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
                                <textarea
                                    value={ruleConfigField.description || ''}
                                    onChange={e => setRuleConfigField({ ...ruleConfigField, description: e.target.value })}
                                    placeholder="Add field context for other users..."
                                    style={{ width: '100%', height: '60px', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-color)', resize: 'vertical', outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1.5rem', margin: '0.5rem 0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={ruleConfigField.required}
                                        onChange={e => setRuleConfigField({ ...ruleConfigField, required: e.target.checked })}
                                        style={{ width: '14px', height: '14px' }}
                                    />
                                    Required
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={ruleConfigField.unique || false}
                                        onChange={e => setRuleConfigField({ ...ruleConfigField, unique: e.target.checked })}
                                        style={{ width: '14px', height: '14px' }}
                                    />
                                    Unique Constraint
                                </label>
                            </div>

                            <div style={{ borderTop: '1px dashed var(--border-color)', margin: '0.5rem 0' }} />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Regex Format Expression</label>
                                <Input
                                    placeholder="e.g. ^[a-zA-Z0-9]+$"
                                    value={ruleConfigField.format || ''}
                                    onChange={e => setRuleConfigField({ ...ruleConfigField, format: e.target.value })}
                                    style={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Allowed Enum Values (Comma Separated)</label>
                                <Input
                                    placeholder="completed, pending, cancelled"
                                    value={ruleConfigField.enumValues ? ruleConfigField.enumValues.join(', ') : ''}
                                    onChange={e => {
                                        const val = e.target.value;
                                        const enumArr = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
                                        setRuleConfigField({ ...ruleConfigField, enumValues: enumArr });
                                    }}
                                    style={{ fontSize: '0.8125rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Min Value Check</label>
                                    <Input
                                        type="number"
                                        value={ruleConfigField.minValue !== undefined ? ruleConfigField.minValue : ''}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setRuleConfigField({ ...ruleConfigField, minValue: val ? Number(val) : undefined });
                                        }}
                                        style={{ fontSize: '0.8125rem' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Max Value Check</label>
                                    <Input
                                        type="number"
                                        value={ruleConfigField.maxValue !== undefined ? ruleConfigField.maxValue : ''}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setRuleConfigField({ ...ruleConfigField, maxValue: val ? Number(val) : undefined });
                                        }}
                                        style={{ fontSize: '0.8125rem' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="dcs-drawer-footer">
                            <Button variant="secondary" onClick={() => setShowRuleConfigDrawer(false)}>Cancel</Button>
                            <Button onClick={applyRuleConfig}>Apply Local Settings</Button>
                        </div>
                </div>
            )}

            {/* ── Validation Selection Dialog ── */}
            {showValidationSelect && (
                <div className="dcs-backdrop animate-fade-in" onClick={() => setShowValidationSelect(false)}>
                    <div
                        className="dcs-modal animate-slide-in-up"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        <div className="dcs-modal-header">
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                <Play size={18} style={{ color: 'var(--primary-color)' }} />
                                Select Dataset for Validation
                            </h3>
                            <button onClick={() => setShowValidationSelect(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="dcs-modal-body">
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                                Select a raw dataset in the repository to validate against the schema rules of <strong>{selectedContract?.name}</strong>.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Dataset</label>
                                <select
                                    value={selectedDatasetId}
                                    onChange={e => setSelectedDatasetId(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-color)' }}
                                >
                                    <option value="">Choose dataset from workspace...</option>
                                    {datasets.map(ds => (
                                        <option key={ds.id} value={ds.id}>{ds.name} ({ds.source.toUpperCase()})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="dcs-modal-footer">
                            <Button variant="secondary" onClick={() => setShowValidationSelect(false)}>Cancel</Button>
                            <Button onClick={handleValidateDataset} disabled={!selectedDatasetId || isValidating}>
                                {isValidating ? 'Validating...' : 'Run Scan'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Validation Report Modal ── */}
            {showReportModal && validationReport && (
                <div className="dcs-backdrop animate-fade-in" onClick={() => setShowReportModal(false)}>
                    <div
                        className="dcs-modal animate-slide-in-up"
                        style={{ width: '680px', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        <div className="dcs-modal-header" style={{ flexShrink: 0 }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                <CheckCircle size={18} style={{ color: 'var(--success-color)' }} />
                                Validation Ingestion Scan Report
                            </h3>
                            <button onClick={() => setShowReportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="dcs-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', maxHeight: '500px' }}>
                            {/* Overall statistics */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                {[
                                    { label: 'Quality Score', val: `${validationReport.overallScore}/100`, color: validationReport.overallScore >= 80 ? 'var(--success-color)' : 'var(--warning-color)' },
                                    { label: 'Pass Rate', val: `${validationReport.passRate}%`, color: 'var(--primary-color)' },
                                    { label: 'Total Rows', val: validationReport.totalRows, color: 'var(--text-primary)' },
                                    { label: 'Invalid Rows', val: validationReport.invalidRows, color: validationReport.invalidRows > 0 ? 'var(--danger-color)' : 'var(--text-secondary)' },
                                ].map((stat, i) => (
                                    <div key={i} style={{ textAlign: 'center', padding: '0.75rem 0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>{stat.label}</div>
                                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: stat.color }}>{stat.val}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Quality sub-scores */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                                <h4 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>Validation Dimension Scores</h4>
                                {[
                                    { label: 'Completeness check (Non-null values)', val: validationReport.completeness },
                                    { label: 'Validity check (Type match correctness)', val: validationReport.validity },
                                    { label: 'Uniqueness check (No key collisions)', val: validationReport.uniqueness }
                                ].map((dim, i) => (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                            <span>{dim.label}</span>
                                            <span style={{ fontWeight: 600 }}>{dim.val}%</span>
                                        </div>
                                        <div style={{ height: '5px', background: 'var(--border-color)', borderRadius: '999px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${dim.val}%`, background: 'var(--primary-color)', borderRadius: '999px' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Detailed Anomaly list */}
                            <div>
                                <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <AlertCircle size={14} style={{ color: 'var(--warning-color)' }} />
                                    Anomaly & Issue Logs ({validationReport.issues.length} instances)
                                </h4>

                                {validationReport.issues.length === 0 ? (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                        <CheckCircle2 size={16} />
                                        <span>All rows passed verification. The dataset is fully compliant with the contract boundaries!</span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-color)' }}>
                                        {validationReport.issues.map((iss, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                                                <span className={`dc-recent-badge ${iss.severity === 'error' ? 'error' : 'warning'}`} style={{ fontSize: '0.5625rem', padding: '1px 5px', textTransform: 'uppercase', marginTop: '1px' }}>
                                                    {iss.severity}
                                                </span>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>Row {iss.row + 1}: Field `{iss.field}` failed `{iss.rule}`</div>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.6875rem', marginTop: '0.125rem' }}>
                                                        Expected: <span style={{ color: 'var(--success-color)' }}>{iss.expected}</span> | Actual: <span style={{ color: 'var(--danger-color)' }}>{iss.actual}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="dcs-modal-footer" style={{ flexShrink: 0 }}>
                            <Button onClick={() => setShowReportModal(false)}>Close Report</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── New Contract Modal ── */}
            {showNewContractModal && (
                <div className="dcs-backdrop animate-fade-in" onClick={() => setShowNewContractModal(false)}>
                    <div
                        className="dcs-modal animate-slide-in-up"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                        <div className="dcs-modal-header">
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                <PlusCircle size={18} style={{ color: 'var(--primary-color)' }} />
                                Create New Contract Spec
                            </h3>
                            <button onClick={() => setShowNewContractModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="dcs-modal-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Contract Name *</label>
                                <Input
                                    placeholder="e.g. Sales Pipeline Schema"
                                    value={newContractName}
                                    onChange={e => setNewContractName(e.target.value)}
                                    style={{ fontSize: '0.8125rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Domain</label>
                                <Input
                                    placeholder="e.g. E-Commerce, Operations, Marketing"
                                    value={newContractDomain}
                                    onChange={e => setNewContractDomain(e.target.value)}
                                    style={{ fontSize: '0.8125rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Dataset Source</label>
                                    <select
                                        value={newContractDatasetId}
                                        onChange={e => setNewContractDatasetId(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-color)' }}
                                    >
                                        <option value="">Create blank spec...</option>
                                        {datasets.map(ds => (
                                            <option key={ds.id} value={ds.id}>{ds.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Initial Version</label>
                                    <Input
                                        placeholder="1.0.0"
                                        value={newContractVersion}
                                        onChange={e => setNewContractVersion(e.target.value)}
                                        style={{ fontSize: '0.8125rem' }}
                                    />
                                </div>
                            </div>

                            {newContractDatasetId && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.05)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.15)', fontSize: '0.75rem', color: 'var(--primary-color)' }}>
                                    <Sparkles size={16} />
                                    <span>AI will auto-import fields and infer validation rules from this dataset!</span>
                                </div>
                            )}
                        </div>

                        <div className="dcs-modal-footer">
                            <Button variant="secondary" onClick={() => setShowNewContractModal(false)}>Cancel</Button>
                            <Button onClick={handleCreateContract} disabled={!newContractName.trim()}>Create Spec</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Wrapper Lucide helper icon to prevent compile errors
function PlusCircle(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-plus-circle"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
        </svg>
    );
}
