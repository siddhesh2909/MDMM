"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDataset = exports.createDataset = exports.getDatasets = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getDatasets = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const datasets = await prisma_1.default.dataset.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json(datasets);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch datasets' });
    }
};
exports.getDatasets = getDatasets;
const createDataset = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { name, rawData, inferredSchema } = req.body;
        if (!name || !rawData) {
            return res.status(400).json({ error: 'Name and raw data are required' });
        }
        // Parse and stringify right away to validate JSON format
        let parsedData;
        try {
            parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        }
        catch (e) {
            return res.status(400).json({ error: 'Invalid JSON data' });
        }
        // Ensure array
        if (!Array.isArray(parsedData)) {
            parsedData = [parsedData];
        }
        const dataString = JSON.stringify(parsedData);
        const inferredSchemaString = inferredSchema ? (typeof inferredSchema === 'string' ? inferredSchema : JSON.stringify(inferredSchema)) : "[]";
        const dataset = await prisma_1.default.dataset.create({
            data: {
                name,
                rawData: dataString,
                inferredSchema: inferredSchemaString,
                ownerId: user.id,
                organizationId: user.organizationId
            }
        });
        res.status(201).json(dataset);
    }
    catch (err) {
        console.error("Dataset creation error:", err);
        res.status(500).json({ error: 'Failed to upload dataset' });
    }
};
exports.createDataset = createDataset;
const updateDataset = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const datasetId = String(req.params.id);
        const { rawData } = req.body;
        if (!rawData) {
            return res.status(400).json({ error: 'rawData is required' });
        }
        // Verify ownership and organization
        const existing = await prisma_1.default.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Dataset not found or unauthorized' });
        }
        const dataString = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);
        const updated = await prisma_1.default.dataset.update({
            where: { id: datasetId },
            data: { rawData: dataString }
        });
        res.status(200).json(updated);
    }
    catch (err) {
        console.error("Dataset update error:", err);
        res.status(500).json({ error: 'Failed to update dataset' });
    }
};
exports.updateDataset = updateDataset;
