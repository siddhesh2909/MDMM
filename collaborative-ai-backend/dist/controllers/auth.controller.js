"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = exports.logout = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const zod_1 = require("zod");
const notification_service_1 = require("../services/notification.service");
const auditLogger_1 = require("../utils/auditLogger");
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(['Data Engineer', 'Data Analyst', 'Business User', 'Admin', 'Data Steward', 'Analyst', 'Viewer']).optional(),
    department: zod_1.z.string().optional()
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string()
});
const generateToken = (user) => {
    const roleMapped = user.role === 'Data Engineer' ? 'Data Steward' :
        user.role === 'Data Analyst' ? 'Analyst' :
            user.role === 'Business User' ? 'Viewer' :
                user.role;
    return jsonwebtoken_1.default.sign({
        id: user.id,
        role: roleMapped,
        organizationId: user.organizationId,
        permissions: user.permissions
    }, process.env.JWT_SECRET || 'super_secret_collaborative_ai_key_2026', { expiresIn: '1d' });
};
const register = async (req, res) => {
    try {
        const { name, email, password, role, department } = registerSchema.parse(req.body);
        // For this demo, we auto-assign to the first organization if none provided
        let org = await prisma_1.default.organization.findFirst();
        if (!org) {
            org = await prisma_1.default.organization.create({ data: { name: 'Default Org', domain: 'default.com' } });
        }
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(400).json({ error: 'Email already exists' });
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const defaultPermissions = role === 'Admin' ? ['*'] :
            role === 'Data Engineer' || role === 'Data Steward' || role === 'Data Analyst' || role === 'Analyst' ? ['dataset:manage', 'dataset:view', 'contract:edit', 'contract:view'] :
                ['dataset:view'];
        const user = await prisma_1.default.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || 'Viewer',
                department,
                organizationId: org.id,
                permissions: JSON.stringify(defaultPermissions)
            }
        });
        // Trigger notifications
        try {
            await (0, notification_service_1.notifyUser)(user.id, 'Welcome to Collaborative AI!', `Hi ${name}, your account was successfully created as a ${user.role}.`, 'account', '/admin');
            await (0, notification_service_1.notifyAdmins)(org.id, 'New User Registered', `${name} (${email}) has joined the organization as ${user.role}.`, 'account', '/admin');
        }
        catch (nErr) {
            console.error('Failed to trigger register notifications:', nErr);
        }
        const token = generateToken(user);
        const mappedRole = user.role === 'Data Engineer' ? 'Data Steward' :
            user.role === 'Data Analyst' ? 'Analyst' :
                user.role === 'Business User' ? 'Viewer' :
                    user.role;
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: mappedRole,
                organizationId: user.organizationId,
                permissions: defaultPermissions
            }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Registration failed';
        res.status(400).json({ error: message });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user)
            return res.status(401).json({ error: 'Invalid credentials' });
        const validPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!validPassword)
            return res.status(401).json({ error: 'Invalid credentials' });
        const token = generateToken(user);
        // Update last active
        await prisma_1.default.user.update({ where: { id: user.id }, data: { lastActive: new Date() } });
        // Log login action in audit trail
        await (0, auditLogger_1.logAction)(user.id, user.role, user.organizationId, 'LOGIN', 'User', user.id, { email: user.email });
        // Trigger login security alert notification
        try {
            await (0, notification_service_1.notifyUser)(user.id, 'Security Alert: Successful Login', `A successful login was detected for your account.`, 'security', '/');
        }
        catch (nErr) {
            console.error('Failed to trigger login notification:', nErr);
        }
        const mappedRole = user.role === 'Data Engineer' ? 'Data Steward' :
            user.role === 'Data Analyst' ? 'Analyst' :
                user.role === 'Business User' ? 'Viewer' :
                    user.role;
        res.status(200).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: mappedRole,
                department: user.department,
                organizationId: user.organizationId,
                permissions: JSON.parse(user.permissions)
            }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        res.status(400).json({ error: message });
    }
};
exports.login = login;
const logout = async (req, res) => {
    res.status(200).json({ message: 'Logged out successfully' });
};
exports.logout = logout;
const refreshToken = async (req, res) => {
    // Basic implementation for demo
    res.status(200).json({ message: 'Token refresh endpoint' });
};
exports.refreshToken = refreshToken;
