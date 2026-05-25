import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.GROQ_API_KEY) {
    console.error("CRITICAL: GROQ_API_KEY is missing from environment variables.");
}

export const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || ''
});

// Helper for quick completions
export async function getGroqChatCompletion(prompt: string, systemContext?: string) {
    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (systemContext) {
        messages.push({ role: 'system', content: systemContext });
    }
    messages.push({ role: 'user', content: prompt });

    return groq.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile', // Fast, default model
        temperature: 0.5,
        max_tokens: 1024,
    });
}
