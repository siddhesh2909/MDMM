import { Request, Response, NextFunction, Router } from 'express';
import { getContracts, createContract, updateContract, deleteContract, duplicateContract, toggleContractStatus, getLatestContract, getContractsDashboardStats, getContractDetail } from '../controllers/contracts.controller';
import { getAnalytics, getDatasetAnalytics } from '../controllers/analytics.controller';
import { getDatasets, createDataset, updateDataset, getDatasetDetail, deleteDataset } from '../controllers/datasets.controller';
import { getUsers, getAuditLog, inviteUser, updateUserRole, deactivateUser, activateUser, deleteUser, updateProfile, getProfile, revokeOtherSessions, downloadPersonalData, deleteAccount, updateOrganizationDetails } from '../controllers/users.controller';
import { testConnection, pullData } from '../controllers/connectors.controller';
import { authenticateToken, requirePermission, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { getReports, createReport, regenerateReport, getReportVersions, deleteReport, shareReport, exportReport, updateReportShare, revokeReportShare, getReportSharedUsers, getSharedReportByToken, exportSharedReportByToken } from '../controllers/reports.controller';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, runScheduleNow } from '../controllers/schedules.controller';

// New controllers
import { validateDataset, getValidationReport } from '../controllers/validation.controller';
import { getDatasetQuality, getQualityOverview } from '../controllers/quality.controller';
import { createVersion, getVersions, compareVersions, rollbackVersion } from '../controllers/versioning.controller';
import { getSchemaSuggestions, applySuggestion } from '../controllers/evolution.controller';
import { getErrorLogs, getLogSummary } from '../controllers/pipeline-logs.controller';
import { getNotifications, markRead, markAllRead, streamNotifications, getNotificationDetail, deleteNotification, toggleArchiveNotification } from '../controllers/notifications.controller';

const router = Router();

// SSE Stream must be authenticated inline using token query param to allow native browser EventSource connections
router.get('/notifications/stream', streamNotifications);

// Public shared report endpoints
router.get('/shared/reports/:token', getSharedReportByToken);
router.get('/shared/reports/:token/export', exportSharedReportByToken);

// Protect all data routes
router.use(authenticateToken);

// ── Data Contracts Dashboard Stats (must be before :id routes) ──
router.get('/contracts-dashboard-stats', getContractsDashboardStats);

// ── Contracts ──
router.get('/contracts', getContracts);
router.post('/contracts', requirePermission('contract:edit'), createContract);
router.patch('/contracts/:id', requirePermission('contract:edit'), updateContract);
router.delete('/contracts/:id', requirePermission('contract:edit'), deleteContract);
router.post('/contracts/:id/duplicate', requirePermission('contract:edit'), duplicateContract);
router.patch('/contracts/:id/status', requirePermission('contract:edit'), toggleContractStatus);
router.get('/contracts/:id/detail', getContractDetail);

// ── Contract Validation (Part 1) ──
router.post('/contracts/:id/validate-dataset', requirePermission('contract:edit'), validateDataset);

// ── Contract Versioning (Part 5) ──
router.post('/contracts/:id/version', requirePermission('contract:edit'), createVersion);
router.get('/contracts/:id/versions', getVersions);
router.get('/contracts/:id/versions/compare', compareVersions);
router.post('/contracts/:id/rollback', requirePermission('contract:edit'), rollbackVersion);

// ── Contract Evolution / Schema Suggestions (Part 6) ──
router.get('/contracts/:id/latest', getLatestContract);
router.get('/contracts/:id/schema-suggestions', getSchemaSuggestions);
router.post('/contracts/:id/apply-suggestion', requirePermission('contract:edit'), applySuggestion);

// ── Datasets ──
router.get('/datasets', getDatasets);
router.get('/datasets/:id', getDatasetDetail);
router.post('/datasets', requirePermission('dataset:manage'), createDataset);
router.patch('/datasets/:id', requirePermission('dataset:manage'), updateDataset);
router.delete('/datasets/:id', requirePermission('dataset:manage'), deleteDataset);
router.get('/datasets/:id/analytics', getDatasetAnalytics);

// ── Dataset Sharing ──
import { shareDataset, updateDatasetShare, revokeDatasetShare, getDatasetSharedUsers } from '../controllers/sharing.controller';
router.post('/datasets/:id/share', shareDataset);
router.post('/datasets/:id/share/update', updateDatasetShare);
router.post('/datasets/:id/share/revoke', revokeDatasetShare);
router.get('/datasets/:id/share/users', getDatasetSharedUsers);

// ── Dataset Validation Report (Part 1) ──
router.get('/datasets/:id/validation-report', getValidationReport);

// ── Dataset Quality Metrics (Part 3) ──
router.get('/datasets/:id/quality', getDatasetQuality);
router.get('/quality/overview', getQualityOverview);


// ── Analytics ──
router.get('/analytics', getAnalytics);

// ── Admin / Users ──
router.get('/users', requireRole(['Admin']), getUsers);
router.post('/log-security-event', async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { path } = req.body;
    try {
        const { logAction } = require('../utils/auditLogger');
        await logAction(
            user.id,
            user.role,
            user.organizationId,
            'UNAUTHORIZED_ACCESS',
            'Route',
            path || 'unknown',
            { attemptPath: path }
        );
        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Failed to log security event:', err);
        res.status(500).json({ error: 'Failed to log security event' });
    }
});

router.post('/log-dashboard-publish', async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { dashboardId, dashboardName } = req.body;
    try {
        const { logAction } = require('../utils/auditLogger');
        await logAction(
            user.id,
            user.role,
            user.organizationId,
            'DASHBOARD_PUBLICATION',
            'Dashboard',
            dashboardId || 'unknown',
            { dashboardName }
        );
        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Failed to log dashboard publication:', err);
        res.status(500).json({ error: 'Failed to log dashboard publication' });
    }
});

router.get('/users/profile', getProfile);
router.patch('/users/profile', updateProfile);
router.post('/users/profile/revoke-others', revokeOtherSessions);
router.get('/users/profile/download-data', downloadPersonalData);
router.delete('/users/profile', deleteAccount);
router.patch('/organization', updateOrganizationDetails);
router.get('/audit-log', requireRole(['Admin']), getAuditLog);
router.post('/users/invite', requireRole(['Admin']), inviteUser);
router.patch('/users/update-role', requireRole(['Admin']), updateUserRole);
router.patch('/users/deactivate', requireRole(['Admin']), deactivateUser);
router.patch('/users/activate', requireRole(['Admin']), activateUser);
router.delete('/users/delete', requireRole(['Admin']), deleteUser);

// ── Connectors ──
router.post('/connectors/test', requirePermission('dataset:manage'), testConnection);
router.post('/connectors/pull', requirePermission('dataset:manage'), pullData);

// ── Pipeline Logs (Part 7) ──
router.get('/logs/errors', getErrorLogs);
router.get('/logs/summary', getLogSummary);

// ── Notifications ──
router.get('/notifications', getNotifications);
router.get('/notifications/:id', getNotificationDetail);
router.patch('/notifications/:id/read', markRead);
router.patch('/notifications/:id/archive', toggleArchiveNotification);
router.delete('/notifications/:id', deleteNotification);
router.post('/notifications/mark-all-read', markAllRead);

// ── Reports ──
router.get('/reports', getReports);
router.post('/reports', createReport);
router.post('/reports/:id/regenerate', regenerateReport);
router.get('/reports/:id/versions', getReportVersions);
router.delete('/reports/:id', deleteReport);
router.post('/reports/:id/share', shareReport);
router.post('/reports/:id/share/update', updateReportShare);
router.post('/reports/:id/share/revoke', revokeReportShare);
router.get('/reports/:id/share/users', getReportSharedUsers);
router.get('/reports/:id/export', exportReport);

// ── Schedules ──
router.get('/schedules', getSchedules);
router.post('/schedules', createSchedule);
router.patch('/schedules/:id', updateSchedule);
router.delete('/schedules/:id', deleteSchedule);
router.post('/schedules/:id/run', runScheduleNow);

// ── Enterprise BI Analytics Engine Routes ──
import {
    classifyDataset,
    getDatasetKPIs,
    getWidgetRecommendations,
    getCorrelationMatrix,
    getForecast,
    getDashboardHealth,
    getBusinessGlossary,
    getDashboardLayoutVersions,
    saveDashboardLayoutVersion,
    rollbackDashboardLayoutVersion,
    getAlertRules,
    createAlertRule,
    deleteAlertRule,
    getCollaborationComments,
    createCollaborationComment,
    resolveCollaborationComment
} from '../controllers/enterprise-bi.controller';

router.get('/datasets/:id/bi/classification', classifyDataset);
router.get('/datasets/:id/bi/kpis', getDatasetKPIs);
router.get('/datasets/:id/bi/recommendations', getWidgetRecommendations);
router.get('/datasets/:id/bi/correlations', getCorrelationMatrix);
router.get('/datasets/:id/bi/forecasting', getForecast);
router.get('/datasets/:id/bi/health', getDashboardHealth);
router.get('/datasets/:id/bi/glossary', getBusinessGlossary);
router.get('/datasets/:id/bi/versions', getDashboardLayoutVersions);
router.post('/datasets/:id/bi/versions', saveDashboardLayoutVersion);
router.post('/datasets/:id/bi/versions/:versionId/rollback', rollbackDashboardLayoutVersion);
router.get('/datasets/:id/bi/alerts', getAlertRules);
router.post('/datasets/:id/bi/alerts', createAlertRule);
router.delete('/datasets/:id/bi/alerts/:alertId', deleteAlertRule);
router.get('/datasets/:id/bi/comments', getCollaborationComments);
router.post('/datasets/:id/bi/comments', createCollaborationComment);
router.patch('/datasets/:id/bi/comments/:commentId/resolve', resolveCollaborationComment);

export default router;
