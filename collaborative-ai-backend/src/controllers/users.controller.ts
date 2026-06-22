import * as express from 'express';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { notifyUser, notifyAdmins } from '../services/notification.service';
import fs from 'fs';
import path from 'path';

export const getUsers = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const orgId = req.user?.organizationId;
        const role = req.user?.role;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        // Admin-only Team Directory listing
        if (role !== 'Admin') {
            return res.status(403).json({ error: 'Forbidden: Admin privilege required' });
        }

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

        const mappedUsers = users.map((u: any) => ({
            ...u,
            role: u.role === 'Data Engineer' ? 'Data Steward' :
                u.role === 'Data Analyst' ? 'Analyst' :
                    u.role === 'Business User' ? 'Viewer' :
                        u.role
        }));

        res.status(200).json(mappedUsers);
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

        try {
            await notifyAdmins(
                orgId,
                'User Invited',
                `${name} (${email}) has been invited to join the organization as ${role || 'Business User'}.`,
                'account',
                '/admin'
            );
        } catch (nErr) {
            console.error('Failed to trigger invite notifications:', nErr);
        }

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
            role === 'Data Engineer' || role === 'Data Steward' ? ['dataset:manage', 'dataset:view', 'contract:edit', 'contract:view'] :
                role === 'Data Analyst' || role === 'Analyst' ? ['dataset:manage', 'dataset:view', 'contract:view'] :
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

        try {
            await notifyUser(
                updatedUser.id,
                'Role Updated',
                `Your account role has been updated to ${role} by an administrator.`,
                'account',
                '/'
            );
            await notifyAdmins(
                orgId,
                'User Role Updated',
                `User ${updatedUser.name} was updated to ${role} by ${reqUser.role}.`,
                'account',
                '/admin'
            );
        } catch (nErr) {
            console.error('Failed to trigger role update notifications:', nErr);
        }

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

        try {
            await notifyAdmins(
                orgId,
                'User Account Deactivated',
                `User ${updatedUser.name} (${updatedUser.email}) was deactivated by ${reqUser.role}.`,
                'security',
                '/admin'
            );
        } catch (nErr) {
            console.error('Failed to trigger deactivate notifications:', nErr);
        }

        res.status(200).json({ message: 'User deactivated successfully', user: updatedUser });
    } catch (err) {
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
};

export const activateUser = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { id } = req.body;
        const orgId = req.user?.organizationId;
        const reqUser = req.user;

        if (!orgId || !reqUser) return res.status(401).json({ error: 'Unauthorized' });
        if (!id) return res.status(400).json({ error: 'Missing user id' });

        const updatedUser = await prisma.user.update({
            where: { id: id, organizationId: orgId } as any,
            data: { status: 'Active' } as any
        });

        // Audit Log
        await (prisma as any).auditLog.create({
            data: {
                userId: reqUser.id,
                role: reqUser.role,
                action: 'Activate User',
                entityType: 'User',
                entityId: updatedUser.id,
                organizationId: orgId
            }
        });

        try {
            await notifyAdmins(
                orgId,
                'User Account Activated',
                `User ${updatedUser.name} (${updatedUser.email}) was activated by ${reqUser.role}.`,
                'security',
                '/admin'
            );
        } catch (nErr) {
            console.error('Failed to trigger activate notifications:', nErr);
        }

        res.status(200).json({ message: 'User activated successfully', user: updatedUser });
    } catch (err) {
        res.status(500).json({ error: 'Failed to activate user' });
    }
};

export const deleteUser = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const { id } = req.body;
        const orgId = req.user?.organizationId;
        const reqUser = req.user;

        if (!orgId || !reqUser) return res.status(401).json({ error: 'Unauthorized' });
        if (!id) return res.status(400).json({ error: 'Missing user id' });
        if (id === reqUser.id) return res.status(400).json({ error: 'Cannot delete your own account from user management' });

        // Re-assign datasets and contracts to the admin to prevent FK constraints issues
        await prisma.dataset.updateMany({
            where: { ownerId: id },
            data: { ownerId: reqUser.id }
        });

        await prisma.dataContract.updateMany({
            where: { ownerId: id },
            data: { ownerId: reqUser.id }
        });

        const deletedUser = await prisma.user.delete({
            where: { id: id, organizationId: orgId } as any
        });

        // Audit Log
        await (prisma as any).auditLog.create({
            data: {
                userId: reqUser.id,
                role: reqUser.role,
                action: 'Delete User Account',
                entityType: 'User',
                entityId: id,
                organizationId: orgId
            }
        });

        try {
            await notifyAdmins(
                orgId,
                'User Account Deleted',
                `User ${deletedUser.name} (${deletedUser.email}) was deleted by ${reqUser.role}.`,
                'security',
                '/admin'
            );
        } catch (nErr) {
            console.error('Failed to trigger delete notifications:', nErr);
        }

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

// --- Profile Metadata helpers (JSON based file-store) ---
const METADATA_FILE_PATH = path.join(__dirname, '..', 'data', 'user_profiles_metadata.json');

const readUserMetadata = () => {
    try {
        const dataDir = path.dirname(METADATA_FILE_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(METADATA_FILE_PATH)) {
            fs.writeFileSync(METADATA_FILE_PATH, '{}');
            return {};
        }
        const fileContent = fs.readFileSync(METADATA_FILE_PATH, 'utf-8');
        return JSON.parse(fileContent || '{}');
    } catch (err) {
        console.error('Failed to read user profiles metadata:', err);
        return {};
    }
};

const writeUserMetadata = (data: any) => {
    try {
        const dataDir = path.dirname(METADATA_FILE_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(METADATA_FILE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Failed to write user profiles metadata:', err);
    }
};

const getUserProfileMetadata = (userId: string, userRole: string) => {
    const allMetadata = readUserMetadata();
    if (!allMetadata[userId]) {
        allMetadata[userId] = {
            profilePhoto: '',
            jobTitle: userRole === 'Admin' ? 'Enterprise Administrator' :
                userRole === 'Data Steward' || userRole === 'Data Engineer' ? 'Lead Data Steward' :
                    userRole === 'Analyst' || userRole === 'Data Analyst' ? 'Data Analyst' :
                        'Guest Data Viewer',
            contactNumber: '+1 (555) 019-2834',
            timezone: 'UTC (GMT+00:00)',
            twoFactorEnabled: false,
            activeSessions: [
                {
                    id: 'session-' + Math.random().toString(36).substring(2, 9),
                    device: 'Chrome on macOS (Current)',
                    location: 'San Francisco, US',
                    ip: '192.168.1.100',
                    lastActive: new Date().toISOString(),
                    currentSession: true
                }
            ],
            lastLoginInfo: 'Chrome on macOS, San Francisco, US (IP: 192.168.1.100)',
            notifications: {
                system: true,
                email: false,
                aiAlerts: true
            },
            aiPreferences: {
                model: 'llama-3-8b',
                temperature: 0.7,
                customRules: 'Format tabular results cleanly as Markdown tables.'
            }
        };
        writeUserMetadata(allMetadata);
    }
    return allMetadata[userId];
};

export const getProfile = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({
            where: { id: userId, organizationId: orgId } as any,
            include: { organization: true }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        const metadata = getUserProfileMetadata(user.id, user.role);

        const mappedRole = user.role === 'Data Engineer' ? 'Data Steward' :
            user.role === 'Data Analyst' ? 'Analyst' :
                user.role === 'Business User' ? 'Viewer' :
                    user.role;

        res.status(200).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: mappedRole,
            department: user.department || 'Not Configured',
            organizationId: user.organizationId,
            organizationName: user.organization?.name || 'Enterprise Org',
            permissions: JSON.parse(user.permissions || '[]'),
            status: user.status,
            lastActive: user.lastActive,
            profilePhoto: metadata.profilePhoto || '',
            jobTitle: metadata.jobTitle || '',
            contactNumber: metadata.contactNumber || '',
            timezone: metadata.timezone || 'UTC (GMT+00:00)',
            twoFactorEnabled: metadata.twoFactorEnabled || false,
            activeSessions: metadata.activeSessions || [],
            lastLoginInfo: metadata.lastLoginInfo || 'Unknown Device',
            notifications: metadata.notifications || { system: true, email: false, aiAlerts: true },
            aiPreferences: metadata.aiPreferences || { model: 'llama-3-8b', temperature: 0.7, customRules: '' }
        });
    } catch (err) {
        console.error('Failed to get profile:', err);
        res.status(500).json({ error: 'Failed to fetch user profile details' });
    }
};

export const updateProfile = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

        const {
            name,
            department,
            password,
            profilePhoto,
            jobTitle,
            contactNumber,
            timezone,
            twoFactorEnabled,
            notifications,
            aiPreferences
        } = req.body;

        const user = await prisma.user.findUnique({
            where: { id: userId, organizationId: orgId } as any
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Update database columns
        const dbUpdateData: any = {};
        if (name !== undefined) dbUpdateData.name = name;
        if (department !== undefined) dbUpdateData.department = department;
        if (password) {
            dbUpdateData.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId } as any,
            data: dbUpdateData
        });

        // Update metadata profiles in JSON
        const allMetadata = readUserMetadata();
        const userMeta = getUserProfileMetadata(userId, updatedUser.role);

        if (profilePhoto !== undefined) userMeta.profilePhoto = profilePhoto;
        if (jobTitle !== undefined) userMeta.jobTitle = jobTitle;
        if (contactNumber !== undefined) userMeta.contactNumber = contactNumber;
        if (timezone !== undefined) userMeta.timezone = timezone;
        if (twoFactorEnabled !== undefined) userMeta.twoFactorEnabled = twoFactorEnabled;
        if (notifications !== undefined) userMeta.notifications = { ...userMeta.notifications, ...notifications };
        if (aiPreferences !== undefined) userMeta.aiPreferences = { ...userMeta.aiPreferences, ...aiPreferences };

        allMetadata[userId] = userMeta;
        writeUserMetadata(allMetadata);

        // Audit Log trace
        const changedFields: string[] = [];
        if (name !== undefined) changedFields.push('name');
        if (department !== undefined) changedFields.push('department');
        if (password) changedFields.push('password');
        if (profilePhoto !== undefined) changedFields.push('profilePhoto');
        if (jobTitle !== undefined) changedFields.push('jobTitle');
        if (contactNumber !== undefined) changedFields.push('contactNumber');
        if (timezone !== undefined) changedFields.push('timezone');
        if (twoFactorEnabled !== undefined) changedFields.push('twoFactorEnabled');
        if (notifications !== undefined) changedFields.push('notifications');
        if (aiPreferences !== undefined) changedFields.push('aiPreferences');

        await (prisma as any).auditLog.create({
            data: {
                userId: userId,
                role: updatedUser.role,
                action: 'Update Profile',
                entityType: 'User',
                entityId: userId,
                details: JSON.stringify({ changedFields, passwordChanged: !!password }),
                organizationId: orgId
            }
        });

        const mappedRole = updatedUser.role === 'Data Engineer' ? 'Data Steward' :
            updatedUser.role === 'Data Analyst' ? 'Analyst' :
                updatedUser.role === 'Business User' ? 'Viewer' :
                    updatedUser.role;

        res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: mappedRole,
                department: updatedUser.department,
                organizationId: updatedUser.organizationId,
                permissions: JSON.parse(updatedUser.permissions)
            }
        });
    } catch (err) {
        console.error("Update profile error:", err);
        res.status(500).json({ error: 'Failed to update profile details' });
    }
};

export const revokeOtherSessions = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

        const allMetadata = readUserMetadata();
        if (allMetadata[userId]) {
            const sessions = allMetadata[userId].activeSessions || [];
            const currentSession = sessions.find((s: any) => s.currentSession) || {
                id: 'session-' + Math.random().toString(36).substring(2, 9),
                device: 'Chrome on macOS (Current)',
                location: 'San Francisco, US',
                ip: '192.168.1.100',
                lastActive: new Date().toISOString(),
                currentSession: true
            };
            allMetadata[userId].activeSessions = [currentSession];
            writeUserMetadata(allMetadata);
        }

        await (prisma as any).auditLog.create({
            data: {
                userId: userId,
                role: req.user?.role || 'User',
                action: 'Revoke Other Sessions',
                entityType: 'User',
                entityId: userId,
                organizationId: orgId
            }
        });

        res.status(200).json({ message: 'Other active sessions revoked successfully' });
    } catch (err) {
        console.error('Revoke other sessions error:', err);
        res.status(500).json({ error: 'Failed to revoke other sessions' });
    }
};

export const downloadPersonalData = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({
            where: { id: userId, organizationId: orgId } as any,
            include: { organization: true }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        const metadata = getUserProfileMetadata(user.id, user.role);

        const datasets = await prisma.dataset.findMany({
            where: { ownerId: userId, organizationId: orgId },
            select: { id: true, name: true, source: true, createdAt: true }
        });

        const notifications = await prisma.notification.findMany({
            where: { userId: userId, organizationId: orgId },
            take: 20
        });

        const auditLogs = await (prisma as any).auditLog.findMany({
            where: { userId: userId, organizationId: orgId },
            take: 20
        });

        const dumpData = {
            profile: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                organization: user.organization?.name,
                jobTitle: metadata.jobTitle,
                contactNumber: metadata.contactNumber,
                timezone: metadata.timezone,
                twoFactorEnabled: metadata.twoFactorEnabled,
                lastLoginInfo: metadata.lastLoginInfo,
                createdAt: user.createdAt
            },
            datasets,
            notifications,
            recentActivityLogs: auditLogs
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=personal_data_export_${userId}.json`);
        res.status(200).send(JSON.stringify(dumpData, null, 2));
    } catch (err) {
        console.error('Download data error:', err);
        res.status(500).json({ error: 'Failed to compile personal data export' });
    }
};

export const deleteAccount = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });

        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Password confirmation is required' });

        const user = await prisma.user.findUnique({
            where: { id: userId, organizationId: orgId } as any
        });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password credentials' });

        if (user.role === 'Admin') {
            const adminCount = await prisma.user.count({
                where: { organizationId: orgId, role: 'Admin' }
            });
            if (adminCount <= 1) {
                return res.status(400).json({ error: 'Cannot delete the last Administrator account in your organization.' });
            }
        }

        const allMetadata = readUserMetadata();
        if (allMetadata[userId]) {
            delete allMetadata[userId];
            writeUserMetadata(allMetadata);
        }

        await (prisma as any).auditLog.create({
            data: {
                userId: userId,
                role: user.role,
                action: 'Delete Account',
                entityType: 'User',
                entityId: userId,
                organizationId: orgId
            }
        });

        await prisma.user.delete({
            where: { id: userId }
        });

        res.status(200).json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: 'Failed to delete account' });
    }
};

export const updateOrganizationDetails = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        const role = req.user?.role;
        if (!userId || !orgId || role !== 'Admin') return res.status(403).json({ error: 'Forbidden: Admin privilege required' });

        const { name, domain } = req.body;
        if (!name) return res.status(400).json({ error: 'Organization Name is required' });

        const updatedOrg = await prisma.organization.update({
            where: { id: orgId },
            data: { name, domain }
        });

        await (prisma as any).auditLog.create({
            data: {
                userId: userId,
                role: role,
                action: 'Update Organization Details',
                entityType: 'Organization',
                entityId: orgId,
                details: JSON.stringify({ name, domain }),
                organizationId: orgId
            }
        });

        res.status(200).json({ message: 'Organization settings updated successfully', organization: updatedOrg });
    } catch (err) {
        console.error('Update organization settings error:', err);
        res.status(500).json({ error: 'Failed to update organization settings' });
    }
};
