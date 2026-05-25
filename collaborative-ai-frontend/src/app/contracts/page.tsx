'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Stepper } from '@/components/ui/Stepper';
import {
    FileJson, PlusCircle, Save, Sparkles, Search, Copy, Trash2, X,
    ToggleLeft, ArrowLeft, Plus, CheckCircle2, AlertTriangle, Info,
    Type, Hash, Calendar, ToggleRight, Key, Percent, Clock, Layers, List,
    Zap, MessageSquare, Shield, ChevronRight
} from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';
import { apiClient } from '@/lib/apiClient';
import './contracts.css';

// ── Type Definitions ──

interface ContractSchema {
    id: string;
    name: string;
    domain: string;
    version: string;
    schemaDef: string | SchemaField[];
    status: string;
    enforcementMode?: string;
    autoCreated?: boolean;
    createdAt: string;
    updatedAt: string;
}

interface SchemaField {
    name: string;
    type: string;
    required: boolean;
    description: string;
}

interface ValidationIssue {
    severity: 'error' | 'warning' | 'suggestion';
    field: string | null;
    category: string;
    message: string;
    suggestedFix: Record<string, any> | null;
}

// ── Helpers ──

const TYPE_ICONS: Record<string, React.ReactNode> = {
    String: <Type size={14} />,
    Integer: <Hash size={14} />,
    Float: <Percent size={14} />,
    Date: <Calendar size={14} />,
    Boolean: <ToggleLeft size={14} />,
    UUID: <Key size={14} />,
    Time: <Clock size={14} />,
    Object: <Layers size={14} />,
    Array: <List size={14} />,
};

const ALL_TYPES = ['String', 'Integer', 'Float', 'Date', 'Boolean', 'UUID', 'Time', 'Object', 'Array'];

const BUILDER_STEPS = ['Basics', 'Schema Fields', 'AI Validation', 'Review & Save'];

function parseSchema(schemaDef: string | SchemaField[]): SchemaField[] {
    if (Array.isArray(schemaDef)) return schemaDef;
    try { return JSON.parse(schemaDef); } catch { return []; }
}

function timeAgo(dateString: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const SAMPLE_SCHEMA: SchemaField[] = [
    { name: 'id', type: 'UUID', required: true, description: 'Unique identifier' },
    { name: 'customer_name', type: 'String', required: true, description: 'Full name of the customer' },
    { name: 'email', type: 'String', required: true, description: 'Customer email address' },
    { name: 'order_total', type: 'Float', required: true, description: 'Total order amount in USD' },
    { name: 'is_active', type: 'Boolean', required: false, description: 'Whether the customer account is active' },
    { name: 'created_at', type: 'Date', required: true, description: 'Record creation timestamp' },
];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function ContractsPage() {
    // ── State ──
    const [view, setView] = useState<'list' | 'builder'>('list');
    const [contracts, setContracts] = useState<ContractSchema[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Draft' | 'Active'>('all');

    // Builder state
    const [builderStep, setBuilderStep] = useState(0);
    const [editingContract, setEditingContract] = useState<ContractSchema | null>(null);
    const [contractName, setContractName] = useState('');
    const [contractDomain, setContractDomain] = useState('');
    const [contractVersion, setContractVersion] = useState('1.0.0');
    const [contractEnforcementMode, setContractEnforcementMode] = useState<'strict' | 'warning' | 'monitor'>('monitor');
    const [fields, setFields] = useState<SchemaField[]>([]);
    const [activateOnSave, setActivateOnSave] = useState(false);

    // Validation
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [validationScore, setValidationScore] = useState<number | null>(null);
    const [validationSummary, setValidationSummary] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [ignoredIssues, setIgnoredIssues] = useState<Set<number>>(new Set());

    // AI
    const [isSaving, setIsSaving] = useState(false);
    const [isImproving, setIsImproving] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
    const [chatMessage, setChatMessage] = useState('');
    const [isChatting, setIsChatting] = useState(false);

    const { showToast } = useToast();

    // ── Load contracts ──
    useEffect(() => {
        loadContracts();
    }, []);

    const loadContracts = async () => {
        try {
            const data = await apiClient.get('/data/contracts');
            if (data) setContracts(data);
        } catch (e) {
            console.error('Failed to load contracts', e);
        }
    };

    // ── Contract List Actions ──
    const handleNewContract = () => {
        setEditingContract(null);
        setContractName('');
        setContractDomain('');
        setContractVersion('1.0.0');
        setContractEnforcementMode('monitor');
        setFields([]);
        setBuilderStep(0);
        setValidationIssues([]);
        setValidationScore(null);
        setIgnoredIssues(new Set());
        setActivateOnSave(false);
        setChatHistory([]);
        setView('builder');
    };

    const handleUseSample = () => {
        setEditingContract(null);
        setContractName('Sample E-Commerce Contract');
        setContractDomain('E-Commerce');
        setContractVersion('1.0.0');
        setFields([...SAMPLE_SCHEMA]);
        setBuilderStep(0);
        setValidationIssues([]);
        setValidationScore(null);
        setIgnoredIssues(new Set());
        setActivateOnSave(false);
        setChatHistory([]);
        setView('builder');
        showToast('Sample contract loaded! Walk through the steps to save it.', 'info');
    };

    const handleEditContract = (contract: ContractSchema) => {
        setEditingContract(contract);
        setContractName(contract.name);
        setContractDomain(contract.domain);
        setContractVersion(contract.version || '1.0.0');
        setContractEnforcementMode((contract.enforcementMode as any) || 'monitor');
        setFields(parseSchema(contract.schemaDef));
        setBuilderStep(0);
        setValidationIssues([]);
        setValidationScore(null);
        setIgnoredIssues(new Set());
        setActivateOnSave(contract.status === 'Active');
        setChatHistory([]);
        setView('builder');
    };

    const handleDuplicate = async (contract: ContractSchema) => {
        try {
            await apiClient.post(`/data/contracts/${contract.id}/duplicate`, {});
            showToast(`"${contract.name}" duplicated.`, 'success');
            loadContracts();
        } catch { showToast('Failed to duplicate.', 'error'); }
    };

    const handleToggleStatus = async (contract: ContractSchema) => {
        try {
            await apiClient.patch(`/data/contracts/${contract.id}/status`, {});
            showToast(`Contract ${contract.status === 'Active' ? 'deactivated' : 'activated'}.`, 'success');
            loadContracts();
        } catch { showToast('Failed to toggle status.', 'error'); }
    };

    const handleDelete = async (contract: ContractSchema) => {
        if (!confirm(`Delete "${contract.name}"? This cannot be undone.`)) return;
        try {
            await apiClient.delete(`/data/contracts/${contract.id}`);
            showToast('Contract deleted.', 'success');
            loadContracts();
        } catch { showToast('Failed to delete.', 'error'); }
    };

    // ── Builder Logic ──
    const handleFieldChange = (index: number, key: keyof SchemaField, value: any) => {
        setFields(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [key]: value };
            return updated;
        });
    };

    const handleAddField = () => {
        setFields(prev => [...prev, { name: '', type: 'String', required: false, description: '' }]);
    };

    const handleRemoveField = (index: number) => {
        setFields(prev => prev.filter((_, i) => i !== index));
    };

    // ── AI Actions ──
    const handleValidate = async () => {
        setIsValidating(true);
        setIgnoredIssues(new Set());
        try {
            const result = await apiClient.post('/ai/validate-schema', {
                schema: fields,
                contractName,
            });
            setValidationIssues(result?.issues || []);
            setValidationScore(result?.score ?? null);
            setValidationSummary(result?.summary || '');
        } catch {
            showToast('AI validation failed. You can still save.', 'error');
            setValidationIssues([]);
            setValidationScore(null);
        } finally {
            setIsValidating(false);
        }
    };

    const handleImproveWithAI = async () => {
        setIsImproving(true);
        try {
            const response = await apiClient.post('/ai/suggest-schema', { currentSchema: fields });
            if (response?.improvedSchema) {
                setFields(response.improvedSchema);
                showToast('AI improved your schema. Review the changes!', 'success');
            }
        } catch { showToast('AI engine unavailable.', 'error'); }
        finally { setIsImproving(false); }
    };

    const handleFixIssue = (issue: ValidationIssue) => {
        if (!issue.suggestedFix || !issue.field) return;
        const fieldIdx = fields.findIndex(f => f.name === issue.field);
        if (fieldIdx >= 0) {
            const updated = [...fields];
            updated[fieldIdx] = { ...updated[fieldIdx], ...issue.suggestedFix };
            setFields(updated);
            showToast(`Fixed: ${issue.field}`, 'success');
        }
        setValidationIssues(prev => prev.filter(i => i !== issue));
    };

    const handleFixAll = () => {
        let updatedFields = [...fields];
        validationIssues.forEach(issue => {
            if (issue.suggestedFix && issue.field && !ignoredIssues.has(validationIssues.indexOf(issue))) {
                const idx = updatedFields.findIndex(f => f.name === issue.field);
                if (idx >= 0) {
                    updatedFields[idx] = { ...updatedFields[idx], ...issue.suggestedFix };
                }
            }
        });
        setFields(updatedFields);
        setValidationIssues(prev => prev.filter((_, i) => ignoredIssues.has(i)));
        showToast('All fixable issues resolved!', 'success');
    };

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatMessage.trim()) return;
        const context = `Context: Contract "${contractName}", domain "${contractDomain}". Schema: ${JSON.stringify(fields)}`;
        const prompt = `${context}\n\nUser: ${chatMessage}`;
        const newHistory = [...chatHistory, { role: 'user', content: chatMessage }];
        setChatHistory(newHistory);
        setChatMessage('');
        setIsChatting(true);
        try {
            const res = await apiClient.post('/ai/chat', { message: prompt });
            if (res?.reply) setChatHistory([...newHistory, { role: 'ai', content: res.reply }]);
        } catch { showToast('AI is unavailable.', 'error'); }
        finally { setIsChatting(false); }
    };

    // ── Save Contract ──
    const handleSave = async () => {
        if (!contractName.trim()) { showToast('Contract name is required.', 'error'); return; }
        if (fields.length === 0) { showToast('Add at least one field.', 'error'); return; }

        setIsSaving(true);
        try {
            if (editingContract) {
                await apiClient.patch(`/data/contracts/${editingContract.id}`, {
                    name: contractName,
                    domain: contractDomain,
                    version: contractVersion,
                    schemaDef: fields,
                    enforcementMode: contractEnforcementMode,
                });
                if (activateOnSave && editingContract.status !== 'Active') {
                    await apiClient.patch(`/data/contracts/${editingContract.id}/status`, {});
                }
                showToast('Contract updated successfully!', 'success');
            } else {
                const created = await apiClient.post('/data/contracts', {
                    name: contractName,
                    domain: contractDomain,
                    version: contractVersion,
                    schemaDef: fields,
                    enforcementMode: contractEnforcementMode,
                });
                if (activateOnSave && created?.id) {
                    await apiClient.patch(`/data/contracts/${created.id}/status`, {});
                }
                showToast('Contract created successfully!', 'success');
            }
            await loadContracts();
            setView('list');
        } catch { showToast('Failed to save contract.', 'error'); }
        finally { setIsSaving(false); }
    };

    // ── Builder Step Navigation ──
    const handleBuilderNext = async () => {
        if (builderStep === 0) {
            if (!contractName.trim()) { showToast('Enter a contract name.', 'error'); return; }
        }
        if (builderStep === 1) {
            if (fields.length === 0) { showToast('Add at least one field.', 'error'); return; }
            const emptyNames = fields.some(f => !f.name.trim());
            if (emptyNames) { showToast('All fields must have a name.', 'error'); return; }
        }
        if (builderStep === 2 && validationScore === null) {
            await handleValidate();
        }
        if (builderStep === 3) {
            await handleSave();
            return;
        }
        setBuilderStep(prev => Math.min(prev + 1, BUILDER_STEPS.length - 1));
    };

    const handleBuilderBack = () => {
        setBuilderStep(prev => Math.max(prev - 1, 0));
    };

    // ── Filtered Contracts ──
    const filteredContracts = contracts.filter(c => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return c.name.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q);
        }
        return true;
    });

    // ── AI context actions for sidebar ──
    const getQuickActions = () => {
        switch (builderStep) {
            case 0: return [
                { label: 'Suggest a domain', icon: <Sparkles size={14} />, action: () => { setChatMessage('Suggest a domain for this contract'); } },
            ];
            case 1: return [
                { label: 'Add common fields', icon: <Plus size={14} />, action: () => {
                    const commonFields: SchemaField[] = [
                        { name: 'id', type: 'UUID', required: true, description: 'Unique identifier' },
                        { name: 'created_at', type: 'Date', required: true, description: 'Creation timestamp' },
                        { name: 'updated_at', type: 'Date', required: false, description: 'Last update timestamp' },
                    ];
                    const existingNames = new Set(fields.map(f => f.name));
                    const toAdd = commonFields.filter(f => !existingNames.has(f.name));
                    if (toAdd.length) { setFields(prev => [...prev, ...toAdd]); showToast(`Added ${toAdd.length} common fields.`, 'success'); }
                    else showToast('Common fields already exist.', 'info');
                }},
                { label: 'Optimize with AI', icon: <Zap size={14} />, action: handleImproveWithAI },
                { label: 'Generate descriptions', icon: <MessageSquare size={14} />, action: handleImproveWithAI },
            ];
            case 2: return [
                { label: 'Re-validate', icon: <Shield size={14} />, action: handleValidate },
                { label: 'Fix all issues', icon: <Zap size={14} />, action: handleFixAll },
            ];
            case 3: return [
                { label: 'Summarize contract', icon: <MessageSquare size={14} />, action: () => { setChatMessage('Summarize this entire contract in 2-3 sentences.'); } },
            ];
            default: return [];
        }
    };

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    if (view === 'builder') {
        return (
            <div className="contracts-page">
                <div className="contracts-page-header">
                    <div>
                        <Button variant="secondary" onClick={() => setView('list')} icon={<ArrowLeft size={16} />}>
                            Back to List
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        {editingContract ? `Edit: ${editingContract.name}` : 'New Contract'}
                    </CardHeader>
                    <CardContent>
                        <Stepper steps={BUILDER_STEPS} currentStep={builderStep} />

                        <div className="contract-builder" style={{ marginTop: '1.5rem' }}>
                            <div className="contract-builder-main">
                                {/* ── Step 0: Basics ── */}
                                {builderStep === 0 && (
                                    <div className="builder-step" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '500px' }}>
                                        <h3>Contract Details</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                            Give your contract a clear name and categorize it by domain.
                                        </p>
                                        <Input
                                            label="Contract Name *"
                                            placeholder="e.g., Customer Orders Schema"
                                            value={contractName}
                                            onChange={e => setContractName(e.target.value)}
                                        />
                                        <Input
                                            label="Domain"
                                            placeholder="e.g., E-Commerce, Marketing, Finance"
                                            value={contractDomain}
                                            onChange={e => setContractDomain(e.target.value)}
                                        />
                                        <Input
                                            label="Version"
                                            placeholder="1.0.0"
                                            value={contractVersion}
                                            onChange={e => setContractVersion(e.target.value)}
                                        />
                                        <div className="input-wrapper">
                                            <label className="input-label">Enforcement Mode</label>
                                            <select
                                                className="input-field"
                                                value={contractEnforcementMode}
                                                onChange={e => setContractEnforcementMode(e.target.value as any)}
                                            >
                                                <option value="monitor">Monitor — log issues silently</option>
                                                <option value="warning">Warning — store all, attach report</option>
                                                <option value="strict">Strict — reject invalid rows</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* ── Step 1: Schema Editor ── */}
                                {builderStep === 1 && (
                                    <div className="builder-step">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <div>
                                                <h3>Define Your Fields</h3>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                                    Each card represents a field in your data contract. Set the name, type, and description.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="field-cards">
                                            {fields.map((field, idx) => (
                                                <div key={idx} className="field-card">
                                                    <div className="field-card-header">
                                                        <div className="field-card-name-row">
                                                            <span className={`type-badge type-badge--${field.type}`}>
                                                                {TYPE_ICONS[field.type] || <Type size={14} />}
                                                                {field.type}
                                                            </span>
                                                            <input
                                                                value={field.name}
                                                                onChange={e => handleFieldChange(idx, 'name', e.target.value)}
                                                                placeholder="field_name"
                                                            />
                                                        </div>
                                                        <div className="field-card-controls">
                                                            <label className="toggle-switch">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={field.required}
                                                                    onChange={e => handleFieldChange(idx, 'required', e.target.checked)}
                                                                />
                                                                <span className="toggle-track" />
                                                                Required
                                                            </label>
                                                            <button className="field-card-remove" onClick={() => handleRemoveField(idx)} title="Remove field">
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="field-card-body">
                                                        <div className="input-wrapper">
                                                            <label className="input-label">Data Type</label>
                                                            <select
                                                                className="input-field"
                                                                value={field.type}
                                                                onChange={e => handleFieldChange(idx, 'type', e.target.value)}
                                                            >
                                                                {ALL_TYPES.map(t => <option key={t}>{t}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="input-wrapper field-card-desc">
                                                            <label className="input-label">Description</label>
                                                            <input
                                                                className="input-field"
                                                                value={field.description}
                                                                onChange={e => handleFieldChange(idx, 'description', e.target.value)}
                                                                placeholder="Brief description of this field..."
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            <button className="add-field-btn" onClick={handleAddField}>
                                                <Plus size={18} /> Add Field
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ── Step 2: AI Validation ── */}
                                {builderStep === 2 && (
                                    <div className="builder-step">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <div>
                                                <h3>AI Validation</h3>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                                    Our AI has analyzed your schema for potential issues.
                                                </p>
                                            </div>
                                            {!isValidating && validationScore === null && (
                                                <Button variant="primary" onClick={handleValidate} icon={<Shield size={16} />}>
                                                    Run Validation
                                                </Button>
                                            )}
                                        </div>

                                        {isValidating && (
                                            <div style={{ textAlign: 'center', padding: '3rem' }}>
                                                <div className="spinner" style={{ width: 32, height: 32, border: '3px solid var(--primary-color)', borderTopColor: 'transparent', margin: '0 auto 1rem' }} />
                                                <p style={{ color: 'var(--text-secondary)' }}>AI is analyzing your schema...</p>
                                            </div>
                                        )}

                                        {!isValidating && validationScore !== null && (
                                            <>
                                                <div className="validation-header">
                                                    <div className="validation-score">
                                                        <div className={`validation-score-circle ${validationScore >= 80 ? 'good' : validationScore >= 50 ? 'ok' : 'bad'}`}>
                                                            {validationScore}
                                                        </div>
                                                        <div className="validation-score-text">
                                                            <strong>Quality Score</strong>
                                                            {validationSummary}
                                                        </div>
                                                    </div>
                                                    {validationIssues.length > 0 && (
                                                        <Button variant="primary" onClick={handleFixAll} icon={<Zap size={14} />}>
                                                            Fix All Issues
                                                        </Button>
                                                    )}
                                                </div>

                                                {validationIssues.length > 0 ? (
                                                    <div className="validation-issues">
                                                        {validationIssues.map((issue, idx) => {
                                                            if (ignoredIssues.has(idx)) return null;
                                                            return (
                                                                <div key={idx} className="validation-issue">
                                                                    <div className={`validation-issue-icon ${issue.severity}`}>
                                                                        {issue.severity === 'error' ? <AlertTriangle size={14} /> :
                                                                            issue.severity === 'warning' ? <AlertTriangle size={14} /> :
                                                                                <Info size={14} />}
                                                                    </div>
                                                                    <div className="validation-issue-content">
                                                                        <div className="validation-issue-message">{issue.message}</div>
                                                                        {issue.field && <div className="validation-issue-field">Field: {issue.field}</div>}
                                                                    </div>
                                                                    <div className="validation-issue-actions">
                                                                        {issue.suggestedFix && (
                                                                            <button className="validation-fix-btn fix" onClick={() => handleFixIssue(issue)}>
                                                                                Fix
                                                                            </button>
                                                                        )}
                                                                        <button className="validation-fix-btn ignore" onClick={() => setIgnoredIssues(prev => new Set(prev).add(idx))}>
                                                                            Ignore
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="validation-empty">
                                                        <div className="validation-empty-icon">
                                                            <CheckCircle2 size={28} />
                                                        </div>
                                                        <h3>All Clear!</h3>
                                                        <p>No issues detected. Your schema looks great.</p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* ── Step 3: Review & Save ── */}
                                {builderStep === 3 && (
                                    <div className="builder-step">
                                        <h3>Review & Save</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                            Review your contract details before saving.
                                        </p>

                                        <div className="review-summary">
                                            <div className="review-section">
                                                <h4>Contract Details</h4>
                                                <div className="review-detail-row">
                                                    <span className="review-detail-label">Name</span>
                                                    <span className="review-detail-value">{contractName}</span>
                                                </div>
                                                <div className="review-detail-row">
                                                    <span className="review-detail-label">Domain</span>
                                                    <span className="review-detail-value">{contractDomain || '—'}</span>
                                                </div>
                                                <div className="review-detail-row">
                                                    <span className="review-detail-label">Version</span>
                                                    <span className="review-detail-value">{contractVersion}</span>
                                                </div>
                                                <div className="review-detail-row">
                                                    <span className="review-detail-label">Total Fields</span>
                                                    <span className="review-detail-value">{fields.length}</span>
                                                </div>
                                                {validationScore !== null && (
                                                    <div className="review-detail-row">
                                                        <span className="review-detail-label">Quality Score</span>
                                                        <span className="review-detail-value" style={{ color: validationScore >= 80 ? 'var(--success-color)' : 'var(--warning-color)' }}>
                                                            {validationScore}/100
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="review-section">
                                                <h4>Fields</h4>
                                                <div className="review-fields-mini">
                                                    {fields.map((f, i) => (
                                                        <span key={i} className="review-field-tag">
                                                            {TYPE_ICONS[f.type]}
                                                            {f.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="review-activate">
                                                <div className="review-activate-text">
                                                    Activate this contract?
                                                    <span>Active contracts enforce data quality rules.</span>
                                                </div>
                                                <label className="toggle-switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={activateOnSave}
                                                        onChange={e => setActivateOnSave(e.target.checked)}
                                                    />
                                                    <span className="toggle-track" />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── AI Sidebar ── */}
                            <div className="contract-builder-sidebar">
                                <div className="ai-sidebar">
                                    <div className="ai-sidebar-header">
                                        <Sparkles size={16} /> AI Assistant
                                    </div>
                                    <div className="ai-sidebar-content">
                                        <div className="ai-quick-actions">
                                            {getQuickActions().map((action, i) => (
                                                <button key={i} className="ai-quick-action" onClick={action.action} disabled={isImproving}>
                                                    {action.icon} {action.label} <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                                                </button>
                                            ))}
                                        </div>

                                        <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }} />

                                        <div className="ai-chat-area">
                                            {chatHistory.length === 0 ? (
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', textAlign: 'center', marginTop: '1rem' }}>
                                                    Ask me anything about your contract...
                                                </p>
                                            ) : chatHistory.map((msg, i) => (
                                                <div key={i} className={`ai-chat-msg ${msg.role}`}>
                                                    {msg.content.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                                                        part.startsWith('**') && part.endsWith('**')
                                                            ? <strong key={j}>{part.slice(2, -2)}</strong>
                                                            : part.split(/(`[^`]+`)/g).map((sub, k) =>
                                                                sub.startsWith('`') && sub.endsWith('`')
                                                                    ? <code key={k} style={{ backgroundColor: msg.role === 'user' ? 'rgba(255,255,255,0.2)' : 'var(--bg-color)', padding: '0 3px', borderRadius: '3px', fontSize: '0.72rem' }}>{sub.slice(1, -1)}</code>
                                                                    : sub
                                                            )
                                                    )}
                                                </div>
                                            ))}
                                            {isChatting && <div className="ai-chat-msg ai">Thinking...</div>}
                                        </div>
                                    </div>
                                    <form className="ai-sidebar-footer" onSubmit={handleChatSubmit}>
                                        <input
                                            className="input-field"
                                            placeholder="Ask AI..."
                                            value={chatMessage}
                                            onChange={e => setChatMessage(e.target.value)}
                                            disabled={isChatting}
                                        />
                                        <Button type="submit" variant="primary" disabled={isChatting || !chatMessage.trim()}>
                                            Send
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Button variant="secondary" onClick={builderStep === 0 ? () => setView('list') : handleBuilderBack}>
                            {builderStep === 0 ? 'Cancel' : 'Back'}
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleBuilderNext}
                            disabled={isSaving || isValidating}
                            icon={builderStep === 3 ? <Save size={16} /> : undefined}
                        >
                            {isSaving ? 'Saving...' : builderStep === 3 ? (editingContract ? 'Save Changes' : 'Create Contract') : 'Continue'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // CONTRACT LIST VIEW
    // ═══════════════════════════════════════════════════════════

    return (
        <div className="contracts-page">
            <div className="contracts-page-header">
                <div>
                    <h1>Data Contracts</h1>
                    <p>Define and manage the shape of your data with AI-powered validation.</p>
                </div>
                <Button variant="primary" onClick={handleNewContract} icon={<PlusCircle size={16} />}>
                    New Contract
                </Button>
            </div>

            {/* Search & Filter */}
            <div className="contracts-toolbar">
                <div className="contracts-search">
                    <Search size={16} className="contracts-search-icon" />
                    <input
                        placeholder="Search contracts..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="contracts-filter-pills">
                    {(['all', 'Draft', 'Active'] as const).map(filter => (
                        <button
                            key={filter}
                            className={`contracts-filter-pill ${statusFilter === filter ? 'active' : ''}`}
                            onClick={() => setStatusFilter(filter)}
                        >
                            {filter === 'all' ? 'All' : filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Contracts Grid or Empty State */}
            {contracts.length === 0 ? (
                <div className="contracts-empty">
                    <div className="contracts-empty-icon">
                        <FileJson size={36} />
                    </div>
                    <h2>No contracts yet</h2>
                    <p>Data contracts define the shape of your data — field names, types, and rules. Create one to get started.</p>
                    <div className="contracts-empty-actions">
                        <Button variant="primary" onClick={handleNewContract} icon={<PlusCircle size={16} />}>
                            Create Your First Contract
                        </Button>
                        <Button variant="outline" onClick={handleUseSample}>
                            Use a Sample Contract
                        </Button>
                    </div>
                </div>
            ) : filteredContracts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No contracts match your search.
                </div>
            ) : (
                <div className="contracts-grid">
                    {filteredContracts.map(contract => {
                        const fieldCount = parseSchema(contract.schemaDef).length;
                        return (
                            <div
                                key={contract.id}
                                className="contract-list-card"
                                onClick={() => handleEditContract(contract)}
                            >
                                <div className="contract-list-card-header">
                                    <div className="contract-list-card-title">
                                        <FileJson size={18} color="var(--primary-color)" />
                                        {contract.name}
                                    </div>
                                    <div className="contract-list-card-actions" onClick={e => e.stopPropagation()}>
                                        <button className="contract-action-btn" title="Duplicate" onClick={() => handleDuplicate(contract)}>
                                            <Copy size={14} />
                                        </button>
                                        <button className="contract-action-btn" title={contract.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => handleToggleStatus(contract)}>
                                            {contract.status === 'Active' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                        </button>
                                        <button className="contract-action-btn danger" title="Delete" onClick={() => handleDelete(contract)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="contract-list-card-meta">
                                    <span className={`contract-status-dot ${contract.status === 'Active' ? 'active' : 'draft'}`} />
                                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{contract.status}</span>
                                    {contract.domain && <span className="contract-badge contract-badge--domain">{contract.domain}</span>}
                                    <span className="contract-badge contract-badge--version">v{contract.version || '1.0.0'}</span>
                                    {(contract as any).autoCreated && (
                                        <span className="contract-badge contract-badge--auto">Auto-generated</span>
                                    )}
                                    {(contract as any).enforcementMode && (
                                        <span className={`contract-badge contract-badge--enforcement contract-badge--enforcement-${(contract as any).enforcementMode}`}>
                                            {(contract as any).enforcementMode}
                                        </span>
                                    )}
                                </div>

                                <div className="contract-list-card-footer">
                                    <span className="contract-field-count">
                                        <Layers size={12} /> {fieldCount} fields
                                    </span>
                                    <span>{timeAgo(contract.updatedAt)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
