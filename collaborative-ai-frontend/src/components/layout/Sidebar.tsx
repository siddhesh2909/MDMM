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
    MessageSquare
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
    { name: 'Workflows', path: '/workflows', icon: GitMerge },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'AI Assistant', path: '/ai-assistant', icon: Sparkles },
    { name: 'AI Business Assistant', path: '/ai-business-assistant', icon: Sparkles },
    {
        name: 'Collaboration',
        path: '/collaboration/direct-messages',
        icon: MessageSquare,
        subItems: [
            { name: 'Direct Messages', path: '/collaboration/direct-messages' }
        ]
    },
    { name: 'Admin', path: '/admin', icon: Settings },
];

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const { role } = useRole();
    const { logout } = useAuth();

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
                <span className="sidebar-logo">CollabAI</span>
                <button onClick={() => setCollapsed(!collapsed)} className="icon-btn" aria-label="Toggle Sidebar">
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <nav className="sidebar-nav">
                {allowedNavs.map((item) => {
                    const isActive = pathname.startsWith(item.path) || (item.subItems && item.subItems.some(sub => pathname.startsWith(sub.path)));
                    const Icon = item.icon;
                    return (
                        <div key={item.name} className="nav-group" style={{ display: 'flex', flexDirection: 'column' }}>
                            <Link href={item.path} className={`nav-item ${isActive ? 'active' : ''}`} title={collapsed ? item.name : undefined}>
                                <Icon className="nav-icon" />
                                <span className="nav-label">{item.name}</span>
                            </Link>

                            {item.subItems && !collapsed && (
                                <div className="nav-sub-list">
                                    {item.subItems.map((sub) => {
                                        const isSubActive = pathname === sub.path;
                                        return (
                                            <Link key={sub.path} href={sub.path} className={`nav-sub-item ${isSubActive ? 'active' : ''}`}>
                                                <span className="nav-sub-dot" />
                                                <span>{sub.name}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
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
