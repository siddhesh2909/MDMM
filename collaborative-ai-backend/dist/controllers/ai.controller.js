"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestSchema = exports.analyzeData = exports.handleChat = void 0;
const groq_1 = require("../lib/groq");
const SYSTEM_PROMPT = `
You are an expert Data Engineering and Analytics AI Assistant working within a Collaborative AI Platform for E-Commerce. 
Your role is to help users understand their data pipelines, anomalies, contracts, and revenue metrics.
Answer questions directly, concisely, and use a professional yet approachable tone. 
The user is querying their platform's state. 
Be helpful, provide specific mock metric numbers if asked (e.g. $124k revenue), and format output in simple markdown.
`;
const handleChat = async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message content is required.' });
        }
        // Ideally, history would be mapped cleanly, but for demo we just pass the latest prompt
        const completion = await (0, groq_1.getGroqChatCompletion)(message, SYSTEM_PROMPT);
        const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't formulate a response.";
        res.status(200).json({ reply: aiResponse });
    }
    catch (error) {
        console.error("Groq Chat Error:", error);
        res.status(500).json({ error: 'Failed to process AI chat request.' });
    }
};
exports.handleChat = handleChat;
const analyzeData = async (req, res) => {
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
        const completion = await groq_1.groq.chat.completions.create({
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
        }
        catch (e) {
            console.error("Failed to parse Groq JSON:", responseText);
        }
        res.status(200).json({ status: "success", anomalies });
    }
    catch (error) {
        console.error("Groq Analysis Error:", error);
        res.status(500).json({ error: 'Failed to run AI data analysis.' });
    }
};
exports.analyzeData = analyzeData;
const suggestSchema = async (req, res) => {
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
        const completion = await groq_1.groq.chat.completions.create({
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
        }
        catch (e) {
            console.error("Failed to parse Groq Suggestion JSON:", responseText);
        }
        res.status(200).json({ status: "success", improvedSchema });
    }
    catch (error) {
        console.error("Groq Suggest Schema Error:", error);
        res.status(500).json({ error: 'Failed to run AI schema suggestion.' });
    }
};
exports.suggestSchema = suggestSchema;
