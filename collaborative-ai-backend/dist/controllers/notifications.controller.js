"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamNotifications = exports.markAllRead = exports.markRead = exports.getNotifications = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const notification_service_1 = require("../services/notification.service");
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_collaborative_ai_key_2026';
// GET /api/data/notifications
const getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const notifications = await prisma_1.default.notification.findMany({
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
    }
    catch (error) {
        console.error('Failed to get notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};
exports.getNotifications = getNotifications;
// PATCH /api/data/notifications/:id/read
const markRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const id = String(req.params.id);
        const existing = await prisma_1.default.notification.findFirst({
            where: {
                id,
                userId,
                organizationId: orgId
            }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        const updated = await prisma_1.default.notification.update({
            where: { id },
            data: { read: true }
        });
        res.status(200).json(updated);
    }
    catch (error) {
        console.error('Failed to mark notification as read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
};
exports.markRead = markRead;
// POST /api/data/notifications/mark-all-read
const markAllRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const updated = await prisma_1.default.notification.updateMany({
            where: {
                userId,
                organizationId: orgId,
                read: false
            },
            data: { read: true }
        });
        res.status(200).json({ success: true, count: updated.count });
    }
    catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
};
exports.markAllRead = markAllRead;
// GET /api/data/notifications/stream (SSE)
const streamNotifications = async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) {
            res.status(401).json({ error: 'Authentication token required' });
            return;
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch (err) {
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
        const listener = (notification) => {
            if (notification.userId === userId && notification.organizationId === orgId) {
                res.write(`data: ${JSON.stringify(notification)}\n\n`);
            }
        };
        notification_service_1.notificationEvents.on('notification', listener);
        const heartbeat = setInterval(() => {
            res.write(': heartbeat\n\n');
        }, 30000);
        req.on('close', () => {
            clearInterval(heartbeat);
            notification_service_1.notificationEvents.off('notification', listener);
        });
    }
    catch (error) {
        console.error('SSE Stream error:', error);
        res.status(500).end();
    }
};
exports.streamNotifications = streamNotifications;
