'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRole } from '@/components/providers/RoleProvider';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatWidget } from '@/components/ui/ChatWidget';
import { Shield } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

const PUBLIC_PATHS = ['/login', '/'];

function checkAuthorization(role: string, path: string): boolean {
    if (role === 'Admin') return true;

    // Direct mapping of paths allowed for Analyst vs Viewer (Business User)
    const analystPaths = [
        '/ingestion',
        '/data-contracts',
        '/contracts',
        '/preprocessing',
        '/analytics',
        '/ai-assistant',
        '/profile',
        '/notifications',
        '/collaboration'
    ];
    const viewerPaths = [
        '/analytics',
        '/reports',
        '/ai-business-assistant',
        '/profile',
        '/notifications',
        '/collaboration'
    ];

    if (role === 'Analyst') {
        return analystPaths.some(p => path === p || path.startsWith(p + '/'));
    }
    if (role === 'Business User') {
        return viewerPaths.some(p => path === p || path.startsWith(p + '/'));
    }
    return false;
}

export function AppShell({ children }: { children: React.ReactNode }) {
    const { token, isLoading } = useAuth();
    const { role } = useRole();
    const pathname = usePathname();
    const [mounted, setMounted] = React.useState(false);
    const [isAuthorized, setIsAuthorized] = React.useState(true);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    // Check authorization dynamically when pathname or role changes
    React.useEffect(() => {
        if (!mounted || !token || isLoading) return;
        
        const isPublicPage = PUBLIC_PATHS.includes(pathname);
        if (isPublicPage) {
            setIsAuthorized(true);
            return;
        }

        const authStatus = checkAuthorization(role, pathname);
        setIsAuthorized(authStatus);

        if (!authStatus) {
            // Log security event to backend
            apiClient.post('/data/log-security-event', { path: pathname }).catch(err => {
                console.error('Failed to log security event:', err);
            });
        }
    }, [pathname, role, token, isLoading, mounted]);

    if (!mounted) {
        return null;
    }

    const isPublicPage = PUBLIC_PATHS.includes(pathname);

    // On public pages or while loading, render children without shell
    if (isPublicPage || isLoading || !token) {
        return <>{children}</>;
    }

    // Render beautiful Access Denied state inline within shell
    if (!isAuthorized) {
        return (
            <div className="app-container">
                <Sidebar />
                <div className="main-content">
                    <Header />
                    <main className="page-content animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
                        <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '3rem', textAlign: 'center', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
                            <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', marginBottom: '1.5rem', color: 'var(--danger-color)' }}>
                                <Shield size={48} />
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Access Denied</h2>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '2rem' }}>
                                You do not have the required permissions to access this module (<strong>{pathname}</strong>). 
                                This unauthorized attempt has been logged for security audit purposes.
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={() => window.location.href = role === 'Business User' ? '/analytics' : '/ingestion'}
                                >
                                    Go to Dashboard
                                </button>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <Sidebar />
            <div className="main-content">
                <Header />
                <main className={`page-content animate-fade-in ${pathname.startsWith('/collaboration') ? 'full-bleed' : ''}`}>
                    {children}
                </main>
                {pathname !== '/analytics' && pathname !== '/ai-assistant' && pathname !== '/ai-business-assistant' && <ChatWidget />}
            </div>
        </div>
    );
}
