import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { logAction } from '../utils/auditLogger';

// Helper to fetch dataset name
async function getDatasetName(datasetId: string) {
    const dataset = await prisma.dataset.findUnique({
        where: { id: datasetId }
    });
    return dataset ? dataset.name : 'Unknown Dataset';
}

// ── GET /api/data/schedules ───────────────────────────────────
export const getSchedules = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const schedules = await prisma.reportSchedule.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(schedules);
    } catch (err) {
        console.error('Fetch schedules error:', err);
        res.status(500).json({ error: 'Failed to fetch report schedules.' });
    }
};

// ── POST /api/data/schedules ──────────────────────────────────
export const createSchedule = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { datasetId, name, format, frequency, recipients, time } = req.body;
        if (!datasetId || !name || !frequency || !time) {
            return res.status(400).json({ error: 'datasetId, name, frequency, and time are required.' });
        }

        const datasetName = await getDatasetName(datasetId);

        const schedule = await prisma.reportSchedule.create({
            data: {
                name,
                datasetId,
                datasetName,
                format: format || 'PDF',
                frequency,
                recipients: recipients || '',
                time,
                status: 'Active',
                organizationId: user.organizationId
            }
        });

        await logAction(user.id, user.role, user.organizationId, 'SCHEDULE_CREATE', 'ReportSchedule', schedule.id, { name, frequency });

        res.status(201).json({ success: true, schedule });
    } catch (err) {
        console.error('Create schedule error:', err);
        res.status(500).json({ error: 'Failed to create schedule.' });
    }
};

// ── PATCH /api/data/schedules/:id ─────────────────────────────
export const updateSchedule = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const scheduleId = String(req.params.id);
        const { name, format, frequency, recipients, time, status } = req.body;

        const existing = await prisma.reportSchedule.findFirst({
            where: { id: scheduleId, organizationId: user.organizationId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Schedule not found.' });
        }

        const updated = await prisma.reportSchedule.update({
            where: { id: scheduleId },
            data: {
                name: name !== undefined ? name : existing.name,
                format: format !== undefined ? format : existing.format,
                frequency: frequency !== undefined ? frequency : existing.frequency,
                recipients: recipients !== undefined ? recipients : existing.recipients,
                time: time !== undefined ? time : existing.time,
                status: status !== undefined ? status : existing.status
            }
        });

        await logAction(user.id, user.role, user.organizationId, 'SCHEDULE_UPDATE', 'ReportSchedule', scheduleId, { name: updated.name, status: updated.status });

        res.status(200).json({ success: true, schedule: updated });
    } catch (err) {
        console.error('Update schedule error:', err);
        res.status(500).json({ error: 'Failed to update schedule.' });
    }
};

// ── DELETE /api/data/schedules/:id ────────────────────────────
export const deleteSchedule = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const scheduleId = String(req.params.id);

        const existing = await prisma.reportSchedule.findFirst({
            where: { id: scheduleId, organizationId: user.organizationId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Schedule not found.' });
        }

        await prisma.reportSchedule.delete({
            where: { id: scheduleId }
        });

        await logAction(user.id, user.role, user.organizationId, 'SCHEDULE_DELETE', 'ReportSchedule', scheduleId, { name: existing.name });

        res.status(200).json({ success: true, message: 'Schedule deleted successfully.' });
    } catch (err) {
        console.error('Delete schedule error:', err);
        res.status(500).json({ error: 'Failed to delete schedule.' });
    }
};

// ── POST /api/data/schedules/:id/run ──────────────────────────
export const runScheduleNow = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const scheduleId = String(req.params.id);

        const schedule = await prisma.reportSchedule.findFirst({
            where: { id: scheduleId, organizationId: user.organizationId }
        });
        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found.' });
        }

        // Import the createReport function logic directly or call it mock-wise.
        // We will execute a mock request call to generate the report for the schedule.
        const dataset = await prisma.dataset.findUnique({
            where: { id: schedule.datasetId }
        });
        if (!dataset) {
            return res.status(404).json({ error: 'Source dataset for schedule not found.' });
        }

        // Re-use logic to create report
        const { createReport } = require('./reports.controller');
        
        // Mock request context
        const mockReq = {
            user,
            body: {
                datasetId: schedule.datasetId,
                name: `Scheduled: ${schedule.name}`,
                format: schedule.format
            }
        } as any;

        const mockRes = {
            status: (code: number) => {
                return {
                    json: (data: any) => {
                        res.status(code).json({
                            success: code === 201,
                            message: code === 201 ? 'Scheduled report generated successfully.' : 'Generation failed.',
                            ...data
                        });
                    }
                };
            }
        } as any;

        await createReport(mockReq, mockRes);

    } catch (err) {
        console.error('Run schedule error:', err);
        res.status(500).json({ error: 'Failed to trigger schedule report generation.' });
    }
};
