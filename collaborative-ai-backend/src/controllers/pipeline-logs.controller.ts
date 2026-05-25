import * as express from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

/**
 * Pipeline Logs Controller
 * Central observability for all pipeline events
 */

// GET /api/logs/errors — paginated, filterable error/event log
export const getErrorLogs = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const logType = req.query.type as string;
        const severity = req.query.severity as string;

        const where: any = { organizationId: user.organizationId };
        if (logType) where.logType = logType;
        if (severity) where.severity = severity;

        const [total, logs] = await Promise.all([
            prisma.pipelineLog.count({ where }),
            prisma.pipelineLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        res.status(200).json({
            total,
            page,
            totalPages: Math.ceil(total / limit),
            logs: logs.map(l => ({
                ...l,
                metadata: JSON.parse(l.metadata),
            })),
        });
    } catch (err) {
        console.error('Get logs error:', err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};

// GET /api/logs/summary — counts by severity
export const getLogSummary = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const orgId = user.organizationId;

        const [total, errors, warnings, infos] = await Promise.all([
            prisma.pipelineLog.count({ where: { organizationId: orgId } }),
            prisma.pipelineLog.count({ where: { organizationId: orgId, severity: 'error' } }),
            prisma.pipelineLog.count({ where: { organizationId: orgId, severity: 'warning' } }),
            prisma.pipelineLog.count({ where: { organizationId: orgId, severity: 'info' } }),
        ]);

        // Recent (last 24 hours)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentErrors = await prisma.pipelineLog.count({
            where: { organizationId: orgId, severity: 'error', createdAt: { gte: since } }
        });

        res.status(200).json({
            total,
            errors,
            warnings,
            infos,
            recentErrors,
        });
    } catch (err) {
        console.error('Log summary error:', err);
        res.status(500).json({ error: 'Failed to fetch log summary' });
    }
};
