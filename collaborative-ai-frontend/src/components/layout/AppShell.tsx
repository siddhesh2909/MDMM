'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatWidget } from '@/components/ui/ChatWidget';

const PUBLIC_PATHS = ['/login', '/'];

export function AppShell({ children }: { children: React.ReactNode }) {
    const { token, isLoading } = useAuth();
    const pathname = usePathname();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    const isPublicPage = PUBLIC_PATHS.includes(pathname);

    // On public pages or while loading, render children without shell
    if (isPublicPage || isLoading || !token) {
        return <>{children}</>;
    }

    return (
        <div className="app-container">
            <Sidebar />
            <div className="main-content">
                <Header />
                <main className="page-content animate-fade-in">
                    {children}
                </main>
                <ChatWidget />
            </div>
        </div>
    );
}
