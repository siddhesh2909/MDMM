import * as express from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { notifyUser, notifyAll, notifyAdmins } from '../services/notification.service';

export const getContracts = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const contracts = await prisma.dataContract.findMany({
            where: { organizationId: orgId } as any,
            orderBy: { updatedAt: 'desc' }
        });
        res.status(200).json(contracts);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch contracts' });
    }
}

export const createContract = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { name, domain, version, schemaDef, enforcementMode, autoCreated } = req.body;
        const validModes = ['strict', 'warning', 'monitor'];
        const contract = await prisma.dataContract.create({
            data: {
                name,
                domain: domain || 'Ingestion',
                ownerName: user.id,
                ownerId: user.id,
                organizationId: user.organizationId,
                version: version || '1.0.0',
                status: 'Draft',
                enforcementMode: validModes.includes(enforcementMode) ? enforcementMode : 'monitor',
                schemaDef: typeof schemaDef === 'string' ? schemaDef : JSON.stringify(schemaDef),
            } as any,
        });

        try {
            await notifyUser(
                user.id,
                'Data Contract Created',
                `You created data contract "${name}".`,
                'project',
                '/data-contracts'
            );
            await notifyAll(
                user.organizationId,
                'New Data Contract',
                `A new data contract "${name}" was created by ${user.id}.`,
                'project',
                '/data-contracts'
            );
        } catch (nErr) {
            console.error('Failed to trigger contract create notifications:', nErr);
        }

        res.status(201).json(contract);
    } catch (err) {
        console.error("Contract creation error:", err);
        res.status(500).json({ error: 'Failed to create contract' });
    }
}

export const updateContract = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const contractId = String(req.params.id);
        const { name, version, schemaDef, domain, enforcementMode } = req.body;
        const validModes = ['strict', 'warning', 'monitor'];

        const existing = await prisma.dataContract.findFirst({
            where: { id: contractId, organizationId: user.organizationId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Contract not found or unauthorized.' });
        }

        const contract = await prisma.dataContract.update({
            where: { id: contractId },
            data: {
                ...(name && { name: String(name) }),
                ...(domain && { domain: String(domain) }),
                ...(version && { version: String(version) }),
                ...(schemaDef !== undefined && { schemaDef: typeof schemaDef === 'string' ? schemaDef : JSON.stringify(schemaDef) }),
                ...(enforcementMode && validModes.includes(enforcementMode) && { enforcementMode }),
            } as any,
        });

        try {
            await notifyUser(
                user.id,
                'Data Contract Updated',
                `Contract "${contract.name}" has been updated.`,
                'project',
                '/data-contracts'
            );
        } catch (nErr) {
            console.error('Failed to trigger contract update notifications:', nErr);
        }

        res.status(200).json(contract);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update contract' });
    }
}

// GET /api/data/contracts/:id/latest
export const getLatestContract = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const contractId = String(req.params.id);

        const contract = await prisma.dataContract.findFirst({
            where: { id: contractId, organizationId: user.organizationId },
        });
        if (!contract) return res.status(404).json({ error: 'Contract not found' });

        // Fetch latest validation report for usage stats
        const latestReport = await prisma.validationReport.findFirst({
            where: { contractId, organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
        });

        const usageCount = await prisma.validationReport.count({
            where: { contractId, organizationId: user.organizationId },
        });

        res.status(200).json({
            ...contract,
            schemaDef: typeof contract.schemaDef === 'string' ? JSON.parse(contract.schemaDef) : contract.schemaDef,
            usageStats: {
                totalValidations: usageCount,
                lastValidatedAt: latestReport?.createdAt || null,
                lastPassRate: latestReport?.passRate || null,
            },
        });
    } catch (err) {
        console.error('Get latest contract error:', err);
        res.status(500).json({ error: 'Failed to fetch contract' });
    }
}

export const deleteContract = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const contractId = String(req.params.id);

        const existing = await prisma.dataContract.findFirst({
            where: { id: contractId, organizationId: user.organizationId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Contract not found or unauthorized.' });
        }

        await prisma.dataContract.delete({ where: { id: contractId } });

        try {
            await notifyUser(
                user.id,
                'Data Contract Deleted',
                `Contract "${existing.name}" has been deleted.`,
                'project',
                '/data-contracts'
            );
        } catch (nErr) {
            console.error('Failed to trigger contract delete notifications:', nErr);
        }

        res.status(200).json({ message: 'Contract deleted successfully.' });
    } catch (err) {
        console.error("Contract deletion error:", err);
        res.status(500).json({ error: 'Failed to delete contract' });
    }
}

export const duplicateContract = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const contractId = String(req.params.id);

        const existing = await prisma.dataContract.findFirst({
            where: { id: contractId, organizationId: user.organizationId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Contract not found or unauthorized.' });
        }

        const duplicate = await prisma.dataContract.create({
            data: {
                name: `${existing.name} (Copy)`,
                domain: existing.domain,
                ownerName: user.id,
                ownerId: user.id,
                organizationId: user.organizationId,
                version: '1.0.0',
                schemaDef: existing.schemaDef,
                status: 'Draft'
            }
        });

        try {
            await notifyUser(
                user.id,
                'Data Contract Duplicated',
                `Contract "${existing.name}" has been duplicated as "${duplicate.name}".`,
                'project',
                '/data-contracts'
            );
        } catch (nErr) {
            console.error('Failed to trigger contract duplicate notifications:', nErr);
        }

        res.status(201).json(duplicate);
    } catch (err) {
        console.error("Contract duplication error:", err);
        res.status(500).json({ error: 'Failed to duplicate contract' });
    }
}

export const toggleContractStatus = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const contractId = String(req.params.id);

        const existing = await prisma.dataContract.findFirst({
            where: { id: contractId, organizationId: user.organizationId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Contract not found or unauthorized.' });
        }

        const newStatus = existing.status === 'Active' ? 'Draft' : 'Active';

        const updated = await prisma.dataContract.update({
            where: { id: contractId },
            data: { status: newStatus }
        });

        try {
            await notifyAll(
                user.organizationId,
                `Data Contract ${newStatus === 'Active' ? 'Activated' : 'Deactivated'}`,
                `Contract "${existing.name}" status has been set to ${newStatus}.`,
                'approval',
                '/data-contracts'
            );
        } catch (nErr) {
            console.error('Failed to trigger contract status toggle notifications:', nErr);
        }

        res.status(200).json(updated);
    } catch (err) {
        console.error("Contract status toggle error:", err);
        res.status(500).json({ error: 'Failed to toggle contract status' });
    }
}

// GET /api/data/contracts-dashboard-stats
export const getContractsDashboardStats = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const totalContracts = await prisma.dataContract.count({
            where: { organizationId: orgId },
        });

        const activeContracts = await prisma.dataContract.count({
            where: { organizationId: orgId, status: 'Active' },
        });

        const datasets = await prisma.dataset.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
        });

        const sourceDistribution: Record<string, number> = {};
        datasets.forEach(ds => {
            const src = ds.source || 'file';
            sourceDistribution[src] = (sourceDistribution[src] || 0) + 1;
        });

        const activeSources = Object.keys(sourceDistribution).length;

        const recentImports = datasets.slice(0, 5).map(ds => ({
            id: ds.id,
            name: ds.name,
            source: ds.source || 'file',
            sourceUri: ds.sourceUri || ds.name,
            status: ds.status,
            createdAt: ds.createdAt,
            fieldCount: (() => {
                try {
                    const schema = ds.inferredSchema ? JSON.parse(ds.inferredSchema) : [];
                    return Array.isArray(schema) ? schema.length : 0;
                } catch { return 0; }
            })(),
        }));

        res.status(200).json({
            totalContracts,
            activeContracts,
            activeSources,
            totalImports: datasets.length,
            recentImports,
            sourceDistribution,
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};

// GET /api/data/contracts/:id/detail
export const getContractDetail = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const contractId = String(req.params.id);

        const contract = await prisma.dataContract.findFirst({
            where: { id: contractId, organizationId: orgId },
        });

        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }

        const latestDataset = await prisma.dataset.findFirst({
            where: { organizationId: orgId, boundContractId: contractId },
            orderBy: { createdAt: 'desc' },
        });

        let sampleRecords: any[] = [];
        let datasetInfo = null;

        if (latestDataset) {
            try {
                const rawData = JSON.parse(latestDataset.rawData);
                sampleRecords = Array.isArray(rawData) ? rawData.slice(0, 5) : [];
            } catch { /* ignore parse errors */ }

            datasetInfo = {
                id: latestDataset.id,
                name: latestDataset.name,
                source: latestDataset.source,
                sourceUri: latestDataset.sourceUri,
                status: latestDataset.status,
                createdAt: latestDataset.createdAt,
            };
        }

        let parsedSchema: any[] = [];
        try {
            parsedSchema = typeof contract.schemaDef === 'string'
                ? JSON.parse(contract.schemaDef)
                : contract.schemaDef;
        } catch { parsedSchema = []; }

        res.status(200).json({
            ...contract,
            schemaDef: parsedSchema,
            dataset: datasetInfo,
            sampleRecords,
        });
    } catch (err) {
        console.error('Contract detail error:', err);
        res.status(500).json({ error: 'Failed to fetch contract detail' });
    }
};
