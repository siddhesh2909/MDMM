'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';

export type Role = 'Data Engineer' | 'Data Analyst' | 'Business User' | 'Admin';

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

    const role = useMemo<Role>(() => {
        if (overrideRole) return overrideRole;
        if (user?.role) return user.role as Role;
        return 'Data Engineer';
    }, [overrideRole, user]);

    const permissions = useMemo(() => user?.permissions || [], [user]);

    const hasPermission = (perm: string) => {
        if (role === 'Admin') return true;
        return permissions.includes(perm);
    };

    const setRole = (newRole: Role) => {
        setOverrideRole(newRole);
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
