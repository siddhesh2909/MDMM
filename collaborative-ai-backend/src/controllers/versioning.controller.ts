import * as express from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { notifyAll } from '../services/notification.service';

/**
 * Versioning Controller
 * - Create version snapshot
 * - Get version history
 * - Compare versions
 * - Rollback to previous version
 */

// POST /api/data/contracts/:id/version — snapshot current version
export const createVersion = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const contractId = String(req.params.id);
        const { changeLog } = req.body;

        const contract = await prisma.dataContract.findFirst({
            where: { id: contractId, organizationId: user.organizationId }
        });
        if (!contract) return res.status(404).json({ error: 'Contract not found' });

        // Save snapshot
        const version = await prisma.contractVersion.create({
            data: {
                contractId,
                version: contract.version,
                schemaDef: contract.schemaDef,
                changeLog: changeLog || `Version ${contract.version} snapshot`,
                changedBy: user.id,
            }
        });

        try {
            await notifyAll(
                user.organizationId,
                'New Contract Version Snapshot',
                `A new version snapshot (${contract.version}) of contract "${contract.name}" was created.`,
                'project',
                '/data-contracts'
            );
        } catch (nErr) {
            console.error('Failed to trigger contract version notifications:', nErr);
        }

        res.status(201).json(version);
    } catch (err) {
        console.error('Create version error:', err);
        res.status(500).json({ error: 'Failed to create version' });
    }
};

// GET /api/data/contracts/:id/versions — list all versions
export const getVersions = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const contractId = String(req.params.id);

        const versions = await prisma.contractVersion.findMany({
            where: { contractId },
            orderBy: { createdAt: 'desc' },
        });

        const parsed = versions.map(v => ({
            ...v,
            schemaDef: JSON.parse(v.schemaDef),
        }));

        res.status(200).json(parsed);
    } catch (err) {
        console.error('Get versions error:', err);
        res.status(500).json({ error: 'Failed to fetch versions' });
    }
};

// GET /api/data/contracts/:id/versions/compare?v1=X&v2=Y
export const compareVersions = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const contractId = String(req.params.id);
        const v1 = String(req.query.v1);
        const v2 = String(req.query.v2);

        if (!v1 || !v2) return res.status(400).json({ error: 'Both v1 and v2 query params are required' });

        const [version1, version2] = await Promise.all([
            prisma.contractVersion.findFirst({ where: { contractId, version: v1 } }),
            prisma.contractVersion.findFirst({ where: { contractId, version: v2 } }),
        ]);

        if (!version1 || !version2) return res.status(404).json({ error: 'One or both versions not found' });

        const schema1 = JSON.parse(version1.schemaDef);
        const schema2 = JSON.parse(version2.schemaDef);

        const fields1 = new Map<string, any>(schema1.map((f: any) => [f.name, f]));
        const fields2 = new Map<string, any>(schema2.map((f: any) => [f.name, f]));

        const added: any[] = [];
        const removed: any[] = [];
        const changed: any[] = [];
        const unchanged: any[] = [];

        // Find added and changed
        fields2.forEach((field, name) => {
            if (!fields1.has(name)) {
                added.push(field);
            } else {
                const oldField = fields1.get(name);
                if (JSON.stringify(oldField) !== JSON.stringify(field)) {
                    changed.push({ field: name, from: oldField, to: field });
                } else {
                    unchanged.push(field);
                }
            }
        });

        // Find removed
        fields1.forEach((field, name) => {
            if (!fields2.has(name)) {
                removed.push(field);
            }
        });

        // Find affected datasets
        const affectedDatasets = await prisma.dataset.findMany({
            where: { boundContractId: contractId, organizationId: user.organizationId },
            select: { id: true, name: true },
        });

        res.status(200).json({
            v1: { version: v1, fieldCount: schema1.length, createdAt: version1.createdAt },
            v2: { version: v2, fieldCount: schema2.length, createdAt: version2.createdAt },
            diff: { added, removed, changed, unchanged },
            affectedDatasets,
        });
    } catch (err) {
        console.error('Compare versions error:', err);
        res.status(500).json({ error: 'Failed to compare versions' });
    }
};

// POST /api/data/contracts/:id/rollback — rollback to a given version
export const rollbackVersion = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const contractId = String(req.params.id);
        const { targetVersion } = req.body;

        if (!targetVersion) return res.status(400).json({ error: 'targetVersion is required' });

        const contract = await prisma.dataContract.findFirst({
            where: { id: contractId, organizationId: user.organizationId }
        });
        if (!contract) return res.status(404).json({ error: 'Contract not found' });

        const versionSnapshot = await prisma.contractVersion.findFirst({
            where: { contractId, version: targetVersion }
        });
        if (!versionSnapshot) return res.status(404).json({ error: `Version ${targetVersion} not found` });

        // Save current as a version first
        await prisma.contractVersion.create({
            data: {
                contractId,
                version: contract.version,
                schemaDef: contract.schemaDef,
                changeLog: `Snapshot before rollback to ${targetVersion}`,
                changedBy: user.id,
            }
        });

        // Bump version number
        const parts = contract.version.split('.').map(Number);
        parts[1] = (parts[1] || 0) + 1;
        parts[2] = 0;
        const newVersion = parts.join('.');

        // Apply rollback
        const updated = await prisma.dataContract.update({
            where: { id: contractId },
            data: {
                schemaDef: versionSnapshot.schemaDef,
                version: newVersion,
            }
        });

        // Save the rollback as a new version
        await prisma.contractVersion.create({
            data: {
                contractId,
                version: newVersion,
                schemaDef: versionSnapshot.schemaDef,
                changeLog: `Rolled back to v${targetVersion}`,
                changedBy: user.id,
            }
        });

        // Log
        await prisma.pipelineLog.create({
            data: {
                logType: 'alert',
                severity: 'info',
                message: `Contract "${contract.name}" rolled back from v${contract.version} to v${targetVersion} (now v${newVersion})`,
                contractId,
                organizationId: user.organizationId,
            }
        });

        try {
            await notifyAll(
                user.organizationId,
                'Contract Rolled Back',
                `Contract "${contract.name}" was rolled back to v${targetVersion} (now v${newVersion}).`,
                'project',
                '/data-contracts'
            );
        } catch (nErr) {
            console.error('Failed to trigger contract rollback notifications:', nErr);
        }

        res.status(200).json(updated);
    } catch (err) {
        console.error('Rollback error:', err);
        res.status(500).json({ error: 'Failed to rollback version' });
    }
};
