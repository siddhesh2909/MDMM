'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Shield, Users, Activity, UserX } from 'lucide-react';
import { useRole } from '@/components/providers/RoleProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { apiClient } from '@/lib/apiClient';

export default function AdminPage() {
    const { role } = useRole();
    const { user: currentUser } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'users' | 'rbac' | 'audit'>('users');
    const [users, setUsers] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const handleUpdateRole = async (userId: string, newRole: string) => {
        try {
            await apiClient.patch('/data/users/update-role', { id: userId, role: newRole });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            showToast('User role updated successfully.', 'success');
        } catch (err) {
            showToast('Failed to update role.', 'error');
        }
    };

    const handleDeactivate = async (userId: string) => {
        if (!confirm('Are you sure you want to deactivate this user?')) return;
        try {
            await apiClient.patch('/data/users/deactivate', { id: userId });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'Inactive' } : u));
            showToast('User deactivated successfully.', 'success');
        } catch (err) {
            showToast('Failed to deactivate user.', 'error');
        }
    };

    useEffect(() => {
        if (role !== 'Admin') return;

        async function loadAdminData() {
            setLoading(true);
            try {
                if (activeTab === 'users') {
                    const data = await apiClient.get('/data/users');
                    setUsers(data || []);
                } else if (activeTab === 'audit') {
                    const data = await apiClient.get('/data/audit-log');
                    setAuditLogs(data || []);
                }
            } catch (err) {
                console.error("Admin data fetch error:", err);
            } finally {
                setLoading(false);
            }
        }
        loadAdminData();
    }, [role, activeTab]);

    if (role !== 'Admin') {
        return (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                <Shield size={64} color="var(--danger-color)" style={{ margin: '0 auto 1.5rem' }} />
                <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>Access Denied</h2>
                <p>You require Administrator privileges to view this page.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Administration & Security</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage users, define Role-Based Access Control matrices, and view audit logs.</p>
                </div>
                {loading && <div className="spinner" style={{ width: 24, height: 24, border: '2px solid var(--primary-color)', borderTopColor: 'transparent' }} />}
            </div>

            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <Button variant={activeTab === 'users' ? 'primary' : 'outline'} icon={<Users size={16} />} onClick={() => setActiveTab('users')}>User Management</Button>
                <Button variant={activeTab === 'rbac' ? 'primary' : 'outline'} icon={<Shield size={16} />} onClick={() => setActiveTab('rbac')}>Access Control</Button>
                <Button variant={activeTab === 'audit' ? 'primary' : 'outline'} icon={<Activity size={16} />} onClick={() => setActiveTab('audit')}>Audit Logs</Button>
            </div>

            {activeTab === 'users' && (
                <Card>
                    <CardHeader actions={<Button variant="primary">Invite User</Button>}>
                        Directory
                    </CardHeader>
                    <CardContent style={{ padding: 0 }}>
                        <DataTable
                            columns={[
                                { header: 'Name', accessorKey: 'name' },
                                { header: 'Email', accessorKey: 'email' },
                                {
                                    header: 'Role',
                                    cell: (row) => (
                                        <select
                                            value={row.role}
                                            onChange={(e) => handleUpdateRole(row.id, e.target.value)}
                                            style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }}
                                            disabled={row.id === currentUser?.id || row.status === 'Inactive'}
                                        >
                                            <option value="Admin">Admin</option>
                                            <option value="Data Engineer">Data Engineer</option>
                                            <option value="Data Analyst">Data Analyst</option>
                                            <option value="Business User">Business User</option>
                                        </select>
                                    )
                                },
                                { header: 'Department', accessorKey: 'department' },
                                {
                                    header: 'Status',
                                    cell: (row) => <span style={{ color: row.status === 'Active' ? 'var(--success-color)' : 'var(--text-secondary)' }}>{row.status}</span>
                                },
                                {
                                    header: 'Actions',
                                    cell: (row) => (
                                        <Button
                                            variant="outline"
                                            onClick={() => handleDeactivate(row.id)}
                                            disabled={row.status === 'Inactive' || row.id === currentUser?.id}
                                            style={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)', padding: '0.25rem 0.75rem', height: 'auto' }}
                                        >
                                            <UserX size={14} style={{ marginRight: '0.25rem' }} /> Deactivate
                                        </Button>
                                    )
                                }
                            ]}
                            data={users}
                        />
                    </CardContent>
                </Card>
            )}

            {activeTab === 'audit' && (
                <Card>
                    <CardHeader>System Audit Log</CardHeader>
                    <CardContent style={{ padding: 0 }}>
                        <DataTable
                            columns={[
                                { header: 'Timestamp', accessorKey: 'time' },
                                { header: 'User', accessorKey: 'user' },
                                { header: 'Action', accessorKey: 'action' },
                                { header: 'Resource', accessorKey: 'resource' }
                            ]}
                            data={auditLogs}
                        />
                    </CardContent>
                </Card>
            )}

            {activeTab === 'rbac' && (
                <Card>
                    <CardHeader>Role Permissions Matrix</CardHeader>
                    <CardContent>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Ensure least-privilege principles are met. Changes strictly enforced at API layer.</p>
                        {/* Visual table placeholder for RBAC Map */}
                        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                            <table className="data-table" style={{ border: 'none' }}>
                                <thead>
                                    <tr>
                                        <th>Permission</th>
                                        <th>Data Engineer</th>
                                        <th>Data Analyst</th>
                                        <th>Business User</th>
                                        <th>Admin</th>
                                    </tr>
                                </thead>
                                <tbody style={{ textAlign: 'center' }}>
                                    <tr>
                                        <td style={{ textAlign: 'left' }}>Ingest Raw Data</td>
                                        <td>✅</td><td>❌</td><td>❌</td><td>✅</td>
                                    </tr>
                                    <tr>
                                        <td style={{ textAlign: 'left' }}>Edit Schema Contracts</td>
                                        <td>✅</td><td>✅</td><td>❌</td><td>✅</td>
                                    </tr>
                                    <tr>
                                        <td style={{ textAlign: 'left' }}>View Analytics</td>
                                        <td>❌</td><td>✅</td><td>✅</td><td>✅</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
