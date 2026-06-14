'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/providers/ToastProvider';
import { apiClient } from '@/lib/apiClient';
import { 
    Bell, ArrowLeft, ShieldAlert, Database, CheckCircle2, Wand2, GitMerge,
    Network, BarChart3, FileText, Sparkles, Settings, Check, Archive, Trash2,
    Calendar, AlertTriangle, Info, Shield, Layers, HelpCircle
} from 'lucide-react';

interface Notification {
    id: string;
    title: string;
    description: string;
    type: string;
    read: boolean;
    archived: boolean;
    priority: string;
    actionUrl?: string;
    createdAt: string;
}

export default function NotificationDetailsPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { showToast } = useToast();

    const [notification, setNotification] = useState<Notification | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!id) return;
        
        const fetchDetails = async () => {
            setLoading(true);
            setError(false);
            try {
                const res = await apiClient.get(`/data/notifications/${id}`);
                if (res && res.id) {
                    setNotification(res);
                } else {
                    setError(true);
                }
            } catch (err) {
                console.error('Failed to load notification details:', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [id]);

    const handleMarkAsRead = async () => {
        if (!notification) return;
        try {
            await apiClient.patch(`/data/notifications/${notification.id}/read`, {});
            setNotification(prev => prev ? { ...prev, read: true } : null);
            showToast('Notification marked as read', 'success');
        } catch {
            showToast('Failed to update status', 'error');
        }
    };

    const handleArchive = async () => {
        if (!notification) return;
        try {
            await apiClient.patch(`/data/notifications/${notification.id}/archive`, {});
            setNotification(prev => prev ? { ...prev, archived: !prev.archived } : null);
            showToast(notification.archived ? 'Notification restored from archive' : 'Notification archived', 'success');
        } catch {
            showToast('Failed to toggle archive status', 'error');
        }
    };

    const handleDelete = async () => {
        if (!notification) return;
        if (!confirm('Are you sure you want to delete this notification permanently?')) return;
        try {
            await apiClient.delete(`/data/notifications/${notification.id}`);
            showToast('Notification deleted successfully', 'info');
            router.push('/notifications');
        } catch {
            showToast('Failed to delete notification', 'error');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
                <Loader2 className="spinner animate-spin" size={36} color="var(--primary-color)" />
                <span style={{ color: 'var(--text-secondary)' }}>Retrieving event log detail...</span>
            </div>
        );
    }

    if (error || !notification) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1.5rem', textAlign: 'center' }}>
                <AlertTriangle size={48} style={{ color: 'var(--danger-color)' }} />
                <h2>Event Log Mismatch</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '400px' }}>
                    The specified notification index could not be located in database logs. It may have been permanently deleted or moved.
                </p>
                <Button variant="primary" onClick={() => router.push('/notifications')}>
                    Return to Notification Center
                </Button>
            </div>
        );
    }

    // Category mapping
    const getCategoryDetails = (type: string) => {
        const t = type.toLowerCase();
        switch (t) {
            case 'security':
                return { icon: <ShieldAlert size={18} />, label: 'Security Alert', bg: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger-color)', module: 'Admin Security Module' };
            case 'dataset':
            case 'data sources':
                return { icon: <Database size={18} />, label: 'Data Source Ingest', bg: 'var(--primary-light)', color: 'var(--primary-color)', module: 'Data Ingestion Service' };
            case 'contract':
            case 'data contracts':
                return { icon: <CheckCircle2 size={18} />, label: 'Data Contract Governance', bg: 'rgba(16, 185, 129, 0.08)', color: '#10b981', module: 'Data Contracts Schema Registry' };
            case 'preprocessing':
                return { icon: <Wand2 size={18} />, label: 'Preprocessing Pipeline', bg: 'rgba(168, 85, 247, 0.08)', color: '#a855f7', module: 'AI Preprocessing & Standardizer' };
            case 'workflow':
                return { icon: <GitMerge size={18} />, label: 'Workflow Task', bg: 'rgba(99, 102, 241, 0.08)', color: '#6366f1', module: 'Workflow & Ingest Pipeline' };
            case 'lineage':
                return { icon: <Network size={18} />, label: 'Lineage Map', bg: 'rgba(6, 182, 212, 0.08)', color: '#06b6d4', module: 'Data Lineage Trace System' };
            case 'analytics':
                return { icon: <BarChart3 size={18} />, label: 'Analytics Dashboard', bg: 'rgba(14, 165, 233, 0.08)', color: '#0ea5e9', module: 'Visual Analytics Studio' };
            case 'reports':
                return { icon: <FileText size={18} />, label: 'Enterprise Report', bg: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', module: 'Reports & Scheduled Distributions' };
            case 'ai':
            case 'ai assistant':
                return { icon: <Sparkles size={18} />, label: 'AI Copilot Assistant', bg: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', module: 'Advanced AI Analyst / BI Copilot' };
            case 'system':
                return { icon: <Settings size={18} />, label: 'System Service', bg: 'rgba(100, 116, 139, 0.08)', color: '#64748b', module: 'Platform Architecture & IT' };
            default:
                return { icon: <Bell size={18} />, label: 'General Alert', bg: 'var(--bg-secondary)', color: 'var(--text-secondary)', module: 'Platform Notification Center' };
        }
    };

    const getRecommendedAction = (type: string) => {
        const t = type.toLowerCase();
        switch (t) {
            case 'security':
                return 'Review recent login locations and active sessions in the Security panel. Revoke other sessions if you do not recognize the host IP.';
            case 'dataset':
            case 'data sources':
                return 'Navigate to the Data Source Hub to check parsed tables, row counts, and AI-inferred quality scores for the uploaded dataset.';
            case 'contract':
            case 'data contracts':
                return 'Review governance schemas, schema version history drift, or approve evolution schemas proposed for active ingestion contracts.';
            case 'preprocessing':
                return 'Go to the Preprocessing tab to apply statistical imputation standardizations, categorical encoding operations, and fix schema anomalies.';
            case 'workflow':
                return 'Verify task progression checklist in Workflows, update assignee status mappings, or request validation reports.';
            case 'lineage':
                return 'Check the Lineage network map to trace downstream impact analysis, schema dependency relations, and quality index scores.';
            case 'analytics':
                return 'Open the Analytics Dashboard to view newly published charts and metric rollup distributions.';
            case 'reports':
                return 'Configure automated report distribution frequencies, export CSV/Excel ledgers, or modify targeted recipient lists.';
            case 'ai':
            case 'ai assistant':
                return 'Query the Data Analyst or Business Intelligence Copilot consoles directly to generate strategic business recommendations.';
            case 'system':
                return 'Ensure operational systems are backed up and notify relevant teams of planned backend maintenance operations.';
            default:
                return 'Review the alert information and check associated module registries for status metrics.';
        }
    };

    const getPriorityBadgeStyle = (priority: string) => {
        const p = priority?.toLowerCase();
        if (p === 'critical') return { color: 'var(--danger-color)', bg: 'rgba(239, 68, 68, 0.08)', label: 'CRITICAL PRIORITY' };
        if (p === 'high') return { color: 'var(--warning-color)', bg: 'rgba(245, 158, 11, 0.08)', label: 'HIGH PRIORITY' };
        if (p === 'medium') return { color: 'var(--accent-color)', bg: 'rgba(14, 165, 233, 0.08)', label: 'MEDIUM PRIORITY' };
        return { color: 'var(--text-secondary)', bg: 'rgba(100, 116, 139, 0.08)', label: 'LOW PRIORITY' };
    };

    const catDetails = getCategoryDetails(notification.type);
    const priBadge = getPriorityBadgeStyle(notification.priority);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
            {/* Back Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                    onClick={() => router.push('/notifications')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        transition: 'color 0.2s',
                        cursor: 'pointer'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-color)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                    <ArrowLeft size={16} /> Return to Notification Center
                </button>
            </div>

            {/* Main Detail Card */}
            <Card style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                <CardContent style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    {/* Category & Priority Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        {/* Category badge */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: catDetails.bg,
                            color: catDetails.color,
                            fontSize: '0.8rem',
                            fontWeight: 700
                        }}>
                            {catDetails.icon}
                            <span>{catDetails.label}</span>
                        </div>

                        {/* Priority Badge */}
                        <div style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '4px',
                            backgroundColor: priBadge.bg,
                            color: priBadge.color,
                            letterSpacing: '0.04em'
                        }}>
                            {priBadge.label}
                        </div>
                    </div>

                    {/* Title & Description section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            {notification.title}
                        </h2>
                        <p style={{ 
                            fontSize: '1rem', 
                            color: 'var(--text-primary)', 
                            lineHeight: '1.6', 
                            margin: 0, 
                            whiteSpace: 'pre-wrap', 
                            backgroundColor: 'var(--bg-secondary)', 
                            padding: '1.25rem 1.5rem', 
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)'
                        }}>
                            {notification.description}
                        </p>
                    </div>

                    {/* Meta Parameters Checklist */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <Calendar size={18} style={{ color: 'var(--text-secondary)', marginTop: '2px' }} />
                            <div>
                                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date Generated</span>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    {new Date(notification.createdAt).toLocaleString(undefined, { 
                                        weekday: 'long', 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric', 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                    })}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <Layers size={18} style={{ color: 'var(--text-secondary)', marginTop: '2px' }} />
                            <div>
                                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Related Module</span>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    {catDetails.module}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <Info size={18} style={{ color: 'var(--text-secondary)', marginTop: '2px' }} />
                            <div>
                                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status Parameters</span>
                                <span style={{ 
                                    fontSize: '0.9rem', 
                                    color: notification.read ? 'var(--text-secondary)' : 'var(--primary-color)', 
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    {notification.read ? 'Acknowledged (Read)' : 'Pending Review'}
                                    {notification.archived && ' • Archived'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Recommended Action Card */}
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        padding: '1.25rem 1.5rem',
                        backgroundColor: 'rgba(99, 102, 241, 0.03)',
                        borderRadius: '8px',
                        border: '1px dashed var(--primary-color)'
                    }}>
                        <HelpCircle size={22} style={{ color: 'var(--primary-color)', flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.785rem', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recommended Action</span>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: '1.5' }}>
                                {getRecommendedAction(notification.type)}
                            </p>
                        </div>
                    </div>

                    {/* Operations Action Bar */}
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        borderTop: '1px solid var(--border-color)', 
                        paddingTop: '1.5rem',
                        marginTop: '1rem',
                        flexWrap: 'wrap',
                        gap: '1rem'
                    }}>
                        {/* Left action: Mark read/navigate */}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            {!notification.read && (
                                <Button variant="primary" icon={<Check size={16} />} onClick={handleMarkAsRead}>
                                    Mark as Acknowledged
                                </Button>
                            )}
                            {notification.actionUrl && (
                                <Button 
                                    variant="outline" 
                                    onClick={() => router.push(notification.actionUrl || '')}
                                >
                                    Open Related Module
                                </Button>
                            )}
                        </div>

                        {/* Right action: Archive / Delete */}
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <Button 
                                variant="outline" 
                                icon={<Archive size={16} />}
                                style={{ color: 'var(--warning-color)', borderColor: 'var(--warning-color)' }}
                                onClick={handleArchive}
                            >
                                {notification.archived ? 'Restore from Archive' : 'Archive Alert'}
                            </Button>
                            <Button 
                                variant="outline" 
                                icon={<Trash2 size={16} />}
                                style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                                onClick={handleDelete}
                            >
                                Delete Permanent
                            </Button>
                        </div>
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}

// Simple loader helper
function Loader2(props: any) {
    return (
        <svg
            className={props.className}
            style={props.style}
            width={props.size || 24}
            height={props.size || 24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}
