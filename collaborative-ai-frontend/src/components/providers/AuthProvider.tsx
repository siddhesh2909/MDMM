'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: string;
    organizationId: string;
    permissions: string[];
    department?: string;
    status?: string;
    lastActive?: string;
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (name: string, email: string, password: string, role?: string, department?: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_PATHS = ['/login', '/'];

function getInitialToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
}

function getInitialUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('auth_user');
    if (!saved) return null;
    try { return JSON.parse(saved); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(getInitialUser);
    const [token, setToken] = useState<string | null>(getInitialToken);
    const [isLoading] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    // Redirect logic: protect routes
    useEffect(() => {
        if (isLoading) return;
        const isPublic = PUBLIC_PATHS.includes(pathname);
        if (!token && !isPublic) {
            router.replace('/login');
        } else if (token && isPublic) {
            router.replace('/ingestion');
        }
    }, [token, pathname, isLoading, router]);

    const login = useCallback(async (email: string, password: string) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok && data.token) {
                setToken(data.token);
                setUser(data.user);
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('auth_user', JSON.stringify(data.user));
                return { success: true };
            }
            return { success: false, error: data.error || 'Login failed' };
        } catch {
            return { success: false, error: 'Network error. Is the backend running?' };
        }
    }, []);

    const register = useCallback(async (name: string, email: string, password: string, role?: string, department?: string) => {
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role, department })
            });
            const data = await res.json();
            if (res.ok && data.token) {
                setToken(data.token);
                setUser(data.user);
                localStorage.setItem('auth_token', data.token);
                localStorage.setItem('auth_user', JSON.stringify(data.user));
                return { success: true };
            }
            return { success: false, error: data.error || 'Registration failed' };
        } catch {
            return { success: false, error: 'Network error. Is the backend running?' };
        }
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        router.replace('/login');
    }, [router]);

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
