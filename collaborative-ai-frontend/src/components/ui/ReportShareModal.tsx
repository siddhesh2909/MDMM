import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/providers/ToastProvider';
import { 
    Users, UserPlus, Shield, Globe, Lock, Trash2, Loader2, Search, Check, ChevronDown, Copy
} from 'lucide-react';

interface UserInfo {
    id: string;
    name: string;
    email: string;
    role?: string;
}

interface Collaborator extends UserInfo {
    permission: 'viewer' | 'editor' | 'manager' | 'owner' | 'view' | 'edit' | 'manage';
}

interface ReportShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportId: string;
    reportName: string;
    onSaveCallback?: () => void; // Triggered when visibility or sharing changes
}

export function ReportShareModal({ isOpen, onClose, reportId, reportName, onSaveCallback }: ReportShareModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [visibility, setVisibility] = useState<string>('private');
    const [owner, setOwner] = useState<UserInfo | null>(null);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    
    // User Directory states
    const [directory, setDirectory] = useState<UserInfo[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
    const [selectedPermission, setSelectedPermission] = useState<'viewer' | 'editor' | 'manager'>('viewer');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [generatedShareLink, setGeneratedShareLink] = useState('');

    // Load directory and current sharing data
    useEffect(() => {
        if (isOpen && reportId) {
            fetchSharingDetails();
            fetchUserDirectory();
        }
    }, [isOpen, reportId]);

    const fetchSharingDetails = async () => {
        setLoading(true);
        try {
            const data = await apiClient.get(`/data/reports/${reportId}/share/users`);
            if (data) {
                setVisibility(data.visibility || 'private');
                setOwner(data.owner);
                setCollaborators(data.collaborators || []);
                
                // Set or construct share link
                const reportData = await apiClient.get('/data/reports');
                const matchingReport = Array.isArray(reportData) ? reportData.find((r: any) => r.id === reportId) : null;
                if (matchingReport && matchingReport.shareLink) {
                    setGeneratedShareLink(`${window.location.origin}/shared/reports/${matchingReport.shareLink}`);
                } else {
                    setGeneratedShareLink('');
                }
            }
        } catch (err: any) {
            console.error('Failed to load sharing details:', err);
            showToast(err.message || 'Failed to load report sharing permissions.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchUserDirectory = async () => {
        try {
            const users = await apiClient.get('/collaboration/users');
            if (users) {
                setDirectory(users);
            }
        } catch (err) {
            console.error('Failed to load user directory:', err);
        }
    };

    const handleVisibilityChange = async (newVisibility: string) => {
        setActionLoading(true);
        try {
            const res = await apiClient.post(`/data/reports/${reportId}/share`, {
                visibility: newVisibility
            });
            setVisibility(newVisibility);
            if (res && res.shareLink) {
                setGeneratedShareLink(`${window.location.origin}/shared/reports/${res.shareLink}`);
            }
            showToast(`Report visibility updated to ${newVisibility}.`, 'success');
            if (onSaveCallback) onSaveCallback();
        } catch (err: any) {
            showToast(err.message || 'Failed to update visibility.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddCollaborator = async () => {
        if (!selectedUser) {
            showToast('Please select a user to share with.', 'error');
            return;
        }
        setActionLoading(true);
        try {
            const res = await apiClient.post(`/data/reports/${reportId}/share`, {
                targetEmail: selectedUser.email,
                permission: selectedPermission
            });
            showToast(`Shared report with ${selectedUser.name}.`, 'success');
            
            if (res && res.shareLink) {
                setGeneratedShareLink(`${window.location.origin}/shared/reports/${res.shareLink}`);
            }

            // Reset fields
            setSelectedUser(null);
            setSearchQuery('');
            setSelectedPermission('viewer');
            
            // Reload sharing lists
            await fetchSharingDetails();
            if (onSaveCallback) onSaveCallback();
        } catch (err: any) {
            showToast(err.message || 'Failed to add collaborator.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdatePermission = async (userId: string, permission: string) => {
        setActionLoading(true);
        try {
            await apiClient.post(`/data/reports/${reportId}/share/update`, {
                targetUserId: userId,
                permission
            });
            showToast('Collaborator permission level updated.', 'success');
            await fetchSharingDetails();
            if (onSaveCallback) onSaveCallback();
        } catch (err: any) {
            showToast(err.message || 'Failed to update permission.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevokeShare = async (userId: string) => {
        if (!confirm('Are you sure you want to revoke access for this user?')) return;
        setActionLoading(true);
        try {
            await apiClient.post(`/data/reports/${reportId}/share/revoke`, {
                targetUserId: userId
            });
            showToast('Collaborator access revoked successfully.', 'info');
            await fetchSharingDetails();
            if (onSaveCallback) onSaveCallback();
        } catch (err: any) {
            showToast(err.message || 'Failed to revoke collaborator access.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Filter directory list based on search and exclusions (owner + current collaborators)
    const filteredUsers = directory.filter(u => {
        if (owner && u.id === owner.id) return false;
        if (collaborators.some(c => c.id === u.id)) return false;
        
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        if (q.includes('(') && q.includes(')')) return false;
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Share "${reportName}"`} maxWidth="560px">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.25rem' }}>
                
                {/* 1. Visibility Scope Card */}
                <div style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Shield size={16} color="var(--primary-color)" />
                        <span>Visibility Scope</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {/* Private Option */}
                        <div 
                            onClick={() => !actionLoading && handleVisibilityChange('private')}
                            style={{
                                padding: '1rem',
                                border: `1px solid ${visibility === 'private' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                borderRadius: '8px',
                                backgroundColor: visibility === 'private' ? 'rgba(79, 70, 229, 0.04)' : 'var(--bg-color)',
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                gap: '0.75rem',
                                alignItems: 'flex-start',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Lock size={18} style={{ color: visibility === 'private' ? 'var(--primary-color)' : 'var(--text-secondary)', marginTop: '2px' }} />
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: visibility === 'private' ? 'var(--primary-color)' : 'var(--text-primary)' }}>Private</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>Only shared users can see.</div>
                            </div>
                        </div>

                        {/* Org Option */}
                        <div 
                            onClick={() => !actionLoading && handleVisibilityChange('organization')}
                            style={{
                                padding: '1rem',
                                border: `1px solid ${visibility === 'organization' ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                borderRadius: '8px',
                                backgroundColor: visibility === 'organization' ? 'rgba(79, 70, 229, 0.04)' : 'var(--bg-color)',
                                cursor: actionLoading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                gap: '0.75rem',
                                alignItems: 'flex-start',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Globe size={18} style={{ color: visibility === 'organization' ? 'var(--primary-color)' : 'var(--text-secondary)', marginTop: '2px' }} />
                            <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: visibility === 'organization' ? 'var(--primary-color)' : 'var(--text-primary)' }}>Organization</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>Anyone in company can see.</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Add Collaborators Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Add Collaborator</label>
                    <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
                        {/* Autocomplete Input */}
                        <div style={{ flex: 1, position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 0.75rem', backgroundColor: 'var(--bg-color)', height: '40px' }}>
                                <Search size={16} color="var(--text-secondary)" style={{ marginRight: '0.5rem' }} />
                                <input
                                    type="text"
                                    placeholder="Type name or email..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setSelectedUser(null);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                                />
                            </div>

                            {/* Suggestions Dropdown */}
                            {showSuggestions && filteredUsers.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '44px',
                                    left: 0,
                                    right: 0,
                                    backgroundColor: 'var(--bg-color)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    boxShadow: 'var(--shadow-md)',
                                    zIndex: 50,
                                    maxHeight: '160px',
                                    overflowY: 'auto'
                                }}>
                                    {filteredUsers.map(u => (
                                        <div 
                                            key={u.id}
                                            onClick={() => {
                                                setSelectedUser(u);
                                                setSearchQuery(`${u.name} (${u.email})`);
                                                setShowSuggestions(false);
                                            }}
                                            style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <span style={{ fontWeight: 500 }}>{u.name}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Permission selector */}
                        <select
                            value={selectedPermission}
                            onChange={(e) => setSelectedPermission(e.target.value as any)}
                            style={{
                                padding: '0 0.5rem',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                backgroundColor: 'var(--bg-color)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                outline: 'none',
                                cursor: 'pointer',
                                height: '40px'
                            }}
                        >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="manager">Manager</option>
                        </select>

                        <Button 
                            variant="primary" 
                            onClick={handleAddCollaborator}
                            disabled={!selectedUser || actionLoading}
                            style={{ height: '40px' }}
                            icon={<UserPlus size={16} />}
                        >
                            Add
                        </Button>
                    </div>
                </div>

                {/* 3. Collaborators List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Who has access</div>
                    
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', color: 'var(--text-secondary)', gap: '0.5rem' }}>
                            <Loader2 className="spinner" size={16} />
                            <span style={{ fontSize: '0.85rem' }}>Loading access list...</span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                            {/* Owner */}
                            {owner && (
                                <div style={{ display: 'flex', justifySelf: 'stretch', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-color)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{owner.name}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{owner.email}</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-color)', backgroundColor: 'rgba(79, 70, 229, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Owner</span>
                                </div>
                            )}

                            {/* Collaborators */}
                            {collaborators.length > 0 ? (
                                collaborators.map((c) => (
                                    <div key={c.id} style={{ display: 'flex', justifySelf: 'stretch', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-color)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.email}</span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {/* Collaborator Role Select */}
                                            <select
                                                value={c.permission === 'view' ? 'viewer' : c.permission === 'edit' ? 'editor' : c.permission === 'manage' ? 'manager' : c.permission}
                                                onChange={(e) => handleUpdatePermission(c.id, e.target.value)}
                                                disabled={actionLoading}
                                                style={{
                                                    padding: '0.2rem 0.5rem',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '4px',
                                                    backgroundColor: 'var(--bg-secondary)',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.8rem',
                                                    outline: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <option value="viewer">Viewer</option>
                                                <option value="editor">Editor</option>
                                                <option value="manager">Manager</option>
                                            </select>

                                            {/* Revoke access button */}
                                            <button 
                                                onClick={() => handleRevokeShare(c.id)}
                                                disabled={actionLoading}
                                                style={{
                                                    border: 'none',
                                                    background: 'transparent',
                                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                                    color: 'var(--danger-color)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '0.25rem',
                                                    opacity: 0.8
                                                }}
                                                title="Revoke access"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                visibility === 'private' && (
                                    <div style={{ padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                        No team members shared yet. Add collaborators above!
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>



                {/* Footer buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                    <Button variant="outline" onClick={onClose}>Done</Button>
                </div>
            </div>
        </Modal>
    );
}
