"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteWorkflow = exports.updateWorkflow = exports.createWorkflow = exports.getWorkflows = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const notification_service_1 = require("../services/notification.service");
const auditLogger_1 = require("../utils/auditLogger");
const getWorkflows = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { status, priority, assignee } = req.query;
        const where = { organizationId: orgId };
        if (status && status !== 'All')
            where.status = status;
        if (priority && priority !== 'All')
            where.priority = priority;
        if (assignee && assignee !== 'All')
            where.assignee = { contains: assignee };
        const workflows = await prisma_1.default.workflowTask.findMany({
            where,
            orderBy: { updatedAt: 'desc' }
        });
        res.status(200).json(workflows);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch workflows' });
    }
};
exports.getWorkflows = getWorkflows;
const createWorkflow = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { title, description, assignee, status, priority, category, progress, dueDate } = req.body;
        const workflow = await prisma_1.default.workflowTask.create({
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
            }
        });
        // Audit workflow task creation/execution
        await (0, auditLogger_1.logAction)(user.id, user.role, user.organizationId, 'WORKFLOW_EXECUTION', 'WorkflowTask', workflow.id, { title: title, action: 'create' });
        try {
            await (0, notification_service_1.notifyAssignee)(assignee, 'New Workflow Task Assigned', `You have been assigned to task: "${title}".`, 'task', '/workflows');
        }
        catch (nErr) {
            console.error('Failed to trigger task assignment notifications:', nErr);
        }
        res.status(201).json(workflow);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create workflow' });
    }
};
exports.createWorkflow = createWorkflow;
const updateWorkflow = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const id = req.params.id;
        const { status, progress, title, description, assignee, priority, category, dueDate } = req.body;
        // Verify organization
        const existing = await prisma_1.default.workflowTask.findFirst({
            where: { id, organizationId: user.organizationId }
        });
        if (!existing)
            return res.status(404).json({ error: 'Workflow task not found or unauthorized' });
        const data = {};
        if (status !== undefined)
            data.status = status;
        if (progress !== undefined)
            data.progress = progress;
        if (title !== undefined)
            data.title = title;
        if (description !== undefined)
            data.description = description;
        if (assignee !== undefined)
            data.assignee = assignee;
        if (priority !== undefined)
            data.priority = priority;
        if (category !== undefined)
            data.category = category;
        if (dueDate !== undefined)
            data.dueDate = dueDate ? new Date(dueDate) : null;
        const workflow = await prisma_1.default.workflowTask.update({ where: { id }, data });
        // Audit workflow task update/execution
        await (0, auditLogger_1.logAction)(user.id, user.role, user.organizationId, 'WORKFLOW_EXECUTION', 'WorkflowTask', workflow.id, { title: workflow.title, action: 'update', status: workflow.status, progress: workflow.progress });
        try {
            const titleStr = workflow.title;
            const updatedAssignee = workflow.assignee;
            if (workflow.status === 'Approved' || workflow.progress === 100) {
                await (0, notification_service_1.notifyAssignee)(updatedAssignee, 'Workflow Task Completed', `Task "${titleStr}" has been marked as completed/approved.`, 'task', '/workflows');
            }
            else {
                await (0, notification_service_1.notifyAssignee)(updatedAssignee, 'Workflow Task Updated', `Task "${titleStr}" status updated to ${workflow.status} (${workflow.progress}%).`, 'task', '/workflows');
            }
        }
        catch (nErr) {
            console.error('Failed to trigger task update notifications:', nErr);
        }
        res.status(200).json(workflow);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update workflow' });
    }
};
exports.updateWorkflow = updateWorkflow;
const deleteWorkflow = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const id = req.params.id;
        // Verify organization
        const existing = await prisma_1.default.workflowTask.findFirst({
            where: { id, organizationId: user.organizationId }
        });
        if (!existing)
            return res.status(404).json({ error: 'Workflow task not found or unauthorized' });
        await prisma_1.default.workflowTask.delete({ where: { id } });
        try {
            await (0, notification_service_1.notifyAssignee)(existing.assignee, 'Workflow Task Deleted', `Task "${existing.title}" has been deleted.`, 'task', '/workflows');
        }
        catch (nErr) {
            console.error('Failed to trigger task delete notifications:', nErr);
        }
        res.status(200).json({ message: 'Workflow deleted' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete workflow' });
    }
};
exports.deleteWorkflow = deleteWorkflow;
