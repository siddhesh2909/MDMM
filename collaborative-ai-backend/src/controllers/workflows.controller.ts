import * as express from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

export const getWorkflows = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const { status, priority, assignee } = req.query;
        const where = { organizationId: orgId } as any;

        if (status && status !== 'All') where.status = status as string;
        if (priority && priority !== 'All') where.priority = priority as string;
        if (assignee && assignee !== 'All') where.assignee = { contains: assignee as string };

        const workflows = await prisma.workflowTask.findMany({
            where,
            orderBy: { updatedAt: 'desc' }
        });
        res.status(200).json(workflows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch workflows' });
    }
}

export const createWorkflow = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { title, description, assignee, status, priority, category, progress, dueDate } = req.body;
        const workflow = await prisma.workflowTask.create({
            data: {
                title,
                description: description || '',
                assignee,
                status: status || 'Pending',
                priority: priority || 'Medium',
                category: category || 'General',
                progress: progress || 0,
                dueDate: dueDate ? new Date(dueDate) : null,
                organizationId: user.organizationId
            } as any
        });
        res.status(201).json(workflow);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create workflow' });
    }
}

export const updateWorkflow = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const id = req.params.id as string;
        const { status, progress, title, description, assignee, priority, category, dueDate } = req.body;

        // Verify organization
        const existing = await prisma.workflowTask.findFirst({
            where: { id, organizationId: user.organizationId }
        });

        if (!existing) return res.status(404).json({ error: 'Workflow task not found or unauthorized' });

        const data: any = {};
        if (status !== undefined) data.status = status;
        if (progress !== undefined) data.progress = progress;
        if (title !== undefined) data.title = title;
        if (description !== undefined) data.description = description;
        if (assignee !== undefined) data.assignee = assignee;
        if (priority !== undefined) data.priority = priority;
        if (category !== undefined) data.category = category;
        if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

        const workflow = await prisma.workflowTask.update({ where: { id }, data });
        res.status(200).json(workflow);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update workflow' });
    }
}

export const deleteWorkflow = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const id = req.params.id as string;

        // Verify organization
        const existing = await prisma.workflowTask.findFirst({
            where: { id, organizationId: user.organizationId }
        });

        if (!existing) return res.status(404).json({ error: 'Workflow task not found or unauthorized' });

        await prisma.workflowTask.delete({ where: { id } });
        res.status(200).json({ message: 'Workflow deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete workflow' });
    }
}
