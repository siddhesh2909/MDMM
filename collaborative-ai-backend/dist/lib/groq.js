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
    console.error("CRITICAL: GROQ_API_KEY is missing from environment variables.");
}
exports.groq = new groq_sdk_1.default({
    apiKey: process.env.GROQ_API_KEY || ''
});
// Helper for quick completions
async function getGroqChatCompletion(prompt, systemContext) {
    const messages = [];
    if (systemContext) {
        messages.push({ role: 'system', content: systemContext });
    }
    messages.push({ role: 'user', content: prompt });
    return exports.groq.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile', // Fast, default model
        temperature: 0.5,
        max_tokens: 1024,
    });
}
