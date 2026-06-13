"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValidationReport = exports.validateDataset = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const validation_engine_1 = require("../services/validation.engine");
const notification_service_1 = require("../services/notification.service");
/**
 * Validation Controller
 * - Validate a dataset against a specific contract
 * - Get validation reports for a dataset
 */
// POST /api/data/contracts/:id/validate-dataset
const validateDataset = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const contractId = String(req.params.id);
        const { datasetId } = req.body;
        if (!datasetId)
            return res.status(400).json({ error: 'datasetId is required' });
        // Load contract
        const contract = await prisma_1.default.dataContract.findFirst({
            where: { id: contractId, organizationId: user.organizationId }
        });
        if (!contract)
            return res.status(404).json({ error: 'Contract not found' });
        // Load dataset
        const dataset = await prisma_1.default.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });
        if (!dataset)
            return res.status(404).json({ error: 'Dataset not found' });
        // Parse
        let data;
        try {
            data = JSON.parse(dataset.rawData);
            if (!Array.isArray(data))
                data = [data];
        }
        catch {
            return res.status(400).json({ error: 'Dataset has invalid JSON data' });
        }
        let schemaFields;
        try {
            schemaFields = typeof contract.schemaDef === 'string'
                ? JSON.parse(contract.schemaDef) : contract.schemaDef;
        }
        catch {
            return res.status(400).json({ error: 'Contract has invalid schema' });
        }
        // Validate
        const result = (0, validation_engine_1.validateDataAgainstSchema)(data, schemaFields);
        const mode = contract.enforcementMode || 'warning';
        // Save report
        const report = await prisma_1.default.validationReport.create({
            data: {
                datasetId,
                contractId,
                contractVersion: contract.version,
                mode,
                totalRows: result.totalRows,
                validRows: result.validRows,
                invalidRows: result.invalidRows,
                passRate: result.passRate,
                completeness: result.completeness,
                validity: result.validity,
                uniqueness: result.uniqueness,
                overallScore: result.overallScore,
                issues: JSON.stringify(result.issues),
                summary: JSON.stringify(result.summary),
                organizationId: user.organizationId,
            }
        });
        // Update dataset
        const newStatus = result.invalidRows > 0 && mode === 'strict' ? 'FAILED_VALIDATION' : 'VALIDATED';
        await prisma_1.default.dataset.update({
            where: { id: datasetId },
            data: { status: newStatus, boundContractId: contractId }
        });
        // Quality snapshot
        await prisma_1.default.qualitySnapshot.create({
            data: {
                datasetId,
                completeness: result.completeness,
                validity: result.validity,
                uniqueness: result.uniqueness,
                freshness: 100,
                overallScore: result.overallScore,
            }
        });
        // Log
        await prisma_1.default.pipelineLog.create({
            data: {
                logType: 'validation',
                severity: result.invalidRows > 0 ? 'warning' : 'info',
                message: `Manual validation: "${dataset.name}" against "${contract.name}" — ${result.passRate}% pass rate`,
                datasetId,
                contractId,
                organizationId: user.organizationId,
            }
        });
        try {
            const hasErrors = result.invalidRows > 0;
            const titleStr = hasErrors ? 'Validation Failure' : 'Validation Succeeded';
            const msgStr = hasErrors
                ? `Dataset "${dataset.name}" failed contract "${contract.name}" validation with ${result.invalidRows} errors (${result.passRate}% pass rate).`
                : `Dataset "${dataset.name}" passed contract "${contract.name}" validation (${result.passRate}% pass rate).`;
            const notifType = hasErrors ? 'error' : 'approval';
            await (0, notification_service_1.notifyUser)(user.id, titleStr, msgStr, notifType, '/ingestion');
        }
        catch (nErr) {
            console.error('Failed to trigger validation notifications:', nErr);
        }
        res.status(200).json({
            reportId: report.id,
            mode,
            ...result,
        });
    }
    catch (err) {
        console.error('Validation error:', err);
        res.status(500).json({ error: 'Validation failed' });
    }
};
exports.validateDataset = validateDataset;
// GET /api/data/datasets/:id/validation-report
const getValidationReport = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const datasetId = String(req.params.id);
        const reports = await prisma_1.default.validationReport.findMany({
            where: { datasetId, organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        // Parse JSON fields
        const parsed = reports.map(r => ({
            ...r,
            issues: JSON.parse(r.issues),
            summary: JSON.parse(r.summary),
        }));
        res.status(200).json(parsed);
    }
    catch (err) {
        console.error('Get validation report error:', err);
        res.status(500).json({ error: 'Failed to fetch validation reports' });
    }
};
exports.getValidationReport = getValidationReport;
