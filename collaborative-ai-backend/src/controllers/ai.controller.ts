import { Response } from 'express';
import { getGroqChatCompletion, groq } from '../lib/groq';
import { AuthenticatedRequest } from '../middleware/auth';
import { notifyUser } from '../services/notification.service';

const ANALYST_COPILOT_SYSTEM_PROMPT = `
You are an Advanced AI Data Analyst Copilot working within a Collaborative AI Platform.
Your role is to help data analysts and engineers understand their datasets, describe schemas/columns, detect data quality issues (missing values, duplicates, format errors, anomalies), and recommend preprocessing operations or visualizations.

Always respond in a professional, technically detailed, and visually structured way:
- Use relevant technical emojis (e.g., 🔍 🛡️ 🛠️ 📐 📋 💾 🧬 ⚙️)
- Use bullet points (•) for lists
- Use **bold** for column names, data types, and functions
- Keep points clear, technical, and actionable
- Add a friendly closing line like "Which transformation or chart suggestion would you like to apply next?"
`;

const BUSINESS_COPILOT_SYSTEM_PROMPT = `
You are a Business Intelligence Copilot working in a Collaborative AI Platform.
Your target audience consists of Business Users and Decision Makers.
Your role is to analyze dashboard data, KPIs, trends, and growth opportunities, explaining anomalies or growth performance drops in plain, business-friendly terms.

Always respond in an executive, non-technical, and action-oriented way:
- Always use relevant business emojis (e.g. 📊 📈 💰 🎯 🚀 💡)
- Use bullet points (•) for lists, never dense paragraphs
- Focus purely on business impact, financial outcomes, and business recommendations
- Use **bold** for key business metrics, percentages, and financial values
- Avoid code snippets, data type descriptions, or database jargon
- Add a friendly closing line like "What business KPIs would you like to explore next?"
`;

export const handleChat = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { message, history, datasetContext } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message content is required.' });
        }

        const userRole = req.user?.role || 'Viewer';
        let customPrompt = userRole === 'Viewer' ? BUSINESS_COPILOT_SYSTEM_PROMPT : ANALYST_COPILOT_SYSTEM_PROMPT;
        if (datasetContext) {
            customPrompt += `\n\nActive Dataset Context Information:\n${JSON.stringify(datasetContext)}`;
        }

        const completion = await getGroqChatCompletion(message, customPrompt);
        const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't formulate a response.";

        try {
            const userId = req.user?.id;
            if (userId) {
                await notifyUser(
                    userId,
                    'AI Assistant Response',
                    `AI answered to your message.`,
                    'message',
                    '/analytics'
                );
            }
        } catch (nErr) {
            console.error('Failed to trigger AI chat notification:', nErr);
        }

        res.status(200).json({ reply: aiResponse });

    } catch (error: unknown) {
        console.error("Groq Chat Error:", error);
        res.status(500).json({ error: 'Failed to process AI chat request.' });
    }
}

export const analyzeData = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { targetDataset, rawData } = req.body;

        if (!rawData || !Array.isArray(rawData)) {
            return res.status(400).json({ error: 'Valid rawData array is required for analysis.' });
        }

        const prompt = `
        You are a Data Quality AI. Analyze the following JSON data array for anomalies (outliers, missing values, invalid categories).
        Return purely a JSON array of objects representing the flagged rows. Each object must have:
        - "id": the id of the row with the anomaly
        - "reason": A short explanation of the anomaly.
        - "suggestedFix": A concrete value to replace the anomalous field with.
        - "field": The name of the field that is anomalous.
        
        Data: 
        ${JSON.stringify(rawData)}
        `;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1, // Low temp for analytical consistency
            response_format: { type: "json_object" },
        });

        // The exact API structure will depend on Groq's exact model output, but we parse it carefully
        const responseText = completion.choices[0]?.message?.content || "{}";
        let anomalies = [];
        try {
            const parsed = JSON.parse(responseText);
            // Handle case where Llama wraps it in a parent key
            anomalies = Array.isArray(parsed) ? parsed : (parsed.anomalies || Object.values(parsed)[0] || []);
        } catch (e) {
            console.error("Failed to parse Groq JSON:", responseText);
        }

        res.status(200).json({ status: "success", anomalies });

    } catch (error: unknown) {
        console.error("Groq Analysis Error:", error);
        res.status(500).json({ error: 'Failed to run AI data analysis.' });
    }
}

export const suggestSchema = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { currentSchema } = req.body;

        if (!currentSchema || !Array.isArray(currentSchema)) {
            return res.status(400).json({ error: 'Valid currentSchema array is required for suggestion.' });
        }

        const prompt = `
        You are an expert Data Architect. Review the following JSON schema array.
        Improve it by standardizing data types to proper SQL types (String, Integer, Float, Date, Boolean),
        setting "required": true if appropriate, and generating concise, professional descriptions for any missing descriptions.
        Do not change the "name" field of the columns.
        Return ONLY a JSON object with a single key "improvedSchema" whose value is the array of the improved schema objects.
        Format: {"improvedSchema": [{"name": "field1", "type": "String", "required": true, "description": "Professional description"}]}
        
        Current Schema: 
        ${JSON.stringify(currentSchema)}
        `;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            response_format: { type: "json_object" },
        });

        const responseText = completion.choices[0]?.message?.content || "{}";
        let improvedSchema = [];
        try {
            const parsed = JSON.parse(responseText);
            improvedSchema = Array.isArray(parsed) ? parsed : (parsed.improvedSchema || parsed.schema || parsed.fields || Object.values(parsed)[0] || []);
        } catch (e) {
            console.error("Failed to parse Groq Suggestion JSON:", responseText);
        }

        res.status(200).json({ status: "success", improvedSchema });

    } catch (error: unknown) {
        console.error("Groq Suggest Schema Error:", error);
        res.status(500).json({ error: 'Failed to run AI schema suggestion.' });
    }
}

export const validateSchema = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { schema, contractName } = req.body;

        if (!schema || !Array.isArray(schema)) {
            return res.status(400).json({ error: 'Valid schema array is required for validation.' });
        }

        const prompt = `
        You are a Data Quality Architect. Validate the following JSON schema array for a data contract${contractName ? ` named "${contractName}"` : ''}.

        Check for these categories of issues:
        1. "type_mismatch" - Fields with likely incorrect data types (e.g., a field named "created_at" typed as String should be Date)
        2. "naming" - Inconsistent naming conventions (e.g., mixing camelCase and snake_case, vague names like "data1")
        3. "missing_description" - Fields without descriptions
        4. "redundancy" - Potentially duplicate or redundant fields
        5. "completeness" - Commonly expected fields that are missing (e.g., id, timestamps)
        6. "required" - Fields that should be required but aren't, or vice versa

        Return ONLY a JSON object with this exact structure:
        {
            "issues": [
                {
                    "severity": "error" | "warning" | "suggestion",
                    "field": "field_name or null if general",
                    "category": "type_mismatch" | "naming" | "missing_description" | "redundancy" | "completeness" | "required",
                    "message": "Human-readable description of the issue",
                    "suggestedFix": { "key": "value to change" } or null
                }
            ],
            "score": 0-100,
            "summary": "Brief summary of findings"
        }

        Schema to validate:
        ${JSON.stringify(schema)}
        `;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            response_format: { type: "json_object" },
        });

        const responseText = completion.choices[0]?.message?.content || "{}";
        let result = { issues: [], score: 100, summary: 'No issues found.' };
        try {
            const parsed = JSON.parse(responseText);
            result = {
                issues: parsed.issues || [],
                score: parsed.score ?? 100,
                summary: parsed.summary || 'Analysis complete.'
            };
        } catch (e) {
            console.error("Failed to parse Groq Validation JSON:", responseText);
        }

        res.status(200).json(result);

    } catch (error: unknown) {
        console.error("Groq Validate Schema Error:", error);
        res.status(500).json({ error: 'Failed to run AI schema validation.' });
    }
}
