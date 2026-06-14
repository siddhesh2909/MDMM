import { EventEmitter } from 'events';
import prisma from '../lib/prisma';

export const notificationEvents = new EventEmitter();

// Max listeners to prevent warning on multiple active users streams
notificationEvents.setMaxListeners(100);

export const createNotification = async (
    userId: string,
    title: string,
    description: string,
    type: string,
    actionUrl?: string,
    icon?: string,
    organizationId?: string
) => {
    try {
        let orgId = organizationId;
        if (!orgId) {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user) orgId = user.organizationId;
        }
        if (!orgId) {
            console.error(`Cannot create notification: organizationId not found for user ${userId}`);
            return null;
        }

        const notification = await prisma.notification.create({
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
        notificationEvents.emit('notification', notification);

        return notification;
    } catch (error) {
        console.error('Failed to create notification:', error);
        return null;
    }
};

export const notifyUser = async (
    userId: string,
    title: string,
    description: string,
    type: string,
    actionUrl?: string,
    icon?: string
) => {
    return createNotification(userId, title, description, type, actionUrl, icon);
};

export const notifyAssignee = async (
    assigneeName: string,
    title: string,
    description: string,
    type: string,
    actionUrl?: string,
    icon?: string
) => {
    try {
        const user = await prisma.user.findFirst({
            where: { name: assigneeName }
        });
        if (user) {
            return createNotification(user.id, title, description, type, actionUrl, icon, user.organizationId);
        }
    } catch (error) {
        console.error('Failed to notify assignee:', error);
    }
    return null;
};

export const notifyAdmins = async (
    organizationId: string,
    title: string,
    description: string,
    type: string,
    actionUrl?: string,
    icon?: string
) => {
    try {
        const admins = await prisma.user.findMany({
            where: { organizationId, role: 'Admin' }
        });
        const promises = admins.map(admin =>
            createNotification(admin.id, title, description, type, actionUrl, icon, organizationId)
        );
        return await Promise.all(promises);
    } catch (error) {
        console.error('Failed to notify admins:', error);
        return [];
    }
};

export const notifyAll = async (
    organizationId: string,
    title: string,
    description: string,
    type: string,
    actionUrl?: string,
    icon?: string
) => {
    try {
        const users = await prisma.user.findMany({
            where: { organizationId }
        });
        const promises = users.map(user =>
            createNotification(user.id, title, description, type, actionUrl, icon, organizationId)
        );
        return await Promise.all(promises);
    } catch (error) {
        console.error('Failed to notify all:', error);
        return [];
    }
};
