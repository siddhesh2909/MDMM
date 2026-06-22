"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrganizationDetails = exports.deleteAccount = exports.downloadPersonalData = exports.revokeOtherSessions = exports.updateProfile = exports.getProfile = exports.deleteUser = exports.activateUser = exports.deactivateUser = exports.updateUserRole = exports.inviteUser = exports.getAuditLog = exports.getUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const notification_service_1 = require("../services/notification.service");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const getUsers = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const role = req.user?.role;
        if (!orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        // Admin-only Team Directory listing
        if (role !== 'Admin') {
            return res.status(403).json({ error: 'Forbidden: Admin privilege required' });
        }
        const users = await prisma_1.default.user.findMany({
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
            }
        });
        const mappedUsers = users.map((u) => ({
            ...u,
            role: u.role === 'Data Engineer' ? 'Data Steward' :
                u.role === 'Data Analyst' ? 'Analyst' :
                    u.role === 'Business User' ? 'Viewer' :
                        u.role
        }));
        res.status(200).json(mappedUsers);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};
exports.getUsers = getUsers;
const getAuditLog = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const auditTrail = await prisma_1.default.auditLog.findMany({
            where: { organizationId: orgId },
            orderBy: { timestamp: 'desc' },
            take: 50
        });
        res.status(200).json(auditTrail);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
};
exports.getAuditLog = getAuditLog;
const inviteUser = async (req, res) => {
    // For enterprise demo: create a pending user in the current org
    try {
        const { name, email, role, department } = req.body;
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const user = await prisma_1.default.user.create({
            data: {
                name,
                email,
                role: role || 'Business User',
                department,
                organizationId: orgId,
                status: 'Pending',
                password: 'INVITED_USER_PLACEHOLDER'
            }
        });
        try {
            await (0, notification_service_1.notifyAdmins)(orgId, 'User Invited', `${name} (${email}) has been invited to join the organization as ${role || 'Business User'}.`, 'account', '/admin');
        }
        catch (nErr) {
            console.error('Failed to trigger invite notifications:', nErr);
        }
        res.status(201).json({ message: 'User invited successfully', user });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to invite user' });
    }
};
exports.inviteUser = inviteUser;
const updateUserRole = async (req, res) => {
    try {
        const { id, role } = req.body;
        const orgId = req.user?.organizationId;
        const reqUser = req.user;
        if (!orgId || !reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!id || !role)
            return res.status(400).json({ error: 'Missing id or role' });
        const defaultPermissions = role === 'Admin' ? ['*'] :
            role === 'Data Engineer' || role === 'Data Steward' ? ['dataset:manage', 'dataset:view', 'contract:edit', 'contract:view'] :
                role === 'Data Analyst' || role === 'Analyst' ? ['dataset:manage', 'dataset:view', 'contract:view'] :
                    ['dataset:view'];
        const updatedUser = await prisma_1.default.user.update({
            where: { id: id, organizationId: orgId },
            data: {
                role,
                permissions: JSON.stringify(defaultPermissions)
            }
        });
        // Audit Log
        await prisma_1.default.auditLog.create({
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
            await (0, notification_service_1.notifyUser)(updatedUser.id, 'Role Updated', `Your account role has been updated to ${role} by an administrator.`, 'account', '/');
            await (0, notification_service_1.notifyAdmins)(orgId, 'User Role Updated', `User ${updatedUser.name} was updated to ${role} by ${reqUser.role}.`, 'account', '/admin');
        }
        catch (nErr) {
            console.error('Failed to trigger role update notifications:', nErr);
        }
        res.status(200).json({ message: 'User role updated successfully', user: updatedUser });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update user role' });
    }
};
exports.updateUserRole = updateUserRole;
const deactivateUser = async (req, res) => {
    try {
        const { id } = req.body;
        const orgId = req.user?.organizationId;
        const reqUser = req.user;
        if (!orgId || !reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!id)
            return res.status(400).json({ error: 'Missing user id' });
        const updatedUser = await prisma_1.default.user.update({
            where: { id: id, organizationId: orgId },
            data: { status: 'Inactive' }
        });
        // Audit Log
        await prisma_1.default.auditLog.create({
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
            await (0, notification_service_1.notifyAdmins)(orgId, 'User Account Deactivated', `User ${updatedUser.name} (${updatedUser.email}) was deactivated by ${reqUser.role}.`, 'security', '/admin');
        }
        catch (nErr) {
            console.error('Failed to trigger deactivate notifications:', nErr);
        }
        res.status(200).json({ message: 'User deactivated successfully', user: updatedUser });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
};
exports.deactivateUser = deactivateUser;
const activateUser = async (req, res) => {
    try {
        const { id } = req.body;
        const orgId = req.user?.organizationId;
        const reqUser = req.user;
        if (!orgId || !reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!id)
            return res.status(400).json({ error: 'Missing user id' });
        const updatedUser = await prisma_1.default.user.update({
            where: { id: id, organizationId: orgId },
            data: { status: 'Active' }
        });
        // Audit Log
        await prisma_1.default.auditLog.create({
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
            await (0, notification_service_1.notifyAdmins)(orgId, 'User Account Activated', `User ${updatedUser.name} (${updatedUser.email}) was activated by ${reqUser.role}.`, 'security', '/admin');
        }
        catch (nErr) {
            console.error('Failed to trigger activate notifications:', nErr);
        }
        res.status(200).json({ message: 'User activated successfully', user: updatedUser });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to activate user' });
    }
};
exports.activateUser = activateUser;
const deleteUser = async (req, res) => {
    try {
        const { id } = req.body;
        const orgId = req.user?.organizationId;
        const reqUser = req.user;
        if (!orgId || !reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!id)
            return res.status(400).json({ error: 'Missing user id' });
        if (id === reqUser.id)
            return res.status(400).json({ error: 'Cannot delete your own account from user management' });
        // Re-assign datasets and contracts to the admin to prevent FK constraints issues
        await prisma_1.default.dataset.updateMany({
            where: { ownerId: id },
            data: { ownerId: reqUser.id }
        });
        await prisma_1.default.dataContract.updateMany({
            where: { ownerId: id },
            data: { ownerId: reqUser.id }
        });
        const deletedUser = await prisma_1.default.user.delete({
            where: { id: id, organizationId: orgId }
        });
        // Audit Log
        await prisma_1.default.auditLog.create({
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
            await (0, notification_service_1.notifyAdmins)(orgId, 'User Account Deleted', `User ${deletedUser.name} (${deletedUser.email}) was deleted by ${reqUser.role}.`, 'security', '/admin');
        }
        catch (nErr) {
            console.error('Failed to trigger delete notifications:', nErr);
        }
        res.status(200).json({ message: 'User deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
exports.deleteUser = deleteUser;
// --- Profile Metadata helpers (JSON based file-store) ---
const METADATA_FILE_PATH = path_1.default.join(__dirname, '..', 'data', 'user_profiles_metadata.json');
const readUserMetadata = () => {
    try {
        const dataDir = path_1.default.dirname(METADATA_FILE_PATH);
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs_1.default.existsSync(METADATA_FILE_PATH)) {
            fs_1.default.writeFileSync(METADATA_FILE_PATH, '{}');
            return {};
        }
        const fileContent = fs_1.default.readFileSync(METADATA_FILE_PATH, 'utf-8');
        return JSON.parse(fileContent || '{}');
    }
    catch (err) {
        console.error('Failed to read user profiles metadata:', err);
        return {};
    }
};
const writeUserMetadata = (data) => {
    try {
        const dataDir = path_1.default.dirname(METADATA_FILE_PATH);
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
        fs_1.default.writeFileSync(METADATA_FILE_PATH, JSON.stringify(data, null, 2));
    }
    catch (err) {
        console.error('Failed to write user profiles metadata:', err);
    }
};
const getUserProfileMetadata = (userId, userRole) => {
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
const getProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId, organizationId: orgId },
            include: { organization: true }
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
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
    }
    catch (err) {
        console.error('Failed to get profile:', err);
        res.status(500).json({ error: 'Failed to fetch user profile details' });
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { name, department, password, profilePhoto, jobTitle, contactNumber, timezone, twoFactorEnabled, notifications, aiPreferences } = req.body;
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId, organizationId: orgId }
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        // Update database columns
        const dbUpdateData = {};
        if (name !== undefined)
            dbUpdateData.name = name;
        if (department !== undefined)
            dbUpdateData.department = department;
        if (password) {
            dbUpdateData.password = await bcryptjs_1.default.hash(password, 10);
        }
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: dbUpdateData
        });
        // Update metadata profiles in JSON
        const allMetadata = readUserMetadata();
        const userMeta = getUserProfileMetadata(userId, updatedUser.role);
        if (profilePhoto !== undefined)
            userMeta.profilePhoto = profilePhoto;
        if (jobTitle !== undefined)
            userMeta.jobTitle = jobTitle;
        if (contactNumber !== undefined)
            userMeta.contactNumber = contactNumber;
        if (timezone !== undefined)
            userMeta.timezone = timezone;
        if (twoFactorEnabled !== undefined)
            userMeta.twoFactorEnabled = twoFactorEnabled;
        if (notifications !== undefined)
            userMeta.notifications = { ...userMeta.notifications, ...notifications };
        if (aiPreferences !== undefined)
            userMeta.aiPreferences = { ...userMeta.aiPreferences, ...aiPreferences };
        allMetadata[userId] = userMeta;
        writeUserMetadata(allMetadata);
        // Audit Log trace
        const changedFields = [];
        if (name !== undefined)
            changedFields.push('name');
        if (department !== undefined)
            changedFields.push('department');
        if (password)
            changedFields.push('password');
        if (profilePhoto !== undefined)
            changedFields.push('profilePhoto');
        if (jobTitle !== undefined)
            changedFields.push('jobTitle');
        if (contactNumber !== undefined)
            changedFields.push('contactNumber');
        if (timezone !== undefined)
            changedFields.push('timezone');
        if (twoFactorEnabled !== undefined)
            changedFields.push('twoFactorEnabled');
        if (notifications !== undefined)
            changedFields.push('notifications');
        if (aiPreferences !== undefined)
            changedFields.push('aiPreferences');
        await prisma_1.default.auditLog.create({
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
    }
    catch (err) {
        console.error("Update profile error:", err);
        res.status(500).json({ error: 'Failed to update profile details' });
    }
};
exports.updateProfile = updateProfile;
const revokeOtherSessions = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const allMetadata = readUserMetadata();
        if (allMetadata[userId]) {
            const sessions = allMetadata[userId].activeSessions || [];
            const currentSession = sessions.find((s) => s.currentSession) || {
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
        await prisma_1.default.auditLog.create({
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
    }
    catch (err) {
        console.error('Revoke other sessions error:', err);
        res.status(500).json({ error: 'Failed to revoke other sessions' });
    }
};
exports.revokeOtherSessions = revokeOtherSessions;
const downloadPersonalData = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId, organizationId: orgId },
            include: { organization: true }
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const metadata = getUserProfileMetadata(user.id, user.role);
        const datasets = await prisma_1.default.dataset.findMany({
            where: { ownerId: userId, organizationId: orgId },
            select: { id: true, name: true, source: true, createdAt: true }
        });
        const notifications = await prisma_1.default.notification.findMany({
            where: { userId: userId, organizationId: orgId },
            take: 20
        });
        const auditLogs = await prisma_1.default.auditLog.findMany({
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
    }
    catch (err) {
        console.error('Download data error:', err);
        res.status(500).json({ error: 'Failed to compile personal data export' });
    }
};
exports.downloadPersonalData = downloadPersonalData;
const deleteAccount = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        if (!userId || !orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { password } = req.body;
        if (!password)
            return res.status(400).json({ error: 'Password confirmation is required' });
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId, organizationId: orgId }
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const validPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!validPassword)
            return res.status(400).json({ error: 'Invalid password credentials' });
        if (user.role === 'Admin') {
            const adminCount = await prisma_1.default.user.count({
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
        await prisma_1.default.auditLog.create({
            data: {
                userId: userId,
                role: user.role,
                action: 'Delete Account',
                entityType: 'User',
                entityId: userId,
                organizationId: orgId
            }
        });
        await prisma_1.default.user.delete({
            where: { id: userId }
        });
        res.status(200).json({ message: 'Account deleted successfully' });
    }
    catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: 'Failed to delete account' });
    }
};
exports.deleteAccount = deleteAccount;
const updateOrganizationDetails = async (req, res) => {
    try {
        const userId = req.user?.id;
        const orgId = req.user?.organizationId;
        const role = req.user?.role;
        if (!userId || !orgId || role !== 'Admin')
            return res.status(403).json({ error: 'Forbidden: Admin privilege required' });
        const { name, domain } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Organization Name is required' });
        const updatedOrg = await prisma_1.default.organization.update({
            where: { id: orgId },
            data: { name, domain }
        });
        await prisma_1.default.auditLog.create({
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
    }
    catch (err) {
        console.error('Update organization settings error:', err);
        res.status(500).json({ error: 'Failed to update organization settings' });
    }
};
exports.updateOrganizationDetails = updateOrganizationDetails;
