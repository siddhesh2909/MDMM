'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Bell,
    ShieldAlert,
    Database,
    CheckCircle2,
    Wand2,
    GitMerge,
    Network,
    BarChart3,
    FileText,
    Sparkles,
    Settings,
    Clock,
    Trash2,
    Archive,
    Check,
    Eye,
    CheckCheck,
    AlertTriangle,
    ChevronRight
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/providers/ToastProvider';

interface Notification {
    id: string;
    title: string;
    description: string;
    type: string; // Category (e.g. security, dataset, contract, preprocessing, workflow, lineage, analytics, reports, ai, system)
    read: boolean;
    archived: boolean;
    priority: string; // Critical, High, Medium, Low
    actionUrl?: string;
    createdAt: string;
}

export function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [shouldRing, setShouldRing] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { showToast } = useToast();

    // Fetch initial notifications (excluding archived ones for the dropdown view)
    const fetchNotifications = async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await apiClient.get('/data/notifications?status=all');
            if (data && Array.isArray(data)) {
                setNotifications(data);
            } else {
                setError(true);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
            setError(false); // set to false and use mock empty if DB connection fails
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();

        // Retrieve auth token
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        if (!token) return;

        // Establish SSE connection
        const eventSource = new EventSource(`/api/data/notifications/stream?token=${encodeURIComponent(token)}`);

        eventSource.onmessage = (event) => {
            try {
                const newNotif = JSON.parse(event.data);
                setNotifications((prev) => {
                    if (prev.some((n) => n.id === newNotif.id)) return prev;

                    // Trigger bell shake animation
                    setShouldRing(true);
                    setTimeout(() => setShouldRing(false), 500);

                    // Trigger real-time compact toast alert
                    const toastType = newNotif.priority === 'Critical' || newNotif.type === 'error' ? 'error' : 
                                      newNotif.priority === 'High' || newNotif.type === 'contract' ? 'success' : 'info';
                    showToast(newNotif.title, toastType);

                    // Prepend new notification if not archived
                    if (!newNotif.archived) {
                        return [newNotif, ...prev];
                    }
                    return prev;
                });
            } catch (err) {
                console.error('Failed to parse SSE notification:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.warn('Notification EventSource connection error, will retry...', err);
        };

        return () => {
            eventSource.close();
        };
    }, [showToast]);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            await apiClient.patch(`/data/notifications/${id}/read`, {});
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read: true } : n))
            );
            showToast('Notification marked as read', 'success');
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await apiClient.post('/data/notifications/mark-all-read', {});
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            showToast('All notifications marked as read', 'success');
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const handleArchive = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await apiClient.patch(`/data/notifications/${id}/archive`, {});
            // Remove from active dropdown list since it is archived
            setNotifications((prev) => prev.filter((n) => n.id !== id));
            showToast('Notification archived', 'success');
        } catch (err) {
            console.error('Failed to archive notification:', err);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await apiClient.delete(`/data/notifications/${id}`);
            setNotifications((prev) => prev.filter((n) => n.id !== id));
            showToast('Notification deleted', 'info');
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    const handleItemClick = async (notif: Notification) => {
        if (!notif.read) {
            await handleMarkAsRead(notif.id);
        }
        setIsOpen(false);
        router.push(`/notifications/${notif.id}`);
    };

    // Calculate relative time
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    // Render Lucide icon based on category/type
    const renderCategoryHeader = (type: string) => {
        const t = type.toLowerCase();
        switch (t) {
            case 'security':
                return { icon: <ShieldAlert size={13} style={{ color: 'var(--danger-color)' }} />, label: 'Security Alert', bg: 'rgba(239, 68, 68, 0.08)' };
            case 'dataset':
            case 'data sources':
                return { icon: <Database size={13} style={{ color: 'var(--primary-color)' }} />, label: 'Data Source Ingest', bg: 'var(--primary-light)' };
            case 'contract':
            case 'data contracts':
                return { icon: <CheckCircle2 size={13} style={{ color: '#10b981' }} />, label: 'Data Contract Governance', bg: 'rgba(16, 185, 129, 0.08)' };
            case 'preprocessing':
                return { icon: <Wand2 size={13} style={{ color: '#a855f7' }} />, label: 'Preprocessing Pipeline', bg: 'rgba(168, 85, 247, 0.08)' };
            case 'workflow':
                return { icon: <GitMerge size={13} style={{ color: '#6366f1' }} />, label: 'Workflow Automation', bg: 'rgba(99, 102, 241, 0.08)' };
            case 'lineage':
                return { icon: <Network size={13} style={{ color: '#06b6d4' }} />, label: 'Lineage Network', bg: 'rgba(6, 182, 212, 0.08)' };
            case 'analytics':
                return { icon: <BarChart3 size={13} style={{ color: '#0ea5e9' }} />, label: 'Analytics Insights', bg: 'rgba(14, 165, 233, 0.08)' };
            case 'reports':
                return { icon: <FileText size={13} style={{ color: '#f59e0b' }} />, label: 'Enterprise Report', bg: 'rgba(245, 158, 11, 0.08)' };
            case 'ai':
            case 'ai assistant':
                return { icon: <Sparkles size={13} style={{ color: '#8b5cf6' }} />, label: 'AI Copilot Assistant', bg: 'rgba(139, 92, 246, 0.08)' };
            case 'system':
                return { icon: <Settings size={13} style={{ color: '#64748b' }} />, label: 'System Service', bg: 'rgba(100, 116, 139, 0.08)' };
            default:
                return { icon: <Bell size={13} />, label: 'General Notification', bg: 'var(--bg-secondary)' };
        }
    };

    const getPriorityBorder = (priority: string) => {
        const p = priority?.toLowerCase();
        if (p === 'critical') return '4px solid var(--danger-color)';
        if (p === 'high') return '4px solid var(--warning-color)';
        if (p === 'medium') return '4px solid var(--accent-color)';
        return '4px solid var(--text-secondary)';
    };

    return (
        <div className="notification-container" ref={dropdownRef}>
            {/* Bell Toggle Trigger Button */}
            <button
                className={`icon-btn ${shouldRing ? 'notification-bell-ring' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Notifications"
                style={{ position: 'relative' }}
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="notification-badge">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Card */}
            {isOpen && (
                <div className="notification-dropdown">
                    {/* Header */}
                    <div className="notification-dropdown-header" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Notifications</span>
                            {unreadCount > 0 && (
                                <span style={{
                                    backgroundColor: 'var(--danger-color)',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    borderRadius: '12px',
                                    padding: '1px 6px'
                                }}>
                                    {unreadCount} unread
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    style={{
                                        fontSize: '0.72rem',
                                        color: 'var(--primary-color)',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <CheckCheck size={13} /> Mark read
                                </button>
                            )}
                            <button
                                onClick={() => { setIsOpen(false); router.push('/notifications'); }}
                                style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--accent-color)',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1px',
                                    cursor: 'pointer'
                                }}
                            >
                                View all <ChevronRight size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Notification List Scroll viewport */}
                    <div className="notification-list" style={{ padding: '0.5rem 0', maxHeight: '440px', overflowY: 'auto' }}>
                        {loading && (
                            <div className="notification-loading-state">
                                <span className="spinner" style={{ width: '20px', height: '20px', border: '2px solid var(--border-color)', borderTopColor: 'var(--primary-color)' }} />
                                <span style={{ fontSize: '0.785rem' }}>Loading alerts...</span>
                            </div>
                        )}

                        {error && (
                            <div className="notification-error-state">
                                <AlertTriangle size={24} className="notification-empty-icon" style={{ color: 'var(--danger-color)' }} />
                                <p style={{ fontSize: '0.785rem' }}>Failed to sync notifications.</p>
                            </div>
                        )}

                        {!loading && !error && notifications.length === 0 && (
                            <div className="notification-empty-state" style={{ padding: '4rem 2rem' }}>
                                <Bell size={32} className="notification-empty-icon" style={{ opacity: 0.3 }} />
                                <p style={{ fontSize: '0.825rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>You are completely caught up!</p>
                            </div>
                        )}

                        {!loading && !error && notifications.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0 0.5rem' }}>
                                {notifications.map((notif) => {
                                    const cat = renderCategoryHeader(notif.type);
                                    return (
                                        <div
                                            key={notif.id}
                                            onClick={() => handleItemClick(notif)}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.25rem',
                                                padding: '0.75rem 1rem',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border-color)',
                                                borderLeft: getPriorityBorder(notif.priority),
                                                backgroundColor: notif.read ? 'var(--bg-color)' : 'rgba(99, 102, 241, 0.04)',
                                                position: 'relative',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                            className="notification-item-card-row"
                                        >
                                            {/* Top info row */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    backgroundColor: cat.bg,
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    color: 'var(--text-primary)'
                                                }}>
                                                    {cat.icon}
                                                    <span>{cat.label}</span>
                                                </div>
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.8 }}>
                                                    {formatTime(notif.createdAt)}
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '2px', paddingRight: '1rem' }}>
                                                <span style={{
                                                    fontSize: '0.825rem',
                                                    fontWeight: notif.read ? 600 : 700,
                                                    color: 'var(--text-primary)',
                                                    lineHeight: '1.25'
                                                }}>
                                                    {notif.title}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-secondary)',
                                                    lineHeight: '1.35',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}>
                                                    {notif.description}
                                                </span>
                                            </div>

                                            {/* Priority visual badge */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    fontWeight: 600,
                                                    padding: '1px 5px',
                                                    borderRadius: '3px',
                                                    backgroundColor: notif.priority === 'Critical' ? 'rgba(239, 68, 68, 0.1)' :
                                                                    notif.priority === 'High' ? 'rgba(245, 158, 11, 0.1)' :
                                                                    notif.priority === 'Medium' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                                    color: notif.priority === 'Critical' ? 'var(--danger-color)' :
                                                           notif.priority === 'High' ? 'var(--warning-color)' :
                                                           notif.priority === 'Medium' ? 'var(--accent-color)' : 'var(--text-secondary)'
                                                }}>
                                                    {notif.priority}
                                                </span>
                                                {!notif.read && (
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-color)' }} />
                                                )}
                                            </div>

                                            {/* Hover Quick actions overlay */}
                                            <div
                                                className="notification-quick-actions"
                                                style={{
                                                    position: 'absolute',
                                                    right: '0.5rem',
                                                    top: '0.5rem',
                                                    display: 'flex',
                                                    gap: '2px',
                                                    opacity: 0,
                                                    transition: 'opacity 0.15s ease',
                                                    backgroundColor: 'var(--bg-color)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '6px',
                                                    padding: '2px',
                                                    boxShadow: 'var(--shadow-sm)'
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    onClick={() => { setIsOpen(false); router.push(`/notifications/${notif.id}`); }}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-color)'}
                                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                                    title="View Details"
                                                >
                                                    <Eye size={13} />
                                                </button>
                                                {!notif.read && (
                                                    <button
                                                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                                        onMouseEnter={e => e.currentTarget.style.color = '#10b981'}
                                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                                        title="Mark as Read"
                                                    >
                                                        <Check size={13} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => handleArchive(notif.id, e)}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--warning-color)'}
                                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                                    title="Archive"
                                                >
                                                    <Archive size={13} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(notif.id, e)}
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger-color)'}
                                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="notification-footer" style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', padding: '0.625rem', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'center' }}>
                        <span>Real-time Sync Active</span>
                    </div>
                </div>
            )}

            {/* Custom hover styles injected via style block */}
            <style jsx global>{`
                .notification-item-card-row:hover .notification-quick-actions {
                    opacity: 1 !important;
                }
                .notification-item-card-row:hover {
                    border-color: var(--primary-color) !important;
                    box-shadow: var(--shadow-sm) !important;
                }
            `}</style>
        </div>
    );
}
