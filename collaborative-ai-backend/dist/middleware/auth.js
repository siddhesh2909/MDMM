"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'Access token required' });
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'super_secret_collaborative_ai_key_2026', async (err, user) => {
        if (err)
            return res.status(403).json({ error: 'Invalid or expired token' });
        try {
            // Verify that the user still exists in the database to prevent stale token/wiped DB constraint failures
            const dbUser = await prisma_1.default.user.findUnique({
                where: { id: user.id }
            });
            if (!dbUser) {
                return res.status(401).json({ error: 'Session expired. Please log in again.' });
            }
            let parsedPermissions = [];
            if (dbUser.permissions) {
                try {
                    parsedPermissions = JSON.parse(dbUser.permissions);
                }
                catch (e) {
                    console.error('Failed to parse token permissions:', dbUser.permissions, e);
                    parsedPermissions = [];
                }
            }
            req.user = {
                id: dbUser.id,
                role: dbUser.role,
                organizationId: dbUser.organizationId,
                permissions: parsedPermissions
            };
            next();
        }
        catch (dbErr) {
            console.error('Authentication verification database error:', dbErr);
            return res.status(500).json({ error: 'Internal server error during authentication' });
        }
    });
};
exports.authenticateToken = authenticateToken;
const requireRole = (roles) => {
    return (req, res, next) => {
        const authReq = req;
        if (!authReq.user)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!roles.includes(authReq.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
        }
        next();
    };
};
exports.requireRole = requireRole;
const requirePermission = (permission) => {
    return (req, res, next) => {
        const authReq = req;
        if (!authReq.user)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!authReq.user.permissions.includes(permission) && authReq.user.role !== 'Admin') {
            return res.status(403).json({ error: `Forbidden: Missing permission [${permission}]` });
        }
        next();
    };
};
exports.requirePermission = requirePermission;
