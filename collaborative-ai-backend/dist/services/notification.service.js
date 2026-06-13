"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyAll = exports.notifyAdmins = exports.notifyAssignee = exports.notifyUser = exports.createNotification = exports.notificationEvents = void 0;
const events_1 = require("events");
const prisma_1 = __importDefault(require("../lib/prisma"));
exports.notificationEvents = new events_1.EventEmitter();
// Max listeners to prevent warning on multiple active users streams
exports.notificationEvents.setMaxListeners(100);
const createNotification = async (userId, title, description, type, actionUrl, icon, organizationId) => {
    try {
        let orgId = organizationId;
        if (!orgId) {
            const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
            if (user)
                orgId = user.organizationId;
        }
        if (!orgId) {
            console.error(`Cannot create notification: organizationId not found for user ${userId}`);
            return null;
        }
        const notification = await prisma_1.default.notification.create({
            data: {
                userId,
                title,
                description,
                type,
                actionUrl: actionUrl || null,
                icon: icon || null,
                organizationId: orgId,
            }
        });
        // Emit for real-time SSE stream
        exports.notificationEvents.emit('notification', notification);
        return notification;
    }
    catch (error) {
        console.error('Failed to create notification:', error);
        return null;
    }
};
exports.createNotification = createNotification;
const notifyUser = async (userId, title, description, type, actionUrl, icon) => {
    return (0, exports.createNotification)(userId, title, description, type, actionUrl, icon);
};
exports.notifyUser = notifyUser;
const notifyAssignee = async (assigneeName, title, description, type, actionUrl, icon) => {
    try {
        const user = await prisma_1.default.user.findFirst({
            where: { name: assigneeName }
        });
        if (user) {
            return (0, exports.createNotification)(user.id, title, description, type, actionUrl, icon, user.organizationId);
        }
    }
    catch (error) {
        console.error('Failed to notify assignee:', error);
    }
    return null;
};
exports.notifyAssignee = notifyAssignee;
const notifyAdmins = async (organizationId, title, description, type, actionUrl, icon) => {
    try {
        const admins = await prisma_1.default.user.findMany({
            where: { organizationId, role: 'Admin' }
        });
        const promises = admins.map(admin => (0, exports.createNotification)(admin.id, title, description, type, actionUrl, icon, organizationId));
        return await Promise.all(promises);
    }
    catch (error) {
        console.error('Failed to notify admins:', error);
        return [];
    }
};
exports.notifyAdmins = notifyAdmins;
const notifyAll = async (organizationId, title, description, type, actionUrl, icon) => {
    try {
        const users = await prisma_1.default.user.findMany({
            where: { organizationId }
        });
        const promises = users.map(user => (0, exports.createNotification)(user.id, title, description, type, actionUrl, icon, organizationId));
        return await Promise.all(promises);
    }
    catch (error) {
        console.error('Failed to notify all:', error);
        return [];
    }
};
exports.notifyAll = notifyAll;
