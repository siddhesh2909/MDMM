'use client';

import React from 'react';
import { Search, Bell, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRole } from '@/components/providers/RoleProvider';
import './layout.css';

export function Header() {
    const { theme, toggleTheme } = useTheme();
    const { user } = useAuth();
    const { role } = useRole();

    return (
        <header className="header">
            <div className="header-search">
                <Search size={18} color="var(--text-secondary)" />
                <input type="text" placeholder="Search data, contracts, or coworkers..." />
            </div>

            <div className="header-actions">
                {/* Theme Toggle */}
                <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle Theme">
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                {/* Notifications */}
                <button className="icon-btn" aria-label="Notifications">
                    <Bell size={20} />
                </button>

                {/* User Profile */}
                <div className="user-profile" title={`Role: ${role}`}>
                    <div className="user-avatar">
                        {user?.name?.charAt(0) || role.charAt(0)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {user?.name || 'User'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {role}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.5 }}>•</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 500 }}>
                                {user?.department || 'Member'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
