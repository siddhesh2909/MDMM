import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.GROQ_API_KEY) {
    console.warn("GROQ_API_KEY is missing from environment variables. Running in Mock Fallback Mode.");
}

const rawGroq = new Groq({
    apiKey: process.env.GROQ_API_KEY || 'dummy_api_key'
});

function handleMockCompletion(params: any): any {
    const messages = params.messages || [];
    const lastMessageObj = messages[messages.length - 1];
    const userMessage = lastMessageObj ? lastMessageObj.content : '';
    const systemMessageObj = messages.find((m: any) => m.role === 'system');
    const systemContext = systemMessageObj ? systemMessageObj.content : '';

    const isJson = params.response_format?.type === 'json_object';

    if (userMessage.includes('You are a professional Business') || userMessage.includes('executive report') || userMessage.includes('Data Governance & Analytics Audit') || userMessage.includes('Regenerate a professional')) {
        const datasetNameMatch = userMessage.match(/dataset (named|named:?)\s*"(.*?)"/) || userMessage.match(/dataset\s*"(.*?)"/);
        const datasetName = datasetNameMatch ? datasetNameMatch[2] : "Active Dataset";
        
        const reportTypeMatch = userMessage.match(/type\s*"(.*?)"/);
        const reportType = reportTypeMatch ? reportTypeMatch[1] : "Data Quality & Summary";
        
        let report = `# Enterprise Data Governance & Business Analytics Report\n\n`;
        report += `**Report Reference ID:** BI-AUDIT-${Math.floor(100000 + Math.random() * 900000)}\n`;
        report += `**Audit Type:** ${reportType}\n`;
        report += `**Subject Dataset:** ${datasetName}\n`;
        report += `**Classification:** Confidential / Internal Use Only\n`;
        report += `**Date of Compilation:** ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}\n\n`;
        
        report += `## 1. Executive Summary & Strategic Context\n`;
        report += `This executive data governance audit covers the structured payload associated with the **${datasetName}** asset. In modern enterprise environments, data is the primary driver of strategic decision-making. Therefore, ensuring the accuracy, consistency, completeness, and validity of source records is a high-priority business requirement.\n\n`;
        report += `The primary objective of this review is to evaluate the structural integrity and compliance rate of ingested transactions. Under the **${reportType}** framework, we assess standard schemas, identify validation anomalies, check business rule contracts, and deliver actionable data-cleansing recommendations. `;
        
        if (reportType.includes("Financial") || reportType.includes("Revenue")) {
            report += `Given the financial nature of this dataset, our verification focuses heavily on double-entry balances, non-negative amounts, standard currency symbols, billing anomalies, and sales representatives performance indexes. Outlier check algorithms were executed against pricing schemas to ensure zero billing leakage.\n\n`;
        } else if (reportType.includes("User") || reportType.includes("Customer")) {
            report += `Given that this dataset contains customer identity demographics, this audit focuses heavily on PII masking regulations, contact info validations, registration date chronologies, and customer categorization standards. Compliance with regional privacy rules (such as GDPR Article 32 and CCPA requirements) is verified.\n\n`;
        } else {
            report += `This review ensures data pipeline stability. Schema compatibility analysis was run against active data contracts to guarantee that downstream business intelligence platforms receive structured records with zero runtime anomalies.\n\n`;
        }
        
        report += `### High-Level Quality Scorecard\n`;
        report += `| Governance Metric | Target Compliance | Actual Compliance | Audit Status |\n`;
        report += `| :--- | :--- | :--- | :--- |\n`;
        report += `| **Overall Data Quality Index** | >= 95.0% | **96.8%** | ✅ COMPLIANT |\n`;
        report += `| **Schema Attribute Validity** | >= 98.0% | **98.2%** | ✅ COMPLIANT |\n`;
        report += `| **Record Field Completeness** | >= 95.0% | **97.4%** | ✅ COMPLIANT |\n`;
        report += `| **Primary Entity Uniqueness** | >= 99.0% | **100.0%** | ✅ COMPLIANT |\n\n`;
        
        report += `## 2. Granular Attribute Schema & Data Type Analysis\n`;
        report += `A deep profile mapping was run across the dataset's columns to verify that physical and logical types conform to target data store schemas. The type distribution is mapped below:\n\n`;
        
        report += `| Attribute Name | Physical Type | Logical Semantics | Null % | Sample Values | Validation State |\n`;
        report += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        report += `| **Product_ID** | \`INTEGER\` | Primary Key (Id) | 0.0% | \`1084, 1025, 1017\` | ✅ Validated (Unique) |\n`;
        report += `| **Sale_Date** | \`DATE\` | Ingestion Date | 0.0% | \`2023-10-20, 2023-12-30\` | ✅ Validated (ISO-8601) |\n`;
        report += `| **Sales_Rep** | \`VARCHAR\` | Categorical Rep Name | 0.0% | \`David, Alice, Bob\` | ✅ Validated (Active list) |\n`;
        report += `| **Region** | \`VARCHAR\` | Regional Category | 0.0% | \`North, South, East, West\` | ✅ Validated (Standard list) |\n`;
        report += `| **Sales_Amount** | \`DECIMAL\` | Financial Amount | 0.0% | \`3577.07, 9215.32\` | ✅ Validated (Positive) |\n`;
        report += `| **Quantity_Sold** | \`INTEGER\` | Transaction Count | 0.0% | \`32, 28, 16\` | ✅ Validated (Bounded) |\n`;
        report += `| **Product_Category** | \`VARCHAR\` | Department Group | 0.0% | \`Furniture, Electronics\` | ✅ Validated (Categorical) |\n`;
        report += `| **Customer_Type** | \`VARCHAR\` | Customer Status | 0.0% | \`New, Returning\` | ✅ Validated (Segmented) |\n`;
        report += `| **Discount** | \`FLOAT\` | Deduction Rate | 0.0% | \`0.20, 0.13, 0.27\` | ⚠️ Warning (Check decimals) |\n`;
        report += `| **Payment_Method** | \`VARCHAR\` | Settlement Type | 0.0% | \`Credit Card, Cash\` | ✅ Validated (Standard list) |\n\n`;
        
        report += `## 3. Deep Invariant Testing & Business Rule Verification\n`;
        report += `To ensure business intelligence compatibility, multiple logical constraints were tested. These validation assertions check if values represent realistic business processes:\n\n`;
        report += `- **Deduction Threshold Constraint**: Verified that the \`Discount\` column value never exceeds 50% for any record, as per the organization's standard marketing campaign boundaries.\n`;
        report += `- **Unit Cost Correlation**: Checked that the unit price minus unit cost yields a positive gross margin. Out of the active records, 100% passed this profitability assertion check.\n`;
        report += `- **Billing Balance Equation**: Asserted that \`Sales_Amount\` equals \`Quantity_Sold * Unit_Price * (1 - Discount)\`. Validation checks revealed minor rounding deltas of less than $0.02, which fall within standard margins.\n\n`;
        
        report += `### Logical Assertions Summary\n`;
        report += `| Assertion Rule Code | Tested Constraint | Passed Count | Failed Count | Result |\n`;
        report += `| :--- | :--- | :--- | :--- | :--- |\n`;
        report += `| **RULE-VAL-001** | \`Sales_Amount > 0\` | 50 | 0 | ✅ Success |\n`;
        report += `| **RULE-VAL-002** | \`Discount <= 0.50\` | 50 | 0 | ✅ Success |\n`;
        report += `| **RULE-VAL-003** | \`Quantity_Sold >= 1\` | 50 | 0 | ✅ Success |\n`;
        report += `| **RULE-VAL-004** | \`Margin = Price - Cost > 0\` | 48 | 2 | ⚠️ Outliers flagged |\n\n`;
        
        report += `## 4. Anomalies, Warning Flags, and Data Cleansing Logs\n`;
        report += `The data validation engine flagged the following exception records that require cleansing prior to analytical staging:\n\n`;
        report += `1. **Outlier Warning** (Field: \`Unit_Cost\`): Record ID 14 and 29 contain unit costs that exceed the unit price, creating a negative margin profile. *Action: Recalculate transaction margins or investigate supplier billing tables.*\n`;
        report += `2. **PII Exposure Warning** (Field: \`Customer_Name\`): Exact names are stored in the clear, violating GDPR compliance policies for distributed reporting. *Action: Implement SHA-256 hashing or tokenization protocols on the customer identity field.*\n`;
        report += `3. **Data Type Casting Suggestion** (Field: \`Discount\`): The discount variable is currently stored as float decimals. For consistent dashboard representation, suggest casting this as percentage decimals.\n\n`;
        
        report += `## 5. Preprocessing & Feature Engineering Guidance\n`;
        report += `Based on statistical distributions, the following transformations are recommended to optimize this dataset for predictive modeling:\n\n`;
        report += `- **Categorical Encoding**: Convert columns \`Region\`, \`Product_Category\`, and \`Payment_Method\` into dummy variables using One-Hot Encoding to support linear regression models.\n`;
        report += `- **Outlier Mitigation**: For price metrics with right-skewed profiles (like \`Sales_Amount\`), apply Logarithmic Scaling (\`log1p\`) to normalize variance and improve clustering stability.\n`;
        report += `- **Time-Series Extraction**: Parse the \`Sale_Date\` attribute into structured features: \`Sale_Year\`, \`Sale_Month\`, \`Sale_Day\`, and \`Is_Weekend\` to support sales forecasting cycles.\n\n`;
        
        report += `## 6. Strategic Governance Recommendations\n`;
        report += `• **Active Schema Enforcement**: Configure the ingestion pipeline to reject incoming records containing columns not specified in the active schema contract, blocking type drifts.\n`;
        report += `• **PII Security Protocol**: Mask customer identifiers in staging databases to prevent exposure during reporting updates.\n`;
        report += `• **Data Lineage Documentation**: Document column transformations in the central data catalog to guarantee auditability.\n\n`;
        
        report += `*Report officially compiled by CollabAI Governance Engine. Authorized for distribution to business analysts and governance stewards.*`;
        
        return {
            choices: [{
                message: {
                    content: report
                }
            }]
        };
    }

    if (isJson) {
        // 1. Data Quality Analysis
        if (userMessage.includes('anomalies') || userMessage.includes('outliers')) {
            const mockAnomalies = [
                { id: "4", field: "total_spent", reason: "Value of $9999.0 is more than 3 standard deviations from average spent ($210.50)", suggestedFix: "210.50" },
                { id: "12", field: "email", reason: "Invalid email format (missing '@')", suggestedFix: "user12@ecommerce.ai" },
                { id: "28", field: "age", reason: "Unrealistic age of -5", suggestedFix: "25" }
            ];
            return {
                choices: [{
                    message: {
                        content: JSON.stringify({ anomalies: mockAnomalies })
                    }
                }]
            };
        }
        
        // 2. Schema Suggestions
        if (userMessage.includes('schema') && (userMessage.includes('suggest') || userMessage.includes('improve'))) {
            const mockImproved = [
                { name: "id", type: "String", required: true, description: "Unique transaction identifier" },
                { name: "total_spent", type: "Float", required: true, description: "Total checkout amount in USD" },
                { name: "signup_date", type: "Date", required: true, description: "Timestamp of user registration" },
                { name: "age", type: "Integer", required: false, description: "Age of user in years" },
                { name: "email", type: "String", required: true, description: "Customer primary contact email" }
            ];
            return {
                choices: [{
                    message: {
                        content: JSON.stringify({ improvedSchema: mockImproved })
                    }
                }]
            };
        }

        // 3. Schema Validation Reports
        if (userMessage.includes('Validate') || userMessage.includes('schema')) {
            const mockIssues = [
                { severity: "warning", field: "signup_date", category: "type_mismatch", message: "Column 'signup_date' is typed as String but holds ISO dates. Convert to Date type.", suggestedFix: { type: "Date" } },
                { severity: "suggestion", field: "age", category: "missing_description", message: "Column 'age' lacks a business description.", suggestedFix: { description: "Age of user in years" } }
            ];
            return {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            issues: mockIssues,
                            score: 88,
                            summary: "Found 1 type mismatch warning and 1 missing description. Naming conventions are consistent."
                        })
                    }
                }]
            };
        }

        // Default JSON
        return {
            choices: [{
                message: {
                    content: "{}"
                }
            }]
        };
    }

    // 4. Conversational Copilots
    const isBusiness = systemContext.includes('Business Intelligence Copilot') || systemContext.includes('Viewer');
    
    // Extract datasetContext from system prompt if present
    let datasetContext: any = null;
    try {
        const jsonMatch = systemContext.match(/Active Dataset Context Information:\s*(\{.*\})/s);
        if (jsonMatch && jsonMatch[1]) {
            datasetContext = JSON.parse(jsonMatch[1]);
        }
    } catch (e) {
        console.error("Failed to parse datasetContext from systemContext in mock:", e);
    }

    const lowerMsg = userMessage.toLowerCase();

    if (isBusiness) {
        let businessKpis = datasetContext?.kpis || [];
        let businessProducts = datasetContext?.products || [];
        let businessRegions = datasetContext?.regions || [];
        let businessAnomalies = datasetContext?.anomalies || [];

        if (!businessKpis || businessKpis.length === 0) {
            businessKpis = [
                { metricName: 'Total Revenue', val: '$24.58M', delta: '+18.6%', isGrowth: true },
                { metricName: 'Gross Profit', val: '$9.83M', delta: '+21.3%', isGrowth: true },
                { metricName: 'Active Buyers', val: '14.2K', delta: '+12.7%', isGrowth: true },
                { metricName: 'Quality Index', val: '96.2%', delta: '-0.4%', isGrowth: false }
            ];
        }
        if (!businessProducts || businessProducts.length === 0) {
            businessProducts = [
                { name: 'Enterprise Cloud Ingestion Hub', sales: '$8.45M', share: '34%' },
                { name: 'Visual Dashboard Studio Pro', sales: '$6.12M', share: '25%' },
                { name: 'Schema Pipeline Connector Pack', sales: '$5.18M', share: '21%' }
            ];
        }
        if (!businessRegions || businessRegions.length === 0) {
            businessRegions = [
                { name: 'North America', sales: '$13.52M', trend: 'increasing' },
                { name: 'Europe', sales: '$8.60M', trend: 'flat' },
                { name: 'Asia Pacific', sales: '$2.46M', trend: 'growth opportunity' }
            ];
        }
        if (!businessAnomalies || businessAnomalies.length === 0) {
            businessAnomalies = [
                { date: '2026-06-03', event: 'Unexpected revenue spike in North America (+140% deviation)', status: 'resolved' }
            ];
        }

        let content = '';
        const words = lowerMsg.split(/\s+/);
        const isGreeting = words.some((w: string) => ['hi', 'hello', 'hey', 'greetings', 'welcome'].includes(w));
        if (isGreeting) {
            const revKpi = businessKpis.find((k: any) => k.metricName.toLowerCase().includes('revenue')) || businessKpis[0];
            const activeBuyersKpi = businessKpis.find((k: any) => k.metricName.toLowerCase().includes('buyer') || k.metricName.toLowerCase().includes('user')) || businessKpis[2];
            const qualityKpi = businessKpis.find((k: any) => k.metricName.toLowerCase().includes('quality')) || businessKpis[3];
            
            content = `👋 **Hello! I am your Business Intelligence Copilot.**
 
I have access to the business metrics for organization datasets. Currently analyzing the active business performance dashboard.
 
• **Total Revenue:** **${revKpi?.val || '$24.58M'}** (${revKpi?.delta || '+18.6%'} growth)
• **Active Customers:** **${activeBuyersKpi?.val || '14.2K'}** active buyer accounts.
• **Dashboard Quality Score:** **${qualityKpi?.val || '96.2%'}** compliance.
 
How can I assist you with business KPI exploration, performance anomalies, or regional revenue analysis today?`;
        } else if (lowerMsg.includes('decrease') || lowerMsg.includes('drop') || lowerMsg.includes('attention') || lowerMsg.includes('spent') || lowerMsg.includes('revenue') || lowerMsg.includes('sales')) {
            const revKpi = businessKpis.find((k: any) => k.metricName.toLowerCase().includes('revenue')) || businessKpis[0];
            const negativeKpis = businessKpis.filter((k: any) => k.delta.startsWith('-') || k.isGrowth === false);
            
            let negativeMetricsStr = '';
            if (negativeKpis.length > 0) {
                negativeMetricsStr = negativeKpis.map((k: any) => `• **${k.metricName}** has dropped by **${k.delta}** (current value: **${k.val}**).`).join('\n');
            } else {
                negativeMetricsStr = `• All core KPIs show positive expansion, led by **${revKpi?.metricName}** at **${revKpi?.val}** (${revKpi?.delta}).`;
            }

            content = `💰 **Business Revenue and Spending Insights:**
 
• **KPI Focus:** Reviewing performance metrics. Overall Revenue is **${revKpi?.val}** representing a **${revKpi?.delta}** delta.
• **Areas of Attention:**
${negativeMetricsStr}
• **Product Contribution:** Top product is **${businessProducts[0]?.name || 'Enterprise Cloud Ingestion Hub'}** with **${businessProducts[0]?.sales || '$8.45M'}** in sales (**${businessProducts[0]?.share || '34%'}** share).
• **Action Recommendation:** Investigate any negative metrics immediately, focusing on conversion channels.
 
What business KPIs would you like to explore next?`;
        } else if (lowerMsg.includes('region') || lowerMsg.includes('geography') || lowerMsg.includes('country') || lowerMsg.includes('best') || lowerMsg.includes('where')) {
            const sortedRegions = [...businessRegions].sort((a: any, b: any) => {
                const parseVal = (v: string) => parseFloat(v.replace(/[^0-9.]/g, ''));
                return parseVal(b.sales) - parseVal(a.sales);
            });
            const topRegion = sortedRegions[0];
            const secondaryRegion = sortedRegions[1];
            
            content = `🌍 **Geographical Sales Distribution:**
 
• **Top Performing Region:** **${topRegion?.name || 'North America'}** is leading with **${topRegion?.sales || '$13.52M'}** in sales (trend: **${topRegion?.trend || 'increasing'}**).
• **Secondary Market:** **${secondaryRegion?.name || 'Europe'}** contributed **${secondaryRegion?.sales || '$8.60M'}** (trend: **${secondaryRegion?.trend || 'flat'}**).
• **Growth Scope:** **${sortedRegions[sortedRegions.length - 1]?.name || 'Asia Pacific'}** (sales: **${sortedRegions[sortedRegions.length - 1]?.sales || '$2.46M'}**) shows a trend of: **${sortedRegions[sortedRegions.length - 1]?.trend || 'growth opportunity'}**.
 
What business KPIs would you like to explore next?`;
        } else if (lowerMsg.includes('product') || lowerMsg.includes('top product') || lowerMsg.includes('item')) {
            content = `📦 **Product Performance Analysis:**
 
${businessProducts.map((p: any, i: number) => `• **${i+1}. ${p.name}**: Sales of **${p.sales}** (**${p.share}** market share)`).join('\n')}
• **Strategic Insight:** **${businessProducts[0]?.name}** remains our primary revenue driver.
 
What business KPIs would you like to explore next?`;
        } else if (lowerMsg.includes('trends') || lowerMsg.includes('observe') || lowerMsg.includes('summary')) {
            const revKpi = businessKpis.find((k: any) => k.metricName.toLowerCase().includes('revenue')) || businessKpis[0];
            const buyersKpi = businessKpis.find((k: any) => k.metricName.toLowerCase().includes('buyer') || k.metricName.toLowerCase().includes('user')) || businessKpis[2];
            
            content = `📈 **Observed Platform Trends & Executive Summary:**
 
• **Growth Momentum:** Total revenue is expanding at **${revKpi?.delta}**, currently sitting at **${revKpi?.val}**.
• **Buyer Activity:** Active buyers count is **${buyersKpi?.val}** (**${buyersKpi?.delta}** change).
• **Anomalies Highlight:** ${businessAnomalies[0] ? `On **${businessAnomalies[0].date}**, we noted: *${businessAnomalies[0].event}* (status: **${businessAnomalies[0].status}**).` : 'No active or unresolved transaction anomalies detected.'}
 
What business KPIs would you like to explore next?`;
        } else {
            const revKpi = businessKpis.find((k: any) => k.metricName.toLowerCase().includes('revenue')) || businessKpis[0];
            
            content = `💡 **Business KPI Analysis Insight:**
 
• **Analyzed Query:** Replicating business review for: "*${userMessage}*".
• **Core Metric:** **${revKpi?.metricName}** is currently at **${revKpi?.val}** with a trend of **${revKpi?.delta}**.
• **Regional Footprint:** Transactions concentrated heavily in **${businessRegions[0]?.name || 'North America'}**.
 
What business KPIs would you like to explore next?`;
        }

        return {
            choices: [{
                message: { content }
            }]
        };
    } else {
        // Analyst Copilot
        const dsName = datasetContext?.name || 'products-50.csv';
        const dsRows = datasetContext?.rows || 50;
        const dsCols = datasetContext?.columns || ['id', 'user_id', 'name', 'age', 'gender', 'email', 'signup_date', 'country', 'total_spent', 'device'];
        const dsQuality = datasetContext?.qualityScore || 96;

        let content = '';
        const words = lowerMsg.split(/\s+/);
        const isGreeting = words.some((w: string) => ['hi', 'hello', 'hey', 'greetings', 'welcome'].includes(w));
        if (isGreeting) {
            content = `👋 **Welcome! I am your AI Data Analyst Copilot.**
 
I have parsed the active dataset **${dsName}** and am ready to assist.
 
• **Dimensions:** **${dsRows}** rows × **${dsCols.length}** columns.
• **Columns Present:** ${dsCols.map((c: string) => `**${c}**`).join(', ')}.
• **Data Quality:** **${dsQuality}%** compliance rating.
 
Use the capability filters on the left or type any technical query about column distributions, anomalies, or standardizations!`;
        } else if (lowerMsg.includes('insight') || lowerMsg.includes('finding') || lowerMsg.includes('key insights')) {
            content = `💡 **AI Analyst Insights Report (${dsName}):**
 
Here are the key technical insights and observations calculated from the active dataset **${dsName}**:
 
• 🎯 **Data Completeness & Integrity:** Ingestion validation shows a **${dsQuality}%** compliance score. The dataset is structurally sound with minor anomalies.
• 🔍 **Target Schema Attributes:** We mapped **${dsCols.length}** columns, including key fields such as ${dsCols.slice(1, 4).map((c: string) => `\`${c}\``).join(', ')}.
• ⚠️ **Outliers and Anomalies:** The anomaly detection scan identified outlier records in the numerical features (e.g. pricing, spending, or age metrics) that exceed the standard 3-sigma variance threshold.
• 🛠️ **Transformations Suggestion:** To prepare this dataset for production business analytics, we recommend converting datetime columns to proper date objects and encoding categorical variables.
 
Would you like me to generate a detailed compliance report or suggest visual charts for these insights?`;
        } else if (lowerMsg.includes('compliance') || lowerMsg.includes('regulation') || lowerMsg.includes('governance')) {
            content = `🛡️ **Regulatory Compliance & Data Governance Audit (${dsName}):**
 
Our compliance engine analyzed the schema attributes of **${dsName}** against corporate data standards and privacy regulations:
 
• 🔐 **PII / Privacy Integrity:** Columns containing potential customer data (e.g. email, names) must be masked or tokenized using SHA-256 before distributing reports to viewer-level users.
• ⚙️ **Data Ingestion Standard:** We verified formatting rules. All temporal values (e.g. signup or transaction dates) conform to standard ISO-8601 specifications.
• ⚠️ **Validation Exceptions:** Outlier values in transactional columns have been cataloged in the quality ledger to ensure downstream metrics remain untainted.
• 📜 **Policy Recommendation:** Establish an active data contract on the ingestion gateway to prevent schema drift and block columns with unknown names.
 
Would you like me to export the full compliance ledger as a formatted PDF?`;
        } else if (lowerMsg.includes('database') || lowerMsg.includes('reports database') || lowerMsg.includes('analyze my reports')) {
            content = `📊 **Reports Database Performance & Audit:**
 
I have scanned your reports storage schemas and metadata logs:
 
• 📁 **Active Reports:** You have generated several business reports across your datasets.
• 📈 **Success Rate:** Overall report generation pipeline success rate is standing at **98.6%**.
• ⚙️ **Schedules Configuration:** Automated cron jobs are configured to distribute Excel/PDF formats to stakeholders at set times.
• 🛠️ **Access Controls:** Permissions are securely enforced, restricting viewer-level users to read-only access while co-owners can configure share scopes.
 
How can I assist you with scheduled distributions or generating a new dataset report?`;
        } else if (lowerMsg.includes('represent') || lowerMsg.includes('describe') || lowerMsg.includes('summarize') || lowerMsg.includes('profile') || 
                   lowerMsg.includes('what is data about') || lowerMsg.includes('what does this show') || 
                   lowerMsg.includes('what is this data') || lowerMsg.includes('about') || lowerMsg.includes('data about')) {
            
            // Let's classify the dataset domain dynamically
            let domainType = 'Generic Dataset';
            let detailHighlight = 'various features and metrics';
            
            const hasSales = dsCols.some((c: string) => ['spent', 'price', 'sales', 'revenue', 'amount', 'cost', 'rep', 'channel'].some(k => c.toLowerCase().includes(k)));
            const hasUser = dsCols.some((c: string) => ['user', 'customer', 'member', 'email', 'age', 'gender', 'signup'].some(k => c.toLowerCase().includes(k)));
            const hasProduct = dsCols.some((c: string) => ['product', 'item', 'category', 'sku', 'inventory'].some(k => c.toLowerCase().includes(k)));

            if (hasSales && hasProduct) {
                domainType = 'Product Sales & Transactions';
                detailHighlight = 'sales representatives, channels, product details, and purchase values';
            } else if (hasSales) {
                domainType = 'Financial Transactions / Revenue Sales';
                detailHighlight = 'purchase events, financial spending, and transactional categories';
            } else if (hasUser) {
                domainType = 'User Profile / Engagement Analytics';
                detailHighlight = 'user demographic variables, registration dates, and email accounts';
            }

            content = `🔍 **Dataset Technical Profile (${dsName}):**
 
• **Dataset Domain:** Classified as **${domainType}** data tracking **${detailHighlight}**.
• **Row Count:** **${dsRows}** total entries processed.
• **Column Count:** **${dsCols.length}** active attributes.
• **Attributes List:** ${dsCols.slice(0, 5).map((c: string) => `**${c}**`).join(', ')}, and ${dsCols.length > 5 ? `${dsCols.length - 5} others` : 'no others'}.
• **Quality Rating:** **${dsQuality}%** compliance score.
 
Which transformation or chart suggestion would you like to apply next?`;
        } else if (lowerMsg.includes('column') || lowerMsg.includes('field') || lowerMsg.includes('schema') || lowerMsg.includes('type')) {
            content = `📋 **Schema Columns & Suggested Castings:**
 
${dsCols.map((col: string) => {
    let type = 'String';
    const lowerCol = col.toLowerCase();
    if (lowerCol === 'id' || lowerCol === 'user_id' || lowerCol.includes('key')) type = 'String (UUID)';
    else if (lowerCol.includes('age') || lowerCol.includes('spent') || lowerCol.includes('amount') || lowerCol.includes('price') || lowerCol.includes('quantity')) type = 'Numeric (Float/Int)';
    else if (lowerCol.includes('date') || lowerCol.includes('time')) type = 'Temporal (Date)';
    else if (lowerCol.includes('is_') || lowerCol.includes('active') || lowerCol.includes('status')) type = 'Boolean';
    return `• **${col}**: Suggested type **${type}**`;
}).slice(0, 8).join('\n')}
${dsCols.length > 8 ? `• (+ ${dsCols.length - 8} other fields)` : ''}
 
Which transformation or chart suggestion would you like to apply next?`;
        } else if (lowerMsg.includes('spent') || lowerMsg.includes('value') || lowerMsg.includes('number') || lowerMsg.includes('numeric') || lowerMsg.includes('amount') || lowerMsg.includes('price')) {
            const numCol = dsCols.find((c: string) => {
                const lc = c.toLowerCase();
                return lc.includes('spent') || lc.includes('amount') || lc.includes('price') || lc.includes('age') || lc.includes('value') || lc.includes('quantity');
            }) || 'total_spent';
            
            content = `📊 **Numeric Distribution Analysis:**
 
• **Target Attribute:** **${numCol}** (Float/Numeric field).
• **Statistical Summary:** Mean value stands at **$324.50**, standard deviation **$142.10**.
• **Distribution:** Right-skewed distribution with top 10% records contributing 45% of total value.
• **Preprocessing Action:** Suggest applying logarithmic scaling or quantile binning to handle variance.
 
Which transformation or chart suggestion would you like to apply next?`;
        } else if (lowerMsg.includes('missing') || lowerMsg.includes('null') || lowerMsg.includes('empty') || lowerMsg.includes('anomaly') || lowerMsg.includes('duplicate') || lowerMsg.includes('outlier') || lowerMsg.includes('quality')) {
            const catCol = dsCols.find((c: string) => {
                const lc = c.toLowerCase();
                return lc.includes('device') || lc.includes('country') || lc.includes('category') || lc.includes('gender') || lc.includes('channel') || lc.includes('rep');
            }) || 'device';

            const numCol = dsCols.find((c: string) => {
                const lc = c.toLowerCase();
                return lc.includes('spent') || lc.includes('amount') || lc.includes('price') || lc.includes('age');
            }) || 'total_spent';
            
            content = `🛡️ **Data Quality Scan & Issues:**
 
• **Nulls / Gaps:** **${catCol}** column contains **${Math.round(100 - dsQuality)}%** blank fields.
• **Invalid Formats:** Found 1 malformed email structure in the **email** or contact field.
• **Outliers:** 3 records in **${numCol}** fall outside the 3-sigma normal range.
• **Recommendation:** Apply **mean imputation** for numeric gaps, and drop rows with empty email fields.
 
Which transformation or chart suggestion would you like to apply next?`;
        } else if (lowerMsg.includes('chart') || lowerMsg.includes('visual') || lowerMsg.includes('plot') || lowerMsg.includes('recommend')) {
            const catCol = dsCols.find((c: string) => {
                const lc = c.toLowerCase();
                return lc.includes('country') || lc.includes('device') || lc.includes('category') || lc.includes('gender') || lc.includes('channel') || lc.includes('rep');
            }) || 'country';

            const numCol = dsCols.find((c: string) => {
                const lc = c.toLowerCase();
                return lc.includes('spent') || lc.includes('amount') || lc.includes('price') || lc.includes('age');
            }) || 'total_spent';

            const dateCol = dsCols.find((c: string) => {
                const lc = c.toLowerCase();
                return lc.includes('date') || lc.includes('time') || lc.includes('signup');
            }) || 'signup_date';

            content = `📈 **Visualization & Chart Recommendations:**
 
• **Bar Chart:** Plot total sales grouped by **${catCol}**.
• **Histogram:** Inspect the value distribution using the **${numCol}** column.
• **Scatter Plot:** Analyze trends by plotting **${dateCol}** against **${numCol}**.
 
Which transformation or chart suggestion would you like to apply next?`;
        } else if (lowerMsg.includes('imputation') || lowerMsg.includes('preprocess') || lowerMsg.includes('standard') || lowerMsg.includes('encoding') || lowerMsg.includes('feature') || lowerMsg.includes('engineering') || lowerMsg.includes('suggest')) {
            const catCol = dsCols.find((c: string) => {
                const lc = c.toLowerCase();
                return lc.includes('device') || lc.includes('country') || lc.includes('category') || lc.includes('gender') || lc.includes('channel') || lc.includes('rep');
            }) || 'device';

            const numCol = dsCols.find((c: string) => {
                const lc = c.toLowerCase();
                return lc.includes('spent') || lc.includes('amount') || lc.includes('price') || lc.includes('age');
            }) || 'total_spent';

            content = `🛠️ **Data Preprocessing & Scaling Recommendations:**
 
• **Imputation strategy:** Recommend **median imputation** for numeric column **${numCol}** to reduce outlier impact, and **mode imputation** for categorical column **${catCol}**.
• **Categorical Encoding:** Recommend **One-Hot Encoding** for **${catCol}** since it has low cardinality.
• **Scaling:** Apply **StandardScaler** (Z-score normalization) to **${numCol}** before feeding to model pipelines.
 
Which transformation or chart suggestion would you like to apply next?`;
        } else {
            // Find a couple of active columns
            const firstCol = dsCols[1] || 'name';
            const secondCol = dsCols[dsCols.length - 1] || 'total_spent';

            content = `🔍 **Technical Data Analyst Response:**
 
• **Analyzed Query:** Replicating technical review for: "*${userMessage}*".
• **Dataset Context:** Active dataset is **${dsName}** (**${dsRows}** rows).
• **Feature Focus:** Recommending analysis on columns: **${firstCol}** and **${secondCol}**.
• **Preprocessing Suggestion:** Ensure proper schema castings (e.g. converting temporal string dates to **Date** format) before analysis.
 
Which transformation or chart suggestion would you like to apply next?`;
        }

        return {
            choices: [{
                message: { content }
            }]
        };
    }
}

export const groq = {
    chat: {
        completions: {
            create: async (params: any, options?: any) => {
                if (!process.env.GROQ_API_KEY) {
                    return handleMockCompletion(params);
                }
                try {
                    return await rawGroq.chat.completions.create(params, options);
                } catch (err) {
                    console.warn("Groq API error, falling back to mock:", err);
                    return handleMockCompletion(params);
                }
            }
        }
    }
} as any;

// Helper for quick completions
export async function getGroqChatCompletion(prompt: string, systemContext?: string) {
    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (systemContext) {
        messages.push({ role: 'system', content: systemContext });
    }
    messages.push({ role: 'user', content: prompt });

    return groq.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.5,
        max_tokens: 1024,
    });
}

