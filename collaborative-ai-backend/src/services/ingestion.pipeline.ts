import prisma from '../lib/prisma';
import { validateDataAgainstSchema, SchemaField, ValidationResult } from './validation.engine';
import { createIngestionLineage } from '../controllers/lineage.controller';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type EnforcementMode = 'strict' | 'warning' | 'monitor';

export interface IngestionPipelineParams {
    name: string;
    parsedData: Record<string, any>[];
    inferredSchema: SchemaField[];
    source?: string;
    sourceUri?: string;
    enforcementMode?: EnforcementMode;
    userId: string;
    organizationId: string;
}

export interface IngestionPipelineResult {
    dataset: {
        id: string;
        name: string;
        status: string;
        storedRows: number;
    };
    contract: {
        id: string;
        name: string;
        version: string;
        autoCreated: boolean;
    };
    validationReport: {
        id: string;
        totalRows: number;
        validRows: number;
        invalidRows: number;
        passRate: number;
        overallScore: number;
        completeness: number;
        validity: number;
        uniqueness: number;
        errors: Array<{
            row: number;
            field: string;
            rule: string;
            expected: string;
            actual: string;
            severity: string;
        }>;
        summary: Record<string, number>;
    };
    enforcementMode: EnforcementMode;
    status: string;
}

// ─────────────────────────────────────────────────────────────
// Auto Contract Resolution
// ─────────────────────────────────────────────────────────────

async function resolveContract(
    name: string,
    schema: SchemaField[],
    userId: string,
    organizationId: string,
    enforcementMode: EnforcementMode
): Promise<{ contract: any; autoCreated: boolean }> {
    // 1. Check if a dataset with this name has a boundContractId
    const existingDataset = await prisma.dataset.findFirst({
        where: { name, organizationId, boundContractId: { not: null } },
        orderBy: { createdAt: 'desc' },
    });

    if (existingDataset?.boundContractId) {
        const contract = await prisma.dataContract.findFirst({
            where: { id: existingDataset.boundContractId, organizationId, status: 'Active' },
        });
        if (contract) return { contract, autoCreated: false };
    }

    // 2. Fuzzy match by name against Active contracts
    const baseName = name
        .replace(/\.(csv|json|xlsx|xls)$/i, '')
        .replace(/[\s_-]+/g, ' ')
        .toLowerCase()
        .trim();

    const activeContracts = await prisma.dataContract.findMany({
        where: { organizationId, status: 'Active' },
    });

    const matched = activeContracts.find(c => {
        const cName = c.name.toLowerCase();
        return cName.includes(baseName) || baseName.includes(cName);
    });

    if (matched) return { contract: matched, autoCreated: false };

    // 3. Create new contract from inferred schema
    const contractName = baseName
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') + ' Contract';

    const newContract = await prisma.dataContract.create({
        data: {
            name: contractName,
            domain: 'Ingestion',
            ownerName: userId,
            ownerId: userId,
            organizationId,
            version: '1.0.0',
            status: 'Draft',
            schemaDef: JSON.stringify(schema),
            enforcementMode,
        } as any,
    });

    return { contract: newContract, autoCreated: true };
}

// ─────────────────────────────────────────────────────────────
// Enforcement Mode: Filter data rows
// ─────────────────────────────────────────────────────────────

function applyEnforcement(
    parsedData: Record<string, any>[],
    validationResult: ValidationResult,
    mode: EnforcementMode
): { dataToStore: Record<string, any>[]; finalStatus: string } {
    if (mode !== 'strict') {
        return {
            dataToStore: parsedData,
            finalStatus: validationResult.invalidRows > 0 ? 'VALIDATED_WITH_WARNINGS' : 'VALIDATED',
        };
    }

    // Strict mode: collect invalid row indices from issues
    const invalidRowIndices = new Set<number>(
        validationResult.issues
            .filter(i => i.severity === 'error')
            .map(i => i.row)
    );

    const dataToStore = parsedData.filter((_, idx) => !invalidRowIndices.has(idx));

    const finalStatus =
        dataToStore.length === 0
            ? 'FAILED'
            : dataToStore.length < parsedData.length
            ? 'PARTIAL_SUCCESS'
            : 'VALIDATED';

    return { dataToStore, finalStatus };
}

// ─────────────────────────────────────────────────────────────
// Main Pipeline Orchestrator
// ─────────────────────────────────────────────────────────────

export async function runIngestionPipeline(
    params: IngestionPipelineParams
): Promise<IngestionPipelineResult> {
    const {
        name,
        parsedData,
        inferredSchema,
        source = 'file',
        sourceUri,
        enforcementMode = 'monitor',
        userId,
        organizationId,
    } = params;

    if (!parsedData.length) {
        throw new Error('No data provided to pipeline');
    }

    // ── Step 1: Resolve Contract ──────────────────────────────
    const { contract, autoCreated } = await resolveContract(
        name,
        inferredSchema,
        userId,
        organizationId,
        enforcementMode
    );

    // ── Step 2: Parse schema from contract ───────────────────
    let schemaFields: SchemaField[] = inferredSchema;
    try {
        schemaFields =
            typeof contract.schemaDef === 'string'
                ? JSON.parse(contract.schemaDef)
                : contract.schemaDef;
    } catch {
        // fall back to inferred schema
        schemaFields = inferredSchema;
    }

    // ── Step 3: Validate ──────────────────────────────────────
    const validationResult = validateDataAgainstSchema(parsedData, schemaFields);
    const contractEnforcement: EnforcementMode =
        (contract as any).enforcementMode || enforcementMode;

    // ── Step 4: Apply enforcement mode ───────────────────────
    const { dataToStore, finalStatus } = applyEnforcement(
        parsedData,
        validationResult,
        contractEnforcement
    );

    // ── Step 5: Save Dataset ──────────────────────────────────
    const dataset = await prisma.dataset.create({
        data: {
            name,
            rawData: JSON.stringify(dataToStore),
            inferredSchema: JSON.stringify(inferredSchema),
            source,
            sourceUri: sourceUri || name,
            status: finalStatus,
            boundContractId: contract.id,
            ownerId: userId,
            organizationId,
        },
    });

    // ── Step 6: Save Validation Report ────────────────────────
    const report = await prisma.validationReport.create({
        data: {
            datasetId: dataset.id,
            contractId: contract.id,
            contractVersion: contract.version,
            mode: contractEnforcement,
            totalRows: validationResult.totalRows,
            validRows: validationResult.validRows,
            invalidRows: validationResult.invalidRows,
            passRate: validationResult.passRate,
            completeness: validationResult.completeness,
            validity: validationResult.validity,
            uniqueness: validationResult.uniqueness,
            overallScore: validationResult.overallScore,
            issues: JSON.stringify(validationResult.issues.slice(0, 500)),
            summary: JSON.stringify(validationResult.summary),
            organizationId,
        },
    });

    // ── Step 7: Quality Snapshot ──────────────────────────────
    await prisma.qualitySnapshot.create({
        data: {
            datasetId: dataset.id,
            completeness: validationResult.completeness,
            validity: validationResult.validity,
            uniqueness: validationResult.uniqueness,
            freshness: 100,
            overallScore: validationResult.overallScore,
        },
    });

    // ── Step 8: Pipeline Log ──────────────────────────────────
    const logSeverity =
        finalStatus === 'FAILED'
            ? 'error'
            : validationResult.invalidRows > 0
            ? 'warning'
            : 'info';

    await prisma.pipelineLog.create({
        data: {
            logType: 'ingestion',
            severity: logSeverity,
            message: `Ingested "${name}" (${dataToStore.length}/${parsedData.length} rows stored) via "${contract.name}" v${contract.version} [${contractEnforcement}] — pass rate: ${validationResult.passRate}%`,
            datasetId: dataset.id,
            contractId: contract.id,
            metadata: JSON.stringify({
                source,
                storedRows: dataToStore.length,
                totalRows: parsedData.length,
                passRate: validationResult.passRate,
                mode: contractEnforcement,
                autoContractCreated: autoCreated,
            }),
            organizationId,
        },
    });

    // ── Step 9: Lineage ───────────────────────────────────────
    try {
        await createIngestionLineage(
            organizationId,
            dataset.id,
            name,
            source,
            sourceUri || name,
            contract.id,
            contract.name,
            dataToStore.length
        );
    } catch (e) {
        console.error('Lineage creation error (non-blocking):', e);
    }

    // ── Return ────────────────────────────────────────────────
    return {
        dataset: {
            id: dataset.id,
            name: dataset.name,
            status: finalStatus,
            storedRows: dataToStore.length,
        },
        contract: {
            id: contract.id,
            name: contract.name,
            version: contract.version,
            autoCreated,
        },
        validationReport: {
            id: report.id,
            totalRows: validationResult.totalRows,
            validRows: validationResult.validRows,
            invalidRows: validationResult.invalidRows,
            passRate: validationResult.passRate,
            overallScore: validationResult.overallScore,
            completeness: validationResult.completeness,
            validity: validationResult.validity,
            uniqueness: validationResult.uniqueness,
            errors: validationResult.issues.slice(0, 50).map(i => ({
                row: i.row,
                field: i.field,
                rule: i.rule,
                expected: i.expected,
                actual: i.actual,
                severity: i.severity,
            })),
            summary: validationResult.summary,
        },
        enforcementMode: contractEnforcement,
        status: finalStatus,
    };
}
