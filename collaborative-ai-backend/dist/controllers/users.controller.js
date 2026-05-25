"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivateUser = exports.updateUserRole = exports.inviteUser = exports.getAuditLog = exports.getUsers = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getUsers = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const users = await prisma_1.default.user.findMany({
            where: { organizationId: orgId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                createdAt: true,
                status: true,
                lastActive: true
            }
        });
        res.status(200).json(users);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};
exports.getUsers = getUsers;
const getAuditLog = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const auditTrail = await prisma_1.default.auditLog.findMany({
            where: { organizationId: orgId },
            orderBy: { timestamp: 'desc' },
            take: 50
        });
        res.status(200).json(auditTrail);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
};
exports.getAuditLog = getAuditLog;
const inviteUser = async (req, res) => {
    // For enterprise demo: create a pending user in the current org
    try {
        const { name, email, role, department } = req.body;
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const user = await prisma_1.default.user.create({
            data: {
                name,
                email,
                role: role || 'Business User',
                department,
                organizationId: orgId,
                status: 'Pending',
                password: 'INVITED_USER_PLACEHOLDER'
            }
        });
        res.status(201).json({ message: 'User invited successfully', user });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to invite user' });
    }
};
exports.inviteUser = inviteUser;
const updateUserRole = async (req, res) => {
    try {
        const { id, role } = req.body;
        const orgId = req.user?.organizationId;
        const reqUser = req.user;
        if (!orgId || !reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!id || !role)
            return res.status(400).json({ error: 'Missing id or role' });
        const defaultPermissions = role === 'Admin' ? ['*'] :
            role === 'Data Engineer' ? ['dataset:manage', 'contract:edit', 'workflow:view', 'workflow:edit'] :
                role === 'Data Analyst' ? ['dataset:view', 'contract:view', 'workflow:view'] :
                    ['dataset:view'];
        const updatedUser = await prisma_1.default.user.update({
            where: { id: id, organizationId: orgId },
            data: {
                role,
                permissions: JSON.stringify(defaultPermissions)
            }
        });
        // Audit Log
        await prisma_1.default.auditLog.create({
            data: {
                userId: reqUser.id,
                role: reqUser.role,
                action: 'Update Role',
                entityType: 'User',
                entityId: updatedUser.id,
                details: JSON.stringify({ newRole: role }),
                organizationId: orgId
            }
        });
        res.status(200).json({ message: 'User role updated successfully', user: updatedUser });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update user role' });
    }
};
exports.updateUserRole = updateUserRole;
const deactivateUser = async (req, res) => {
    try {
        const { id } = req.body;
        const orgId = req.user?.organizationId;
        const reqUser = req.user;
        if (!orgId || !reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!id)
            return res.status(400).json({ error: 'Missing user id' });
        const updatedUser = await prisma_1.default.user.update({
            where: { id: id, organizationId: orgId },
            data: { status: 'Inactive' }
        });
        // Audit Log
        await prisma_1.default.auditLog.create({
            data: {
                userId: reqUser.id,
                role: reqUser.role,
                action: 'Deactivate User',
                entityType: 'User',
                entityId: updatedUser.id,
                organizationId: orgId
            }
        });
        res.status(200).json({ message: 'User deactivated successfully', user: updatedUser });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
};
exports.deactivateUser = deactivateUser;
