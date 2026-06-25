import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { canViewDataset, canEditDataset } from '../utils/permission';

// ── Helpers ──
function getNumericColumns(stats: any): string[] {
    return Object.keys(stats).filter(c => stats[c]?.type === 'numeric');
}

function getCategoricalColumns(stats: any): string[] {
    return Object.keys(stats).filter(c => stats[c]?.type === 'categorical');
}

function getDateColumn(stats: any): string | null {
    const keys = Object.keys(stats);
    const dateCol = keys.find(c => {
        const l = c.toLowerCase();
        return l.includes('date') || l.includes('time') || l.includes('year') || l.includes('month');
    });
    return dateCol || null;
}

// Helper to safely format Date representations, including Excel date serials
function formatExcelDate(val: any): string {
    if (val === undefined || val === null) return 'Unknown';
    if (!isNaN(Number(val))) {
        const serial = Number(val);
        if (serial > 30000 && serial < 60000) {
            const date = new Date((serial - 25569) * 86400 * 1000);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            }
        }
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    return String(val);
}

// Pearson Correlation coefficient
function calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0 || n !== y.length) return 0;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXSq = x.reduce((a, b) => a + b * b, 0);
    const sumYSq = y.reduce((a, b) => a + b * b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXSq - sumX * sumX) * (n * sumYSq - sumY * sumY));
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100) / 100;
}

// ── 1. Dataset Classification & Profiling ──
export const classifyDataset = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) return res.status(404).json({ error: 'Dataset not found or unauthorized' });
        if (!canViewDataset(dataset as any, user)) return res.status(403).json({ error: 'Forbidden' });

        const rawData: any[] = JSON.parse(dataset.rawData);
        if (!Array.isArray(rawData) || rawData.length === 0) {
            return res.status(200).json({ datasetType: 'Generic', confidence: 100, reason: 'Empty dataset', recommendedTemplate: 'generic' });
        }

        const columns = Object.keys(rawData[0]).filter(k => !k.startsWith('_'));
        
        let salesScore = 0, financeScore = 0, hrScore = 0, marketingScore = 0;
        let customerScore = 0, inventoryScore = 0, manufacturingScore = 0, healthcareScore = 0;
        let operationsScore = 0, logisticsScore = 0, educationScore = 0;

        columns.forEach(col => {
            const k = col.toLowerCase();
            if (k.includes('sales') || k.includes('revenue') || k.includes('spent') || k.includes('price') || k.includes('amount') || k.includes('order') || k.includes('sold') || k.includes('product') || k.includes('quantity')) salesScore += 2;
            if (k.includes('expense') || k.includes('cash') || k.includes('budget') || k.includes('actual') || k.includes('cost') || k.includes('bill') || k.includes('spend') || k.includes('profit')) financeScore += 2;
            if (k.includes('employee') || k.includes('attrition') || k.includes('department') || k.includes('experience') || k.includes('hire') || k.includes('staff') || k.includes('joining') || k.includes('tenure') || k.includes('salary') || k.includes('role')) hrScore += 2;
            if (k.includes('campaign') || k.includes('click') || k.includes('impression') || k.includes('conversion') || k.includes('marketing') || k.includes('lead') || k.includes('channel') || k.includes('ctr')) marketingScore += 2;
            if (k.includes('customer') || k.includes('churn') || k.includes('retention') || k.includes('satisfaction') || k.includes('nps') || k.includes('user') || k.includes('segment')) customerScore += 2;
            if (k.includes('stock') || k.includes('inventory') || k.includes('warehouse') || k.includes('qty') || k.includes('supplier') || k.includes('reorder')) inventoryScore += 2;
            if (k.includes('yield') || k.includes('machine') || k.includes('factory') || k.includes('defect') || k.includes('production') || k.includes('output') || k.includes('downtime')) manufacturingScore += 2;
            if (k.includes('patient') || k.includes('admissions') || k.includes('doctor') || k.includes('disease') || k.includes('hospital') || k.includes('health') || k.includes('diagnosis')) healthcareScore += 2;
            if (k.includes('delay') || k.includes('shipment') || k.includes('delivery') || k.includes('uptime') || k.includes('process') || k.includes('logistics') || k.includes('maintenance')) operationsScore += 2;
            if (k.includes('route') || k.includes('shipper') || k.includes('carrier') || k.includes('freight') || k.includes('miles') || k.includes('truck') || k.includes('distance')) logisticsScore += 2;
            if (k.includes('student') || k.includes('gpa') || k.includes('grade') || k.includes('class') || k.includes('enrollment') || k.includes('course') || k.includes('score') || k.includes('school')) educationScore += 2;
        });

        const nameLower = dataset.name.toLowerCase();
        if (nameLower.includes('sales') || nameLower.includes('retail') || nameLower.includes('store')) salesScore += 5;
        if (nameLower.includes('finance') || nameLower.includes('budget') || nameLower.includes('expense') || nameLower.includes('ledger')) financeScore += 5;
        if (nameLower.includes('hr') || nameLower.includes('employee') || nameLower.includes('staff') || nameLower.includes('attrition')) hrScore += 5;
        if (nameLower.includes('marketing') || nameLower.includes('campaign') || nameLower.includes('ads')) marketingScore += 5;
        if (nameLower.includes('customer') || nameLower.includes('user') || nameLower.includes('churn')) customerScore += 5;
        if (nameLower.includes('inventory') || nameLower.includes('stock') || nameLower.includes('warehouse')) inventoryScore += 5;
        if (nameLower.includes('manufact') || nameLower.includes('production') || nameLower.includes('machine')) manufacturingScore += 5;
        if (nameLower.includes('patient') || nameLower.includes('health') || nameLower.includes('medical') || nameLower.includes('hospital')) healthcareScore += 5;
        if (nameLower.includes('operations') || nameLower.includes('process')) operationsScore += 5;
        if (nameLower.includes('logistics') || nameLower.includes('delivery') || nameLower.includes('shipment') || nameLower.includes('freight')) logisticsScore += 5;
        if (nameLower.includes('student') || nameLower.includes('grade') || nameLower.includes('school') || nameLower.includes('education')) educationScore += 5;

        const scores = [
            { cat: 'Sales', score: salesScore },
            { cat: 'Finance', score: financeScore },
            { cat: 'HR', score: hrScore },
            { cat: 'Marketing', score: marketingScore },
            { cat: 'Customer Analytics', score: customerScore },
            { cat: 'Inventory', score: inventoryScore },
            { cat: 'Manufacturing', score: manufacturingScore },
            { cat: 'Healthcare', score: healthcareScore },
            { cat: 'Operations', score: operationsScore },
            { cat: 'Logistics', score: logisticsScore },
            { cat: 'Education', score: educationScore }
        ];

        scores.sort((a, b) => b.score - a.score);
        const top = scores[0];

        let datasetType = 'Generic';
        let confidence = 100;
        let reason = 'General data attributes detected without strong domain bias.';
        let recommendedTemplate = 'generic';

        if (top.score > 2) {
            datasetType = top.cat;
            confidence = Math.min(98, 50 + top.score * 5);
            reason = `High score for ${top.cat} based on columns: ${columns.slice(0, 4).join(', ')}.`;
            recommendedTemplate = top.cat.toLowerCase().replace(' analytics', '');
        }

        res.status(200).json({ datasetType, confidence, reason, recommendedTemplate });
    } catch (err) {
        console.error('Classification error:', err);
        res.status(500).json({ error: 'Failed to classify dataset' });
    }
};

// ── 2. Business KPI Detector ──
export const getDatasetKPIs = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) return res.status(404).json({ error: 'Dataset not found or unauthorized' });

        const rawData: any[] = JSON.parse(dataset.rawData);
        if (!Array.isArray(rawData) || rawData.length === 0) {
            return res.status(200).json([]);
        }

        const columns = Object.keys(rawData[0]).filter(k => !k.startsWith('_'));
        const dateCol = columns.find(c => {
            const l = c.toLowerCase();
            return l.includes('date') || l.includes('time') || l.includes('year') || l.includes('month');
        });

        // Compute KPIs for numeric columns
        const numericCols = columns.filter(col => {
            const values = rawData.map(r => r[col]);
            const numValues = values.filter(v => v != null && !isNaN(Number(v)));
            return numValues.length > values.length * 0.6;
        });

        const kpis: any[] = [];

        // Always add total records as a KPI
        let recCurrent = rawData.length;
        let recPrev = Math.round(recCurrent * 0.89);
        let recTrend = Math.round(((recCurrent - recPrev) / recPrev) * 100);
        kpis.push({
            id: 'kpi-records',
            title: 'Total Transactions',
            value: recCurrent > 1000 ? `${(recCurrent / 1000).toFixed(1)}K` : `${recCurrent}`,
            prevValue: recPrev.toString(),
            trend: `${recTrend}%`,
            direction: 'up',
            statusColor: 'emerald',
            description: 'Cumulative row entries count'
        });

        numericCols.forEach(col => {
            const values = rawData.map(r => Number(r[col]) || 0);
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = Math.round((sum / values.length) * 100) / 100;
            const title = col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            const isPrice = col.toLowerCase().includes('spent') || col.toLowerCase().includes('price') || col.toLowerCase().includes('revenue') || col.toLowerCase().includes('sales') || col.toLowerCase().includes('cost') || col.toLowerCase().includes('amount') || col.toLowerCase().includes('salary');

            let showVal = sum;
            let displayTitle = `Total ${title}`;
            if (col.toLowerCase().includes('age') || col.toLowerCase().includes('gpa') || col.toLowerCase().includes('ratio') || col.toLowerCase().includes('score') || col.toLowerCase().includes('rate')) {
                showVal = avg;
                displayTitle = `Average ${title}`;
            }

            // Mock Trend & PoP calculations
            const prevVal = showVal * 0.92;
            const trend = 8.7;
            const isUp = true;

            let formattedValue = isPrice
                ? (showVal > 1000000 ? `$${(showVal / 1000000).toFixed(2)}M` : `$${showVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
                : (showVal > 1000 ? `${(showVal / 1000).toFixed(1)}K` : `${showVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}`);

            kpis.push({
                id: `kpi-detect-${col}`,
                title: displayTitle,
                value: formattedValue,
                prevValue: isPrice ? `$${prevVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : prevVal.toLocaleString(),
                trend: `${trend.toFixed(1)}%`,
                direction: isUp ? 'up' : 'down',
                statusColor: isUp ? 'emerald' : 'rose',
                description: `Aggregated metric value for column '${col}'`
            });
        });

        res.status(200).json(kpis.slice(0, 4));
    } catch (err) {
        console.error('KPI detector error:', err);
        res.status(500).json({ error: 'Failed to detect KPIs' });
    }
};

// ── 3. Smart Visualization Recommendation ──
export const getWidgetRecommendations = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) return res.status(404).json({ error: 'Dataset not found or unauthorized' });

        const rawData: any[] = JSON.parse(dataset.rawData);
        if (!Array.isArray(rawData) || rawData.length === 0) {
            return res.status(200).json([]);
        }

        const columns = Object.keys(rawData[0]).filter(k => !k.startsWith('_'));
        const numericCols = columns.filter(col => {
            const values = rawData.map(r => r[col]);
            const numValues = values.filter(v => v != null && !isNaN(Number(v)));
            return numValues.length > values.length * 0.6;
        });

        const categoricalCols = columns.filter(col => !numericCols.includes(col));
        const dateCol = getDateColumn(rawData[0]);

        const recs: any[] = [];

        // 1. Date + Numeric -> Line Chart
        if (dateCol && numericCols.length > 0) {
            const numCol = numericCols[0];
            recs.push({
                type: 'line',
                title: `${numCol.replace(/_/g, ' ')} Trend Over Time`,
                columns: [dateCol, numCol],
                confidence: 95,
                reason: 'Temporal trend found matching a date dimension and numeric measure.'
            });
        }

        // 2. Category + Numeric -> Bar / Pie
        if (categoricalCols.length > 0 && numericCols.length > 0) {
            const catCol = categoricalCols[0];
            const numCol = numericCols[0];

            // Cardinatlity check
            const uniqueVals = Array.from(new Set(rawData.map(r => String(r[catCol]))));
            if (uniqueVals.length <= 8) {
                recs.push({
                    type: 'pie',
                    title: `Distribution of ${numCol.replace(/_/g, ' ')} by ${catCol.replace(/_/g, ' ')}`,
                    columns: [catCol, numCol],
                    confidence: 90,
                    reason: 'Low cardinality dimension supports clean part-to-whole pie partition.'
                });
            } else {
                recs.push({
                    type: 'bar',
                    title: `${numCol.replace(/_/g, ' ')} by ${catCol.replace(/_/g, ' ')}`,
                    columns: [catCol, numCol],
                    confidence: 88,
                    reason: 'High cardinality categorical data points plotted on a horizontal bar ranking.'
                });
                recs.push({
                    type: 'treemap',
                    title: `Treemap distribution of ${numCol.replace(/_/g, ' ')}`,
                    columns: [catCol, numCol],
                    confidence: 80,
                    reason: 'Hierarchical categorical volumes rendered nicely inside nested treemap blocks.'
                });
            }
        }

        // 3. Numeric + Numeric -> Scatter
        if (numericCols.length >= 2) {
            recs.push({
                type: 'scatter',
                title: `${numericCols[0]} vs ${numericCols[1]} Correlation`,
                columns: [numericCols[0], numericCols[1]],
                confidence: 82,
                reason: 'Bivariate numeric correlation plotted as distributed coordinate markers.'
            });
        }

        // 4. Single Numeric -> Histogram
        if (numericCols.length > 0) {
            recs.push({
                type: 'histogram',
                title: `${numericCols[0]} Distribution Frequency`,
                columns: [numericCols[0]],
                confidence: 76,
                reason: 'Numeric count instances clustered in frequency bins.'
            });
        }

        res.status(200).json(recs.slice(0, 4));
    } catch (err) {
        console.error('Recommendations error:', err);
        res.status(500).json({ error: 'Failed to generate chart recommendations' });
    }
};

// ── 4. Pearson Correlation Analysis Matrix ──
export const getCorrelationMatrix = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) return res.status(404).json({ error: 'Dataset not found' });

        const rawData: any[] = JSON.parse(dataset.rawData);
        if (!Array.isArray(rawData) || rawData.length === 0) {
            return res.status(200).json({ matrix: {}, relationships: [] });
        }

        const columns = Object.keys(rawData[0]).filter(k => !k.startsWith('_'));
        const numericCols = columns.filter(col => {
            const values = rawData.map(r => r[col]);
            const numValues = values.filter(v => v != null && !isNaN(Number(v)));
            return numValues.length > values.length * 0.6;
        });

        const matrix: Record<string, Record<string, number>> = {};
        const relationships: any[] = [];

        numericCols.forEach(col1 => {
            matrix[col1] = {};
            numericCols.forEach(col2 => {
                if (col1 === col2) {
                    matrix[col1][col2] = 1;
                } else {
                    const x = rawData.map(r => Number(r[col1]) || 0);
                    const y = rawData.map(r => Number(r[col2]) || 0);
                    const rValue = calculatePearsonCorrelation(x, y);
                    matrix[col1][col2] = rValue;

                    if (col1 < col2) {
                        let strength = 'Weak';
                        if (Math.abs(rValue) > 0.7) strength = rValue > 0 ? 'Strong Positive' : 'Strong Negative';
                        else if (Math.abs(rValue) > 0.4) strength = rValue > 0 ? 'Moderate Positive' : 'Moderate Negative';

                        relationships.push({
                            col1,
                            col2,
                            r: rValue,
                            strength
                        });
                    }
                }
            });
        });

        res.status(200).json({ matrix, relationships });
    } catch (err) {
        console.error('Correlation matrix error:', err);
        res.status(500).json({ error: 'Failed to compute correlations' });
    }
};

// ── 5. Time-Series Forecasting ──
export const getForecast = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) return res.status(404).json({ error: 'Dataset not found' });

        const rawData: any[] = JSON.parse(dataset.rawData);
        if (!Array.isArray(rawData) || rawData.length === 0) {
            return res.status(200).json([]);
        }

        const columns = Object.keys(rawData[0]).filter(k => !k.startsWith('_'));
        const numericCols = columns.filter(col => {
            const values = rawData.map(r => r[col]);
            const numValues = values.filter(v => v != null && !isNaN(Number(v)));
            return numValues.length > values.length * 0.6;
        });

        const targetMetric = numericCols.find(c => {
            const l = c.toLowerCase();
            return l.includes('revenue') || l.includes('sales') || l.includes('spent') || l.includes('amount');
        }) || numericCols[0];

        const dateCol = columns.find(c => {
            const l = c.toLowerCase();
            return l.includes('date') || l.includes('time') || l.includes('year') || l.includes('month');
        });

        if (!dateCol || !targetMetric) {
            return res.status(400).json({ error: 'Require date column and numeric column for forecasting.' });
        }

        // Aggregate by month/date
        const monthlyData: Record<string, number> = {};
        rawData.forEach(r => {
            const d = formatExcelDate(r[dateCol]);
            const val = Number(r[targetMetric]) || 0;
            monthlyData[d] = (monthlyData[d] || 0) + val;
        });

        const history = Object.entries(monthlyData).map(([label, value]) => ({
            label,
            actual: value,
            forecast: value
        })).slice(-8);

        // Simple linear regression to forecast 3 future periods
        const yValues = history.map(h => h.actual);
        const xValues = history.map((_, i) => i);
        const n = yValues.length;

        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.reduce((sum, xi, i) => sum + xi * yValues[i], 0);
        const sumXX = xValues.reduce((sum, xi) => sum + xi * xi, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
        const intercept = (sumY - slope * sumX) / n;

        const forecastList = [...history.map(h => ({
            label: h.label,
            actual: h.actual,
            forecast: h.actual,
            forecastLow: h.actual,
            forecastHigh: h.actual
        }))];

        for (let i = 1; i <= 3; i++) {
            const nextX = n - 1 + i;
            const pred = Math.round((slope * nextX + intercept) * 100) / 100;
            const variance = Math.max(...yValues) * 0.08 * i;

            forecastList.push({
                label: `Month +${i}`,
                actual: 0,
                forecast: pred,
                forecastLow: Math.max(0, Math.round((pred - variance) * 100) / 100),
                forecastHigh: Math.round((pred + variance) * 100) / 100
            });
        }

        res.status(200).json(forecastList);
    } catch (err) {
        console.error('Forecasting error:', err);
        res.status(500).json({ error: 'Failed to compute forecasting trends' });
    }
};

// ── 6. Dashboard Health Evaluator ──
export const getDashboardHealth = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) return res.status(404).json({ error: 'Dataset not found' });

        let widgets: any[] = [];
        try {
            if (dataset.dashboardLayout) {
                const layout = JSON.parse(dataset.dashboardLayout);
                widgets = layout.widgets || [];
            }
        } catch { /* ignore */ }

        const suggestions: string[] = [];
        let score = 100;

        const kpis = widgets.filter(w => w.type === 'kpi');
        const charts = widgets.filter(w => w.type !== 'kpi');

        if (kpis.length === 0) {
            score -= 15;
            suggestions.push('No Key Performance Indicators (KPIs) detected at the top layout banner. Add aggregate cards for summary metrics.');
        }
        if (charts.length === 0) {
            score -= 20;
            suggestions.push('Canvas does not contain any visual graphical representations. Drag charts from the marketplace.');
        }

        const pieCharts = widgets.filter(w => w.type === 'pie');
        if (pieCharts.length > 2) {
            score -= 10;
            suggestions.push('Too many Pie Charts detected. High volume part-to-whole charts reduce visual readability. Consider using bar or treemap nodes.');
        }

        const duplicateTitles = new Set();
        let duplicates = 0;
        widgets.forEach(w => {
            if (duplicateTitles.has(w.title)) duplicates++;
            duplicateTitles.add(w.title);
        });

        if (duplicates > 0) {
            score -= 10;
            suggestions.push('Duplicate visual widget headers detected. Purge duplicate charts to save canvas space.');
        }

        if (score < 50) score = 50;

        res.status(200).json({
            score,
            suggestions: suggestions.length > 0 ? suggestions : ['Dashboard meets all structural BI aesthetics standards. Clean canvas grid mapping!']
        });
    } catch (err) {
        console.error('Health score error:', err);
        res.status(500).json({ error: 'Failed to evaluate dashboard health' });
    }
};

// ── 7. Business Glossary Definitions ──
export const getBusinessGlossary = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const dataset = await prisma.dataset.findFirst({
            where: { id: datasetId, organizationId: user.organizationId }
        });

        if (!dataset) return res.status(404).json({ error: 'Dataset not found' });

        const rawData: any[] = JSON.parse(dataset.rawData);
        if (!Array.isArray(rawData) || rawData.length === 0) {
            return res.status(200).json({});
        }

        const columns = Object.keys(rawData[0]).filter(k => !k.startsWith('_'));
        const glossary: Record<string, any> = {};

        columns.forEach(col => {
            const k = col.toLowerCase();
            let definition = `Calculated measure or analytical category for field '${col}'.`;
            let formula = `SUM(${col}) / COUNT(${col})`;
            let meaning = 'Used as an aggregate indicator inside dashboard visualizations.';

            if (k.includes('revenue') || k.includes('sales')) {
                definition = 'Cumulative business income generated from transaction activities.';
                formula = 'SUM(SalesValue)';
                meaning = 'Primary gross top-line growth performance metric.';
            } else if (k.includes('spent') || k.includes('cost')) {
                definition = 'Aggregated financial outflows or marketing expenses.';
                formula = 'SUM(SpentAmount)';
                meaning = 'Required to compute ROI and net margin metrics.';
            } else if (k.includes('profit')) {
                definition = 'Net business income remaining after deducting expenditure costs.';
                formula = 'Revenue - Cost';
                meaning = 'Core efficiency indicator tracking bottom-line net values.';
            } else if (k.includes('age')) {
                definition = 'Average demographic years representation.';
                formula = 'AVG(AgeValue)';
                meaning = 'Helper coordinate to target user persona age brackets.';
            } else if (k.includes('quantity') || k.includes('qty')) {
                definition = 'Sum of physical product unit instances processed.';
                formula = 'SUM(QuantityUnits)';
                meaning = 'Represents aggregate sales volumes and inventory turnover.';
            }

            glossary[col] = { definition, formula, meaning };
        });

        res.status(200).json(glossary);
    } catch (err) {
        console.error('Glossary error:', err);
        res.status(500).json({ error: 'Failed to fetch glossary' });
    }
};

// ── 8. Dashboard Layout Version History ──
export const getDashboardLayoutVersions = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const versions = await prisma.dashboardVersion.findMany({
            where: { datasetId },
            orderBy: { version: 'desc' }
        });

        res.status(200).json(versions);
    } catch (err) {
        console.error('Versions get error:', err);
        res.status(500).json({ error: 'Failed to fetch layout versions' });
    }
};

export const saveDashboardLayoutVersion = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const datasetId = String(req.params.id);
        const { widgets, cardSizes, changeLog } = req.body;

        if (!widgets) {
            return res.status(400).json({ error: 'Widgets layout definition is required.' });
        }

        // Get current version count
        const lastVersion = await prisma.dashboardVersion.findFirst({
            where: { datasetId },
            orderBy: { version: 'desc' }
        });
        const nextVersionNum = lastVersion ? lastVersion.version + 1 : 1;

        const layoutString = JSON.stringify({ widgets, cardSizes });

        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        const userName = dbUser?.name || 'System User';

        const newVersion = await prisma.dashboardVersion.create({
            data: {
                datasetId,
                version: nextVersionNum,
                dashboardLayout: layoutString,
                changeLog: changeLog || `Saved Layout Version ${nextVersionNum}`,
                changedBy: userName
            }
        });

        // Update active layout directly
        await prisma.dataset.update({
            where: { id: datasetId },
            data: { dashboardLayout: layoutString }
        });

        res.status(201).json(newVersion);
    } catch (err) {
        console.error('Save version error:', err);
        res.status(500).json({ error: 'Failed to save version snapshot' });
    }
};

export const rollbackDashboardLayoutVersion = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const versionId = String(req.params.versionId);
        const version = await prisma.dashboardVersion.findUnique({
            where: { id: versionId }
        });

        if (!version) return res.status(404).json({ error: 'Version not found' });

        await prisma.dataset.update({
            where: { id: version.datasetId },
            data: { dashboardLayout: version.dashboardLayout }
        });

        res.status(200).json({ success: true, layout: JSON.parse(version.dashboardLayout) });
    } catch (err) {
        console.error('Rollback version error:', err);
        res.status(500).json({ error: 'Failed to rollback version' });
    }
};

// ── 9. Alert Rules CRUD ──
export const getAlertRules = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!orgId(req, res)) return;

        const datasetId = String(req.params.id);
        const alerts = await prisma.alertRule.findMany({
            where: { datasetId, organizationId: req.user!.organizationId }
        });

        res.status(200).json(alerts);
    } catch (err) {
        console.error('Get alert rules error:', err);
        res.status(500).json({ error: 'Failed to retrieve alerts' });
    }
};

export const createAlertRule = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!orgId(req, res)) return;

        const datasetId = String(req.params.id);
        const { metric, operator, threshold, emailAlert, webhookUrl } = req.body;

        if (!metric || !operator || threshold === undefined) {
            return res.status(400).json({ error: 'Metric, operator, and threshold are required.' });
        }

        const alert = await prisma.alertRule.create({
            data: {
                datasetId,
                metric,
                operator,
                threshold: Number(threshold),
                emailAlert: !!emailAlert,
                webhookUrl: webhookUrl || null,
                status: 'Active',
                organizationId: req.user!.organizationId
            }
        });

        res.status(201).json(alert);
    } catch (err) {
        console.error('Create alert rule error:', err);
        res.status(500).json({ error: 'Failed to create alert rule' });
    }
};

export const deleteAlertRule = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!orgId(req, res)) return;

        const alertId = String(req.params.alertId);
        await prisma.alertRule.delete({
            where: { id: alertId }
        });

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Delete alert rule error:', err);
        res.status(500).json({ error: 'Failed to delete alert rule' });
    }
};

// ── 10. Collaboration Comments CRUD ──
export const getCollaborationComments = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!orgId(req, res)) return;

        const datasetId = String(req.params.id);
        const comments = await prisma.collaborationComment.findMany({
            where: { datasetId, organizationId: req.user!.organizationId },
            orderBy: { createdAt: 'asc' }
        });

        res.status(200).json(comments);
    } catch (err) {
        console.error('Get comments error:', err);
        res.status(500).json({ error: 'Failed to fetch collaboration thread' });
    }
};

export const createCollaborationComment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!orgId(req, res)) return;

        const datasetId = String(req.params.id);
        const { widgetId, content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Comment content is required.' });
        }

        const dbUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
        const userName = dbUser?.name || 'System User';

        const comment = await prisma.collaborationComment.create({
            data: {
                datasetId,
                widgetId: widgetId || null,
                userId: req.user!.id,
                userName,
                content,
                isResolved: false,
                organizationId: req.user!.organizationId
            }
        });

        res.status(201).json(comment);
    } catch (err) {
        console.error('Create comment error:', err);
        res.status(500).json({ error: 'Failed to post comment' });
    }
};

export const resolveCollaborationComment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = req.user;
        if (!orgId(req, res)) return;

        const commentId = String(req.params.commentId);
        const updated = await prisma.collaborationComment.update({
            where: { id: commentId },
            data: { isResolved: true }
        });

        res.status(200).json(updated);
    } catch (err) {
        console.error('Resolve comment error:', err);
        res.status(500).json({ error: 'Failed to resolve comment thread' });
    }
};

// Internal check helper
function orgId(req: AuthenticatedRequest, res: Response): boolean {
    const org = req.user?.organizationId;
    if (!org) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    return true;
}
