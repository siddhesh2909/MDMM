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

        const notifications = await prisma.notification.findMany({
            where: {
                userId,
                organizationId: orgId
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 50
        });

        res.status(200).json(notifications);
    } catch (error) {
        console.error('Failed to get notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
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
