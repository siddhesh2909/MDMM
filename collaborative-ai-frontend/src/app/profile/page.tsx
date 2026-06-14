'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useRole } from '@/components/providers/RoleProvider';
import { apiClient } from '@/lib/apiClient';
import {
    User, Lock, Shield, Building, Award, CheckCircle2, Key, Upload,
    Activity, CreditCard, Users, Bell, Sliders, Globe, Trash2, LogOut,
    Info, Calendar, Settings, Mail, Phone, Clock, AlertTriangle, Download, Check
} from 'lucide-react';
import './profile.css';

function getRoleDisplayName(role: string): string {
    if (role === 'Admin') return 'Admin';
    if (role === 'Analyst' || role === 'Data Steward' || role === 'Data Engineer' || role === 'Data Analyst') {
        return 'Analyst';
    }
    return 'Business User';
}

interface SessionItem {
    id: string;
    device: string;
    location: string;
    ip: string;
    lastActive: string;
    currentSession: boolean;
}

interface ProfilePayload {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
    organizationName: string;
    permissions: string[];
    profilePhoto: string;
    jobTitle: string;
    contactNumber: string;
    timezone: string;
    twoFactorEnabled: boolean;
    activeSessions: SessionItem[];
    lastLoginInfo: string;
    notifications: {
        system: boolean;
        email: boolean;
        aiAlerts: boolean;
    };
    aiPreferences: {
        model: string;
        temperature: number;
        customRules: string;
    };
}

export default function ProfilePage() {
    const { user, updateUser } = useAuth();
    const { role } = useRole();
    const { showToast } = useToast();

    // Active tab in settings layout
    const [activeTab, setActiveTab] = useState<'profile' | 'workspace' | 'security' | 'notifications' | 'ai' | 'team' | 'audit' | 'billing' | 'org'>('profile');
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);

    // Profile Details Form States
    const [name, setName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [department, setDepartment] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [timezone, setTimezone] = useState('UTC (GMT+00:00)');
    const [profilePhoto, setProfilePhoto] = useState('');

    // Security Tab States
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [activeSessions, setActiveSessions] = useState<SessionItem[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // Notifications Tab States
    const [notifSystem, setNotifSystem] = useState(true);
    const [notifEmail, setNotifEmail] = useState(false);
    const [notifAiAlerts, setNotifAiAlerts] = useState(true);

    // AI Preferences Tab States
    const [aiModel, setAiModel] = useState('llama-3-8b');
    const [aiTemp, setAiTemp] = useState(0.7);
    const [aiRules, setAiRules] = useState('');

    // Organization Settings (Admin only)
    const [orgName, setOrgName] = useState('Enterprise Org');
    const [orgDomain, setOrgDomain] = useState('ecommerce.ai');

    // Admin Team Management Lists
    const [teamUsers, setTeamUsers] = useState<any[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteName, setInviteName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Business User');
    const [inviteDept, setInviteDept] = useState('');

    // Admin Audit Logs List
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [auditSearch, setAuditSearch] = useState('');

    // Unsaved Changes Dirty Detection States
    const [initialState, setInitialState] = useState<string>('{}');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const isViewer = role === 'Business User';

    // Check if form is dirty (has unsaved modifications)
    const isDirty = () => {
        const currentData = {
            name,
            jobTitle,
            department,
            contactNumber,
            timezone,
            profilePhoto,
            twoFactorEnabled,
            notifications: { system: notifSystem, email: notifEmail, aiAlerts: notifAiAlerts },
            aiPreferences: { model: aiModel, temperature: aiTemp, customRules: aiRules },
            organization: { name: orgName, domain: orgDomain }
        };
        return JSON.stringify(currentData) !== initialState;
    };

    // Load entire profile details from the backend
    const loadProfileData = async () => {
        setLoading(true);
        try {
            const data: ProfilePayload = await apiClient.get('/data/users/profile');
            if (data) {
                setName(data.name || '');
                setJobTitle(data.jobTitle || '');
                setDepartment(data.department || '');
                setContactNumber(data.contactNumber || '');
                setTimezone(data.timezone || 'UTC (GMT+00:00)');
                setProfilePhoto(data.profilePhoto || '');
                setTwoFactorEnabled(data.twoFactorEnabled || false);
                setActiveSessions(data.activeSessions || []);

                if (data.notifications) {
                    setNotifSystem(data.notifications.system);
                    setNotifEmail(data.notifications.email);
                    setNotifAiAlerts(data.notifications.aiAlerts);
                }

                if (data.aiPreferences) {
                    setAiModel(data.aiPreferences.model || 'llama-3-8b');
                    setAiTemp(data.aiPreferences.temperature ?? 0.7);
                    setAiRules(data.aiPreferences.customRules || '');
                }

                setOrgName(data.organizationName || 'Enterprise Org');

                // Save snapshot for dirty tracking
                const snapshot = {
                    name: data.name || '',
                    jobTitle: data.jobTitle || '',
                    department: data.department || '',
                    contactNumber: data.contactNumber || '',
                    timezone: data.timezone || 'UTC (GMT+00:00)',
                    profilePhoto: data.profilePhoto || '',
                    twoFactorEnabled: data.twoFactorEnabled || false,
                    notifications: {
                        system: data.notifications?.system ?? true,
                        email: data.notifications?.email ?? false,
                        aiAlerts: data.notifications?.aiAlerts ?? true
                    },
                    aiPreferences: {
                        model: data.aiPreferences?.model || 'llama-3-8b',
                        temperature: data.aiPreferences?.temperature ?? 0.7,
                        customRules: data.aiPreferences?.customRules || ''
                    },
                    organization: { name: data.organizationName || 'Enterprise Org', domain: 'ecommerce.ai' }
                };
                setInitialState(JSON.stringify(snapshot));
            }
        } catch (err) {
            showToast('Failed to load profile settings data.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Load Admin components data (Users, Audit Logs)
    const loadAdminData = async () => {
        if (role !== 'Admin') return;
        try {
            if (activeTab === 'team') {
                const users = await apiClient.get('/data/users');
                setTeamUsers(users || []);
            } else if (activeTab === 'audit') {
                const logs = await apiClient.get('/data/audit-log');
                setAuditLogs(logs || []);
            }
        } catch (err) {
            console.error('Failed to load admin logs/users:', err);
        }
    };

    useEffect(() => {
        loadProfileData();
    }, []);

    useEffect(() => {
        loadAdminData();
    }, [activeTab, role]);

    // Track unsaved changes warnings
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty()) {
                e.preventDefault();
                e.returnValue = 'You have unsaved configuration changes. Are you sure you want to discard them?';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [name, jobTitle, department, contactNumber, timezone, profilePhoto, twoFactorEnabled, notifSystem, notifEmail, notifAiAlerts, aiModel, aiTemp, aiRules, orgName, orgDomain, initialState]);

    // Handle Profile Photo Upload via base64 encoding
    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            showToast('Image size must be smaller than 2MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setProfilePhoto(reader.result as string);
            showToast('Avatar preview uploaded. Save changes to commit.', 'info');
        };
        reader.readAsDataURL(file);
    };

    // Save profile configurations
    const handleSaveChanges = async () => {
        if (isViewer) return;
        setSaving(true);
        try {
            const payload = {
                name,
                department,
                profilePhoto,
                jobTitle,
                contactNumber,
                timezone,
                twoFactorEnabled,
                notifications: { system: notifSystem, email: notifEmail, aiAlerts: notifAiAlerts },
                aiPreferences: { model: aiModel, temperature: aiTemp, customRules: aiRules }
            };

            const res = await apiClient.patch('/data/users/profile', payload);
            if (res && res.user) {
                updateUser(res.user);
                showToast('Your settings changes have been saved successfully.', 'success');
                // Refresh states
                const nextSnapshot = {
                    name,
                    jobTitle,
                    department,
                    contactNumber,
                    timezone,
                    profilePhoto,
                    twoFactorEnabled,
                    notifications: { system: notifSystem, email: notifEmail, aiAlerts: notifAiAlerts },
                    aiPreferences: { model: aiModel, temperature: aiTemp, customRules: aiRules },
                    organization: { name: orgName, domain: orgDomain }
                };
                setInitialState(JSON.stringify(nextSnapshot));
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to persist settings.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Save Organization details (Admin only)
    const handleSaveOrgSettings = async () => {
        if (role !== 'Admin') return;
        setSaving(true);
        try {
            await apiClient.patch('/data/organization', { name: orgName, domain: orgDomain });
            showToast('Organization configurations updated.', 'success');
            // Update snapshot
            const currentSnap = JSON.parse(initialState);
            currentSnap.organization = { name: orgName, domain: orgDomain };
            setInitialState(JSON.stringify(currentSnap));
        } catch (err: any) {
            showToast(err.message || 'Failed to save organization properties.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Handle updating passwords
    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            showToast('New password must be at least 6 characters.', 'error');
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match.', 'error');
            return;
        }

        setSaving(true);
        try {
            await apiClient.patch('/data/users/profile', { password: newPassword });
            showToast('Security credentials updated successfully.', 'success');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            showToast(err.message || 'Failed to update password.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Log out other sessions
    const handleRevokeOthers = async () => {
        if (isViewer) return;
        if (!confirm('Are you sure you want to invalidate all other active sessions?')) return;
        try {
            await apiClient.post('/data/users/profile/revoke-others', {});
            showToast('Logged out of all other active sessions successfully.', 'success');
            // Clear in UI sessions list
            setActiveSessions(prev => prev.filter(s => s.currentSession));
        } catch {
            showToast('Failed to revoke sessions.', 'error');
        }
    };

    // Download personal information export file
    const handleDownloadData = async () => {
        try {
            showToast('Preparing your personal data export file...', 'info');
            window.open('/api/data/users/profile/download-data', '_blank');
        } catch {
            showToast('Failed to export personal data.', 'error');
        }
    };

    // Account deletion handler
    const handleDeleteAccount = async () => {
        if (!deletePassword) {
            showToast('Confirmation password is required.', 'error');
            return;
        }
        if (deleteConfirmText !== 'DELETE') {
            showToast('Please type "DELETE" exactly to confirm.', 'error');
            return;
        }

        try {
            await apiClient.post('/data/users/profile', { password: deletePassword }); // validates credentials first
            await apiClient.delete('/data/users/profile', { password: deletePassword });
            showToast('Your account was deleted successfully.', 'success');
            setShowDeleteModal(false);
            // Invalidate credentials
            localStorage.clear();
            window.location.href = '/login';
        } catch (err: any) {
            showToast(err.message || 'Failed to authenticate password delete request.', 'error');
        }
    };

    // Admin role updates
    const handleUpdateUserRole = async (userId: string, newRole: string) => {
        try {
            await apiClient.patch('/data/users/update-role', { id: userId, role: newRole });
            setTeamUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            showToast(`User role updated to ${newRole}.`, 'success');
        } catch {
            showToast('Failed to modify user access role.', 'error');
        }
    };

    // Admin user deactivations
    const handleDeactivateUser = async (userId: string) => {
        if (!confirm('Are you sure you want to deactivate this team member?')) return;
        try {
            await apiClient.patch('/data/users/deactivate', { id: userId });
            setTeamUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'Inactive' } : u));
            showToast('Team member deactivated.', 'info');
        } catch {
            showToast('Failed to deactivate user.', 'error');
        }
    };

    // Invite members handler
    const handleInviteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteName.trim() || !inviteEmail.trim()) {
            showToast('Name and email are required fields.', 'error');
            return;
        }
        try {
            await apiClient.post('/data/users/invite', {
                name: inviteName,
                email: inviteEmail,
                role: inviteRole,
                department: inviteDept || undefined
            });
            showToast('User invitation sent successfully.', 'success');
            setShowInviteModal(false);
            setInviteName('');
            setInviteEmail('');
            setInviteDept('');
            // Reload users list
            const nextUsers = await apiClient.get('/data/users');
            setTeamUsers(nextUsers || []);
        } catch (err: any) {
            showToast(err.message || 'Failed to invite user.', 'error');
        }
    };

    // Permissions summary lookup based on roles
    const getRolePermissionsDescription = () => {
        switch (role) {
            case 'Admin':
                return 'Root access privileges. Grant access, define governance contracts, review security metrics, and modify global parameters.';
            case 'Analyst':
                return 'Standard access. Permission to ingest, clean, and view datasets, manage validation contracts, track workflows, and review analytics.';
            case 'Business User':
                return 'Read-only visitor. Restricted view permissions over datasets, contracts. All profile configurations are read-only.';
            default:
                return 'Limited operational clearance.';
        }
    };

    const filteredAuditLogs = auditLogs.filter(log =>
        log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.userId.toLowerCase().includes(auditSearch.toLowerCase())
    );

    return (
        <div className="settings-page-container">
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Settings size={28} color="var(--primary-color)" />
                        My Profile Settings
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Manage your personal details, workspace security clearances, and active login sessions.</p>
                </div>
            </div>

            {/* Settings Card Panel */}
            <div className="settings-dialog-card glass-panel animate-scale-in">
                {/* 1. Sidebar Navigation */}
                <div className="settings-sidebar">
                    <div className="settings-sidebar-header">
                        <Settings size={18} color="var(--primary-color)" />
                        <h3>Settings</h3>
                    </div>

                    <div className="settings-nav-list">
                        <button className={`settings-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                            <User size={15} />
                            <span>Profile Details</span>
                        </button>
                        <button className={`settings-nav-item ${activeTab === 'workspace' ? 'active' : ''}`} onClick={() => setActiveTab('workspace')}>
                            <Building size={15} />
                            <span>Workspace</span>
                        </button>
                        <button className={`settings-nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
                            <Lock size={15} />
                            <span>Security</span>
                        </button>
                        <button className={`settings-nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
                            <Bell size={15} />
                            <span>Notifications</span>
                        </button>
                        <button className={`settings-nav-item ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
                            <Sliders size={15} />
                            <span>AI Preferences</span>
                        </button>

                        {/* Admin-only Navigation Sections */}
                        {role === 'Admin' && (
                            <>
                                <div className="settings-nav-section-divider">Administration</div>
                                <button className={`settings-nav-item ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>
                                    <Users size={15} />
                                    <span>Team Directory</span>
                                </button>
                                <button className={`settings-nav-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
                                    <Activity size={15} />
                                    <span>Audit Trail</span>
                                </button>
                                <button className={`settings-nav-item ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => setActiveTab('billing')}>
                                    <CreditCard size={15} />
                                    <span>Billing Plan</span>
                                </button>
                                <button className={`settings-nav-item ${activeTab === 'org' ? 'active' : ''}`} onClick={() => setActiveTab('org')}>
                                    <Globe size={15} />
                                    <span>Organization</span>
                                </button>
                            </>
                        )}
                    </div>

                    {/* Left footer: Display Mapped User Account role */}
                    <div className="settings-sidebar-footer">
                        <div className="settings-user-role-badge">
                            <Shield size={12} color="var(--primary-color)" />
                            <span>{role} Access</span>
                        </div>
                    </div>
                </div>

                {/* 2. Right Pane Content Areas */}
                <div className="settings-content-pane">
                    {loading ? (
                        /* Loading Skeleton screen */
                        <div className="settings-skeleton-container">
                            <div className="skeleton-line title" />
                            <div className="skeleton-line" />
                            <div className="skeleton-grid">
                                <div className="skeleton-block" />
                                <div className="skeleton-block" />
                            </div>
                        </div>
                    ) : (
                        <div className="settings-tab-viewport">
                            {/* ACTIVE TAB VIEWS */}

                            {/* Tab 1: Profile Details */}
                            {activeTab === 'profile' && (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="settings-view-form">
                                    <div className="settings-view-header">
                                        <h2>General Profile Details</h2>
                                        <p>Govern user identity profile parameters and account credentials.</p>
                                    </div>

                                    {/* Profile Avatar Upload block */}
                                    <div className="profile-photo-upload-section">
                                        <div className="profile-photo-circle">
                                            {profilePhoto ? (
                                                <img src={profilePhoto} alt="User profile avatar preview" />
                                            ) : (
                                                <div className="profile-photo-initials">{name.charAt(0) || 'U'}</div>
                                            )}
                                            {!isViewer && (
                                                <div className="avatar-upload-overlay" onClick={() => fileInputRef.current?.click()}>
                                                    <Upload size={16} />
                                                </div>
                                            )}
                                        </div>
                                        <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" style={{ display: 'none' }} disabled={isViewer} />
                                        <div className="avatar-upload-info">
                                            <h4>Profile Photo</h4>
                                            <p>Support PNG, JPG, or GIF up to 2MB maximum.</p>
                                        </div>
                                    </div>

                                    <div className="settings-grid-columns">
                                        <div className="input-wrapper">
                                            <label className="input-label">Full Name</label>
                                            <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} disabled={isViewer} placeholder="Data Analyst" />
                                        </div>
                                        <div className="input-wrapper">
                                            <label className="input-label">Email Address (Read-only)</label>
                                            <input type="email" className="input-field disabled" value={user?.email || ''} readOnly disabled />
                                        </div>
                                        <div className="input-wrapper">
                                            <label className="input-label">Designation / Job Title</label>
                                            <input type="text" className="input-field" value={jobTitle} onChange={e => setJobTitle(e.target.value)} disabled={isViewer} placeholder="Lead Architect" />
                                        </div>
                                        <div className="input-wrapper">
                                            <label className="input-label">Department Mapping</label>
                                            <select className="input-field" value={department} onChange={e => setDepartment(e.target.value)} disabled={isViewer}>
                                                <option value="">Select Department...</option>
                                                <option value="Data Platform">Data Platform</option>
                                                <option value="Machine Learning">Machine Learning</option>
                                                <option value="Business Intelligence">Business Intelligence</option>
                                                <option value="Platform Security">Platform Security</option>
                                                <option value="Operations">Operations</option>
                                            </select>
                                        </div>
                                        <div className="input-wrapper">
                                            <label className="input-label">Organization Name (Read-only)</label>
                                            <input type="text" className="input-field disabled" value={orgName} readOnly disabled />
                                        </div>
                                        <div className="input-wrapper">
                                            <label className="input-label">Contact Number</label>
                                            <input type="text" className="input-field" value={contactNumber} onChange={e => setContactNumber(e.target.value)} disabled={isViewer} placeholder="+1 (555) 000-0000" />
                                        </div>
                                        <div className="input-wrapper" style={{ gridColumn: 'span 2' }}>
                                            <label className="input-label">Timezone Settings</label>
                                            <select className="input-field" value={timezone} onChange={e => setTimezone(e.target.value)} disabled={isViewer}>
                                                <option value="UTC (GMT+00:00)">UTC (GMT+00:00) — Coordinated Universal Time</option>
                                                <option value="EST (GMT-05:00)">EST (GMT-05:00) — Eastern Standard Time</option>
                                                <option value="PST (GMT-08:00)">PST (GMT-08:00) — Pacific Standard Time</option>
                                                <option value="IST (GMT+05:30)">IST (GMT+05:30) — Indian Standard Time</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Action items */}
                                    {!isViewer && (
                                        <div className="settings-action-bar">
                                            {isDirty() && <span className="unsaved-changes-warn"><AlertTriangle size={13} /> Unsaved changes detected</span>}
                                            <Button onClick={handleSaveChanges} disabled={saving || !isDirty()}>
                                                {saving ? 'Saving...' : 'Save Profile Changes'}
                                            </Button>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Tab 2: Workspace Details */}
                            {activeTab === 'workspace' && (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="settings-view-form">
                                    <div className="settings-view-header">
                                        <h2>Workspace Clearance</h2>
                                        <p>View your active profile roles, scopes, and connected resources.</p>
                                    </div>

                                    <div className="workspace-role-card">
                                        <div className="workspace-role-card-header">
                                            <Award size={20} color="var(--primary-color)" />
                                            <h3>{role} Account Permission Clearance</h3>
                                        </div>
                                        <p className="workspace-role-desc">{getRolePermissionsDescription()}</p>
                                    </div>

                                    <div className="workspace-stats-grid">
                                        <div className="workspace-stat-item">
                                            <span className="stat-label">Active Organization</span>
                                            <span className="stat-value">{orgName}</span>
                                        </div>
                                        <div className="workspace-stat-item">
                                            <span className="stat-label">Clearance Scopes</span>
                                            <span className="stat-value">{role === 'Admin' ? 'Unlimited (*)' : `${(user?.permissions || []).length} Scope(s)`}</span>
                                        </div>
                                        <div className="workspace-stat-item">
                                            <span className="stat-label">Connected Domain</span>
                                            <span className="stat-value">ecommerce.ai</span>
                                        </div>
                                    </div>

                                    <div className="permissions-summary-list">
                                        <h4>Clearance Scopes Included:</h4>
                                        <div className="permissions-badge-row">
                                            {role === 'Admin' ? (
                                                <span className="permission-badge admin">Full System Administrator Clearance</span>
                                            ) : (user?.permissions || []).length > 0 ? (
                                                (user?.permissions || []).map(p => (
                                                    <span key={p} className="permission-badge">{p}</span>
                                                ))
                                            ) : (
                                                <span className="permission-badge empty">No active scopes assigned. Read-only permissions.</span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Tab 3: Security */}
                            {activeTab === 'security' && (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="settings-view-form">
                                    <div className="settings-view-header">
                                        <h2>Security Credentials & Sessions</h2>
                                        <p>Govern active sessions, update authentication credentials, or export data.</p>
                                    </div>

                                    {/* Update password card */}
                                    {!isViewer && (
                                        <div className="security-sub-section">
                                            <h3>Update Account Password</h3>
                                            <form onSubmit={handleUpdatePassword} className="security-password-form">
                                                <div className="input-wrapper">
                                                    <label className="input-label">New Password</label>
                                                    <input type="password" placeholder="••••••••" className="input-field" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
                                                </div>
                                                <div className="input-wrapper">
                                                    <label className="input-label">Confirm New Password</label>
                                                    <input type="password" placeholder="••••••••" className="input-field" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
                                                </div>
                                                <Button type="submit" variant="outline" disabled={saving || !newPassword} style={{ borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}>
                                                    {saving ? 'Updating...' : 'Update Password'}
                                                </Button>
                                            </form>
                                        </div>
                                    )}

                                    {/* Two-Factor Toggle */}
                                    <div className="security-sub-section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                                        <div className="toggle-row-setting">
                                            <div>
                                                <h3>Two-Factor Authentication (2FA)</h3>
                                                <p>Extend security by prompting for validation keys during login events.</p>
                                            </div>
                                            <label className="switch-toggle">
                                                <input type="checkbox" checked={twoFactorEnabled} onChange={e => {
                                                    if (isViewer) return;
                                                    setTwoFactorEnabled(e.target.checked);
                                                    showToast(e.target.checked ? '2FA mock activated. Save changes to commit.' : '2FA deactivated.', 'info');
                                                }} disabled={isViewer} />
                                                <span className="slider-switch-bg" />
                                            </label>
                                        </div>

                                        {twoFactorEnabled && (
                                            <div className="mock-qr-card animate-fade-in">
                                                <Globe size={32} color="var(--primary-color)" />
                                                <div>
                                                    <h4>Interactive Authenticator Bind Ready</h4>
                                                    <p>Scan the QR mockup configuration using Google Authenticator and apply keys.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Active Sessions list */}
                                    <div className="security-sub-section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                            <div>
                                                <h3>Active Login Sessions</h3>
                                                <p>Monitor devices currently authenticated into your profile.</p>
                                            </div>
                                            {!isViewer && activeSessions.length > 1 && (
                                                <Button variant="outline" onClick={handleRevokeOthers} style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)', padding: '0.35rem 0.75rem', height: 'auto', fontSize: '0.8rem' }}>
                                                    Revoke Other Devices
                                                </Button>
                                            )}
                                        </div>

                                        <div className="sessions-list-container">
                                            {activeSessions.map(session => (
                                                <div key={session.id} className="session-item-row">
                                                    <Clock size={16} color="var(--text-secondary)" style={{ marginTop: '3px' }} />
                                                    <div style={{ flex: 1 }}>
                                                        <div className="session-item-meta">
                                                            <strong>{session.device}</strong>
                                                            {session.currentSession && <span className="current-badge">This Session</span>}
                                                        </div>
                                                        <div className="session-item-sub">
                                                            <span>IP: {session.ip}</span> · <span>{session.location}</span> · <span>Active: {session.lastActive ? new Date(session.lastActive).toLocaleTimeString() : 'Recently'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Data export & deletion */}
                                    <div className="security-sub-section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div>
                                            <h3>Account Control Actions</h3>
                                            <p>Manage data compliance rights and export histories.</p>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <Button variant="outline" icon={<Download size={14} />} onClick={handleDownloadData}>
                                                Download My Data
                                            </Button>
                                            {!isViewer && (
                                                <Button variant="outline" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} icon={<Trash2 size={14} />} onClick={() => setShowDeleteModal(true)}>
                                                    Delete My Account
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Tab 4: Notifications Settings */}
                            {activeTab === 'notifications' && (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="settings-view-form">
                                    <div className="settings-view-header">
                                        <h2>Notification Preferences</h2>
                                        <p>Manage the alert notification channels for data platform event updates.</p>
                                    </div>

                                    <div className="settings-checkboxes-stack">
                                        <label className="checkbox-setting-row">
                                            <input type="checkbox" checked={notifSystem} onChange={e => setNotifSystem(e.target.checked)} disabled={isViewer} />
                                            <div>
                                                <h4>System Alerts</h4>
                                                <p>Receive live in-app notifications on schema events, role edits, and tasks updates.</p>
                                            </div>
                                        </label>

                                        <label className="checkbox-setting-row">
                                            <input type="checkbox" checked={notifEmail} onChange={e => setNotifEmail(e.target.checked)} disabled={isViewer} />
                                            <div>
                                                <h4>Email Notifications</h4>
                                                <p>Trigger weekly compliance summary digests and security logins report to email.</p>
                                            </div>
                                        </label>

                                        <label className="checkbox-setting-row">
                                            <input type="checkbox" checked={notifAiAlerts} onChange={e => setNotifAiAlerts(e.target.checked)} disabled={isViewer} />
                                            <div>
                                                <h4>AI Assistant Notifications</h4>
                                                <p>Alert when long-running background AI scanning completes anomalies matrices.</p>
                                            </div>
                                        </label>
                                    </div>

                                    {!isViewer && (
                                        <div className="settings-action-bar">
                                            <Button onClick={handleSaveChanges} disabled={saving || !isDirty()}>
                                                {saving ? 'Saving...' : 'Save Preferences'}
                                            </Button>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Tab 5: AI Preferences */}
                            {activeTab === 'ai' && (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="settings-view-form">
                                    <div className="settings-view-header">
                                        <h2>AI Copilot Preferences</h2>
                                        <p>Configure model weights and custom formatting preferences for AI Assistant.</p>
                                    </div>

                                    <div className="settings-grid-columns" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div className="input-wrapper">
                                            <label className="input-label">Default Analysis Model</label>
                                            <select className="input-field" value={aiModel} onChange={e => setAiModel(e.target.value)} disabled={isViewer}>
                                                <option value="llama-3-8b">Groq Llama 3 (8B) — Blazing Fast</option>
                                                <option value="llama-3-70b">Groq Llama 3 (70B) — Complex Auditing</option>
                                                <option value="mixtral-8x7b">Mixtral 8x7B Instruct — Logic Tasks</option>
                                            </select>
                                        </div>

                                        <div className="input-wrapper">
                                            <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Model Temperature (Creativity):</span>
                                                <strong>{aiTemp}</strong>
                                            </label>
                                            <input type="range" min="0" max="1" step="0.1" className="slider-range-input" value={aiTemp} onChange={e => setAiTemp(parseFloat(e.target.value))} disabled={isViewer} />
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                <span>Precise & Deterministic</span>
                                                <span>Creative & Conversational</span>
                                            </div>
                                        </div>

                                        <div className="input-wrapper">
                                            <label className="input-label">Custom Instruction Directives</label>
                                            <textarea className="textarea-field" rows={4} placeholder="E.g., Always explain anomaly definitions in detail before suggesting imputations..." value={aiRules} onChange={e => setAiRules(e.target.value)} disabled={isViewer} />
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Applied directly into system prompts for Copilot queries.</span>
                                        </div>
                                    </div>

                                    {!isViewer && (
                                        <div className="settings-action-bar">
                                            <Button onClick={handleSaveChanges} disabled={saving || !isDirty()}>
                                                {saving ? 'Saving...' : 'Save AI Configs'}
                                            </Button>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Tab 6: Team Directory (Admin Only) */}
                            {activeTab === 'team' && role === 'Admin' && (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="settings-view-form">
                                    <div className="settings-view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <div>
                                            <h2>Team Member Directory</h2>
                                            <p>Manage user roles, deactivations, and permissions credentials.</p>
                                        </div>
                                        <Button onClick={() => setShowInviteModal(true)} style={{ padding: '0.35rem 0.75rem', height: 'auto', fontSize: '0.8rem' }}>
                                            Invite Member
                                        </Button>
                                    </div>

                                    <div className="admin-table-container">
                                        <table className="settings-data-table">
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Email</th>
                                                    <th>Assigned Role</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {teamUsers.map((u: any) => (
                                                    <tr key={u.id}>
                                                        <td>
                                                            <div className="table-user-cell">
                                                                <div className="user-avatar">{getRoleDisplayName(u.role).charAt(0)}</div>
                                                                <span>{getRoleDisplayName(u.role)}</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                                                        <td>
                                                            <select className="select-role-inline" value={u.role} onChange={e => handleUpdateUserRole(u.id, e.target.value)} disabled={u.id === user?.id || u.status === 'Inactive'}>
                                                                <option value="Admin">Admin</option>
                                                                <option value="Analyst">Analyst</option>
                                                                <option value="Business User">Business User</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <span className={`status-pill ${u.status === 'Active' ? 'active' : 'inactive'}`}>{u.status}</span>
                                                        </td>
                                                        <td>
                                                            <Button variant="outline" style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)', padding: '0.2rem 0.5rem', height: 'auto', fontSize: '0.75rem' }} onClick={() => handleDeactivateUser(u.id)} disabled={u.status === 'Inactive' || u.id === user?.id}>
                                                                Deactivate
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
                            )}

                            {/* Tab 7: Audit Logs (Admin Only) */}
                            {activeTab === 'audit' && role === 'Admin' && (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="settings-view-form">
                                    <div className="settings-view-header">
                                        <h2>System Audit Trail</h2>
                                        <p>Review organization auditing logs for security governance compliance.</p>
                                    </div>

                                    <div className="audit-search-filter">
                                        <input type="text" placeholder="Search by Action or User ID..." className="input-field" value={auditSearch} onChange={e => setAuditSearch(e.target.value)} />
                                    </div>

                                    <div className="admin-table-container" style={{ maxHeight: '350px' }}>
                                        <table className="settings-data-table">
                                            <thead>
                                                <tr>
                                                    <th>Timestamp</th>
                                                    <th>User Role</th>
                                                    <th>Action</th>
                                                    <th>Target Resource</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredAuditLogs.map((log: any) => (
                                                    <tr key={log.id}>
                                                        <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                                        <td>
                                                            <span className="audit-role-badge">{log.role}</span>
                                                        </td>
                                                        <td style={{ fontWeight: 700 }}>{log.action}</td>
                                                        <td style={{ color: 'var(--primary-color)' }}>{log.entityType} ({log.entityId.substring(0, 8)})</td>
                                                    </tr>
                                                ))}
                                                {filteredAuditLogs.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                                                            No system audit logs match your query parameters.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
                            )}

                            {/* Tab 8: Billing Settings (Admin Only) */}
                            {activeTab === 'billing' && role === 'Admin' && (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="settings-view-form">
                                    <div className="settings-view-header">
                                        <h2>Billing & Invoices</h2>
                                        <p>Manage subscription plans, check usage meters, and invoices history.</p>
                                    </div>

                                    <div className="billing-active-plan-card">
                                        <div>
                                            <span className="plan-badge">Enterprise Tier</span>
                                            <h3>Professional Organization Account</h3>
                                            <p>Next renewal date: **July 15, 2026** via Credit Card.</p>
                                        </div>
                                        <Button variant="outline">Upgrade Plan</Button>
                                    </div>

                                    <div className="billing-usage-metrics">
                                        <h4>Monthly Resource Usage:</h4>
                                        <div className="usage-progress-stack">
                                            <div className="usage-meter-item">
                                                <div className="usage-meter-header">
                                                    <span>Datasets Ingested</span>
                                                    <span>18% (18 / 100 Datasets)</span>
                                                </div>
                                                <div className="usage-progress-bar-bg"><div className="usage-progress-bar-fill" style={{ width: '18%' }} /></div>
                                            </div>
                                            <div className="usage-meter-item">
                                                <div className="usage-meter-header">
                                                    <span>AI Scanning Queries</span>
                                                    <span>45% (452 / 1,000 Queries)</span>
                                                </div>
                                                <div className="usage-progress-bar-bg"><div className="usage-progress-bar-fill" style={{ width: '45%' }} /></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="invoice-history-section">
                                        <h4>Invoice Billing History:</h4>
                                        <table className="settings-data-table invoice">
                                            <thead>
                                                <tr>
                                                    <th>Invoice ID</th>
                                                    <th>Billing Date</th>
                                                    <th>Amount</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>INV-2026-004</td>
                                                    <td>June 01, 2026</td>
                                                    <td>$499.00</td>
                                                    <td><span className="status-pill active">Paid</span></td>
                                                </tr>
                                                <tr>
                                                    <td>INV-2026-003</td>
                                                    <td>May 01, 2026</td>
                                                    <td>$499.00</td>
                                                    <td><span className="status-pill active">Paid</span></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
                            )}

                            {/* Tab 9: Organization Settings (Admin Only) */}
                            {activeTab === 'org' && role === 'Admin' && (
                                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="settings-view-form">
                                    <div className="settings-view-header">
                                        <h2>Organization Configuration</h2>
                                        <p>Manage tenancy configuration metadata and verified network domains.</p>
                                    </div>

                                    <div className="settings-grid-columns" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div className="input-wrapper">
                                            <label className="input-label">Organization Legal Name</label>
                                            <input type="text" className="input-field" value={orgName} onChange={e => setOrgName(e.target.value)} />
                                        </div>
                                        <div className="input-wrapper">
                                            <label className="input-label">Verified Email Domain Name</label>
                                            <input type="text" className="input-field" value={orgDomain} onChange={e => setOrgDomain(e.target.value)} placeholder="ecommerce.ai" />
                                        </div>
                                    </div>

                                    <div className="settings-action-bar">
                                        <Button onClick={handleSaveOrgSettings} disabled={saving || !isDirty()}>
                                            {saving ? 'Updating...' : 'Save Organization Details'}
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* MODALS OVERLAYS */}

            {/* 1. Account Deletion Confirmation Dialog Modal */}
            {showDeleteModal && (
                <div className="modal-backdrop-overlay">
                    <div className="settings-confirm-modal animate-scale-in">
                        <div className="confirm-modal-header text-danger">
                            <AlertTriangle size={24} />
                            <h3>Irreversible Account Deletion</h3>
                        </div>
                        <div className="confirm-modal-body">
                            <p>Warning: This action will permanently erase your profile from the database, invalidate all active sessions, and remove access rights. This is irreversible.</p>

                            <div className="input-wrapper" style={{ marginTop: '1rem' }}>
                                <label className="input-label">To confirm deletion, type the word <strong>DELETE</strong> below:</label>
                                <input type="text" className="input-field" placeholder="DELETE" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} />
                            </div>

                            <div className="input-wrapper" style={{ marginTop: '0.75rem' }}>
                                <label className="input-label">Provide your password credentials for validation:</label>
                                <input type="password" className="input-field" placeholder="Password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
                            </div>
                        </div>
                        <div className="confirm-modal-footer">
                            <Button variant="secondary" onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteConfirmText(''); }}>Cancel</Button>
                            <Button style={{ backgroundColor: 'var(--danger-color)', color: 'white' }} onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'DELETE' || !deletePassword}>
                                Permanently Delete My Account
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Admin Invite Team Member Modal */}
            {showInviteModal && (
                <div className="modal-backdrop-overlay">
                    <div className="settings-confirm-modal animate-scale-in" style={{ maxWidth: '440px' }}>
                        <div className="confirm-modal-header">
                            <Users size={20} color="var(--primary-color)" />
                            <h3>Invite Organization Member</h3>
                        </div>
                        <form onSubmit={handleInviteUser}>
                            <div className="confirm-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div className="input-wrapper">
                                    <label className="input-label">Full Name</label>
                                    <input type="text" className="input-field" placeholder="John Doe" value={inviteName} onChange={e => setInviteName(e.target.value)} required />
                                </div>
                                <div className="input-wrapper">
                                    <label className="input-label">Email Address</label>
                                    <input type="email" className="input-field" placeholder="john@ecommerce.ai" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
                                </div>
                                <div className="input-wrapper">
                                    <label className="input-label">Clearance Role</label>
                                    <select className="input-field" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                                        <option value="Analyst">Analyst</option>
                                        <option value="Business User">Business User</option>
                                        <option value="Admin">Admin</option>
                                    </select>
                                </div>
                                <div className="input-wrapper">
                                    <label className="input-label">Department Assignment (Optional)</label>
                                    <input type="text" className="input-field" placeholder="Operations" value={inviteDept} onChange={e => setInviteDept(e.target.value)} />
                                </div>
                            </div>
                            <div className="confirm-modal-footer">
                                <Button type="button" variant="secondary" onClick={() => setShowInviteModal(false)}>Cancel</Button>
                                <Button type="submit">Send Invitation</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
