import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import authRoutes from './routes/auth.routes';
import aiRoutes from './routes/ai.routes';
import dataRoutes from './routes/data.routes';
import collaborationRoutes from './routes/collaboration.routes';
import { initWebSocket } from './services/websocket.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
initWebSocket(server);

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://collaborative-ai-platform-ywpe.vercel.app'
    ],
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    res.on('finish', () => {
        console.log(`[HTTP] ${req.method} ${req.url} -> ${res.statusCode}`);
    });
    next();
});

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Main Root
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Collaborative AI Platform API.' });
});

// API Routing
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/collaboration', collaborationRoutes);

// Error Handling block
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

server.listen(PORT, () => {
    console.log(`Backend Server running locally on http://localhost:${PORT}`);
});
