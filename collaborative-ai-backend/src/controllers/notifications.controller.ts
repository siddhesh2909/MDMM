import * as express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { notificationEvents } from '../services/notification.service';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_collaborative_ai_key_2026';

// GET /api/data/notifications
export const getNotifications = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

        const status = req.query.status as string; // all, unread, read, archived
        const category = req.query.category as string; // e.g. security, workflow, etc.
        const search = req.query.search as string;
        const sort = req.query.sort as string; // newest, oldest, priority

        const whereClause: any = {
            userId,
            organizationId: orgId
        };

        // Filter by Status: All (excludes archived), Unread (excludes archived), Read (excludes archived), Archived
        if (status === 'archived') {
            whereClause.archived = true;
        } else {
            whereClause.archived = false;
            if (status === 'unread') {
                whereClause.read = false;
            } else if (status === 'read') {
                whereClause.read = true;
            }
        }

        // Filter by Category
        if (category && category !== 'all') {
            whereClause.type = category.toLowerCase();
        }

        // Search text
        if (search && search.trim() !== '') {
            whereClause.OR = [
                { title: { contains: search } },
                { description: { contains: search } }
            ];
        }

        // Fetch
        let notifications = await prisma.notification.findMany({
            where: whereClause,
            orderBy: {
                createdAt: sort === 'oldest' ? 'asc' : 'desc'
            }
        });

        // Sort by priority if requested
        if (sort === 'priority') {
            const priorityWeight: Record<string, number> = {
                'Critical': 4,
                'High': 3,
                'Medium': 2,
                'Low': 1
            };
            notifications.sort((a, b) => {
                const weightA = priorityWeight[a.priority] || 0;
                const weightB = priorityWeight[b.priority] || 0;
                if (weightA !== weightB) {
                    return weightB - weightA; // Higher weight first
                }
                // Secondary sort: newest first
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
        }

        res.status(200).json(notifications);
    } catch (error) {
        console.error('Failed to get notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

// GET /api/data/notifications/:id
export const getNotificationDetail = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

        const id = String(req.params.id);

        const notification = await prisma.notification.findFirst({
            where: {
                id,
                userId,
                organizationId: orgId
            }
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.status(200).json(notification);
    } catch (error) {
        console.error('Failed to fetch notification detail:', error);
        res.status(500).json({ error: 'Failed to fetch notification detail' });
    }
};

// DELETE /api/data/notifications/:id
export const deleteNotification = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

        const id = String(req.params.id);

        const existing = await prisma.notification.findFirst({
            where: {
                id,
                userId,
                organizationId: orgId
            }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        await prisma.notification.delete({
            where: { id }
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Failed to delete notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
};

// PATCH /api/data/notifications/:id/archive
export const toggleArchiveNotification = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

        const id = String(req.params.id);

        const existing = await prisma.notification.findFirst({
            where: {
                id,
                userId,
                organizationId: orgId
            }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { archived: !existing.archived }
        });

        res.status(200).json(updated);
    } catch (error) {
        console.error('Failed to update notification archive status:', error);
        res.status(500).json({ error: 'Failed to update notification archive status' });
    }
};

// PATCH /api/data/notifications/:id/read
export const markRead = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

        const id = String(req.params.id);

        const existing = await prisma.notification.findFirst({
            where: {
                id,
                userId,
                organizationId: orgId
            }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { read: true }
        });

        res.status(200).json(updated);
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
};

// POST /api/data/notifications/mark-all-read
export const markAllRead = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

        const updated = await prisma.notification.updateMany({
            where: {
                userId,
                organizationId: orgId,
                read: false
            },
            data: { read: true }
        });

        res.status(200).json({ success: true, count: updated.count });
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
};

// GET /api/data/notifications/stream (SSE)
export const streamNotifications = async (req: express.Request, res: express.Response) => {
    try {
        const token = req.query.token as string;
        if (!token) {
            res.status(401).json({ error: 'Authentication token required' });
            return;
        }

        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            res.status(403).json({ error: 'Invalid or expired token' });
            return;
        }

        const userId = decoded.id;
        const orgId = decoded.organizationId;
        if (!userId || !orgId) {
            res.status(401).json({ error: 'Invalid token payload' });
            return;
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        res.write(': connected\n\n');

        const listener = (notification: any) => {
            if (notification.userId === userId && notification.organizationId === orgId) {
                res.write(`data: ${JSON.stringify(notification)}\n\n`);
            }
        };

        notificationEvents.on('notification', listener);

        const heartbeat = setInterval(() => {
            res.write(': heartbeat\n\n');
        }, 30000);

        req.on('close', () => {
            clearInterval(heartbeat);
            notificationEvents.off('notification', listener);
        });

    } catch (error) {
        console.error('SSE Stream error:', error);
        res.status(500).end();
    }
};
