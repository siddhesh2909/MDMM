'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, Sun, Moon, MessageSquare, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/providers/ThemeProvider';
import './layout.css';

export function Header() {
    const { theme, toggleTheme } = useTheme();
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchExpanded(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

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
            </div>
        </header>
    );
}