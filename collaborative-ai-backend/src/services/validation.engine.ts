import prisma from '../lib/prisma';

/**
 * Validation Engine Service
 * 
 * Validates dataset rows against a contract's schema definition.
 * Computes quality metrics: completeness, validity, uniqueness.
 * Returns structured validation report.
 */

export interface SchemaField {
    name: string;
    type: string;
    required: boolean;
    description?: string;
    format?: string;    // regex for format validation
    minValue?: number;
    maxValue?: number;
    enumValues?: string[];
}

export interface ValidationIssue {
    row: number;
    field: string;
    rule: string;
    expected: string;
    actual: string;
    severity: 'error' | 'warning';
}

export interface ValidationResult {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    passRate: number;
    completeness: number;
    validity: number;
    uniqueness: number;
    overallScore: number;
    issues: ValidationIssue[];
    summary: Record<string, number>; // counts by error category
}

// ── Type Validators ──

function isValidType(value: any, expectedType: string): boolean {
    if (value === null || value === undefined || value === '') return true; // null checks handled by required rule

    const strVal = String(value).trim();

    switch (expectedType) {
        case 'Integer':
            return /^-?\d+$/.test(strVal);
        case 'Float':
            return !isNaN(Number(strVal)) && strVal !== '';
        case 'Boolean':
            return /^(true|false|0|1|yes|no)$/i.test(strVal);
        case 'Date':
            if (!isNaN(Date.parse(strVal))) return true;
            return /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(strVal);
        case 'UUID':
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strVal);
        case 'Time':
            return /^\d{1,2}:\d{2}(:\d{2})?/.test(strVal);
        case 'String':
            return true;
        default:
            return true;
    }
}

function isValidFormat(value: string, format: string): boolean {
    if (!format) return true;
    try {
        const regex = new RegExp(format);
        return regex.test(value);
    } catch {
        return true;
    }
}

// ── Main Validation Function ──

export function validateDataAgainstSchema(
    data: Record<string, any>[],
    schemaFields: SchemaField[]
): ValidationResult {
    const issues: ValidationIssue[] = [];
    const summary: Record<string, number> = {};
    const fieldNames = schemaFields.map(f => f.name);

    let totalCells = 0;
    let nullCells = 0;
    let typeMismatchCount = 0;
    let totalTypeChecks = 0;

    // Track uniqueness per field
    const uniqueTrackers: Record<string, Set<string>> = {};
    const uniqueFields = schemaFields.filter(f => f.name === 'id' || f.name === 'email' || f.name.endsWith('_id'));
    uniqueFields.forEach(f => { uniqueTrackers[f.name] = new Set(); });

    const invalidRowIndices = new Set<number>();

    data.forEach((row, rowIdx) => {
        schemaFields.forEach(field => {
            const value = row[field.name];
            totalCells++;

            // 1. Required check
            if (field.required && (value === null || value === undefined || String(value).trim() === '')) {
                issues.push({
                    row: rowIdx,
                    field: field.name,
                    rule: 'required',
                    expected: 'non-empty value',
                    actual: String(value ?? 'null'),
                    severity: 'error'
                });
                summary['required'] = (summary['required'] || 0) + 1;
                invalidRowIndices.add(rowIdx);
                nullCells++;
                return;
            }

            // Count nulls for completeness
            if (value === null || value === undefined || String(value).trim() === '') {
                nullCells++;
                return;
            }

            // 2. Type check
            totalTypeChecks++;
            if (!isValidType(value, field.type)) {
                typeMismatchCount++;
                issues.push({
                    row: rowIdx,
                    field: field.name,
                    rule: 'type_mismatch',
                    expected: field.type,
                    actual: `"${String(value).slice(0, 50)}"`,
                    severity: 'error'
                });
                summary['type_mismatch'] = (summary['type_mismatch'] || 0) + 1;
                invalidRowIndices.add(rowIdx);
            }

            // 3. Format check
            if (field.format && typeof value === 'string') {
                if (!isValidFormat(value, field.format)) {
                    issues.push({
                        row: rowIdx,
                        field: field.name,
                        rule: 'invalid_format',
                        expected: `match pattern: ${field.format}`,
                        actual: String(value).slice(0, 50),
                        severity: 'warning'
                    });
                    summary['invalid_format'] = (summary['invalid_format'] || 0) + 1;
                }
            }

            // 4. Range check
            if (field.minValue !== undefined || field.maxValue !== undefined) {
                const num = Number(value);
                if (!isNaN(num)) {
                    if (field.minValue !== undefined && num < field.minValue) {
                        issues.push({ row: rowIdx, field: field.name, rule: 'out_of_range', expected: `>= ${field.minValue}`, actual: String(num), severity: 'warning' });
                        summary['out_of_range'] = (summary['out_of_range'] || 0) + 1;
                    }
                    if (field.maxValue !== undefined && num > field.maxValue) {
                        issues.push({ row: rowIdx, field: field.name, rule: 'out_of_range', expected: `<= ${field.maxValue}`, actual: String(num), severity: 'warning' });
                        summary['out_of_range'] = (summary['out_of_range'] || 0) + 1;
                    }
                }
            }

            // 5. Enum check
            if (field.enumValues && field.enumValues.length > 0) {
                if (!field.enumValues.includes(String(value))) {
                    issues.push({ row: rowIdx, field: field.name, rule: 'invalid_enum', expected: field.enumValues.join(', '), actual: String(value).slice(0, 50), severity: 'warning' });
                    summary['invalid_enum'] = (summary['invalid_enum'] || 0) + 1;
                }
            }

            // 6. Uniqueness tracking
            if (uniqueTrackers[field.name]) {
                const key = String(value);
                if (uniqueTrackers[field.name].has(key)) {
                    issues.push({ row: rowIdx, field: field.name, rule: 'duplicate', expected: 'unique value', actual: key.slice(0, 50), severity: 'warning' });
                    summary['duplicate'] = (summary['duplicate'] || 0) + 1;
                }
                uniqueTrackers[field.name].add(key);
            }
        });
    });

    const totalRows = data.length;
    const invalidRows = invalidRowIndices.size;
    const validRows = totalRows - invalidRows;
    const passRate = totalRows > 0 ? (validRows / totalRows) * 100 : 100;

    const completeness = totalCells > 0 ? ((totalCells - nullCells) / totalCells) * 100 : 100;
    const validity = totalTypeChecks > 0 ? ((totalTypeChecks - typeMismatchCount) / totalTypeChecks) * 100 : 100;

    // Uniqueness: average across tracked fields
    let uniqueness = 100;
    if (Object.keys(uniqueTrackers).length > 0 && totalRows > 0) {
        const uniqueRatios = Object.entries(uniqueTrackers).map(([_, set]) => (set.size / totalRows) * 100);
        uniqueness = uniqueRatios.reduce((a, b) => a + b, 0) / uniqueRatios.length;
    }

    const overallScore = Math.round(completeness * 0.3 + validity * 0.3 + uniqueness * 0.2 + passRate * 0.2);

    return {
        totalRows,
        validRows,
        invalidRows,
        passRate: Math.round(passRate * 100) / 100,
        completeness: Math.round(completeness * 100) / 100,
        validity: Math.round(validity * 100) / 100,
        uniqueness: Math.round(uniqueness * 100) / 100,
        overallScore,
        issues: issues.slice(0, 500), // Cap at 500 issues to prevent huge payloads
        summary,
    };
}

// ── Pipeline Validation (auto-run after ingestion) ──

export async function runPipelineValidation(
    datasetId: string,
    organizationId: string
): Promise<{ reportId: string; result: ValidationResult; mode: string } | null> {
    // 1. Load dataset
    const dataset = await prisma.dataset.findFirst({
        where: { id: datasetId, organizationId }
    });
    if (!dataset) return null;

    // 2. Find matching contract
    let contract;
    if (dataset.boundContractId) {
        contract = await prisma.dataContract.findFirst({
            where: { id: dataset.boundContractId, organizationId }
        });
    }

    // Try to find by name similarity
    if (!contract) {
        const baseName = dataset.name.replace(/\.(csv|json|xlsx|xls)$/i, '').replace(/[\s_-]+/g, ' ').toLowerCase();
        const allContracts = await prisma.dataContract.findMany({
            where: { organizationId, status: 'Active' }
        });
        contract = allContracts.find(c =>
            c.name.toLowerCase().includes(baseName) || baseName.includes(c.name.toLowerCase())
        );
    }

    // Robust Fallback: If no contract found, find any existing contract or auto-create a default one
    if (!contract) {
        contract = await prisma.dataContract.findFirst({
            where: { organizationId }
        });

        if (!contract) {
            // Create a default contract based on inferredSchema or inferred columns from rawData
            let parsedData: any[] = [];
            try {
                parsedData = JSON.parse(dataset.rawData);
                if (!Array.isArray(parsedData)) parsedData = [parsedData];
            } catch { /* ignore */ }

            let inferredSchemaFields = dataset.inferredSchema ? JSON.parse(dataset.inferredSchema) : [];
            if (!inferredSchemaFields.length && parsedData.length > 0) {
                const first = parsedData[0];
                inferredSchemaFields = Object.keys(first).map(key => {
                    const val = first[key];
                    let type = 'String';
                    if (val !== null && val !== undefined && val !== '') {
                        if (typeof val === 'number') {
                            type = Number.isInteger(val) ? 'Integer' : 'Float';
                        } else if (typeof val === 'boolean') {
                            type = 'Boolean';
                        }
                    }
                    return { name: key, type, required: true, description: `Inferred from column '${key}'` };
                });
            }

            contract = await prisma.dataContract.create({
                data: {
                    name: `${dataset.name.replace(/\.(csv|json|xlsx|xls)$/i, '')} Contract`,
                    domain: 'Ingestion',
                    ownerName: 'System',
                    ownerId: dataset.ownerId,
                    organizationId,
                    version: '1.0.0',
                    status: 'Draft',
                    schemaDef: JSON.stringify(inferredSchemaFields),
                    enforcementMode: 'warning',
                } as any
            });
        }

        // Bind the contract back to the dataset
        await prisma.dataset.update({
            where: { id: dataset.id },
            data: { boundContractId: contract.id }
        });
    }

    // 3. Parse data and schema
    let data: Record<string, any>[];
    try {
        data = JSON.parse(dataset.rawData);
        if (!Array.isArray(data)) data = [data];
    } catch { return null; }

    let schemaFields: SchemaField[];
    try {
        schemaFields = typeof contract.schemaDef === 'string'
            ? JSON.parse(contract.schemaDef)
            : contract.schemaDef;
    } catch { return null; }

    // 4. Run validation
    const result = validateDataAgainstSchema(data, schemaFields);
    const mode = (contract as any).enforcementMode || 'warning';

    // 5. Save report
    const report = await prisma.validationReport.create({
        data: {
            datasetId,
            contractId: contract.id,
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
            organizationId,
        }
    });

    // 6. Update dataset status
    const newStatus = result.invalidRows > 0 && mode === 'strict'
        ? 'FAILED_VALIDATION'
        : 'VALIDATED';

    await prisma.dataset.update({
        where: { id: datasetId },
        data: { status: newStatus, boundContractId: contract.id }
    });

    // 7. Save quality snapshot
    const freshness = 100; // just ingested = perfectly fresh
    await prisma.qualitySnapshot.create({
        data: {
            datasetId,
            completeness: result.completeness,
            validity: result.validity,
            uniqueness: result.uniqueness,
            freshness,
            overallScore: result.overallScore,
        }
    });

    // 8. Log
    await prisma.pipelineLog.create({
        data: {
            logType: 'validation',
            severity: result.invalidRows > 0 ? (mode === 'strict' ? 'error' : 'warning') : 'info',
            message: `Validated "${dataset.name}" against "${contract.name}" v${contract.version}: ${result.validRows}/${result.totalRows} rows passed (${result.passRate}%)`,
            datasetId,
            contractId: contract.id,
            metadata: JSON.stringify({ mode, score: result.overallScore }),
            organizationId,
        }
    });

    return { reportId: report.id, result, mode };
}
