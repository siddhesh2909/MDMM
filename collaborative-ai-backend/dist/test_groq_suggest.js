"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const groq_sdk_1 = require("groq-sdk");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const groq = new groq_sdk_1.Groq({ apiKey: process.env.GROQ_API_KEY });
async function test() {
    try {
        const prompt = `
        You are an expert Data Architect. Review the following JSON schema array.
        Improve it by standardizing data types to proper SQL types (String, Integer, Float, Date, Boolean),
        setting "required": true if appropriate, and generating concise, professional descriptions for any missing descriptions.
        Do not change the "name" field of the columns.
        Return ONLY a JSON array of the improved schema objects matching exactly this format:
        [{"name": "field1", "type": "String", "required": true, "description": "Professional description"}]
        
        Current Schema: 
        [{"name":"foo","type":"String"}]
        `;
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
            temperature: 0.1,
            response_format: { type: "json_object" },
        });
        console.log("Response:", completion.choices[0]?.message?.content);
    }
    catch (e) {
        console.error("Error:", e);
    }
}
test();
