import prisma from '../lib/prisma';

export enum AuditAction {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    LOGIN = 'LOGIN',
    EXPORT = 'EXPORT',
    INVITE = 'INVITE'
}

export const logAction = async (
    userId: string,
    role: string,
    organizationId: string,
    action: AuditAction | string,
    entityType: string,
    entityId: string,
    details?: any
) => {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                role,
                organizationId,
                action,
                entityType,
                entityId,
                details: details ? JSON.stringify(details) : null
            }
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
    }
};
