"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        return res.status(401).json({ error: 'Access token required' });
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'super_secret_collaborative_ai_key_2026', (err, user) => {
        if (err)
            return res.status(403).json({ error: 'Invalid or expired token' });
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
