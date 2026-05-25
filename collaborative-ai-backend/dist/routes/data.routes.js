"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contracts_controller_1 = require("../controllers/contracts.controller");
const workflows_controller_1 = require("../controllers/workflows.controller");
const analytics_controller_1 = require("../controllers/analytics.controller");
const datasets_controller_1 = require("../controllers/datasets.controller");
const users_controller_1 = require("../controllers/users.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Protect all data routes
router.use(auth_1.authenticateToken);
// Contracts
router.get('/contracts', contracts_controller_1.getContracts);
router.post('/contracts', (0, auth_1.requirePermission)('contract:edit'), contracts_controller_1.createContract);
router.patch('/contracts/:id', (0, auth_1.requirePermission)('contract:edit'), contracts_controller_1.updateContract);
// Datasets
router.get('/datasets', datasets_controller_1.getDatasets);
router.post('/datasets', (0, auth_1.requirePermission)('dataset:manage'), datasets_controller_1.createDataset);
router.patch('/datasets/:id', (0, auth_1.requirePermission)('dataset:manage'), datasets_controller_1.updateDataset);
router.get('/datasets/:id/analytics', analytics_controller_1.getDatasetAnalytics);
// Workflows 
router.get('/workflows', workflows_controller_1.getWorkflows);
router.post('/workflows', (0, auth_1.requirePermission)('workflow:edit'), workflows_controller_1.createWorkflow);
router.patch('/workflows/:id', (0, auth_1.requirePermission)('workflow:edit'), workflows_controller_1.updateWorkflow);
router.delete('/workflows/:id', (0, auth_1.requirePermission)('workflow:edit'), workflows_controller_1.deleteWorkflow);
// Analytics
router.get('/analytics', analytics_controller_1.getAnalytics);
// Admin / Users
router.get('/users', users_controller_1.getUsers);
router.get('/audit-log', (0, auth_1.requireRole)(['Admin']), users_controller_1.getAuditLog);
router.post('/users/invite', (0, auth_1.requireRole)(['Admin']), users_controller_1.inviteUser);
router.patch('/users/update-role', (0, auth_1.requireRole)(['Admin']), users_controller_1.updateUserRole);
router.patch('/users/deactivate', (0, auth_1.requireRole)(['Admin']), users_controller_1.deactivateUser);
exports.default = router;
