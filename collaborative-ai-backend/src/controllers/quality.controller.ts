import * as express from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { canViewDataset } from '../utils/permission';

/**
 * Quality Controller
 * GET /api/data/datasets/:id/quality — per-dataset quality metrics
 * GET /api/data/quality/overview — org-wide quality dashboard
 */

export const getDatasetQuality = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);

        // Get dataset info first to check permission
        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId },
        });

        if (!dataset) {
            return res.status(404).json({ error: 'Dataset not found or unauthorized' });
        }

        if (!canViewDataset(dataset as any, user)) {
            return res.status(403).json({ error: 'Forbidden: You do not have access to view this dataset' });
        }

        // Get latest quality snapshot
        const snapshot = await prisma.qualitySnapshot.findFirst({
            where: { datasetId },
            orderBy: { recordedAt: 'desc' },
        });

        // Get quality history (last 10)
        const history = await prisma.qualitySnapshot.findMany({
            where: { datasetId },
            orderBy: { recordedAt: 'desc' },
            take: 10,
        });

        // Get latest validation report
        const latestReport = await prisma.validationReport.findFirst({
            where: { datasetId, organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
        });

        res.status(200).json({
            datasetId,
            datasetName: dataset.name,
            status: dataset?.status || 'INGESTED',
            current: snapshot ? {
                completeness: snapshot.completeness,
                validity: snapshot.validity,
                uniqueness: snapshot.uniqueness,
                freshness: snapshot.freshness,
                overallScore: snapshot.overallScore,
                recordedAt: snapshot.recordedAt,
            } : null,
            history: history.reverse(),
            lastValidation: latestReport ? {
                contractId: latestReport.contractId,
                contractVersion: latestReport.contractVersion,
                mode: latestReport.mode,
                passRate: latestReport.passRate,
                totalRows: latestReport.totalRows,
                validRows: latestReport.validRows,
                invalidRows: latestReport.invalidRows,
                createdAt: latestReport.createdAt,
            } : null,
        });
    } catch (err) {
        console.error('Get quality error:', err);
        res.status(500).json({ error: 'Failed to fetch quality metrics' });
    }
};

export const getQualityOverview = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const orgId = user.organizationId;

        // Get all datasets
        const datasets = await prisma.dataset.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
        });

        const filteredDatasets = datasets.filter(ds => canViewDataset(ds as any, user));

        // For each dataset, get latest quality snapshot
        const datasetHealth = await Promise.all(filteredDatasets.map(async (ds) => {
            const snapshot = await prisma.qualitySnapshot.findFirst({
                where: { datasetId: ds.id },
                orderBy: { recordedAt: 'desc' },
            });

            const latestReport = await prisma.validationReport.findFirst({
                where: { datasetId: ds.id, organizationId: orgId },
                orderBy: { createdAt: 'desc' },
            });

            return {
                datasetId: ds.id,
                name: ds.name,
                status: ds.status,
                score: snapshot?.overallScore ?? null,
                completeness: snapshot?.completeness ?? null,
                validity: snapshot?.validity ?? null,
                uniqueness: snapshot?.uniqueness ?? null,
                freshness: snapshot?.freshness ?? null,
                issueCount: latestReport?.invalidRows ?? 0,
                lastValidated: latestReport?.createdAt ?? null,
                updatedAt: ds.createdAt,
            };
        }));

        // Compute aggregate metrics
        const scoredDatasets = datasetHealth.filter(d => d.score !== null);
        const avgScore = scoredDatasets.length > 0
            ? Math.round(scoredDatasets.reduce((a, b) => a + (b.score || 0), 0) / scoredDatasets.length)
            : null;
        const avgCompleteness = scoredDatasets.length > 0
            ? Math.round(scoredDatasets.reduce((a, b) => a + (b.completeness || 0), 0) / scoredDatasets.length)
            : null;
        const avgValidity = scoredDatasets.length > 0
            ? Math.round(scoredDatasets.reduce((a, b) => a + (b.validity || 0), 0) / scoredDatasets.length)
            : null;
        const avgUniqueness = scoredDatasets.length > 0
            ? Math.round(scoredDatasets.reduce((a, b) => a + (b.uniqueness || 0), 0) / scoredDatasets.length)
            : null;

        res.status(200).json({
            totalDatasets: datasets.length,
            validatedDatasets: scoredDatasets.length,
            averageScore: avgScore,
            averageCompleteness: avgCompleteness,
            averageValidity: avgValidity,
            averageUniqueness: avgUniqueness,
            datasets: datasetHealth,
        });
    } catch (err) {
        console.error('Quality overview error:', err);
        res.status(500).json({ error: 'Failed to fetch quality overview' });
    }
};
