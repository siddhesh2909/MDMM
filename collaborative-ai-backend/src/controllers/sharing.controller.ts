import * as express from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { canShareDataset, canViewDataset } from '../utils/permission';
import { notifyUser } from '../services/notification.service';

interface SharedUser {
    userId: string;
    permission: 'viewer' | 'editor' | 'manager' | 'owner';
}

function parseSharedWith(sharedWithStr: string): SharedUser[] {
    try {
        const parsed = JSON.parse(sharedWithStr);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// POST /api/data/datasets/:id/share
export const shareDataset = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const { targetEmail, permission, visibility } = req.body;

        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        // Validate share permission
        if (!canShareDataset(dataset, user)) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to share this dataset' });
        }

        let updatedSharedWith = parseSharedWith(dataset.sharedWith);
        let targetUser: any = null;

        // If targetEmail is provided, we add/update that user
        if (targetEmail) {
            targetUser = await prisma.user.findUnique({
                where: { email: targetEmail }
            });

            if (!targetUser) {
                return res.status(404).json({ error: 'User with this email not found' });
            }

            if (targetUser.organizationId !== user.organizationId) {
                return res.status(400).json({ error: 'Cannot share resources outside your organization' });
            }

            // Remove existing if any, then add
            updatedSharedWith = updatedSharedWith.filter(s => s.userId !== targetUser.id);
            updatedSharedWith.push({
                userId: targetUser.id,
                permission: permission || 'viewer'
            });
        }

        const nextVisibility = visibility || dataset.visibility;

        const updated = await prisma.dataset.update({
            where: { id: datasetId },
            data: {
                visibility: nextVisibility,
                sharedWith: JSON.stringify(updatedSharedWith)
            }
        });

        // Notify target user
        if (targetUser && targetUser.id !== user.id) {
            try {
                await notifyUser(
                    targetUser.id,
                    'Dataset Shared with You',
                    `Dataset "${dataset.name}" has been shared with you as a ${permission || 'viewer'}.`,
                    'project',
                    '/ingestion'
                );
            } catch (nErr) {
                console.error('Failed to notify shared user:', nErr);
            }
        }

        res.status(200).json({
            success: true,
            dataset: {
                id: updated.id,
                visibility: updated.visibility,
                sharedWith: updated.sharedWith
            }
        });
    } catch (err) {
        console.error('Share dataset error:', err);
        res.status(500).json({ error: 'Failed to share dataset' });
    }
};

// POST /api/data/datasets/:id/share/update
export const updateDatasetShare = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const { targetUserId, permission } = req.body;

        if (!targetUserId || !permission) {
            return res.status(400).json({ error: 'targetUserId and permission are required' });
        }

        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        if (!canShareDataset(dataset, user)) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to share this dataset' });
        }

        let sharedList = parseSharedWith(dataset.sharedWith);
        sharedList = sharedList.map(s => s.userId === targetUserId ? { ...s, permission } : s);

        const updated = await prisma.dataset.update({
            where: { id: datasetId },
            data: {
                sharedWith: JSON.stringify(sharedList)
            }
        });

        res.status(200).json({ success: true, sharedWith: updated.sharedWith });
    } catch (err) {
        console.error('Update share error:', err);
        res.status(500).json({ error: 'Failed to update sharing permissions' });
    }
};

// POST /api/data/datasets/:id/share/revoke
export const revokeDatasetShare = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const { targetUserId } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ error: 'targetUserId is required' });
        }

        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        if (!canShareDataset(dataset, user)) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to share this dataset' });
        }

        let sharedList = parseSharedWith(dataset.sharedWith);
        sharedList = sharedList.filter(s => s.userId !== targetUserId);

        const updated = await prisma.dataset.update({
            where: { id: datasetId },
            data: {
                sharedWith: JSON.stringify(sharedList)
            }
        });

        res.status(200).json({ success: true, sharedWith: updated.sharedWith });
    } catch (err) {
        console.error('Revoke share error:', err);
        res.status(500).json({ error: 'Failed to revoke sharing access' });
    }
};

// GET /api/data/datasets/:id/share/users
export const getDatasetSharedUsers = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);

        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) {
            return res.status(404).json({ error: 'Dataset not found' });
        }

        if (!canViewDataset(dataset, user)) {
            return res.status(403).json({ error: 'Forbidden: You do not have access to view this dataset' });
        }

        const sharedList = parseSharedWith(dataset.sharedWith);

        // Fetch user information for collaborators
        const userDetails = await Promise.all(
            sharedList.map(async (s) => {
                const dbUser = await prisma.user.findUnique({
                    where: { id: s.userId },
                    select: { id: true, name: true, email: true }
                });
                return dbUser ? { ...dbUser, permission: s.permission } : null;
            })
        );

        // Filter out any null values (in case a user was deleted)
        const collaborators = userDetails.filter(c => c !== null);

        // Find resource creator/owner name & email
        const ownerInfo = await prisma.user.findUnique({
            where: { id: dataset.ownerId },
            select: { id: true, name: true, email: true }
        });

        res.status(200).json({
            visibility: dataset.visibility,
            owner: ownerInfo || { id: dataset.ownerId, name: 'System', email: '' },
            collaborators
        });
    } catch (err) {
        console.error('Get shared users error:', err);
        res.status(500).json({ error: 'Failed to retrieve collaborator list' });
    }
};
