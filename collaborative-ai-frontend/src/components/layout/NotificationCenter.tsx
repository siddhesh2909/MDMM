'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Bell,
    User,
    ShieldAlert,
    Database,
    GitMerge,
    MessageSquare,
    MessageSquareText,
    CreditCard,
    Megaphone,
    AlertTriangle,
    CheckCircle2,
    Activity,
    Clock,
    CheckCheck,
    Eye
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface Notification {
    id: string;
    title: string;
    description: string;
    type: string;
    read: boolean;
    actionUrl?: string;
    icon?: string;
    createdAt: string;
}

export function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');
    const [shouldRing, setShouldRing] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Fetch initial notifications
    const fetchNotifications = async () => {
        setLoading(true);
        setError(false);
        try {
            const data = await apiClient.get('/data/notifications');
            if (data && Array.isArray(data)) {
                setNotifications(data);
            } else {
                setError(true);
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
            setError(true);
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

                    return [newNotif, ...prev];
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
    }, []);

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
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await apiClient.post('/data/notifications/mark-all-read', {});
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch (err) {
            console.error('Failed to mark all as read:', err);
        }
    };

    const handleItemClick = async (notif: Notification) => {
        if (!notif.read) {
            await handleMarkAsRead(notif.id);
        }
        setIsOpen(false);
        if (notif.actionUrl) {
            router.push(notif.actionUrl);
        }
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

    // Render Lucide icon based on notification type
    const renderIcon = (type: string) => {
        switch (type) {
            case 'account':
                return <User className="notif-icon text-blue" />;
            case 'security':
                return <ShieldAlert className="notif-icon text-red" />;
            case 'project':
                return <Database className="notif-icon text-purple" />;
            case 'task':
                return <GitMerge className="notif-icon text-indigo" />;
            case 'comment':
                return <MessageSquare className="notif-icon text-green" />;
            case 'message':
                return <MessageSquareText className="notif-icon text-cyan" />;
            case 'payment':
                return <CreditCard className="notif-icon text-amber" />;
            case 'announcement':
                return <Megaphone className="notif-icon text-pink" />;
            case 'error':
                return <AlertTriangle className="notif-icon text-rose" />;
            case 'approval':
                return <CheckCircle2 className="notif-icon text-emerald" />;
            case 'status':
                return <Activity className="notif-icon text-sky" />;
            case 'deadline':
                return <Clock className="notif-icon text-orange" />;
            default:
                return <Bell className="notif-icon" />;
        }
    };

    // Filter notifications
    const filteredNotifs = notifications.filter((n) => {
        if (activeTab === 'unread') return !n.read;
        if (activeTab === 'read') return n.read;
        return true;
    });

    const unreadGroup = filteredNotifs.filter((n) => !n.read);
    const readGroup = filteredNotifs.filter((n) => n.read);

    return (
        <div className="notification-container" ref={dropdownRef}>
            {/* Bell Toggle Trigger Button */}
            <button
                className={`icon-btn ${shouldRing ? 'notification-bell-ring' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Notifications"
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
                <div className="notification-dropdown glass-panel">
                    {/* Header */}
                    <div className="notification-dropdown-header">
                        <h3>Notifications</h3>
                        {unreadCount > 0 && (
                            <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
                                <CheckCheck size={14} /> Mark all read
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="notification-filters">
                        <button
                            className={`notification-filter-tab ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            All ({notifications.length})
                        </button>
                        <button
                            className={`notification-filter-tab ${activeTab === 'unread' ? 'active' : ''}`}
                            onClick={() => setActiveTab('unread')}
                        >
                            Unread ({notifications.filter((n) => !n.read).length})
                        </button>
                        <button
                            className={`notification-filter-tab ${activeTab === 'read' ? 'active' : ''}`}
                            onClick={() => setActiveTab('read')}
                        >
                            Read ({notifications.filter((n) => n.read).length})
                        </button>
                    </div>

                    {/* Notification List Scroll viewport */}
                    <div className="notification-list">
                        {loading && (
                            <div className="notification-loading-state">
                                <span className="spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)' }} />
                                <span style={{ fontSize: '0.825rem' }}>Loading alerts...</span>
                            </div>
                        )}

                        {error && (
                            <div className="notification-error-state">
                                <AlertTriangle size={32} className="notification-empty-icon" style={{ color: 'var(--danger-color)' }} />
                                <p>Failed to sync notifications. Please try again later.</p>
                            </div>
                        )}

                        {!loading && !error && filteredNotifs.length === 0 && (
                            <div className="notification-empty-state">
                                <Bell size={32} className="notification-empty-icon" />
                                <p>No notifications yet. You are all caught up!</p>
                            </div>
                        )}

                        {!loading && !error && filteredNotifs.length > 0 && (
                            <>
                                {/* Group: Unread */}
                                {activeTab === 'all' && unreadGroup.length > 0 && (
                                    <>
                                        <div className="notification-group-title">Unread</div>
                                        {unreadGroup.map((notif) => (
                                            <div
                                                key={notif.id}
                                                className="notification-item unread"
                                                onClick={() => handleItemClick(notif)}
                                            >
                                                <div className="notification-item-icon-wrapper">
                                                    {renderIcon(notif.type)}
                                                </div>
                                                <div className="notification-item-content">
                                                    <span className="notification-item-title">{notif.title}</span>
                                                    <span className="notification-item-desc">{notif.description}</span>
                                                    <span className="notification-item-time">{formatTime(notif.createdAt)}</span>
                                                </div>
                                                <div className="notification-item-actions">
                                                    <button
                                                        className="notification-item-action-btn"
                                                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                                                        title="Mark as Read"
                                                    >
                                                        <Eye size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                {/* Group: Read */}
                                {activeTab === 'all' && readGroup.length > 0 && (
                                    <>
                                        <div className="notification-group-title">Read</div>
                                        {readGroup.map((notif) => (
                                            <div
                                                key={notif.id}
                                                className="notification-item"
                                                onClick={() => handleItemClick(notif)}
                                            >
                                                <div className="notification-item-icon-wrapper">
                                                    {renderIcon(notif.type)}
                                                </div>
                                                <div className="notification-item-content">
                                                    <span className="notification-item-title">{notif.title}</span>
                                                    <span className="notification-item-desc">{notif.description}</span>
                                                    <span className="notification-item-time">{formatTime(notif.createdAt)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                {/* If filtering by tabs (unread/read) direct list */}
                                {activeTab !== 'all' &&
                                    filteredNotifs.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={`notification-item ${!notif.read ? 'unread' : ''}`}
                                            onClick={() => handleItemClick(notif)}
                                        >
                                            <div className="notification-item-icon-wrapper">
                                                {renderIcon(notif.type)}
                                            </div>
                                            <div className="notification-item-content">
                                                <span className="notification-item-title">{notif.title}</span>
                                                <span className="notification-item-desc">{notif.description}</span>
                                                <span className="notification-item-time">{formatTime(notif.createdAt)}</span>
                                            </div>
                                            {!notif.read && (
                                                <div className="notification-item-actions">
                                                    <button
                                                        className="notification-item-action-btn"
                                                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                                                        title="Mark as Read"
                                                    >
                                                        <Eye size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="notification-footer">
                        <span>Real-time Sync Active</span>
                    </div>
                </div>
            )}
        </div>
    );
}
