'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';

export type Role = 'Analyst' | 'Business User' | 'Admin';

interface RoleContextType {
    role: Role;
    permissions: string[];
    setRole: (role: Role) => void;
    hasPermission: (permission: string) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [overrideRole, setOverrideRole] = useState<Role | null>(null);

    React.useEffect(() => {
        setOverrideRole(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('override_role');
        }
    }, [user?.id]);

    const role = useMemo<Role>(() => {
        if (overrideRole) return overrideRole;
        const dbRole = user?.role;
        if (dbRole === 'Data Analyst' || dbRole === 'Analyst' || dbRole === 'Data Steward' || dbRole === 'Data Engineer') return 'Analyst';
        if (dbRole === 'Business User' || dbRole === 'Viewer') return 'Business User';
        if (dbRole === 'Admin') return 'Admin';
        return 'Business User';
    }, [overrideRole, user]);

    const permissions = useMemo(() => user?.permissions || [], [user]);

    const hasPermission = (perm: string) => {
        if (role === 'Admin') return true;
        return permissions.includes(perm);
    };

    const setRole = (newRole: Role) => {
        setOverrideRole(newRole);
        if (typeof window !== 'undefined') {
            localStorage.setItem('override_role', newRole);
        }
    };

    return (
        <RoleContext.Provider value={{ role, permissions, setRole, hasPermission }}>
            {children}
        </RoleContext.Provider>
    );
}

export const useRole = () => {
    const context = useContext(RoleContext);
    if (context === undefined) {
        throw new Error('useRole must be used within a RoleProvider');
    }
    return context;
};
