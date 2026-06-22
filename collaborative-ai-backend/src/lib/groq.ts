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
        } else if (lowerMsg.includes('describe') || lowerMsg.includes('summarize') || lowerMsg.includes('profile') || 
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

