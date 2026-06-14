"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamNotifications = exports.markAllRead = exports.markRead = exports.toggleArchiveNotification = exports.deleteNotification = exports.getNotificationDetail = exports.getNotifications = void 0;
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
        const status = req.query.status; // all, unread, read, archived
        const category = req.query.category; // e.g. security, workflow, etc.
        const search = req.query.search;
        const sort = req.query.sort; // newest, oldest, priority
        const whereClause = {
            userId,
            organizationId: orgId
        };
        // Filter by Status: All (excludes archived), Unread (excludes archived), Read (excludes archived), Archived
        if (status === 'archived') {
            whereClause.archived = true;
        }
        else {
            whereClause.archived = false;
            if (status === 'unread') {
                whereClause.read = false;
            }
            else if (status === 'read') {
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
        let notifications = await prisma_1.default.notification.findMany({
            where: whereClause,
            orderBy: {
                createdAt: sort === 'oldest' ? 'asc' : 'desc'
            }
        });
        // Sort by priority if requested
        if (sort === 'priority') {
            const priorityWeight = {
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
    }
    catch (error) {
        console.error('Failed to get notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};
exports.getNotifications = getNotifications;
// GET /api/data/notifications/:id
const getNotificationDetail = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const id = String(req.params.id);
        const notification = await prisma_1.default.notification.findFirst({
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
    }
    catch (error) {
        console.error('Failed to fetch notification detail:', error);
        res.status(500).json({ error: 'Failed to fetch notification detail' });
    }
};
exports.getNotificationDetail = getNotificationDetail;
// DELETE /api/data/notifications/:id
const deleteNotification = async (req, res) => {
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
        await prisma_1.default.notification.delete({
            where: { id }
        });
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('Failed to delete notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
};
exports.deleteNotification = deleteNotification;
// PATCH /api/data/notifications/:id/archive
const toggleArchiveNotification = async (req, res) => {
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
            data: { archived: !existing.archived }
        });
        res.status(200).json(updated);
    }
    catch (error) {
        console.error('Failed to update notification archive status:', error);
        res.status(500).json({ error: 'Failed to update notification archive status' });
    }
};
exports.toggleArchiveNotification = toggleArchiveNotification;
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
