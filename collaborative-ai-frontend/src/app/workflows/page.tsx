'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/providers/ToastProvider';
import { User, Clock, CheckCircle, XCircle, Plus, Trash2, AlertTriangle, ListFilter } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import './workflows.css';

interface WorkflowTask {
    id: string;
    title: string;
    description: string;
    assignee: string;
    status: string;
    priority: string;
    category: string;
    progress: number;
    dueDate: string | null;
    createdAt: string;
    updatedAt: string;
}

const STATUS_LIST = ['All', 'Pending', 'In Progress', 'Approved', 'Rejected'] as const;
const PRIORITY_LIST = ['Low', 'Medium', 'High', 'Critical'] as const;
const CATEGORY_LIST = ['General', 'Data Ingestion', 'Data Cleaning', 'Schema Validation', 'ETL Pipeline', 'Reporting'] as const;

const emptyForm = { title: '', description: '', assignee: '', priority: 'Medium' as string, category: 'General' as string, dueDate: '' };

export default function WorkflowsPage() {
    const { showToast } = useToast();
    const [tasks, setTasks] = useState<WorkflowTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [creating, setCreating] = useState(false);

    const loadTasks = useCallback(async () => {
        try {
            const data = await apiClient.get('/data/workflows');
            if (data) setTasks(data);
        } catch { showToast('Failed to load workflows.', 'error'); }
        finally { setLoading(false); }
    }, [showToast]);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    /* ── Filtered tasks ── */
    const filtered = statusFilter === 'All' ? tasks : tasks.filter(t => t.status === statusFilter);

    /* ── Stats ── */
    const countByStatus = (s: string) => tasks.filter(t => t.status === s).length;

    /* ── Actions ── */
    const updateTask = async (id: string, data: Record<string, any>) => {
        try {
            const updated = await apiClient.patch(`/data/workflows/${id}`, data);
            setTasks(prev => prev.map(t => t.id === id ? updated : t));
            showToast(`Task ${data.status ? data.status.toLowerCase() : 'updated'} successfully.`, 'success');
        } catch { showToast('Failed to update task.', 'error'); }
    };

    const deleteTask = async (id: string) => {
        try {
            await apiClient.delete(`/data/workflows/${id}`);
            setTasks(prev => prev.filter(t => t.id !== id));
            showToast('Task deleted.', 'success');
        } catch { showToast('Failed to delete task.', 'error'); }
    };

    const createTask = async () => {
        if (!form.title.trim() || !form.assignee.trim()) { showToast('Title and assignee are required.', 'info'); return; }
        setCreating(true);
        try {
            const created = await apiClient.post('/data/workflows', {
                title: form.title.trim(),
                description: form.description.trim(),
                assignee: form.assignee.trim(),
                priority: form.priority,
                category: form.category,
                status: 'Pending',
                progress: 0,
                dueDate: form.dueDate || null,
            });
            setTasks(prev => [created, ...prev]);
            setShowModal(false);
            setForm(emptyForm);
            showToast('Task created!', 'success');
        } catch { showToast('Failed to create task.', 'error'); }
        finally { setCreating(false); }
    };

    /* ── Helpers ── */
    const statusClass = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const isOverdue = (d: string | null, s: string) => {
        if (!d || s === 'Approved' || s === 'Rejected') return false;
        return new Date(d) < new Date();
    };

    return (
        <div className="wf-page">
            {/* ── Header ── */}
            <div className="wf-header">
                <div>
                    <h1>Workflows & Tasks</h1>
                    <p>Manage data pipeline tasks, approvals, and team assignments.</p>
                </div>
                <Button variant="primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Plus size={16} /> New Task
                </Button>
            </div>

            {/* ── Stats ── */}
            <div className="wf-stats">
                <div className="wf-stat-card pending">
                    <span className="label">Pending</span>
                    <span className="value">{countByStatus('Pending')}</span>
                </div>
                <div className="wf-stat-card inprogress">
                    <span className="label">In Progress</span>
                    <span className="value">{countByStatus('In Progress')}</span>
                </div>
                <div className="wf-stat-card approved">
                    <span className="label">Approved</span>
                    <span className="value">{countByStatus('Approved')}</span>
                </div>
                <div className="wf-stat-card rejected">
                    <span className="label">Rejected</span>
                    <span className="value">{countByStatus('Rejected')}</span>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="wf-filters">
                <ListFilter size={16} style={{ color: 'var(--text-secondary)' }} />
                {STATUS_LIST.map(s => (
                    <button key={s} className={`wf-filter-btn ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                        {s} {s !== 'All' ? `(${countByStatus(s)})` : `(${tasks.length})`}
                    </button>
                ))}
            </div>

            {/* ── Task List ── */}
            <div className="wf-task-list">
                {loading ? (
                    <div className="wf-empty"><p>Loading workflows...</p></div>
                ) : filtered.length === 0 ? (
                    <div className="wf-empty">
                        <p>No {statusFilter !== 'All' ? statusFilter.toLowerCase() : ''} tasks found.</p>
                    </div>
                ) : (
                    filtered.map(task => (
                        <div key={task.id} className={`wf-task-card status-${statusClass(task.status)}`}>
                            <div className="wf-task-top">
                                <div style={{ flex: 1 }}>
                                    <div className="wf-task-title">{task.title}</div>
                                    {task.description && <div className="wf-task-desc">{task.description}</div>}
                                </div>
                                <div className="wf-task-actions">
                                    {task.status === 'Pending' && (
                                        <>
                                            <button className="wf-action-btn approve" onClick={() => updateTask(task.id, { status: 'Approved', progress: 100 })}>
                                                <CheckCircle size={13} /> Approve
                                            </button>
                                            <button className="wf-action-btn reject" onClick={() => updateTask(task.id, { status: 'Rejected', progress: 0 })}>
                                                <XCircle size={13} /> Reject
                                            </button>
                                        </>
                                    )}
                                    {task.status === 'In Progress' && (
                                        <button className="wf-action-btn approve" onClick={() => updateTask(task.id, { status: 'Approved', progress: 100 })}>
                                            <CheckCircle size={13} /> Mark Complete
                                        </button>
                                    )}
                                    {task.status === 'Rejected' && (
                                        <button className="wf-action-btn" onClick={() => updateTask(task.id, { status: 'Pending', progress: 0 })}>
                                            Reopen
                                        </button>
                                    )}
                                    <button className="wf-action-btn delete" onClick={() => deleteTask(task.id)}>
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="wf-task-tags">
                                <span className={`wf-tag priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                                <span className="wf-tag category">{task.category}</span>
                                <span className={`wf-tag status-tag ${statusClass(task.status)}`}>{task.status}</span>
                                {isOverdue(task.dueDate, task.status) && (
                                    <span className="wf-tag priority-critical" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                        <AlertTriangle size={10} /> Overdue
                                    </span>
                                )}
                            </div>

                            {/* Meta */}
                            <div className="wf-task-meta">
                                <div className="wf-task-info">
                                    <span><User size={13} /> {task.assignee}</span>
                                    {task.dueDate && <span><Clock size={13} /> Due {formatDate(task.dueDate)}</span>}
                                    <span><Clock size={13} /> Created {formatDate(task.createdAt)}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <span>{task.progress}%</span>
                                    <div className="wf-progress-bar">
                                        <div className={`wf-progress-fill ${task.progress === 100 ? 'complete' : ''}`} style={{ width: `${task.progress}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* ── Create Modal ── */}
            {showModal && (
                <div className="wf-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="wf-modal" onClick={e => e.stopPropagation()}>
                        <h2>Create New Task</h2>

                        <div className="wf-modal-field">
                            <label>Title *</label>
                            <input placeholder="e.g. Review schema changes" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                        </div>

                        <div className="wf-modal-field">
                            <label>Description</label>
                            <textarea placeholder="Describe the task..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                        </div>

                        <div className="wf-modal-row">
                            <div className="wf-modal-field">
                                <label>Assignee *</label>
                                <input placeholder="e.g. Alice Engineer" value={form.assignee} onChange={e => setForm(p => ({ ...p, assignee: e.target.value }))} />
                            </div>
                            <div className="wf-modal-field">
                                <label>Priority</label>
                                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                                    {PRIORITY_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="wf-modal-row">
                            <div className="wf-modal-field">
                                <label>Category</label>
                                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                                    {CATEGORY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="wf-modal-field">
                                <label>Due Date</label>
                                <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
                            </div>
                        </div>

                        <div className="wf-modal-actions">
                            <Button variant="outline" onClick={() => { setShowModal(false); setForm(emptyForm); }}>Cancel</Button>
                            <Button variant="primary" onClick={createTask} disabled={creating}>
                                {creating ? 'Creating...' : 'Create Task'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
