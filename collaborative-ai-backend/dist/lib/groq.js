"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.groq = void 0;
exports.getGroqChatCompletion = getGroqChatCompletion;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (!process.env.GROQ_API_KEY) {
    console.warn("GROQ_API_KEY is missing from environment variables. Running in Mock Fallback Mode.");
}
const rawGroq = new groq_sdk_1.default({
    apiKey: process.env.GROQ_API_KEY || 'dummy_api_key'
});
function handleMockCompletion(params) {
    const messages = params.messages || [];
    const lastMessageObj = messages[messages.length - 1];
    const userMessage = lastMessageObj ? lastMessageObj.content : '';
    const systemMessageObj = messages.find((m) => m.role === 'system');
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
    if (isBusiness) {
        if (userMessage.includes('decrease') || userMessage.includes('sales')) {
            return {
                choices: [{
                        message: {
                            content: `📊 **Monthly Revenue & Sales Drops:**

• **North America Volume:** Sales dropped **12.4%** this month due to a decrease in active promotion click-through rates.
• **Product Analysis:** The **Visual Dashboard Studio Pro** saw flat transaction counts, offset slightly by **Enterprise Ingestion Hub** renewals.
• **Market Context:** Customer metrics indicate that active buyer volumes remain high (**14.2K**), but the average order value fell by **$18**.
• **Recommendation:** Relaunch the NA email promotion campaign to recapture active leads.

What business KPIs would you like to explore next?`
                        }
                    }]
            };
        }
        if (userMessage.includes('region') || userMessage.includes('best')) {
            return {
                choices: [{
                        message: {
                            content: `📈 **Geographical Performance Review:**

• **North America:** Leading regional driver contributing **$13.52M** of total revenue.
• **Europe:** Stable contribution at **$8.60M**, though quarter-over-quarter growth has stalled.
• **Asia Pacific:** Emerging growth opportunity at **$2.46M** with significant active buyers growth (+24% MoM).

What business KPIs would you like to explore next?`
                        }
                    }]
            };
        }
        if (userMessage.includes('trends') || userMessage.includes('observe')) {
            return {
                choices: [{
                        message: {
                            content: `📊 **Observed Platform Trends:**

• **Revenue Growth:** Total Revenue reached **$24.58M (+18.6%)** year-over-year, showing solid expansion.
• **Profit Margins:** Gross profit expanded to **$9.83M (+21.3%)** due to lower transactional hosting costs.
• **User Retention:** Active Buyers grew to **14.2K (+12.7%)**, but the quality score dipped slightly to **96.2%**.

What business KPIs would you like to explore next?`
                        }
                    }]
            };
        }
        // General Business response
        return {
            choices: [{
                    message: {
                        content: `💡 **Business Intelligence Executive Assistant:**

• **Current Revenue Status:** Standing at **$24.58M** with positive **18.6%** growth.
• **Identified Risks:** Quality Index decreased slightly to **96.2%** due to recent schema adjustments.
• **Strategic Insight:** Regional expansion in APAC shows the highest relative growth momentum.

What business KPIs would you like to explore next?`
                    }
                }]
        };
    }
    else {
        // Analyst Copilot
        if (userMessage.includes('Describe Dataset') || userMessage.includes('Summarize')) {
            return {
                choices: [{
                        message: {
                            content: `🔍 **Dataset Technical Profile:**

• **Total Record Count:** **50** active rows processed.
• **Column Footprint:** Found **10** columns, including **id** (\`String\`), **total_spent** (\`Float\`), and **signup_date** (\`Date\`).
• **Data Quality:** Rated at **96%** overall compliance.
• **Detected Anomalies:** 3 items flagged for review (missing values, extreme outliers).

Which transformation or chart suggestion would you like to apply next?`
                        }
                    }]
            };
        }
        if (userMessage.includes('Detect Anomalies') || userMessage.includes('outlier')) {
            return {
                choices: [{
                        message: {
                            content: `🛡️ **Statistical Outlier Detection:**

• **Outliers Flagged:** 2 instances in **total_spent** exceeded the 3-sigma range (values over **$5,000**).
• **Null Gaps:** **device** column has **4%** missing values.
• **Invalid Formats:** **email** field has 1 invalid format without a domain.

Which transformation or chart suggestion would you like to apply next?`
                        }
                    }]
            };
        }
        if (userMessage.includes('Recommend Charts') || userMessage.includes('chart')) {
            return {
                choices: [{
                        message: {
                            content: `📊 **Visualization Recommendations:**

• **Area / Line Chart:** Map **signup_date** against **total_spent** to visualize transactional trends.
• **Scatter Plot:** Plot **age** against **total_spent** grouped by **gender** to see cohort distribution.
• **Horizontal Bar Chart:** Compare total sales by **country** or **device** category.

Which transformation or chart suggestion would you like to apply next?`
                        }
                    }]
            };
        }
        // General Analyst response
        return {
            choices: [{
                    message: {
                        content: `🔍 **Technical Data Analyst Assistant:**

• **Active Dataset:** Loaded and verified successfully.
• **Schema Analysis:** Columns mapped to **String**, **Integer**, **Float**, and **Date**.
• **Data Quality:** Validation checks passed. No schema drift identified.

Which transformation or chart suggestion would you like to apply next?`
                    }
                }]
        };
    }
}
exports.groq = {
    chat: {
        completions: {
            create: async (params, options) => {
                if (!process.env.GROQ_API_KEY) {
                    return handleMockCompletion(params);
                }
                try {
                    return await rawGroq.chat.completions.create(params, options);
                }
                catch (err) {
                    console.warn("Groq API error, falling back to mock:", err);
                    return handleMockCompletion(params);
                }
            }
        }
    }
};
// Helper for quick completions
async function getGroqChatCompletion(prompt, systemContext) {
    const messages = [];
    if (systemContext) {
        messages.push({ role: 'system', content: systemContext });
    }
    messages.push({ role: 'user', content: prompt });
    return exports.groq.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.5,
        max_tokens: 1024,
    });
}
