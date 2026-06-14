'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/providers/ToastProvider';
import { apiClient } from '@/lib/apiClient';
import { 
    Bell, Search, ShieldAlert, Database, CheckCircle2, Wand2, GitMerge,
    Network, BarChart3, FileText, Sparkles, Settings, Eye, Check,
    Archive, Trash2, SlidersHorizontal, CheckCheck, Loader2, AlertTriangle, ArrowLeft
} from 'lucide-react';

interface Notification {
    id: string;
    title: string;
    description: string;
    type: string;
    read: boolean;
    archived: boolean;
    priority: string;
    createdAt: string;
}

export default function NotificationsCenterPage() {
    const { showToast } = useToast();
    const router = useRouter();

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Filters & Sorting state
    const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read' | 'archived'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'priority'>('newest');
    
    // Category checklist
    const categoriesList = [
        { key: 'security', label: 'Security' },
        { key: 'dataset', label: 'Data Sources' },
        { key: 'contract', label: 'Data Contracts' },
        { key: 'preprocessing', label: 'Preprocessing' },
        { key: 'workflow', label: 'Workflow' },
        { key: 'lineage', label: 'Lineage' },
        { key: 'analytics', label: 'Analytics' },
        { key: 'reports', label: 'Reports' },
        { key: 'ai', label: 'AI Assistant' },
        { key: 'system', label: 'System' }
    ];
    const [selectedCategories, setSelectedCategories] = useState<string[]>(categoriesList.map(c => c.key));

    const loadNotifications = async () => {
        setLoading(true);
        setError(false);
        try {
            // Fetch based on active status filter and sorting from API
            const res = await apiClient.get(`/data/notifications?status=${statusFilter}&sort=${sortOrder}`);
            if (Array.isArray(res)) {
                setNotifications(res);
            } else {
                setError(true);
            }
        } catch (err) {
            console.error('Failed to load notifications in center:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, [statusFilter, sortOrder]);

    const handleMarkAsRead = async (id: string) => {
        try {
            await apiClient.patch(`/data/notifications/${id}/read`, {});
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            showToast('Notification marked as read', 'success');
        } catch {
            showToast('Failed to mark read', 'error');
        }
    };

    const handleArchive = async (id: string) => {
        try {
            await apiClient.patch(`/data/notifications/${id}/archive`, {});
            // If we are showing archived, toggle status, otherwise remove from current view
            if (statusFilter === 'archived') {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, archived: false } : n));
                showToast('Notification unarchived', 'success');
            } else {
                setNotifications(prev => prev.filter(n => n.id !== id));
                showToast('Notification archived', 'success');
            }
        } catch {
            showToast('Failed to toggle archive status', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this notification permanently?')) return;
        try {
            await apiClient.delete(`/data/notifications/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
            showToast('Notification deleted successfully', 'info');
        } catch {
            showToast('Failed to delete notification', 'error');
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await apiClient.post('/data/notifications/mark-all-read', {});
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            showToast('All notifications marked as read', 'success');
        } catch {
            showToast('Failed to mark all read', 'error');
        }
    };

    const toggleCategory = (catKey: string) => {
        setSelectedCategories(prev => 
            prev.includes(catKey) ? prev.filter(k => k !== catKey) : [...prev, catKey]
        );
    };

    const toggleAllCategories = () => {
        if (selectedCategories.length === categoriesList.length) {
            setSelectedCategories([]);
        } else {
            setSelectedCategories(categoriesList.map(c => c.key));
        }
    };

    // Client-side filtering for category checkbox list and search query
    const filteredNotifications = notifications.filter(notif => {
        const matchesCategory = selectedCategories.includes(notif.type.toLowerCase()) || 
                               (notif.type.toLowerCase() === 'ai assistant' && selectedCategories.includes('ai')) ||
                               (notif.type.toLowerCase() === 'data sources' && selectedCategories.includes('dataset')) ||
                               (notif.type.toLowerCase() === 'data contracts' && selectedCategories.includes('contract'));
        const matchesSearch = notif.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             notif.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const getCategoryDetails = (type: string) => {
        const t = type.toLowerCase();
        switch (t) {
            case 'security':
                return { icon: <ShieldAlert size={14} style={{ color: 'var(--danger-color)' }} />, label: 'Security', bg: 'rgba(239, 68, 68, 0.08)' };
            case 'dataset':
            case 'data sources':
                return { icon: <Database size={14} style={{ color: 'var(--primary-color)' }} />, label: 'Data Sources', bg: 'var(--primary-light)' };
            case 'contract':
            case 'data contracts':
                return { icon: <CheckCircle2 size={14} style={{ color: '#10b981' }} />, label: 'Data Contracts', bg: 'rgba(16, 185, 129, 0.08)' };
            case 'preprocessing':
                return { icon: <Wand2 size={14} style={{ color: '#a855f7' }} />, label: 'Preprocessing', bg: 'rgba(168, 85, 247, 0.08)' };
            case 'workflow':
                return { icon: <GitMerge size={14} style={{ color: '#6366f1' }} />, label: 'Workflow', bg: 'rgba(99, 102, 241, 0.08)' };
            case 'lineage':
                return { icon: <Network size={14} style={{ color: '#06b6d4' }} />, label: 'Lineage', bg: 'rgba(6, 182, 212, 0.08)' };
            case 'analytics':
                return { icon: <BarChart3 size={14} style={{ color: '#0ea5e9' }} />, label: 'Analytics', bg: 'rgba(14, 165, 233, 0.08)' };
            case 'reports':
                return { icon: <FileText size={14} style={{ color: '#f59e0b' }} />, label: 'Reports', bg: 'rgba(245, 158, 11, 0.08)' };
            case 'ai':
            case 'ai assistant':
                return { icon: <Sparkles size={14} style={{ color: '#8b5cf6' }} />, label: 'AI Assistant', bg: 'rgba(139, 92, 246, 0.08)' };
            case 'system':
                return { icon: <Settings size={14} style={{ color: '#64748b' }} />, label: 'System', bg: 'rgba(100, 116, 139, 0.08)' };
            default:
                return { icon: <Bell size={14} />, label: 'General', bg: 'var(--bg-secondary)' };
        }
    };

    const getPriorityStyle = (priority: string) => {
        const p = priority?.toLowerCase();
        if (p === 'critical') return { borderLeft: '4px solid var(--danger-color)', color: 'var(--danger-color)', bg: 'rgba(239, 68, 68, 0.08)' };
        if (p === 'high') return { borderLeft: '4px solid var(--warning-color)', color: 'var(--warning-color)', bg: 'rgba(245, 158, 11, 0.08)' };
        if (p === 'medium') return { borderLeft: '4px solid var(--accent-color)', color: 'var(--accent-color)', bg: 'rgba(14, 165, 233, 0.08)' };
        return { borderLeft: '4px solid var(--text-secondary)', color: 'var(--text-secondary)', bg: 'rgba(100, 116, 139, 0.08)' };
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Bell size={28} color="var(--primary-color)" />
                        Notification Center Center
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Manage security events, pipeline updates, data quality audits, and AI alerts.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {notifications.some(n => !n.read) && (
                        <Button variant="outline" icon={<CheckCheck size={16} />} onClick={handleMarkAllRead}>
                            Mark All Read
                        </Button>
                    )}
                    <Button variant="primary" icon={<ArrowLeft size={16} />} onClick={() => router.push('/analytics')}>
                        Back to Dashboard
                    </Button>
                </div>
            </div>

            {/* Split layout: Filter sidebar vs. list content */}
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'flex-start' }}>
                {/* Filter Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Status selection */}
                    <Card>
                        <CardHeader style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem', fontWeight: 600 }}>
                            Status Filter
                        </CardHeader>
                        <CardContent style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {([
                                { key: 'all', label: 'All Active' },
                                { key: 'unread', label: 'Unread' },
                                { key: 'read', label: 'Read' },
                                { key: 'archived', label: 'Archived' }
                            ] as const).map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setStatusFilter(tab.key)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0.625rem 0.875rem',
                                        borderRadius: '6px',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        width: '100%',
                                        textAlign: 'left',
                                        color: statusFilter === tab.key ? 'var(--primary-color)' : 'var(--text-secondary)',
                                        backgroundColor: statusFilter === tab.key ? 'var(--primary-light)' : 'transparent',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Category Checklist */}
                    <Card>
                        <CardHeader style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Categories</span>
                            <button 
                                onClick={toggleAllCategories}
                                style={{ fontSize: '0.72rem', color: 'var(--accent-color)', fontWeight: 600 }}
                            >
                                {selectedCategories.length === categoriesList.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </CardHeader>
                        <CardContent style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                            {categoriesList.map(cat => (
                                <label key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.includes(cat.key)}
                                        onChange={() => toggleCategory(cat.key)}
                                        style={{ accentColor: 'var(--primary-color)' }}
                                    />
                                    <span>{cat.label}</span>
                                </label>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Search & Sort Panel */}
                    <Card style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            {/* Search */}
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: '240px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 0.75rem' }}>
                                <Search size={16} color="var(--text-secondary)" />
                                <input
                                    type="text"
                                    placeholder="Search details, alerts, and summaries..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        outline: 'none',
                                        padding: '0.625rem 0.5rem',
                                        fontSize: '0.875rem',
                                        color: 'var(--text-primary)',
                                        width: '100%'
                                    }}
                                />
                            </div>

                            {/* Sort & Stats */}
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sort By:</span>
                                    <select
                                        value={sortOrder}
                                        onChange={e => setSortOrder(e.target.value as any)}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '6px',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'var(--bg-color)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.8rem',
                                            fontWeight: 500
                                        }}
                                    >
                                        <option value="newest">Newest First</option>
                                        <option value="oldest">Oldest First</option>
                                        <option value="priority">Priority Order</option>
                                    </select>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    Showing {filteredNotifications.length} of {notifications.length}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Notifications Grid / List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {loading && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', gap: '1rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <Loader2 className="spinner animate-spin" size={36} color="var(--primary-color)" />
                                <span style={{ color: 'var(--text-secondary)' }}>Retrieving system logs and events...</span>
                            </div>
                        )}

                        {error && !loading && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', gap: '1rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--danger-color)' }}>
                                <AlertTriangle size={48} />
                                <h3>Sync Error</h3>
                                <p style={{ color: 'var(--text-secondary)' }}>Failed to establish connection with database storage logs.</p>
                            </div>
                        )}

                        {!loading && !error && filteredNotifications.length === 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8rem 2rem', gap: '1rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center' }}>
                                <Bell size={48} style={{ opacity: 0.3 }} />
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>No Notifications Found</h3>
                                <p style={{ color: 'var(--text-secondary)', maxWidth: '300px', fontSize: '0.875rem' }}>
                                    Try adjusting your search criteria, category filters, or toggling active/archived status tabs.
                                </p>
                            </div>
                        )}

                        {!loading && !error && filteredNotifications.length > 0 && (
                            filteredNotifications.map(notif => {
                                const cat = getCategoryDetails(notif.type);
                                const pStyle = getPriorityStyle(notif.priority);
                                return (
                                    <div
                                        key={notif.id}
                                        onClick={() => router.push(`/notifications/${notif.id}`)}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr auto',
                                            gap: '1rem',
                                            padding: '1.25rem 1.5rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            borderLeft: pStyle.borderLeft,
                                            backgroundColor: notif.read ? 'var(--card-bg)' : 'rgba(99, 102, 241, 0.02)',
                                            cursor: 'pointer',
                                            boxShadow: 'var(--shadow-sm)',
                                            transition: 'transform 0.2s, box-shadow 0.2s',
                                        }}
                                        className="notif-center-card"
                                    >
                                        {/* Left Side Info */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                {/* Category Badge */}
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                    backgroundColor: cat.bg,
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    color: 'var(--text-primary)'
                                                }}>
                                                    {cat.icon}
                                                    <span>{cat.label}</span>
                                                </div>

                                                {/* Priority Badge */}
                                                <div style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    padding: '2px 6px',
                                                    borderRadius: '3px',
                                                    backgroundColor: pStyle.bg,
                                                    color: pStyle.color,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.02em'
                                                }}>
                                                    {notif.priority} Priority
                                                </div>

                                                {/* Timestamp */}
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {new Date(notif.createdAt).toLocaleString(undefined, { 
                                                        month: 'short', 
                                                        day: 'numeric', 
                                                        hour: '2-digit', 
                                                        minute: '2-digit' 
                                                    })}
                                                </span>
                                            </div>

                                            {/* Details */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{
                                                    fontSize: '0.975rem',
                                                    fontWeight: notif.read ? 600 : 700,
                                                    color: 'var(--text-primary)'
                                                }}>
                                                    {notif.title}
                                                </span>
                                                <p style={{
                                                    fontSize: '0.85rem',
                                                    color: 'var(--text-secondary)',
                                                    margin: 0,
                                                    lineHeight: '1.5'
                                                }}>
                                                    {notif.description}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right Side Action buttons */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                            <Button
                                                variant="outline"
                                                icon={<Eye size={14} />}
                                                style={{ height: '36px', width: '36px', padding: 0 }}
                                                onClick={() => router.push(`/notifications/${notif.id}`)}
                                                title="View Details"
                                            />
                                            {!notif.read && (
                                                <Button
                                                    variant="outline"
                                                    icon={<Check size={14} />}
                                                    style={{ height: '36px', width: '36px', padding: 0, color: 'var(--success-color)' }}
                                                    onClick={() => handleMarkAsRead(notif.id)}
                                                    title="Mark as Read"
                                                />
                                            )}
                                            <Button
                                                variant="outline"
                                                icon={<Archive size={14} />}
                                                style={{ height: '36px', width: '36px', padding: 0, color: 'var(--warning-color)' }}
                                                onClick={() => handleArchive(notif.id)}
                                                title={statusFilter === 'archived' ? 'Restore from Archive' : 'Archive'}
                                            />
                                            <Button
                                                variant="outline"
                                                icon={<Trash2 size={14} />}
                                                style={{ height: '36px', width: '36px', padding: 0, color: 'var(--danger-color)' }}
                                                onClick={() => handleDelete(notif.id)}
                                                title="Delete permanently"
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Local Styles for hover interactions */}
            <style jsx global>{`
                .notif-center-card:hover {
                    transform: translateY(-2px);
                    border-color: var(--primary-color) !important;
                    box-shadow: var(--shadow-md) !important;
                }
            `}</style>
        </div>
    );
}
