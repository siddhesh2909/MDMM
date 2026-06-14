"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const groq_1 = require("./lib/groq");
async function test() {
    const prompt = `
    You are an expert Data Engineer. Analyze the following JSON data array and return a JSON schema definition.
    Return purely a JSON array representing the fields. Each object must have:
    - "name": the exact column/key name
    - "type": inferred SQL type (e.g. String, Integer, Float, Date, UUID, Boolean)
    - "required": true if the field seems present in all rows
    - "description": a short inferred description
    
    Data Sample: 
    [{"id":"1","name":"Alice"}]
    `;
    try {
        const completion = await groq_1.groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
            temperature: 0.1,
            response_format: { type: "json_object" },
        });
        console.log("RESPONSE:", completion.choices[0]?.message?.content);
    }
    catch (e) {
        console.error("ERROR:", e);
    }
}
test();
