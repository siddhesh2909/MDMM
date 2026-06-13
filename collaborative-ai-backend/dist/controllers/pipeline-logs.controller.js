"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogSummary = exports.getErrorLogs = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
/**
 * Pipeline Logs Controller
 * Central observability for all pipeline events
 */
// GET /api/logs/errors — paginated, filterable error/event log
const getErrorLogs = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const logType = req.query.type;
        const severity = req.query.severity;
        const where = { organizationId: user.organizationId };
        if (logType)
            where.logType = logType;
        if (severity)
            where.severity = severity;
        const [total, logs] = await Promise.all([
            prisma_1.default.pipelineLog.count({ where }),
            prisma_1.default.pipelineLog.findMany({
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
    }
    catch (err) {
        console.error('Get logs error:', err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};
exports.getErrorLogs = getErrorLogs;
// GET /api/logs/summary — counts by severity
const getLogSummary = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const orgId = user.organizationId;
        const [total, errors, warnings, infos] = await Promise.all([
            prisma_1.default.pipelineLog.count({ where: { organizationId: orgId } }),
            prisma_1.default.pipelineLog.count({ where: { organizationId: orgId, severity: 'error' } }),
            prisma_1.default.pipelineLog.count({ where: { organizationId: orgId, severity: 'warning' } }),
            prisma_1.default.pipelineLog.count({ where: { organizationId: orgId, severity: 'info' } }),
        ]);
        // Recent (last 24 hours)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentErrors = await prisma_1.default.pipelineLog.count({
            where: { organizationId: orgId, severity: 'error', createdAt: { gte: since } }
        });
        res.status(200).json({
            total,
            errors,
            warnings,
            infos,
            recentErrors,
        });
    }
    catch (err) {
        console.error('Log summary error:', err);
        res.status(500).json({ error: 'Failed to fetch log summary' });
    }
};
exports.getLogSummary = getLogSummary;
