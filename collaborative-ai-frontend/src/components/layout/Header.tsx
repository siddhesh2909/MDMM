'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Sun, Moon, User, Shield, LogOut, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import { NotificationCenter } from './NotificationCenter';
import { useRole } from '@/components/providers/RoleProvider';
import './layout.css';

export function Header() {
    const { theme, toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const { role } = useRole();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

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
                <NotificationCenter />

                {/* User Profile Dropdown Container */}
                <div className="profile-container" ref={dropdownRef}>
                    <div className="user-profile" onClick={() => setIsOpen(!isOpen)} title={`Role: ${role}`}>
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
                        <ChevronDown size={14} color="var(--text-secondary)" style={{ marginLeft: '4px', transition: 'transform 0.2s' }} className={isOpen ? 'rotate-180' : ''} />
                    </div>

                    {isOpen && (
                        <div className="profile-dropdown glass-panel">
                            <div className="profile-dropdown-header">
                                <div className="user-avatar large">
                                    {user?.name?.charAt(0) || role.charAt(0)}
                                </div>
                                <div className="profile-dropdown-user-details">
                                    <span className="profile-dropdown-name">{user?.name || 'User'}</span>
                                    <span className="profile-dropdown-email">{user?.email || ''}</span>
                                </div>
                            </div>
                            
                            <div className="profile-dropdown-content">
                                <button className="profile-dropdown-item" onClick={handleProfileClick}>
                                    <User size={16} />
                                    <span>My Profile</span>
                                </button>
                                
                                {role === 'Admin' && (
                                    <button className="profile-dropdown-item" onClick={handleAdminClick}>
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

