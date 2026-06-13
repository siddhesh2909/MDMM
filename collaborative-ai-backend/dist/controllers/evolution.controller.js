"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySuggestion = exports.getSchemaSuggestions = void 0;
exports.detectSchemaDrift = detectSchemaDrift;
const prisma_1 = __importDefault(require("../lib/prisma"));
const notification_service_1 = require("../services/notification.service");
/**
 * Schema Evolution Controller
 * Detects schema drift between incoming data and existing contracts.
 * Stores suggestions for users to approve/reject.
 */
// Detect drift: compare inferred schema vs contract schema
function detectSchemaDrift(inferredFields, contractFields) {
    const contractMap = new Map(contractFields.map(f => [f.name, f]));
    const inferredMap = new Map(inferredFields.map(f => [f.name, f]));
    const suggestions = [];
    // New fields in data not in contract
    inferredFields.forEach(field => {
        if (!contractMap.has(field.name)) {
            suggestions.push({
                action: 'add_field',
                field: field.name,
                type: field.type,
                reason: `New field "${field.name}" (${field.type}) detected in incoming data but not in contract.`,
                severity: 'warning',
            });
        }
    });
    // Fields in contract missing from data
    contractFields.forEach(field => {
        if (!inferredMap.has(field.name)) {
            suggestions.push({
                action: 'remove_field',
                field: field.name,
                type: field.type,
                reason: `Field "${field.name}" exists in contract but is missing from incoming data.`,
                severity: field.required ? 'error' : 'warning',
            });
        }
    });
    // Type changes
    inferredFields.forEach(field => {
        const contractField = contractMap.get(field.name);
        if (contractField && contractField.type !== field.type) {
            suggestions.push({
                action: 'change_type',
                field: field.name,
                fromType: contractField.type,
                toType: field.type,
                reason: `Field "${field.name}" type changed from ${contractField.type} to ${field.type}.`,
                severity: 'warning',
            });
        }
    });
    return suggestions;
}
// GET /api/data/contracts/:id/schema-suggestions
const getSchemaSuggestions = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const contractId = String(req.params.id);
        const contract = await prisma_1.default.dataContract.findFirst({
            where: { id: contractId, organizationId: user.organizationId }
        });
        if (!contract)
            return res.status(404).json({ error: 'Contract not found' });
        // Find datasets bound to this contract
        const datasets = await prisma_1.default.dataset.findMany({
            where: { boundContractId: contractId, organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
            take: 5,
        });
        if (datasets.length === 0) {
            return res.status(200).json({ suggestions: [], message: 'No datasets bound to this contract.' });
        }
        let contractFields;
        try {
            contractFields = typeof contract.schemaDef === 'string'
                ? JSON.parse(contract.schemaDef) : contract.schemaDef;
        }
        catch {
            return res.status(400).json({ error: 'Invalid contract schema' });
        }
        // Check latest dataset for drift
        const latestDataset = datasets[0];
        let inferredFields = [];
        try {
            if (latestDataset.inferredSchema) {
                inferredFields = JSON.parse(latestDataset.inferredSchema);
            }
            else {
                // Infer from raw data
                const rawData = JSON.parse(latestDataset.rawData);
                if (Array.isArray(rawData) && rawData.length > 0) {
                    const firstRow = rawData[0];
                    inferredFields = Object.keys(firstRow).map(key => ({
                        name: key,
                        type: inferType(firstRow[key]),
                    }));
                }
            }
        }
        catch { /* ignore */ }
        const suggestions = detectSchemaDrift(inferredFields, contractFields);
        res.status(200).json({
            contractId,
            contractName: contract.name,
            contractVersion: contract.version,
            datasetId: latestDataset.id,
            datasetName: latestDataset.name,
            suggestions,
            hasDrift: suggestions.length > 0,
        });
    }
    catch (err) {
        console.error('Schema suggestions error:', err);
        res.status(500).json({ error: 'Failed to detect schema changes' });
    }
};
exports.getSchemaSuggestions = getSchemaSuggestions;
// POST /api/data/contracts/:id/apply-suggestion
const applySuggestion = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const contractId = String(req.params.id);
        const { action, field, type, toType } = req.body;
        const contract = await prisma_1.default.dataContract.findFirst({
            where: { id: contractId, organizationId: user.organizationId }
        });
        if (!contract)
            return res.status(404).json({ error: 'Contract not found' });
        let schemaFields;
        try {
            schemaFields = typeof contract.schemaDef === 'string'
                ? JSON.parse(contract.schemaDef) : contract.schemaDef;
        }
        catch {
            return res.status(400).json({ error: 'Invalid schema' });
        }
        // Save current version as snapshot before modifying
        await prisma_1.default.contractVersion.create({
            data: {
                contractId,
                version: contract.version,
                schemaDef: contract.schemaDef,
                changeLog: `Before applying suggestion: ${action} ${field}`,
                changedBy: user.id,
            }
        });
        // Apply changes
        if (action === 'add_field') {
            schemaFields.push({ name: field, type: type || 'String', required: false, description: '' });
        }
        else if (action === 'remove_field') {
            schemaFields = schemaFields.filter(f => f.name !== field);
        }
        else if (action === 'change_type') {
            const idx = schemaFields.findIndex(f => f.name === field);
            if (idx >= 0)
                schemaFields[idx].type = toType || type;
        }
        else {
            return res.status(400).json({ error: `Unknown action: ${action}` });
        }
        // Bump patch version
        const parts = contract.version.split('.').map(Number);
        parts[2] = (parts[2] || 0) + 1;
        const newVersion = parts.join('.');
        const updated = await prisma_1.default.dataContract.update({
            where: { id: contractId },
            data: {
                schemaDef: JSON.stringify(schemaFields),
                version: newVersion,
            }
        });
        // Save new version snapshot
        await prisma_1.default.contractVersion.create({
            data: {
                contractId,
                version: newVersion,
                schemaDef: JSON.stringify(schemaFields),
                changeLog: `Applied suggestion: ${action} field "${field}"`,
                changedBy: user.id,
            }
        });
        // Log
        await prisma_1.default.pipelineLog.create({
            data: {
                logType: 'alert',
                severity: 'info',
                message: `Schema evolution: ${action} "${field}" on contract "${contract.name}" → v${newVersion}`,
                contractId,
                organizationId: user.organizationId,
            }
        });
        try {
            await (0, notification_service_1.notifyAll)(user.organizationId, 'Schema Suggestion Applied', `Schema suggestion applied to contract "${contract.name}": ${action} field "${field}" (now v${newVersion}).`, 'project', '/data-contracts');
        }
        catch (nErr) {
            console.error('Failed to trigger schema evolution notifications:', nErr);
        }
        res.status(200).json(updated);
    }
    catch (err) {
        console.error('Apply suggestion error:', err);
        res.status(500).json({ error: 'Failed to apply suggestion' });
    }
};
exports.applySuggestion = applySuggestion;
// Helper: infer type from a JS value
function inferType(value) {
    if (value === null || value === undefined)
        return 'String';
    if (typeof value === 'boolean')
        return 'Boolean';
    if (typeof value === 'number')
        return Number.isInteger(value) ? 'Integer' : 'Float';
    if (typeof value === 'string') {
        if (!isNaN(Date.parse(value)) && /\d{4}[-\/]/.test(value))
            return 'Date';
        if (/^-?\d+$/.test(value))
            return 'Integer';
        if (/^-?\d+\.\d+$/.test(value))
            return 'Float';
        if (/^(true|false)$/i.test(value))
            return 'Boolean';
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(value))
            return 'UUID';
    }
    return 'String';
}
