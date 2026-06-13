"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const data_routes_1 = __importDefault(require("./routes/data.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
// Middleware
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:3000',
        'https://collaborative-ai-platform-ywpe.vercel.app'
    ],
    credentials: true,
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Main Root
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Collaborative AI Platform API.' });
});
// API Routing
app.use('/api/auth', auth_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
app.use('/api/data', data_routes_1.default);
// Error Handling block
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});
app.listen(PORT, () => {
    console.log(`Backend Server running locally on http://localhost:${PORT}`);
});
