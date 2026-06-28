'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    ChevronDown,
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
    CheckCircle,
    MoreVertical,
    FileText,
    HelpCircle,
    Download,
    Maximize2,
    ArrowUpRight
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
    ownerName?: string;
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
    const [activeTab, setActiveTab] = useState<'overview' | 'schema' | 'rules' | 'suggestions' | 'comparison' | 'activity'>('overview');

    // Modals & Drawers States
    const [showNewContractModal, setShowNewContractModal] = useState(false);
    const [showRuleConfigDrawer, setShowRuleConfigDrawer] = useState(false);
    const [ruleConfigField, setRuleConfigField] = useState<SchemaField | null>(null);
    const [ruleConfigFieldIndex, setRuleConfigFieldIndex] = useState<number | null>(null);

    // Sidebar filters
    const [statusFilter, setStatusFilter] = useState('all');
    const [domainFilter, setDomainFilter] = useState('all');

    // Dropdown Actions
    const [showActionsDropdown, setShowActionsDropdown] = useState(false);

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

    // Pagination for fields table
    const [fieldPage, setFieldPage] = useState(1);
    const [fieldsPerPage, setFieldsPerPage] = useState(10);

    const { showToast } = useToast();

    /* ── API Operations ─────────────────────────────────────── */
    const fetchContracts = useCallback(async () => {
        setLoadingContracts(true);
        try {
            const data = await apiClient.get('/data/contracts');
            if (data && Array.isArray(data)) {
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
                setFieldPage(1);

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
                await apiClient.post(`/data/contracts/${selectedContract.id}/version`, {
                    changeLog: `Published changes to version ${nextVersion}`
                });

                showToast(`Data contract published successfully as version ${nextVersion}!`, 'success');

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
                        // ignore
                    }
                }
            }

            if (fieldsPayload.length === 0) {
                fieldsPayload = [
                    { name: 'Product_ID', type: 'Integer', required: true, description: 'Unique product identifier' },
                    { name: 'Sale_Date', type: 'Date', required: true, description: 'Date of the transaction' },
                    { name: 'Sales_Rep', type: 'String', required: true, description: 'Sales representative' }
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

                await apiClient.post(`/data/contracts/${res.id}/version`, {
                    changeLog: `Initial bootstrap of ${newContractName}`
                });

                setNewContractName('');
                setNewContractDomain('Ingestion');
                setNewContractDatasetId('');
                setNewContractVersion('1.0.0');

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
        showToast('AI analyzed schema names and auto-inferred validation rules!', 'success');
    };

    /* ── Mapped filter helper ── */
    const filteredContracts = useMemo(() => {
        return contracts.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.version.includes(searchQuery);
            const matchesStatus = statusFilter === 'all' || c.status.toLowerCase() === statusFilter.toLowerCase();
            const matchesDomain = domainFilter === 'all' || c.domain.toLowerCase() === domainFilter.toLowerCase();
            return matchesSearch && matchesStatus && matchesDomain;
        });
    }, [contracts, searchQuery, statusFilter, domainFilter]);

    // Computed unique domains for dropdown filter list
    const availableDomains = useMemo(() => {
        const set = new Set<string>();
        contracts.forEach(c => { if (c.domain) set.add(c.domain); });
        return Array.from(set);
    }, [contracts]);

    // Computed rules count
    const rulesCount = useMemo(() => {
        if (!selectedContract) return 0;
        let count = 0;
        selectedContract.schemaDef.forEach(f => {
            if (f.required) count++;
            if (f.unique) count++;
            if (f.format) count++;
            if (f.enumValues && f.enumValues.length > 0) count++;
            if (f.minValue !== undefined || f.maxValue !== undefined) count++;
        });
        return count;
    }, [selectedContract]);


    // Dynamic AI suggestions based on schema analysis
    const suggestions = useMemo(() => {
        if (!selectedContract) return [];
        const items: { text: string; type: 'green' | 'amber' | 'blue'; action: string; fieldName: string }[] = [];
        const fields = selectedContract.schemaDef || [];

        fields.forEach(f => {
            const nameLower = f.name.toLowerCase();

            // 1. ID checks
            if (nameLower.includes('id') || nameLower.includes('key')) {
                if (!f.unique || !f.required) {
                    items.push({
                        text: `Field '${f.name}' should be unique and required`,
                        type: 'green',
                        action: 'id_unique',
                        fieldName: f.name
                    });
                } else {
                    items.push({
                        text: `Field '${f.name}' is verified unique & required`,
                        type: 'green',
                        action: '',
                        fieldName: f.name
                    });
                }
            }

            // 2. Date checks
            if (nameLower.includes('date') || nameLower.includes('at')) {
                if (f.type !== 'Date') {
                    items.push({
                        text: `Field '${f.name}' type should be DATE instead of ${f.type}`,
                        type: 'green',
                        action: 'date_type',
                        fieldName: f.name
                    });
                } else {
                    items.push({
                        text: `Field '${f.name}' date format validation verified`,
                        type: 'green',
                        action: '',
                        fieldName: f.name
                    });
                }
            }

            // 3. Email checks
            if (nameLower.includes('email')) {
                if (!f.format) {
                    items.push({
                        text: `Field '${f.name}' should have email format regex validation`,
                        type: 'blue',
                        action: 'email_format',
                        fieldName: f.name
                    });
                } else {
                    items.push({
                        text: `Field '${f.name}' email format regex verified`,
                        type: 'blue',
                        action: '',
                        fieldName: f.name
                    });
                }
            }

            // 4. Phone checks
            if (nameLower.includes('phone')) {
                if (!f.format) {
                    items.push({
                        text: `Field '${f.name}' should have phone format validation`,
                        type: 'blue',
                        action: 'phone_format',
                        fieldName: f.name
                    });
                } else {
                    items.push({
                        text: `Field '${f.name}' phone format validation verified`,
                        type: 'blue',
                        action: '',
                        fieldName: f.name
                    });
                }
            }

            // 5. Region/Country enum list checks
            if (nameLower.includes('region') || nameLower.includes('country')) {
                if (!f.enumValues || f.enumValues.length === 0) {
                    items.push({
                        text: `Field '${f.name}' should use controlled enum list`,
                        type: 'amber',
                        action: 'enum_list',
                        fieldName: f.name
                    });
                } else {
                    items.push({
                        text: `Field '${f.name}' controlled enum values verified`,
                        type: 'amber',
                        action: '',
                        fieldName: f.name
                    });
                }
            }

            // 6. Range checks for amount / numeric values
            if (['amount', 'price', 'revenue', 'cost', 'quantity', 'score', 'total'].some(k => nameLower.includes(k))) {
                if (f.minValue === undefined) {
                    items.push({
                        text: `Add range validation check for field '${f.name}'`,
                        type: 'amber',
                        action: 'min_range',
                        fieldName: f.name
                    });
                } else {
                    items.push({
                        text: `Field '${f.name}' minimum value constraint range verified`,
                        type: 'amber',
                        action: '',
                        fieldName: f.name
                    });
                }
            }

            // 7. Missing descriptions checks
            if (!f.description || f.description.trim() === '') {
                items.push({
                    text: `Missing description for field '${f.name}'`,
                    type: 'blue',
                    action: 'add_desc',
                    fieldName: f.name
                });
            }
        });

        // Safe fallback when fully compliant
        if (items.length === 0) {
            items.push({
                text: 'All schema columns comply with governance rules',
                type: 'green',
                action: '',
                fieldName: ''
            });
        }

        return items;
    }, [selectedContract]);

    // Apply AI suggestions and save to database (targets specific field and action)
    const handleApplyAndSaveSuggestions = async (actionFilter?: string, targetFieldName?: string) => {
        if (!selectedContract) return;
        setIsSaving(true);
        try {
            const updated = selectedContract.schemaDef.map(f => {
                if (targetFieldName && f.name !== targetFieldName) {
                    return f;
                }

                const nameLower = f.name.toLowerCase();
                const copy = { ...f };

                const applyAll = !actionFilter;

                if (applyAll || actionFilter === 'id_unique') {
                    if (nameLower.includes('id') || nameLower.includes('key')) {
                        copy.unique = true;
                        copy.required = true;
                    }
                }
                if (applyAll || actionFilter === 'date_type') {
                    if (nameLower.includes('date') || nameLower.includes('at')) {
                        copy.type = 'Date';
                        copy.required = true;
                    }
                }
                if (applyAll || actionFilter === 'email_format') {
                    if (nameLower.includes('email')) {
                        copy.format = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
                        if (!copy.description) {
                            copy.description = 'Validated email format address';
                        }
                    }
                }
                if (applyAll || actionFilter === 'phone_format') {
                    if (nameLower.includes('phone')) {
                        copy.format = '^\\+?[1-9]\\d{1,14}$';
                        if (!copy.description) {
                            copy.description = 'E.164 phone format validation';
                        }
                    }
                }
                if (applyAll || actionFilter === 'enum_list') {
                    if (nameLower.includes('region') || nameLower.includes('country')) {
                        copy.enumValues = ['North', 'South', 'East', 'West', 'Central'];
                        copy.description = 'Controlled region enum list';
                    }
                }
                if (applyAll || actionFilter === 'min_range') {
                    if (['amount', 'price', 'revenue', 'cost', 'quantity', 'score', 'total'].some(k => nameLower.includes(k))) {
                        copy.minValue = 0;
                        if (copy.type !== 'Integer' && copy.type !== 'Float') {
                            copy.type = 'Float';
                        }
                    }
                }
                if (applyAll || actionFilter === 'add_desc') {
                    if (!copy.description || copy.description.trim() === '') {
                        copy.description = `Governance field context for '${f.name}'`;
                    }
                }
                return copy;
            });

            // Calculate next version
            const currentVer = selectedContract.version || '1.0.0';
            let nextVersion = '1.1.0';
            const vParts = currentVer.split('.').map(Number);
            if (vParts.length >= 2 && !vParts.some(isNaN)) {
                vParts[1] = vParts[1] + 1;
                vParts[2] = 0;
                nextVersion = vParts.join('.');
            }

            const changeLogMsg = actionFilter
                ? `Applied AI Suggestion: "${actionFilter}" on field "${targetFieldName || 'all'}" (Saved automatically)`
                : `Applied all AI suggestions (Saved automatically)`;

            const res = await apiClient.patch(`/data/contracts/${selectedContract.id}`, {
                name: selectedContract.name,
                domain: selectedContract.domain,
                version: nextVersion,
                schemaDef: updated,
                enforcementMode: selectedContract.enforcementMode,
            });

            if (res) {
                await apiClient.post(`/data/contracts/${selectedContract.id}/version`, {
                    changeLog: changeLogMsg
                });

                showToast(`AI suggestion applied and saved successfully as version ${nextVersion}!`, 'success');

                loadContractDetails(selectedContract.id);
                fetchContracts();
            } else {
                showToast('Failed to save contract with applied suggestions.', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Error updating contract with suggestions.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Paginated schema fields
    const paginatedFields = useMemo(() => {
        if (!selectedContract) return [];
        const start = (fieldPage - 1) * fieldsPerPage;
        return selectedContract.schemaDef.slice(start, start + fieldsPerPage);
    }, [selectedContract, fieldPage, fieldsPerPage]);

    const formatUpdatedTime = (isoString: string) => {
        try {
            const date = new Date(isoString);
            const now = new Date();
            const isToday = date.toDateString() === now.toDateString();

            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (isToday) {
                return `Updated today, ${timeStr}`;
            } else {
                return `Updated ${date.toLocaleDateString()}, ${timeStr}`;
            }
        } catch {
            return 'Updated recently';
        }
    };

    const renderSchemaBuilder = () => {
        if (!selectedContract) return null;
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="dc-schema-builder-header">
                    <h4 className="dc-schema-builder-title">
                        <Code2 size={16} style={{ color: '#6366f1' }} />
                        Schema Builder
                    </h4>
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
                            style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', color: '#6366f1', borderColor: 'rgba(99, 102, 241, 0.3)' }}
                            onClick={handleAiAutoMap}
                            icon={<Sparkles size={14} />}
                        >
                            AI Rule Inference
                        </Button>
                    </div>
                </div>

                <div className="dc-schema-table-wrapper">
                    <table className="dc-schema-table">
                        <thead>
                            <tr>
                                <th style={{ width: '30px' }}></th>
                                <th>Field Name</th>
                                <th>Type</th>
                                <th style={{ textAlign: 'center', width: '80px' }}>Required</th>
                                <th>Validation Rules</th>
                                <th>Description</th>
                                <th style={{ textAlign: 'right', width: '80px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedFields.map((field, index) => {
                                const globalIndex = (fieldPage - 1) * fieldsPerPage + index;
                                return (
                                    <tr key={globalIndex}>
                                        <td>
                                            <div className="dc-drag-handle">
                                                <SlidersHorizontal size={12} />
                                            </div>
                                        </td>
                                        <td style={{ width: '180px' }}>
                                            <input
                                                className="dc-field-name-input"
                                                value={field.name}
                                                onChange={e => {
                                                    const cpy = [...selectedContract.schemaDef];
                                                    cpy[globalIndex].name = e.target.value;
                                                    setSelectedContract({ ...selectedContract, schemaDef: cpy });
                                                }}
                                            />
                                        </td>
                                        <td style={{ width: '120px' }}>
                                            <select
                                                className="dc-type-select"
                                                value={field.type}
                                                onChange={e => {
                                                    const cpy = [...selectedContract.schemaDef];
                                                    cpy[globalIndex].type = e.target.value;
                                                    setSelectedContract({ ...selectedContract, schemaDef: cpy });
                                                }}
                                            >
                                                {FIELD_TYPES.map(t => (
                                                    <option key={t} value={t}>{t.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                className="dc-checkbox"
                                                checked={field.required}
                                                onChange={e => {
                                                    const cpy = [...selectedContract.schemaDef];
                                                    cpy[globalIndex].required = e.target.checked;
                                                    setSelectedContract({ ...selectedContract, schemaDef: cpy });
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <div className="dc-table-pills-container">
                                                {field.required && <span className="dc-rule-pill required">Not Null</span>}
                                                {field.unique && <span className="dc-rule-pill unique">Unique</span>}
                                                {field.format && <span className="dc-rule-pill regex">Format</span>}
                                                {field.enumValues && field.enumValues.length > 0 && <span className="dc-rule-pill enum">Enum</span>}
                                                {!field.required && !field.unique && !field.format && (!field.enumValues || field.enumValues.length === 0) && (
                                                    <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.6875rem' }}>None</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                className="dc-desc-input"
                                                value={field.description || ''}
                                                onChange={e => {
                                                    const cpy = [...selectedContract.schemaDef];
                                                    cpy[globalIndex].description = e.target.value;
                                                    setSelectedContract({ ...selectedContract, schemaDef: cpy });
                                                }}
                                                placeholder="Field description..."
                                            />
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => openRuleConfig(field, globalIndex)}
                                                    style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                                                    title="Configure constraints"
                                                >
                                                    <Sliders size={14} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const cpy = selectedContract.schemaDef.filter((_, i) => i !== globalIndex);
                                                        setSelectedContract({ ...selectedContract, schemaDef: cpy });
                                                        showToast(`Staged deletion of '${field.name}' field.`, 'info');
                                                    }}
                                                    style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                                                    title="Remove Field"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="dc-table-footer">
                        <span>Showing {Math.min((fieldPage - 1) * fieldsPerPage + 1, selectedContract.schemaDef.length)} to {Math.min(fieldPage * fieldsPerPage, selectedContract.schemaDef.length)} of {selectedContract.schemaDef.length} fields</span>
                        <div className="dc-pagination-controls">
                            <button
                                className="dc-pagination-btn"
                                onClick={() => setFieldPage(p => Math.max(p - 1, 1))}
                                disabled={fieldPage === 1}
                            >
                                &lt;
                            </button>
                            <button className="dc-pagination-btn active">{fieldPage}</button>
                            <button
                                className="dc-pagination-btn"
                                onClick={() => setFieldPage(p => Math.min(p + 1, Math.ceil(selectedContract.schemaDef.length / fieldsPerPage)))}
                                disabled={fieldPage >= Math.ceil(selectedContract.schemaDef.length / fieldsPerPage)}
                            >
                                &gt;
                            </button>

                            <select
                                className="dc-pagination-select"
                                value={fieldsPerPage}
                                onChange={e => { setFieldsPerPage(Number(e.target.value)); setFieldPage(1); }}
                            >
                                <option value="5">5 / page</option>
                                <option value="10">10 / page</option>
                                <option value="20">20 / page</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderAiSuggestionsTab = () => {
        if (!selectedContract) return null;
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sparkles size={16} style={{ color: '#6366f1' }} />
                        AI Contract Suggestions
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Automated structural boundary improvements
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {suggestions.map((sug, i) => (
                        <div
                            key={i}
                            style={{
                                padding: '1rem',
                                borderRadius: '10px',
                                border: '1px solid var(--dc-border)',
                                background: 'var(--dc-bg-sec)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {sug.type === 'green' ? (
                                    <CheckCircle2 size={18} style={{ color: 'var(--success-color)' }} />
                                ) : sug.type === 'amber' ? (
                                    <AlertCircle size={18} style={{ color: 'var(--warning-color)' }} />
                                ) : (
                                    <Info size={18} style={{ color: 'var(--secondary-color)' }} />
                                )}
                                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--dc-text)' }}>
                                    {sug.text}
                                </span>
                            </div>
                            {sug.action ? (
                                <Button
                                    variant="outline"
                                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', color: '#6366f1', borderColor: 'rgba(99, 102, 241, 0.3)' }}
                                    onClick={() => handleApplyAndSaveSuggestions(sug.action, sug.fieldName)}
                                    disabled={isSaving}
                                >
                                    Fix & Save
                                </Button>
                            ) : (
                                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Check size={12} /> Verified
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderActivityTab = () => {
        if (!selectedContract) return null;
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={16} style={{ color: '#6366f1' }} />
                        Contract Activity Audit Log
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Version evolution history & release timeline
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {contractVersions.slice().reverse().map((versionNode, index) => (
                        <div
                            key={versionNode.id}
                            style={{
                                padding: '1rem',
                                borderRadius: '10px',
                                border: '1px solid var(--dc-border)',
                                background: 'var(--dc-card-bg)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--dc-text)' }}>
                                        v{versionNode.version}
                                    </span>
                                    {index === 0 && (
                                        <span style={{ fontSize: '0.625rem', fontWeight: 600, background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', padding: '1px 5px', borderRadius: '4px' }}>
                                            Current
                                        </span>
                                    )}
                                </div>
                                <span style={{ fontSize: '0.8125rem', color: 'var(--dc-text-sub)' }}>
                                    {versionNode.changeLog || 'Initial bootstrap of data contract'}
                                </span>
                                <span style={{ fontSize: '0.6875rem', color: 'var(--dc-text-muted)' }}>
                                    Published by {versionNode.changedBy || 'System'} on {new Date(versionNode.createdAt).toLocaleDateString()} at {new Date(versionNode.createdAt).toLocaleTimeString()}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <Button
                                    variant="outline"
                                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                                    onClick={() => {
                                        setActiveTab('comparison');
                                        setCompVersion(versionNode.version);
                                    }}
                                >
                                    Compare Diff
                                </Button>
                                {versionNode.version !== selectedContract.version && (
                                    <Button
                                        variant="outline"
                                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', color: '#6366f1', borderColor: 'rgba(99, 102, 241, 0.2)' }}
                                        onClick={() => handleRollback(versionNode.version)}
                                    >
                                        Rollback
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="dc-page">
            {/* Page Header */}
            <div className="dc-page-header">
                <div>
                    <h1>Data Contract Studio</h1>
                    <p>Define structural boundaries, normalizations, and data governance agreements</p>
                </div>
                <div className="dc-header-actions">
                    <Button variant="outline" onClick={fetchContracts} disabled={loadingContracts} icon={<RefreshCw size={14} />}>
                        Sync Connection
                    </Button>
                    <Button onClick={() => setShowNewContractModal(true)} icon={<Plus size={16} />}>
                        New Contract Agreement
                    </Button>
                </div>
            </div>

            {/* 3-Column Workspace Layout */}
            <div className="dc-studio-layout">
                {/* ── LEFT COLUMN: Contracts catalog list ── */}
                <div className="dc-sidebar-left">
                    <h3>Contracts</h3>
                    <div className="dc-search-container">
                        <Search className="dc-search-icon" size={14} />
                        <input
                            className="dc-search-input"
                            placeholder="Search contracts..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="dc-filter-row">
                        <select
                            className="dc-filter-select"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="draft">Draft</option>
                        </select>

                        <select
                            className="dc-filter-select"
                            value={domainFilter}
                            onChange={e => setDomainFilter(e.target.value)}
                        >
                            <option value="all">All Domains</option>
                            {availableDomains.map(dom => (
                                <option key={dom} value={dom}>{dom}</option>
                            ))}
                        </select>

                        <button className="dc-filter-btn" title="Advanced Filter Options">
                            <SlidersHorizontal size={14} />
                        </button>
                    </div>

                    <div className="dc-catalog-list">
                        {loadingContracts ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                <RefreshCw className="spinner" size={20} style={{ margin: '0 auto 0.5rem' }} />
                                <p style={{ fontSize: '0.75rem', margin: 0 }}>Loading catalog...</p>
                            </div>
                        ) : filteredContracts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
                                <FileCode2 size={24} style={{ opacity: 0.4, margin: '0 auto 0.5rem' }} />
                                <p style={{ fontSize: '0.75rem', margin: 0 }}>No agreements</p>
                            </div>
                        ) : (
                            filteredContracts.map(contract => (
                                <div
                                    key={contract.id}
                                    className={`dc-catalog-card ${selectedContractId === contract.id ? 'active' : ''}`}
                                    onClick={() => setSelectedContractId(contract.id)}
                                >
                                    <div className="dc-catalog-card-header">
                                        <h4 className="dc-catalog-title">{contract.name}</h4>
                                        <span className="dc-catalog-ver">v{contract.version}</span>
                                    </div>
                                    <div className="dc-catalog-card-middle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>v{contract.version}</span>
                                        <span className={`dc-catalog-status ${contract.status.toLowerCase()}`}>
                                            {contract.status === 'Active' ? 'Approved' : 'Draft'}
                                        </span>
                                    </div>
                                    <div className="dc-catalog-meta" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        {contract.schemaDef?.length || 0} Fields • {contract.domain}
                                    </div>
                                    <div className="dc-catalog-updated" style={{ fontSize: '0.6875rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                        {formatUpdatedTime(contract.updatedAt)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <button className="dc-archive-btn">
                        <Database size={14} />
                        View Archived Contracts
                    </button>
                </div>

                {/* ── MIDDLE COLUMN: Specification Details Workstation ── */}
                <div className="dc-main-workstation">
                    {selectedContract ? (
                        <>
                            {/* Contract Header */}
                            <div className="dc-workstation-header">
                                <div className="dc-workstation-title-row">
                                    <div className="dc-workstation-title">
                                        <div className="dc-workstation-icon-wrapper">
                                            <FileCode2 size={22} />
                                        </div>
                                        <div>
                                            <h2 className="dc-workstation-h2">{selectedContract.name}</h2>
                                        </div>
                                        <span className={`dc-catalog-status ${selectedContract.status.toLowerCase()}`} style={{ marginLeft: '0.5rem' }}>
                                            {selectedContract.status === 'Active' ? 'Approved' : 'Draft'}
                                        </span>
                                    </div>

                                    <div className="dc-actions-group">
                                        <Button
                                            variant="outline"
                                            onClick={handleSaveContract}
                                            disabled={isSaving}
                                            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                                        >
                                            {isSaving ? 'Saving...' : 'Save Contract'}
                                        </Button>

                                        <div style={{ position: 'relative' }}>
                                            <button
                                                className="dc-dots-menu-btn"
                                                onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                                            >
                                                <MoreVertical size={16} />
                                            </button>

                                            {showActionsDropdown && (
                                                <div className="dc-dropdown-menu">
                                                    <button
                                                        onClick={() => { setShowActionsDropdown(false); setShowValidationSelect(true); }}
                                                        className="dc-dropdown-item"
                                                    >
                                                        <Play size={12} /> Validate Dataset
                                                    </button>
                                                    <button
                                                        onClick={() => { setShowActionsDropdown(false); handleToggleStatus(); }}
                                                        className="dc-dropdown-item"
                                                    >
                                                        <CheckCircle2 size={12} /> {selectedContract.status === 'Active' ? 'Demote to Draft' : 'Approve Spec'}
                                                    </button>
                                                    <button
                                                        onClick={() => { setShowActionsDropdown(false); handleSaveContract(); }}
                                                        className="dc-dropdown-item"
                                                    >
                                                        <GitBranch size={12} /> Publish vNext
                                                    </button>
                                                    <div className="dc-dropdown-divider" />
                                                    <button
                                                        onClick={() => { setShowActionsDropdown(false); handleDeleteContract(); }}
                                                        className="dc-dropdown-item danger"
                                                    >
                                                        <Trash2 size={12} /> Delete Spec
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Horizontal metadata display grid */}
                                <div className="dc-metadata-grid">
                                    <div className="dc-metadata-item">
                                        <span className="dc-metadata-label">Version</span>
                                        <button className="dc-metadata-value-dropdown">
                                            {selectedContract.version} (Current) <ChevronDown size={12} />
                                        </button>
                                    </div>

                                    <div className="dc-metadata-item">
                                        <span className="dc-metadata-label">Domain</span>
                                        <span className="dc-metadata-value">{selectedContract.domain}</span>
                                    </div>

                                    <div className="dc-metadata-item" style={{ gridColumn: 'span 2' }}>
                                        <span className="dc-metadata-label">Owner</span>
                                        <div className="dc-avatar-row">
                                            <div className="dc-avatar-circle">
                                                {selectedContract.ownerName ? selectedContract.ownerName.charAt(0).toUpperCase() : 'A'}
                                            </div>
                                            <div className="dc-avatar-info">
                                                <span className="dc-avatar-name">{selectedContract.ownerName || 'Admin User'}</span>
                                                <span className="dc-avatar-role">Data Engineer</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="dc-metadata-item">
                                        <span className="dc-metadata-label">Enforcement</span>
                                        <span className="dc-metadata-value" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#10b981' }}>
                                            <Shield size={12} /> {selectedContract.enforcementMode.charAt(0).toUpperCase() + selectedContract.enforcementMode.slice(1)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Tabs */}
                            <div className="dc-tabs-list">
                                {[
                                    { id: 'overview', label: 'Overview' },
                                    { id: 'schema', label: 'Schema' },
                                    { id: 'rules', label: 'Validation Rules' },
                                    { id: 'suggestions', label: 'AI Suggestions' },
                                    { id: 'comparison', label: 'Version History' },
                                    { id: 'activity', label: 'Activity' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`dc-tab-trigger ${activeTab === tab.id ? 'active' : ''}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Workspace Main view content */}
                            <div className="dc-workstation-body">
                                {/* TAB 1: OVERVIEW */}
                                {activeTab === 'overview' && (
                                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        <div className="dc-overview-grid">
                                            <div className="dc-overview-card">
                                                <div className="dc-overview-icon blue">
                                                    <FileCode2 size={20} />
                                                </div>
                                                <div className="dc-overview-info">
                                                    <span className="dc-overview-label">Total Fields</span>
                                                    <span className="dc-overview-value">{selectedContract.schemaDef.length}</span>
                                                    <span className="dc-overview-subtitle">All fields in contract</span>
                                                </div>
                                            </div>

                                            <div className="dc-overview-card">
                                                <div className="dc-overview-icon green">
                                                    <CheckCircle2 size={20} />
                                                </div>
                                                <div className="dc-overview-info">
                                                    <span className="dc-overview-label">Validation Rules</span>
                                                    <span className="dc-overview-value">{rulesCount}</span>
                                                    <span className="dc-overview-subtitle">Across all fields</span>
                                                </div>
                                            </div>

                                            <div className="dc-overview-card">
                                                <div className="dc-overview-icon cyan">
                                                    <Brain size={20} />
                                                </div>
                                                <div className="dc-overview-info">
                                                    <span className="dc-overview-label">Quality Score</span>
                                                    <span className="dc-overview-value">{validationReport ? `${validationReport.overallScore}%` : '96%'}</span>
                                                    <div className="dc-sparkline-row">
                                                        <span className="dc-sparkline-label">Excellent</span>
                                                        <svg className="dc-sparkline-svg" viewBox="0 0 48 16">
                                                            <path d="M0,12 Q8,6 16,10 T32,4 T48,2" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="dc-overview-card">
                                                <div className="dc-overview-icon orange">
                                                    <Shield size={20} />
                                                </div>
                                                <div className="dc-overview-info">
                                                    <span className="dc-overview-label">Coverage</span>
                                                    <span className="dc-overview-value">100%</span>
                                                    <span className="dc-overview-subtitle">Fields covered</span>
                                                </div>
                                            </div>
                                        </div>

                                        {renderSchemaBuilder()}

                                        <div style={{ marginTop: '0.5rem', background: 'var(--dc-bg-sec)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--dc-border)' }}>
                                            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--dc-text)' }}>Governed Dataset Binding</h4>
                                            {selectedContract.dataset ? (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                                                    <div>
                                                        <strong>{selectedContract.dataset.name}</strong> • source: {selectedContract.dataset.source}
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--dc-text-sub)', marginTop: '0.25rem' }}>
                                                            Bound on {new Date(selectedContract.dataset.createdAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <span className={`dc-catalog-status ${selectedContract.dataset.status.toLowerCase()}`}>
                                                        {selectedContract.dataset.status}
                                                    </span>
                                                </div>
                                            ) : (
                                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--dc-text-sub)' }}>
                                                    No dataset actively bound to this contract gate yet. Go to ingestion or validate a dataset to map connections.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: SCHEMA BUILDER TABLE */}
                                {activeTab === 'schema' && renderSchemaBuilder()}

                                {/* TAB 3: CUSTOM RULES DISPLAY */}
                                {activeTab === 'rules' && (
                                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>Active Field Constraints</h3>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--dc-text-sub)' }}>Configure constraints via the schema editor table</span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                            {selectedContract.schemaDef.map((field, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        padding: '1rem',
                                                        borderRadius: '8px',
                                                        border: '1px solid var(--dc-border)',
                                                        background: 'var(--dc-bg-sec)',
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
                                                                {field.type}
                                                            </span>
                                                        </div>

                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--dc-text-sub)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <span style={{ color: 'var(--dc-text-muted)' }}>Required:</span>
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
                                                                    <span style={{ color: 'var(--dc-text-muted)' }}>Format Regex:</span>
                                                                    <code style={{ fontSize: '0.6875rem', background: 'var(--dc-bg)', border: '1px solid var(--dc-border)', padding: '2px 4px', borderRadius: '3px', wordBreak: 'break-all', color: 'var(--dc-text)' }}>{field.format}</code>
                                                                </div>
                                                            )}
                                                            {field.enumValues && field.enumValues.length > 0 && (
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: 'column', gap: '0.125rem' }}>
                                                                    <span style={{ color: 'var(--dc-text-muted)' }}>Allowed Enums:</span>
                                                                    <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>{field.enumValues.join(', ')}</span>
                                                                </div>
                                                            )}
                                                            {field.description && (
                                                                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.25rem', borderTop: '1px dashed var(--dc-border)', paddingTop: '0.25rem', color: 'var(--dc-text-muted)' }}>
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

                                {/* TAB 4: AI SUGGESTIONS */}
                                {activeTab === 'suggestions' && renderAiSuggestionsTab()}

                                {/* TAB 5: COMPARISON / EVOLUTION TIMELINE */}
                                {activeTab === 'comparison' && (
                                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                <History size={16} /> Diff: Active Spec vs {compVersion ? `v${compVersion}` : 'Select snapshot'}
                                            </h4>
                                        </div>

                                        {!compVersion ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', border: '1px dashed #e2e8f0', borderRadius: '12px', color: '#64748b' }}>
                                                <Info size={28} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                                                <p style={{ fontSize: '0.75rem' }}>Select any version node in the history sidebar timeline to view structural diffs.</p>
                                            </div>
                                        ) : (
                                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                                                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
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
                                                                    deltaText = '[ADDED] Field introduced';
                                                                } else if (!activeF && snapF) {
                                                                    deltaClass = 'dc-recent-badge error';
                                                                    deltaText = '[DELETED] Field removed';
                                                                } else if (activeF && snapF && (
                                                                    activeF.type !== snapF.type ||
                                                                    activeF.required !== snapF.required ||
                                                                    activeF.format !== snapF.format ||
                                                                    activeF.unique !== snapF.unique ||
                                                                    JSON.stringify(activeF.enumValues) !== JSON.stringify(snapF.enumValues)
                                                                )) {
                                                                    deltaClass = 'dc-recent-badge warning';
                                                                    deltaText = '[MODIFIED] Constraints changed';
                                                                }

                                                                return (
                                                                    <tr key={name} style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                                                                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}>{name}</td>
                                                                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', color: '#64748b' }}>
                                                                            {activeF ? `${activeF.type.toUpperCase()} ${activeF.required ? '(Req)' : ''}` : <span style={{ opacity: 0.3 }}>none</span>}
                                                                        </td>
                                                                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', color: '#64748b' }}>
                                                                            {snapF ? `${snapF.type.toUpperCase()} ${snapF.required ? '(Req)' : ''}` : <span style={{ opacity: 0.3 }}>none</span>}
                                                                        </td>
                                                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                                                            {deltaClass ? (
                                                                                <span className={deltaClass} style={{ fontSize: '0.625rem', padding: '2px 6px' }}>
                                                                                    {deltaText}
                                                                                </span>
                                                                            ) : (
                                                                                <span style={{ color: '#64748b', fontSize: '0.6875rem' }}>Unchanged</span>
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
                                )}

                                {/* TAB 6: ACTIVITY */}
                                {activeTab === 'activity' && renderActivityTab()}
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', textAlign: 'center' }}>
                            <FileCode2 size={48} style={{ color: '#94a3b8', marginBottom: '1rem', opacity: 0.4 }} />
                            <h3>Select a Contract Spec</h3>
                            <p style={{ color: '#64748b', maxWidth: '340px', margin: '0.5rem auto 0', fontSize: '0.875rem' }}>
                                Choose a connection agreement from the list on the left to edit schema definitions, configure active check rules, and view lineage maps.
                            </p>
                        </div>
                    )}
                </div>

                {/* ── RIGHT COLUMN: AI assistant panels and Timeline logs ── */}
                <div className="dc-sidebar-right">
                    {/* Panel 1: AI Assistant */}
                    <div className="dc-assistant-card">
                        <div className="dc-assistant-header">
                            <span className="dc-assistant-title">
                                <Sparkles size={16} style={{ color: '#6366f1' }} />
                                AI Contract Assistant
                            </span>
                            <span className="dc-beta-badge">Beta</span>
                        </div>
                        <h4 className="dc-assistant-info">
                            Hi Admin 👋 I analyzed your contract and found {suggestions.length} suggestions to improve quality.
                        </h4>

                        <div className="dc-suggestion-list">
                            {suggestions.map((sug, i) => (
                                <div 
                                    key={i} 
                                    className={`dc-suggestion-item ${sug.action ? 'actionable' : 'verified'}`}
                                    style={{ cursor: sug.action ? 'pointer' : 'default' }}
                                    onClick={() => sug.action ? handleApplyAndSaveSuggestions(sug.action, sug.fieldName) : showToast('This suggestion is already verified.', 'success')}
                                >
                                    <div className="dc-suggestion-text">
                                        {sug.type === 'green' ? (
                                            <CheckCircle2 size={13} className="dc-suggestion-icon green" style={{ color: '#10b981' }} />
                                        ) : sug.type === 'amber' ? (
                                            <AlertCircle size={13} className="dc-suggestion-icon amber" style={{ color: '#f59e0b' }} />
                                        ) : (
                                            <Info size={13} className="dc-suggestion-icon blue" style={{ color: '#0ea5e9' }} />
                                        )}
                                        <span>{sug.text}</span>
                                    </div>
                                    {sug.action ? (
                                        <span style={{ fontSize: '0.6875rem', color: '#6366f1', fontWeight: 600 }}>Fix</span>
                                    ) : (
                                        <Check size={12} style={{ color: '#10b981' }} />
                                    )}
                                </div>
                            ))}
                        </div>

                        {suggestions.filter(s => s.action).length > 0 ? (
                            <button 
                                className="dc-apply-suggestions-btn" 
                                onClick={() => handleApplyAndSaveSuggestions()}
                                disabled={isSaving}
                            >
                                <Sparkles size={14} /> Fix & Save All Suggestions ({suggestions.filter(s => s.action).length})
                            </button>
                        ) : (
                            <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', fontWeight: 600 }}>
                                <CheckCircle size={14} /> All AI checks are passing!
                            </div>
                        )}
                        <a className="dc-more-link" onClick={() => setActiveTab('suggestions')}>View All Suggestions &rarr;</a>
                    </div>

                    {/* Panel 2: Contract Timeline */}
                    <div className="dc-timeline-card">
                        <h3>Contract Timeline</h3>
                        {contractVersions.length === 0 ? (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                                No timeline logs. Save changes to trigger versions.
                            </div>
                        ) : (
                            <div className="dc-timeline-list">
                                {contractVersions.slice().reverse().map((versionNode, index) => (
                                    <div
                                        key={versionNode.id}
                                        className={`dc-timeline-item ${index === 0 ? 'active' : ''}`}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                            setActiveTab('comparison');
                                            setCompVersion(versionNode.version);
                                        }}
                                    >
                                        <div className="dc-timeline-marker" />
                                        <span className="dc-timeline-ver">
                                            v{versionNode.version}
                                            {index === 0 && <span className="dc-timeline-ver-label">Current</span>}
                                        </span>
                                        <span className="dc-timeline-date">
                                            {new Date(versionNode.createdAt).toLocaleDateString()} at {new Date(versionNode.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="dc-timeline-author">Published by {versionNode.changedBy || 'System'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <a className="dc-more-link" onClick={() => setActiveTab('comparison')}>View Version History &rarr;</a>
                    </div>
                </div>
            </div>

            {/* ── Rule Config Side-Drawer ── */}
            {showRuleConfigDrawer && ruleConfigField && (
                <div className="dcs-drawer">
                    <div className="dcs-drawer-header">
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            <SlidersHorizontal size={18} style={{ color: '#6366f1' }} />
                            Configure: {ruleConfigField.name}
                        </h3>
                        <button onClick={() => setShowRuleConfigDrawer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                            <X size={18} />
                        </button>
                    </div>

                    <div className="dcs-drawer-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Field Name</label>
                            <Input
                                value={ruleConfigField.name}
                                onChange={e => setRuleConfigField({ ...ruleConfigField, name: e.target.value })}
                                style={{ fontSize: '0.8125rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Data Type</label>
                            <select
                                value={ruleConfigField.type}
                                onChange={e => setRuleConfigField({ ...ruleConfigField, type: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff' }}
                            >
                                {FIELD_TYPES.map(t => (
                                    <option key={t} value={t}>{t.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Description</label>
                            <textarea
                                value={ruleConfigField.description || ''}
                                onChange={e => setRuleConfigField({ ...ruleConfigField, description: e.target.value })}
                                placeholder="Add field context for other users..."
                                style={{ width: '100%', height: '60px', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', resize: 'vertical', outline: 'none' }}
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

                        <div style={{ borderTop: '1px dashed #cbd5e1', margin: '0.5rem 0' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Regex Format Expression</label>
                            <Input
                                placeholder="e.g. ^[a-zA-Z0-9]+$"
                                value={ruleConfigField.format || ''}
                                onChange={e => setRuleConfigField({ ...ruleConfigField, format: e.target.value })}
                                style={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Allowed Enum Values (Comma Separated)</label>
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
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Min Value Check</label>
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
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Max Value Check</label>
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
                <div className="dcs-backdrop" onClick={() => setShowValidationSelect(false)}>
                    <div className="dcs-modal" onClick={e => e.stopPropagation()}>
                        <div className="dcs-modal-header">
                            <h3>Select Dataset for Validation</h3>
                            <button onClick={() => setShowValidationSelect(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="dcs-modal-body">
                            <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
                                Select a raw dataset in the repository to validate against the schema rules of <strong>{selectedContract?.name}</strong>.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Select Dataset</label>
                                <select
                                    value={selectedDatasetId}
                                    onChange={e => setSelectedDatasetId(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff' }}
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
                <div className="dcs-backdrop" onClick={() => setShowReportModal(false)}>
                    <div
                        className="dcs-modal"
                        style={{ width: '680px', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="dcs-modal-header" style={{ flexShrink: 0 }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle size={18} style={{ color: '#10b981' }} />
                                Validation Ingestion Scan Report
                            </h3>
                            <button onClick={() => setShowReportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="dcs-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                {[
                                    { label: 'Quality Score', val: `${validationReport.overallScore}/100`, color: validationReport.overallScore >= 80 ? '#10b981' : '#f59e0b' },
                                    { label: 'Pass Rate', val: `${validationReport.passRate}%`, color: '#6366f1' },
                                    { label: 'Total Rows', val: validationReport.totalRows, color: '#0f172a' },
                                    { label: 'Invalid Rows', val: validationReport.invalidRows, color: validationReport.invalidRows > 0 ? '#ef4444' : '#64748b' },
                                ].map((stat, i) => (
                                    <div key={i} style={{ textAlign: 'center', padding: '0.75rem 0.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: '0.25rem' }}>{stat.label}</div>
                                        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: stat.color }}>{stat.val}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                                <h4 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', margin: '0 0 0.5rem' }}>Validation Dimension Scores</h4>
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
                                        <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${dim.val}%`, background: '#6366f1', borderRadius: '999px' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <AlertCircle size={14} style={{ color: '#f59e0b' }} />
                                    Anomaly & Issue Logs ({validationReport.issues.length} instances)
                                </h4>

                                {validationReport.issues.length === 0 ? (
                                    <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                        <CheckCircle2 size={16} />
                                        <span>All rows passed verification. The dataset is fully compliant with the contract boundaries!</span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#ffffff' }}>
                                        {validationReport.issues.map((iss, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                                                <span className={`dc-recent-badge ${iss.severity === 'error' ? 'error' : 'warning'}`} style={{ fontSize: '0.5625rem', padding: '1px 5px', textTransform: 'uppercase', marginTop: '1px' }}>
                                                    {iss.severity}
                                                </span>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>Row {iss.row + 1}: Field `{iss.field}` failed `{iss.rule}`</div>
                                                    <div style={{ color: '#64748b', fontSize: '0.6875rem', marginTop: '0.125rem' }}>
                                                        Expected: <span style={{ color: '#10b981' }}>{iss.expected}</span> | Actual: <span style={{ color: '#ef4444' }}>{iss.actual}</span>
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
                <div className="dcs-backdrop" onClick={() => setShowNewContractModal(false)}>
                    <div className="dcs-modal" onClick={e => e.stopPropagation()}>
                        <div className="dcs-modal-header">
                            <h3>Create New Contract Spec</h3>
                            <button onClick={() => setShowNewContractModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="dcs-modal-body">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Contract Name *</label>
                                <Input
                                    placeholder="e.g. Sales Pipeline Schema"
                                    value={newContractName}
                                    onChange={e => setNewContractName(e.target.value)}
                                    style={{ fontSize: '0.8125rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Domain</label>
                                <Input
                                    placeholder="e.g. E-Commerce, Operations, Marketing"
                                    value={newContractDomain}
                                    onChange={e => setNewContractDomain(e.target.value)}
                                    style={{ fontSize: '0.8125rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Dataset Source</label>
                                    <select
                                        value={newContractDatasetId}
                                        onChange={e => setNewContractDatasetId(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff' }}
                                    >
                                        <option value="">Create blank spec...</option>
                                        {datasets.map(ds => (
                                            <option key={ds.id} value={ds.id}>{ds.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Initial Version</label>
                                    <Input
                                        placeholder="1.0.0"
                                        value={newContractVersion}
                                        onChange={e => setNewContractVersion(e.target.value)}
                                        style={{ fontSize: '0.8125rem' }}
                                    />
                                </div>
                            </div>

                            {newContractDatasetId && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.15)', fontSize: '0.75rem', color: '#6366f1' }}>
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
