import { groq } from './lib/groq';

async function test() {
    const rawData = [
        { id: 1, date: '2026-03-01', revenue: 15400, region: 'North America' },
        { id: 2, date: '2026-03-02', revenue: 'Omitted', region: 'Europe' },
        { id: 3, date: '2026-03-03', revenue: 16200, region: 'Asia Pacific' },
        { id: 4, date: '2026-03-04', revenue: 15800, region: 'Unknown' },
        { id: 5, date: '2026-03-05', revenue: 999999, region: 'North America' }
    ];

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

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-8b-instant',
            temperature: 0.1, // Low temp for analytical consistency
            response_format: { type: "json_object" },
        });

        console.log("RESPONSE:", completion.choices[0]?.message?.content);
    } catch (e) {
        console.error("ERROR:", e);
    }
}

test();
