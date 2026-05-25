import * as express from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
    id: string;
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

    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err: jwt.VerifyErrors | null, user: any) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });

        // Payload comes as JSON string for permissions from database, but should be array in user object
        req.user = {
            id: user.id,
            role: user.role,
            organizationId: user.organizationId,
            permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : (user.permissions || [])
        };
        next();
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
    return (req: any, res: express.Response, next: express.NextFunction) => {
        const authReq = req as AuthenticatedRequest;
        if (!authReq.user) return res.status(401).json({ error: 'Unauthorized' });
        if (!authReq.user.permissions.includes(permission) && authReq.user.role !== 'Admin') {
            return res.status(403).json({ error: `Forbidden: Missing permission [${permission}]` });
        }
        next();
    };
};
