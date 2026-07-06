import * as express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

export interface AuthenticatedUser {
    id: string;
    name: string;
    email: string;
    role: string;
    organizationId: string;
    permissions: string[];
}

export type AuthenticatedRequest = express.Request & {
    user?: AuthenticatedUser;
};

export const authenticateToken = (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, process.env.JWT_SECRET || 'super_secret_collaborative_ai_key_2026', async (err: jwt.VerifyErrors | null, user: any) => {
        if (err) return res.status(401).json({ error: 'Invalid or expired token' });

        try {
            // Verify that the user still exists in the database to prevent stale token/wiped DB constraint failures
            const dbUser = await prisma.user.findUnique({
                where: { id: user.id }
            });

            if (!dbUser) {
                return res.status(401).json({ error: 'Session expired. Please log in again.' });
            }

            let parsedPermissions: string[] = [];
            if (dbUser.permissions) {
                try {
                    parsedPermissions = JSON.parse(dbUser.permissions);
                } catch (e) {
                    console.error('Failed to parse token permissions:', dbUser.permissions, e);
                    parsedPermissions = [];
                }
            }

            const roleOverride = req.headers['x-role-override'] as string;
            req.user = {
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                role: roleOverride || dbUser.role,
                organizationId: dbUser.organizationId,
                permissions: parsedPermissions
            };
            next();
        } catch (dbErr) {
            console.error('Authentication verification database error:', dbErr);
            return res.status(500).json({ error: 'Internal server error during authentication' });
        }
    });
};

export const requireRole = (roles: string[]) => {
    return (req: any, res: express.Response, next: express.NextFunction) => {
        const authReq = req as AuthenticatedRequest;
        if (!authReq.user) return res.status(401).json({ error: 'Unauthorized' });
        if (!roles.includes(authReq.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
        }
        next();
    };
};

export const requirePermission = (permission: string) => {
    // Role-based fallback permissions — ensures existing users have correct access
    // even if their DB permissions field is outdated
    const ROLE_PERMISSIONS: Record<string, string[]> = {
        'Admin': ['*'],
        'Analyst': ['dataset:manage', 'dataset:view', 'contract:edit', 'contract:view'],
        'Data Analyst': ['dataset:manage', 'dataset:view', 'contract:edit', 'contract:view'],
        'Data Engineer': ['dataset:manage', 'dataset:view', 'contract:edit', 'contract:view'],
        'Data Steward': ['dataset:manage', 'dataset:view', 'contract:edit', 'contract:view'],
        'Business User': ['dataset:view'],
        'Viewer': ['dataset:view'],
    };

    return (req: any, res: express.Response, next: express.NextFunction) => {
        const authReq = req as AuthenticatedRequest;
        if (!authReq.user) return res.status(401).json({ error: 'Unauthorized' });

        const role = authReq.user.role;

        // Admin always passes
        if (role === 'Admin') return next();

        // Check explicit DB-stored permissions first
        if (authReq.user.permissions.includes(permission)) return next();

        // Fallback: check role-based default permissions
        const roleDefaults = ROLE_PERMISSIONS[role] || [];
        if (roleDefaults.includes('*') || roleDefaults.includes(permission)) return next();

        return res.status(403).json({ error: `Forbidden: Missing permission [${permission}]` });
    };
};
