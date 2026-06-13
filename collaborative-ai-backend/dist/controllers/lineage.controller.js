"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFullLineage = exports.getDatasetLineage = void 0;
exports.createIngestionLineage = createIngestionLineage;
const prisma_1 = __importDefault(require("../lib/prisma"));
/**
 * Lineage Controller
 * Tracks data flow: source → dataset → contract → transformations → output
 */
// Create lineage nodes + edges during ingestion
async function createIngestionLineage(organizationId, datasetId, datasetName, source, sourceUri, contractId, contractName, rowCount) {
    try {
        // Source node
        const sourceNode = await prisma_1.default.lineageNode.create({
            data: {
                nodeType: 'source',
                label: `${source}: ${sourceUri}`,
                entityId: null,
                metadata: JSON.stringify({ sourceType: source, uri: sourceUri }),
                organizationId,
            }
        });
        // Dataset node
        const datasetNode = await prisma_1.default.lineageNode.create({
            data: {
                nodeType: 'dataset',
                label: datasetName,
                entityId: datasetId,
                metadata: JSON.stringify({ rowCount: rowCount || 0 }),
                organizationId,
            }
        });
        // Edge: source → dataset
        await prisma_1.default.lineageEdge.create({
            data: {
                sourceNodeId: sourceNode.id,
                targetNodeId: datasetNode.id,
                relationship: 'ingested_from',
                organizationId,
            }
        });
        // Contract node + edge (if contract was used)
        if (contractId && contractName) {
            const contractNode = await prisma_1.default.lineageNode.create({
                data: {
                    nodeType: 'contract',
                    label: contractName,
                    entityId: contractId,
                    metadata: JSON.stringify({ status: 'validated' }),
                    organizationId,
                }
            });
            await prisma_1.default.lineageEdge.create({
                data: {
                    sourceNodeId: datasetNode.id,
                    targetNodeId: contractNode.id,
                    relationship: 'validated_by',
                    organizationId,
                }
            });
        }
    }
    catch (err) {
        console.error('Lineage creation error:', err);
    }
}
// GET /api/data/datasets/:id/lineage
const getDatasetLineage = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const datasetId = String(req.params.id);
        // Find all nodes related to this dataset
        const datasetNode = await prisma_1.default.lineageNode.findFirst({
            where: { entityId: datasetId, organizationId: user.organizationId }
        });
        if (!datasetNode) {
            return res.status(200).json({ nodes: [], edges: [] });
        }
        // Find all edges connected to this node (as source or target)
        const edges = await prisma_1.default.lineageEdge.findMany({
            where: {
                organizationId: user.organizationId,
                OR: [
                    { sourceNodeId: datasetNode.id },
                    { targetNodeId: datasetNode.id },
                ]
            }
        });
        // Collect all node IDs
        const nodeIds = new Set();
        nodeIds.add(datasetNode.id);
        edges.forEach(e => {
            nodeIds.add(e.sourceNodeId);
            nodeIds.add(e.targetNodeId);
        });
        // Find connected nodes (two levels deep)
        const secondLevelEdges = await prisma_1.default.lineageEdge.findMany({
            where: {
                organizationId: user.organizationId,
                OR: [
                    { sourceNodeId: { in: Array.from(nodeIds) } },
                    { targetNodeId: { in: Array.from(nodeIds) } },
                ]
            }
        });
        secondLevelEdges.forEach(e => {
            nodeIds.add(e.sourceNodeId);
            nodeIds.add(e.targetNodeId);
        });
        const allEdges = [...edges, ...secondLevelEdges];
        // Deduplicate edges
        const uniqueEdges = Array.from(new Map(allEdges.map(e => [e.id, e])).values());
        // Fetch all nodes
        const nodes = await prisma_1.default.lineageNode.findMany({
            where: { id: { in: Array.from(nodeIds) } }
        });
        // Format response
        res.status(200).json({
            nodes: nodes.map(n => ({
                id: n.id,
                type: n.nodeType,
                label: n.label,
                entityId: n.entityId,
                metadata: JSON.parse(n.metadata),
                createdAt: n.createdAt,
            })),
            edges: uniqueEdges.map(e => ({
                id: e.id,
                source: e.sourceNodeId,
                target: e.targetNodeId,
                relationship: e.relationship,
                metadata: JSON.parse(e.metadata),
            })),
        });
    }
    catch (err) {
        console.error('Get lineage error:', err);
        res.status(500).json({ error: 'Failed to fetch lineage' });
    }
};
exports.getDatasetLineage = getDatasetLineage;
// GET /api/data/lineage/full — full org lineage graph
const getFullLineage = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const nodes = await prisma_1.default.lineageNode.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        const nodeIds = nodes.map(n => n.id);
        const edges = await prisma_1.default.lineageEdge.findMany({
            where: {
                organizationId: user.organizationId,
                sourceNodeId: { in: nodeIds },
            }
        });
        res.status(200).json({
            nodes: nodes.map(n => ({
                id: n.id,
                type: n.nodeType,
                label: n.label,
                entityId: n.entityId,
                metadata: JSON.parse(n.metadata),
            })),
            edges: edges.map(e => ({
                id: e.id,
                source: e.sourceNodeId,
                target: e.targetNodeId,
                relationship: e.relationship,
            })),
        });
    }
    catch (err) {
        console.error('Full lineage error:', err);
        res.status(500).json({ error: 'Failed to fetch lineage' });
    }
};
exports.getFullLineage = getFullLineage;
