import { Router } from 'express';
import { handleChat, analyzeData, suggestSchema, validateSchema } from '../controllers/ai.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure AI routes
router.post('/chat', authenticateToken, handleChat);
router.post('/analyze', authenticateToken, analyzeData);
router.post('/suggest-schema', authenticateToken, suggestSchema);
router.post('/validate-schema', authenticateToken, validateSchema);

export default router;
