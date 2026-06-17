'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Sun, Moon, User, Shield, LogOut, ChevronDown, MessageSquare, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { NotificationCenter } from './NotificationCenter';
import { useRole } from '@/components/providers/RoleProvider';
import './layout.css';

function getRoleDisplayName(role: string): string {
    if (role === 'Admin') return 'Admin';
    if (role === 'Analyst') return 'Analyst';
    return 'Business User';
}

export function Header() {
    const { theme, toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const { role } = useRole();
    const [isOpen, setIsOpen] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchExpanded(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleProfileClick = () => {
        setIsOpen(false);
        router.push('/profile');
    };

    const handleAdminClick = () => {
        setIsOpen(false);
        router.push('/admin');
    };

    const handleLogoutClick = () => {
        setIsOpen(false);
        logout();
    };

    return (
        <header className="header">
            {isSearchExpanded ? (
                <div className="header-search" ref={searchRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '340px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        <Search size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                        <input
                            type="text"
                            placeholder="Search data, contracts, or conversations..."
                            style={{ width: '100%' }}
                            autoFocus
                        />
                    </div>
                    <button 
                        onClick={() => setIsSearchExpanded(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <button
                    className="icon-btn"
                    onClick={() => setIsSearchExpanded(true)}
                    aria-label="Open Search"
                    title="Search"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    <Search size={20} />
                </button>
            )}

            <div className="header-actions">
                <button
                    className="icon-btn"
                    onClick={toggleTheme}
                    aria-label="Toggle Theme"
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                <button
                    className="icon-btn"
                    onClick={() => router.push('/collaboration')}
                    aria-label="Collaboration Channels"
                    title="Collaboration Hub"
                >
                    <MessageSquare size={20} />
                </button>

                <NotificationCenter />

                <div className="profile-container" ref={dropdownRef}>
                    <div
                        className="user-profile"
                        onClick={() => setIsOpen(!isOpen)}
                        title={`Role: ${role}`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <div className="user-avatar">
                            {role.charAt(0)}
                        </div>

                        <span
                            style={{
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)'
                            }}
                        >
                            {getRoleDisplayName(role)}
                        </span>

                        <ChevronDown
                            size={14}
                            color="var(--text-secondary)"
                            style={{ transition: 'transform 0.2s' }}
                            className={isOpen ? 'rotate-180' : ''}
                        />
                    </div>

                    {isOpen && (
                        <div className="profile-dropdown glass-panel">
                            <div className="profile-dropdown-header">
                                <div className="user-avatar large">
                                    {role.charAt(0)}
                                </div>

                                <div className="profile-dropdown-user-details">
                                    <span className="profile-dropdown-name">
                                        {getRoleDisplayName(role)}
                                    </span>

                                    <span className="profile-dropdown-email">
                                        {user?.email || ''}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="profile-dropdown-content">
                                <button
                                    className="profile-dropdown-item"
                                    onClick={handleProfileClick}
                                >
                                    <User size={16} />
                                    <span>My Profile</span>
                                </button>
                                
                                {role === 'Admin' && (
                                    <button
                                        className="profile-dropdown-item"
                                        onClick={handleAdminClick}
                                    >
                                        <Shield size={16} />
                                        <span>Admin Panel</span>
                                    </button>
                                )}
                                
                                <div className="profile-dropdown-divider" />
                                
                                <button className="profile-dropdown-item logout-item" onClick={handleLogoutClick}>
                                    <LogOut size={16} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}