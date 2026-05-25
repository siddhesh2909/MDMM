import * as express from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

export const getUsers = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const users = await prisma.user.findMany({
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
            } as any
        });

        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
}

export const getAuditLog = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const auditTrail = await (prisma as any).auditLog.findMany({
            where: { organizationId: orgId },
            orderBy: { timestamp: 'desc' },
            take: 50
        });

        res.status(200).json(auditTrail);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
}

export const inviteUser = async (req: AuthenticatedRequest, res: express.Response) => {
    // For enterprise demo: create a pending user in the current org
    try {
        const { name, email, role, department } = req.body;
        const orgId = req.user?.organizationId;

        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.create({
            data: {
                name,
                email,
                role: role || 'Business User',
                department,
                organizationId: orgId,
                status: 'Pending',
                password: 'INVITED_USER_PLACEHOLDER'
            } as any
        });

        res.status(201).json({ message: 'User invited successfully', user });
    } catch (err) {
        res.status(500).json({ error: 'Failed to invite user' });
    }
};

export const updateUserRole = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { id, role } = req.body;
        const orgId = req.user?.organizationId;
        const reqUser = req.user;

        if (!orgId || !reqUser) return res.status(401).json({ error: 'Unauthorized' });
        if (!id || !role) return res.status(400).json({ error: 'Missing id or role' });

        const defaultPermissions = role === 'Admin' ? ['*'] :
            role === 'Data Engineer' ? ['dataset:manage', 'contract:edit', 'workflow:view', 'workflow:edit'] :
                role === 'Data Analyst' ? ['dataset:view', 'contract:view', 'workflow:view'] :
                    ['dataset:view'];

        const updatedUser = await prisma.user.update({
            where: { id: id, organizationId: orgId } as any,
            data: {
                role,
                permissions: JSON.stringify(defaultPermissions)
            } as any
        });

        // Audit Log
        await (prisma as any).auditLog.create({
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
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user role' });
    }
};

export const deactivateUser = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { id } = req.body;
        const orgId = req.user?.organizationId;
        const reqUser = req.user;

        if (!orgId || !reqUser) return res.status(401).json({ error: 'Unauthorized' });
        if (!id) return res.status(400).json({ error: 'Missing user id' });

        const updatedUser = await prisma.user.update({
            where: { id: id, organizationId: orgId } as any,
            data: { status: 'Inactive' } as any
        });

        // Audit Log
        await (prisma as any).auditLog.create({
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
    } catch (err) {
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
};
