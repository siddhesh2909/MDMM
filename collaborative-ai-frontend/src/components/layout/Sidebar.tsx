'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/components/providers/RoleProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import {
    Database,
    FileJson,
    Wand2,
    GitMerge,
    Network,
    BarChart3,
    Settings,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Globe
} from 'lucide-react';
import './layout.css';

const navConfig = [
    { name: 'Data Sources', path: '/ingestion', icon: Globe, permission: 'dataset:manage' },
    { name: 'Data Contracts', path: '/data-contracts', icon: Database, permission: 'dataset:manage' },
    { name: 'Preprocessing', path: '/preprocessing', icon: Wand2, permission: 'dataset:manage' },
    { name: 'Workflows', path: '/workflows', icon: GitMerge, permission: 'workflow:view' },
    { name: 'Lineage', path: '/lineage', icon: Network, permission: 'dataset:view' },
    { name: 'Analytics', path: '/analytics', icon: BarChart3, permission: 'dataset:view' },
    { name: 'Admin', path: '/admin', icon: Settings, role: 'Admin' },
];

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const { role, hasPermission } = useRole();
    const { logout } = useAuth();

    const allowedNavs = navConfig.filter((item) => {
        if (item.role && item.role !== role) return false;
        if (item.permission && !hasPermission(item.permission)) return false;
        return true;
    });

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <span className="sidebar-logo">CollabAI</span>
                <button onClick={() => setCollapsed(!collapsed)} className="icon-btn" aria-label="Toggle Sidebar">
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <nav className="sidebar-nav">
                {allowedNavs.map((item) => {
                    const isActive = pathname.startsWith(item.path);
                    const Icon = item.icon;
                    return (
                        <Link key={item.path} href={item.path} className={`nav-item ${isActive ? 'active' : ''}`} title={collapsed ? item.name : undefined}>
                            <Icon className="nav-icon" />
                            <span className="nav-label">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="sidebar-nav" style={{ flex: 'none', borderTop: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                <button
                    className="nav-item"
                    style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', color: 'var(--danger-color)' }}
                    title={collapsed ? 'Logout' : undefined}
                    onClick={logout}
                >
                    <LogOut className="nav-icon" />
                    <span className="nav-label">Logout</span>
                </button>
            </div>
        </aside>
    );
}
