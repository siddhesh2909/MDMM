"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contracts_controller_1 = require("../controllers/contracts.controller");
const analytics_controller_1 = require("../controllers/analytics.controller");
const datasets_controller_1 = require("../controllers/datasets.controller");
const users_controller_1 = require("../controllers/users.controller");
const connectors_controller_1 = require("../controllers/connectors.controller");
const auth_1 = require("../middleware/auth");
// New controllers
const validation_controller_1 = require("../controllers/validation.controller");
const quality_controller_1 = require("../controllers/quality.controller");
const versioning_controller_1 = require("../controllers/versioning.controller");
const evolution_controller_1 = require("../controllers/evolution.controller");
const pipeline_logs_controller_1 = require("../controllers/pipeline-logs.controller");
const notifications_controller_1 = require("../controllers/notifications.controller");
const router = (0, express_1.Router)();
// SSE Stream must be authenticated inline using token query param to allow native browser EventSource connections
router.get('/notifications/stream', notifications_controller_1.streamNotifications);
// Protect all data routes
router.use(auth_1.authenticateToken);
// ── Data Contracts Dashboard Stats (must be before :id routes) ──
router.get('/contracts-dashboard-stats', contracts_controller_1.getContractsDashboardStats);
// ── Contracts ──
router.get('/contracts', contracts_controller_1.getContracts);
router.post('/contracts', (0, auth_1.requirePermission)('contract:edit'), contracts_controller_1.createContract);
router.patch('/contracts/:id', (0, auth_1.requirePermission)('contract:edit'), contracts_controller_1.updateContract);
router.delete('/contracts/:id', (0, auth_1.requirePermission)('contract:edit'), contracts_controller_1.deleteContract);
router.post('/contracts/:id/duplicate', (0, auth_1.requirePermission)('contract:edit'), contracts_controller_1.duplicateContract);
router.patch('/contracts/:id/status', (0, auth_1.requirePermission)('contract:edit'), contracts_controller_1.toggleContractStatus);
router.get('/contracts/:id/detail', contracts_controller_1.getContractDetail);
// ── Contract Validation (Part 1) ──
router.post('/contracts/:id/validate-dataset', (0, auth_1.requirePermission)('contract:edit'), validation_controller_1.validateDataset);
// ── Contract Versioning (Part 5) ──
router.post('/contracts/:id/version', (0, auth_1.requirePermission)('contract:edit'), versioning_controller_1.createVersion);
router.get('/contracts/:id/versions', versioning_controller_1.getVersions);
router.get('/contracts/:id/versions/compare', versioning_controller_1.compareVersions);
router.post('/contracts/:id/rollback', (0, auth_1.requirePermission)('contract:edit'), versioning_controller_1.rollbackVersion);
// ── Contract Evolution / Schema Suggestions (Part 6) ──
router.get('/contracts/:id/latest', contracts_controller_1.getLatestContract);
router.get('/contracts/:id/schema-suggestions', evolution_controller_1.getSchemaSuggestions);
router.post('/contracts/:id/apply-suggestion', (0, auth_1.requirePermission)('contract:edit'), evolution_controller_1.applySuggestion);
// ── Datasets ──
router.get('/datasets', datasets_controller_1.getDatasets);
router.get('/datasets/:id', datasets_controller_1.getDatasetDetail);
router.post('/datasets', (0, auth_1.requirePermission)('dataset:manage'), datasets_controller_1.createDataset);
router.patch('/datasets/:id', (0, auth_1.requirePermission)('dataset:manage'), datasets_controller_1.updateDataset);
router.delete('/datasets/:id', (0, auth_1.requirePermission)('dataset:manage'), datasets_controller_1.deleteDataset);
router.get('/datasets/:id/analytics', analytics_controller_1.getDatasetAnalytics);
// ── Dataset Sharing ──
const sharing_controller_1 = require("../controllers/sharing.controller");
router.post('/datasets/:id/share', sharing_controller_1.shareDataset);
router.post('/datasets/:id/share/update', sharing_controller_1.updateDatasetShare);
router.post('/datasets/:id/share/revoke', sharing_controller_1.revokeDatasetShare);
router.get('/datasets/:id/share/users', sharing_controller_1.getDatasetSharedUsers);
// ── Dataset Validation Report (Part 1) ──
router.get('/datasets/:id/validation-report', validation_controller_1.getValidationReport);
// ── Dataset Quality Metrics (Part 3) ──
router.get('/datasets/:id/quality', quality_controller_1.getDatasetQuality);
router.get('/quality/overview', quality_controller_1.getQualityOverview);
// ── Analytics ──
router.get('/analytics', analytics_controller_1.getAnalytics);
// ── Admin / Users ──
router.get('/users', (0, auth_1.requireRole)(['Admin']), users_controller_1.getUsers);
router.post('/log-security-event', async (req, res) => {
    const authReq = req;
    const user = authReq.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { path } = req.body;
    try {
        const { logAction } = require('../utils/auditLogger');
        await logAction(user.id, user.role, user.organizationId, 'UNAUTHORIZED_ACCESS', 'Route', path || 'unknown', { attemptPath: path });
        res.status(200).json({ success: true });
    }
    catch (err) {
        console.error('Failed to log security event:', err);
        res.status(500).json({ error: 'Failed to log security event' });
    }
});
router.post('/log-dashboard-publish', async (req, res) => {
    const authReq = req;
    const user = authReq.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { dashboardId, dashboardName } = req.body;
    try {
        const { logAction } = require('../utils/auditLogger');
        await logAction(user.id, user.role, user.organizationId, 'DASHBOARD_PUBLICATION', 'Dashboard', dashboardId || 'unknown', { dashboardName });
        res.status(200).json({ success: true });
    }
    catch (err) {
        console.error('Failed to log dashboard publication:', err);
        res.status(500).json({ error: 'Failed to log dashboard publication' });
    }
});
router.get('/users/profile', users_controller_1.getProfile);
router.patch('/users/profile', users_controller_1.updateProfile);
router.post('/users/profile/revoke-others', users_controller_1.revokeOtherSessions);
router.get('/users/profile/download-data', users_controller_1.downloadPersonalData);
router.delete('/users/profile', users_controller_1.deleteAccount);
router.patch('/organization', users_controller_1.updateOrganizationDetails);
router.get('/audit-log', (0, auth_1.requireRole)(['Admin']), users_controller_1.getAuditLog);
router.post('/users/invite', (0, auth_1.requireRole)(['Admin']), users_controller_1.inviteUser);
router.patch('/users/update-role', (0, auth_1.requireRole)(['Admin']), users_controller_1.updateUserRole);
router.patch('/users/deactivate', (0, auth_1.requireRole)(['Admin']), users_controller_1.deactivateUser);
// ── Connectors ──
router.post('/connectors/test', (0, auth_1.requirePermission)('dataset:manage'), connectors_controller_1.testConnection);
router.post('/connectors/pull', (0, auth_1.requirePermission)('dataset:manage'), connectors_controller_1.pullData);
// ── Pipeline Logs (Part 7) ──
router.get('/logs/errors', pipeline_logs_controller_1.getErrorLogs);
router.get('/logs/summary', pipeline_logs_controller_1.getLogSummary);
// ── Notifications ──
router.get('/notifications', notifications_controller_1.getNotifications);
router.get('/notifications/:id', notifications_controller_1.getNotificationDetail);
router.patch('/notifications/:id/read', notifications_controller_1.markRead);
router.patch('/notifications/:id/archive', notifications_controller_1.toggleArchiveNotification);
router.delete('/notifications/:id', notifications_controller_1.deleteNotification);
router.post('/notifications/mark-all-read', notifications_controller_1.markAllRead);
exports.default = router;
