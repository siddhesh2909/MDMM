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
    Globe,
    FileText,
    Sparkles,
    MessageSquare,
    MoreVertical
} from 'lucide-react';
import './layout.css';

interface NavItem {
    name: string;
    path: string;
    icon: React.ComponentType<any>;
    subItems?: { name: string; path: string }[];
}

const navConfig: NavItem[] = [
    { name: 'Data Sources', path: '/ingestion', icon: Globe },
    { name: 'Data Contracts', path: '/data-contracts', icon: Database },
    { name: 'Preprocessing', path: '/preprocessing', icon: Wand2 },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'AI Assistant', path: '/ai-assistant', icon: Sparkles },
    { name: 'AI Business Assistant', path: '/ai-business-assistant', icon: Sparkles },
    { name: 'Collaboration', path: '/collaboration', icon: MessageSquare },
    { name: 'Admin', path: '/admin', icon: Settings },
];

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const { role } = useRole();
    const { user, logout } = useAuth();

    const allowedNavs = navConfig.filter((item) => {
        if (role === 'Admin') {
            if (item.name === 'AI Business Assistant') return false;
            return true;
        }
        if (role === 'Analyst') {
            return [
                'Data Sources',
                'Data Contracts',
                'Preprocessing',
                'Workflows',
                'Analytics',
                'AI Assistant',
                'Collaboration'
            ].includes(item.name);
        }
        if (role === 'Business User') {
            return [
                'Analytics',
                'Reports',
                'AI Business Assistant',
                'Collaboration'
            ].includes(item.name);
        }
        return false;
    });

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', overflow: 'hidden' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="var(--primary-color)" />
                        <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="var(--primary-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="sidebar-logo">CollabAI</span>
                </div>
                <button onClick={() => setCollapsed(!collapsed)} className="icon-btn" aria-label="Toggle Sidebar">
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <nav className="sidebar-nav">
                {allowedNavs.map((item) => {
                    const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                    const Icon = item.icon;
                    return (
                        <div key={item.name} className="nav-group" style={{ display: 'flex', flexDirection: 'column' }}>
                            <Link href={item.path} className={`nav-item ${isActive ? 'active' : ''}`} title={collapsed ? item.name : undefined}>
                                <Icon className="nav-icon" />
                                <span className="nav-label">{item.name}</span>
                            </Link>
                        </div>
                    );
                })}
            </nav>

            <div className="sidebar-footer" style={{ flex: 'none', borderTop: '1px solid var(--border-color)', padding: '1rem 0.75rem' }}>
                <button
                    className="nav-item logout-btn"
                    style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', marginTop: '0.5rem' }}
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
