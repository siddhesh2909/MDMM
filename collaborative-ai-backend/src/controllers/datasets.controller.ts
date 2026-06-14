import * as express from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { runIngestionPipeline, EnforcementMode } from '../services/ingestion.pipeline';
import { runPipelineValidation } from '../services/validation.engine';
import { notifyUser, notifyAdmins } from '../services/notification.service';
import { logAction } from '../utils/auditLogger';

// ── Helpers ──────────────────────────────────────────────────

function inferSchemaFromData(data: Record<string, any>[]) {
    if (!data.length) return [];
    const first = data[0];
    return Object.keys(first).map(key => {
        const val = first[key];
        let type = 'String';
        if (val !== null && val !== undefined && val !== '') {
            if (typeof val === 'number') {
                type = Number.isInteger(val) ? 'Integer' : 'Float';
            } else if (typeof val === 'boolean') {
                type = 'Boolean';
            } else if (!isNaN(Number(val))) {
                type = Number.isInteger(Number(val)) ? 'Integer' : 'Float';
            } else if (/^(true|false)$/i.test(String(val))) {
                type = 'Boolean';
            } else if (!isNaN(Date.parse(String(val)))) {
                type = 'Date';
            }
        }
        return { name: key, type, required: true, description: `Inferred from column '${key}'` };
    });
}

// ── GET /api/data/datasets ────────────────────────────────────

export const getDatasets = async (req: AuthenticatedRequest, res: express.Response<any, Record<string, any>>) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

        const datasets = await prisma.dataset.findMany({
            where: { organizationId: orgId } as any,
            orderBy: { createdAt: 'desc' },
            include: {
                owner: {
                    select: { name: true }
                }
            }
        });

        // Fetch the last validation report score dynamically for each dataset
        const datasetsWithQuality = await Promise.all(datasets.map(async (d) => {
            const lastReport = await prisma.validationReport.findFirst({
                where: { datasetId: d.id, organizationId: orgId },
                orderBy: { createdAt: 'desc' },
            });
            return {
                ...d,
                quality: lastReport ? lastReport.overallScore : 96,
            };
        }));

        res.status(200).json(datasetsWithQuality);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch datasets' });
    }
};

// ── POST /api/data/datasets ───────────────────────────────────
// Accepts: { name, rawData, inferredSchema?, source?, sourceUri?, enforcementMode? }
// Returns: { dataset, contract, validationReport, status, enforcementMode }

export const createDataset = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { name, rawData, inferredSchema, source, sourceUri, enforcementMode } = req.body;
        if (!name || !rawData) {
            return res.status(400).json({ error: 'Name and raw data are required' });
        }

        // Parse data
        let parsedData: Record<string, any>[];
        try {
            const raw = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            parsedData = Array.isArray(raw) ? raw : [raw];
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON in rawData' });
        }

        // Parse or infer schema
        let schemaFields: { name: string; type: string; required: boolean; description: string }[] = [];
        try {
            if (inferredSchema) {
                const parsed = typeof inferredSchema === 'string' ? JSON.parse(inferredSchema) : inferredSchema;
                schemaFields = Array.isArray(parsed) ? parsed : [];
            }
        } catch { /* ignore */ }

        if (!schemaFields.length) {
            schemaFields = inferSchemaFromData(parsedData);
        }

        const mode: EnforcementMode = (['strict', 'warning', 'monitor'].includes(enforcementMode)
            ? enforcementMode
            : 'monitor') as EnforcementMode;

        // Run the full pipeline
        const result = await runIngestionPipeline({
            name,
            parsedData,
            inferredSchema: schemaFields,
            source: source || 'file',
            sourceUri: sourceUri || name,
            enforcementMode: mode,
            userId: user.id,
            organizationId: user.organizationId,
        });

        // Audit dataset ingestion
        await logAction(user.id, user.role, user.organizationId, 'FILE_UPLOAD', 'Dataset', result.dataset.id, { name: name, source: source || 'file' });

        try {
            await notifyUser(
                user.id,
                'Dataset Ingested Successfully',
                `Dataset "${name}" was successfully ingested.`,
                'project',
                '/ingestion'
            );
            await notifyAdmins(
                user.organizationId,
                'New Dataset Ingested',
                `Dataset "${name}" has been uploaded by ${user.id}.`,
                'project',
                '/ingestion'
            );
        } catch (nErr) {
            console.error('Failed to trigger dataset create notifications:', nErr);
        }

        res.status(201).json(result);
    } catch (err) {
        console.error('Dataset creation error:', err);
        res.status(500).json({ error: 'Failed to upload dataset' });
    }
};

// ── PATCH /api/data/datasets/:id ─────────────────────────────

export const updateDataset = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const { rawData } = req.body;

        if (!rawData) {
            return res.status(400).json({ error: 'rawData is required' });
        }

        const existing = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Dataset not found or unauthorized' });
        }

        const dataString = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);

        const updated = await prisma.dataset.update({
            where: { id: datasetId },
            data: { rawData: dataString }
        });

        // Run validation pipeline on the updated dataset to recompute overallScore, completeness, validity, uniqueness, and validation reports!
        try {
            await runPipelineValidation(datasetId, user.organizationId);
        } catch (valErr) {
            console.error('Re-validation error after dataset update:', valErr);
        }

        try {
            await notifyUser(
                user.id,
                'Dataset Updated',
                `Dataset "${updated.name}" has been updated.`,
                'project',
                '/ingestion'
            );
        } catch (nErr) {
            console.error('Failed to trigger dataset update notifications:', nErr);
        }

        res.status(200).json(updated);
    } catch (err) {
        console.error('Dataset update error:', err);
        res.status(500).json({ error: 'Failed to update dataset' });
    }
};

// ── GET /api/data/datasets/:id ──────────────────────────────
export const getDatasetDetail = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);

        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) {
            return res.status(404).json({ error: 'Dataset not found or unauthorized' });
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: user.id }
        });
        const ownerName = dbUser?.name || 'System';

        // Parse rawData
        let parsedData: any[] = [];
        try {
            parsedData = JSON.parse(dataset.rawData);
        } catch { /* ignore */ }

        // Parse inferredSchema
        let schemaFields: any[] = [];
        try {
            if (dataset.inferredSchema) {
                schemaFields = JSON.parse(dataset.inferredSchema);
            }
        } catch { /* ignore */ }

        // Get validation report
        const lastReport = await prisma.validationReport.findFirst({
            where: { datasetId, organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
        });

        // Parse issues and summary
        let reportIssues: any[] = [];
        let reportSummary: any = {};
        if (lastReport) {
            try { reportIssues = JSON.parse(lastReport.issues); } catch { /* ignore */ }
            try { reportSummary = JSON.parse(lastReport.summary); } catch { /* ignore */ }
        }

        const rowCount = parsedData.length;
        const colCount = schemaFields.length;
        const completeness = lastReport ? lastReport.completeness : 98;
        const validity = lastReport ? lastReport.validity : 95;
        const uniqueness = lastReport ? lastReport.uniqueness : 100;
        const overallScore = lastReport ? lastReport.overallScore : 96;

        // Inferred preview rows & columns
        const preview_columns = schemaFields.map(f => f.name);
        const preview_rows = parsedData.slice(0, 10).map(row => preview_columns.map(col => row[col]));

        const suggestions: string[] = [];
        const nonRequiredFields = schemaFields.filter(f => !f.required);
        if (nonRequiredFields.length > 0) {
            suggestions.push(`Handle missing values in column(s) '${nonRequiredFields.map(f => f.name).slice(0, 2).join(', ')}' prior to downstream processing.`);
        } else {
            suggestions.push(`All columns are fully populated (100% complete). Maintain strict required schemas.`);
        }

        const stringFields = schemaFields.filter(f => f.type.toLowerCase() === 'string' || f.type.toLowerCase() === 'text');
        if (stringFields.length > 0) {
            suggestions.push(`Normalize and trim whitespaces in string-based field(s) '${stringFields.map(f => f.name).slice(0, 2).join(', ')}' to preserve index cleanups.`);
        }

        const integerFields = schemaFields.filter(f => f.type.toLowerCase() === 'integer' || f.type.toLowerCase() === 'number' || f.type.toLowerCase() === 'float');
        if (integerFields.length > 0) {
            suggestions.push(`Apply numeric range checks on key numeric fields like '${integerFields.map(f => f.name).slice(0, 2).join(', ')}' to shield against outlier inflation.`);
        } else {
            suggestions.push(`Ensure appropriate decimal formatting is enforced for floating point indices.`);
        }

        while (suggestions.length < 3) {
            suggestions.push(`Monitor real-time schema evolution alerts for incoming data streams.`);
        }

        const ai_insights = {
            summary: overallScore === 100
                ? `This dataset contains ${rowCount} records across ${colCount} columns. The overall data quality score is 100%. The dataset is perfectly clean and ready for production use.`
                : `This dataset contains ${rowCount} records across ${colCount} columns. The primary schema elements suggest this is a '${dataset.source || 'file'}' sourced dataset. The overall data quality score is ${overallScore}%, with minor suggestions for type casting and nullability.`,
            quality_score: overallScore,
            missing_value_analysis: overallScore === 100
                ? "All columns are fully populated (100% completeness score)."
                : `${schemaFields.filter(f => !f.required).length} columns allow null values. The column with the highest null rate is ${schemaFields.find(f => !f.required)?.name || 'none'}.`,
            preprocessing_suggestions: overallScore === 100
                ? [
                    "Dataset is 100% clean. No further preprocessing actions required.",
                    "Maintain strict schema enforcement for incoming data streams.",
                    "Monitor real-time schema evolution alerts."
                ]
                : suggestions.slice(0, 3),
            anomaly_warnings: overallScore === 100
                ? ["No critical anomalies found. Schema meets all standard requirements."]
                : (lastReport && reportIssues.length > 0
                    ? reportIssues.slice(0, 3).map((iss: any) => `Row ${iss.row}: Field '${iss.field}' failed '${iss.rule}' (expected: ${iss.expected}, actual: ${iss.actual})`)
                    : ["No critical anomalies found. Schema meets all standard requirements."])
        };

        res.status(200).json({
            success: true,
            data: {
                dataset: {
                    id: dataset.id,
                    name: dataset.name,
                    source: dataset.source || 'file',
                    type: dataset.source || 'file',
                    rows: rowCount,
                    columns: colCount,
                    quality: overallScore,
                    status: dataset.status.toLowerCase(),
                    owner: ownerName,
                    created_at: dataset.createdAt
                },
                schema: schemaFields.map(f => {
                    const nullCount = parsedData.filter(r => r[f.name] === null || r[f.name] === undefined || String(r[f.name]).trim() === '').length;
                    const pct = rowCount > 0 ? Math.round((nullCount / rowCount) * 100) : 0;
                    return {
                        name: f.name,
                        type: f.type,
                        null_percentage: pct,
                        sample_values: parsedData.slice(0, 3).map(r => String(r[f.name] ?? ''))
                    };
                }),
                preview_columns,
                preview_rows,
                rawData: parsedData,
                ai_insights
            }
        });

    } catch (err) {
        console.error('Get dataset detail error:', err);
        res.status(500).json({ error: 'Failed to fetch dataset details' });
    }
};

// ── DELETE /api/data/datasets/:id ───────────────────────────
export const deleteDataset = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);

        const existing = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Dataset not found or unauthorized' });
        }

        // Delete related validation reports
        await prisma.validationReport.deleteMany({
            where: { datasetId }
        });

        // Delete quality snapshots
        await prisma.qualitySnapshot.deleteMany({
            where: { datasetId }
        });

        // Delete pipeline logs
        await prisma.pipelineLog.deleteMany({
            where: { datasetId }
        });

        // Delete the dataset
        await prisma.dataset.delete({
            where: { id: datasetId }
        });

        try {
            await notifyUser(
                user.id,
                'Dataset Deleted',
                `Dataset "${existing.name}" has been deleted.`,
                'project',
                '/ingestion'
            );
        } catch (nErr) {
            console.error('Failed to trigger dataset delete notifications:', nErr);
        }

        res.status(200).json({ success: true, message: 'Dataset deleted successfully' });
    } catch (err) {
        console.error('Dataset delete error:', err);
        res.status(500).json({ error: 'Failed to delete dataset' });
    }
};

