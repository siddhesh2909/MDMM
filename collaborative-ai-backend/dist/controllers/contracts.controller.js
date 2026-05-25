"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateContract = exports.createContract = exports.getContracts = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getContracts = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId)
            return res.status(401).json({ error: 'Unauthorized' });
        const contracts = await prisma_1.default.dataContract.findMany({
            where: { organizationId: orgId },
            orderBy: { updatedAt: 'desc' }
        });
        res.status(200).json(contracts);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch contracts' });
    }
};
exports.getContracts = getContracts;
const createContract = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { name, domain, version, schemaDef } = req.body;
        const contract = await prisma_1.default.dataContract.create({
            data: {
                name,
                domain,
                ownerName: user.id, // Using ID or looking up name if preferred
                ownerId: user.id,
                organizationId: user.organizationId,
                version: version || '1.0.0',
                schemaDef: typeof schemaDef === 'string' ? schemaDef : JSON.stringify(schemaDef)
            }
        });
        res.status(201).json(contract);
    }
    catch (err) {
        console.error("Contract creation error:", err);
        res.status(500).json({ error: 'Failed to create contract' });
    }
};
exports.createContract = createContract;
const updateContract = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        const contractId = String(req.params.id);
        const { name, version, schemaDef } = req.body;
        // Verify organization
        const existing = await prisma_1.default.dataContract.findFirst({
            where: { id: contractId, organizationId: user.organizationId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Contract not found or unauthorized.' });
        }
        const contract = await prisma_1.default.dataContract.update({
            where: { id: contractId },
            data: {
                ...(name && { name: String(name) }),
                ...(version && { version: String(version) }),
                ...(schemaDef !== undefined && { schemaDef: typeof schemaDef === 'string' ? schemaDef : JSON.stringify(schemaDef) })
            }
        });
        res.status(200).json(contract);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update contract' });
    }
};
exports.updateContract = updateContract;
