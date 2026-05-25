import { Request, Response, NextFunction, Router } from 'express';
import { getContracts, createContract, updateContract, deleteContract, duplicateContract, toggleContractStatus, getLatestContract, getContractsDashboardStats, getContractDetail } from '../controllers/contracts.controller';
import { getWorkflows, createWorkflow, updateWorkflow, deleteWorkflow } from '../controllers/workflows.controller';
import { getAnalytics, getDatasetAnalytics } from '../controllers/analytics.controller';
import { getDatasets, createDataset, updateDataset, getDatasetDetail, deleteDataset } from '../controllers/datasets.controller';
import { getUsers, getAuditLog, inviteUser, updateUserRole, deactivateUser } from '../controllers/users.controller';
import { testConnection, pullData } from '../controllers/connectors.controller';
import { authenticateToken, requirePermission, requireRole } from '../middleware/auth';

// New controllers
import { validateDataset, getValidationReport } from '../controllers/validation.controller';
import { getDatasetQuality, getQualityOverview } from '../controllers/quality.controller';
import { getDatasetLineage, getFullLineage } from '../controllers/lineage.controller';
import { createVersion, getVersions, compareVersions, rollbackVersion } from '../controllers/versioning.controller';
import { getSchemaSuggestions, applySuggestion } from '../controllers/evolution.controller';
import { getErrorLogs, getLogSummary } from '../controllers/pipeline-logs.controller';

const router = Router();

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

// ── Dataset Validation Report (Part 1) ──
router.get('/datasets/:id/validation-report', getValidationReport);

// ── Dataset Quality Metrics (Part 3) ──
router.get('/datasets/:id/quality', getDatasetQuality);
router.get('/quality/overview', getQualityOverview);

// ── Dataset Lineage (Part 4) ──
router.get('/datasets/:id/lineage', getDatasetLineage);
router.get('/lineage/full', getFullLineage);

// ── Workflows ──
router.get('/workflows', getWorkflows);
router.post('/workflows', requirePermission('workflow:edit'), createWorkflow);
router.patch('/workflows/:id', requirePermission('workflow:edit'), updateWorkflow);
router.delete('/workflows/:id', requirePermission('workflow:edit'), deleteWorkflow);

// ── Analytics ──
router.get('/analytics', getAnalytics);

// ── Admin / Users ──
router.get('/users', getUsers);
router.get('/audit-log', requireRole(['Admin']), getAuditLog);
router.post('/users/invite', requireRole(['Admin']), inviteUser);
router.patch('/users/update-role', requireRole(['Admin']), updateUserRole);
router.patch('/users/deactivate', requireRole(['Admin']), deactivateUser);

// ── Connectors ──
router.post('/connectors/test', requirePermission('dataset:manage'), testConnection);
router.post('/connectors/pull', requirePermission('dataset:manage'), pullData);

// ── Pipeline Logs (Part 7) ──
router.get('/logs/errors', getErrorLogs);
router.get('/logs/summary', getLogSummary);

export default router;
