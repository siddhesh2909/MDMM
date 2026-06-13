import * as express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { notifyUser, notifyAdmins } from '../services/notification.service';

const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['Data Engineer', 'Data Analyst', 'Business User', 'Admin', 'Data Steward', 'Analyst', 'Viewer']).optional(),
    department: z.string().optional()
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

const generateToken = (user: any) => {
    const roleMapped = user.role === 'Data Engineer' ? 'Data Steward' :
        user.role === 'Data Analyst' ? 'Analyst' :
            user.role === 'Business User' ? 'Viewer' :
                user.role;
    return jwt.sign(
        {
            id: user.id,
            role: roleMapped,
            organizationId: user.organizationId,
            permissions: user.permissions
        },
        process.env.JWT_SECRET || 'fallback',
        { expiresIn: '1d' }
    );
};

export const register = async (req: express.Request, res: express.Response) => {
    try {
        const { name, email, password, role, department } = registerSchema.parse(req.body);

        // For this demo, we auto-assign to the first organization if none provided
        let org = await prisma.organization.findFirst();
        if (!org) {
            org = await prisma.organization.create({ data: { name: 'Default Org', domain: 'default.com' } });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'Email already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        // Assign default permissions based on role
        const defaultPermissions = role === 'Admin' ? ['*'] :
            role === 'Data Engineer' || role === 'Data Steward' ? ['dataset:manage', 'dataset:view', 'contract:edit', 'contract:view', 'workflow:view', 'workflow:edit'] :
                role === 'Data Analyst' || role === 'Analyst' ? ['dataset:manage', 'dataset:view', 'contract:view', 'workflow:view'] :
                    ['dataset:view'];

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || 'Viewer',
                department,
                organizationId: (org as any).id,
                permissions: JSON.stringify(defaultPermissions)
            } as any
        });

        // Trigger notifications
        try {
            await notifyUser(
                user.id,
                'Welcome to Collaborative AI!',
                `Hi ${name}, your account was successfully created as a ${user.role}.`,
                'account',
                '/admin'
            );
            await notifyAdmins(
                (org as any).id,
                'New User Registered',
                `${name} (${email}) has joined the organization as ${user.role}.`,
                'account',
                '/admin'
            );
        } catch (nErr) {
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
                organizationId: (user as any).organizationId,
                permissions: defaultPermissions
            }
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Registration failed';
        res.status(400).json({ error: message });
    }
}

export const login = async (req: express.Request, res: express.Response) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        const token = generateToken(user);

        // Update last active
        await prisma.user.update({ where: { id: user.id }, data: { lastActive: new Date() } });

        // Trigger login security alert notification
        try {
            await notifyUser(
                user.id,
                'Security Alert: Successful Login',
                `A successful login was detected for your account.`,
                'security',
                '/'
            );
        } catch (nErr) {
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
                organizationId: (user as any).organizationId,
                permissions: JSON.parse((user as any).permissions)
            }
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Login failed';
        res.status(400).json({ error: message });
    }
}

export const logout = async (req: express.Request, res: express.Response) => {
    res.status(200).json({ message: 'Logged out successfully' });
};

export const refreshToken = async (req: express.Request, res: express.Response) => {
    // Basic implementation for demo
    res.status(200).json({ message: 'Token refresh endpoint' });
};
