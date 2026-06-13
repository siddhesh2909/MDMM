"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_controller_1 = require("../controllers/ai.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Secure AI routes
router.post('/chat', auth_1.authenticateToken, ai_controller_1.handleChat);
router.post('/analyze', auth_1.authenticateToken, ai_controller_1.analyzeData);
router.post('/suggest-schema', auth_1.authenticateToken, ai_controller_1.suggestSchema);
router.post('/validate-schema', auth_1.authenticateToken, ai_controller_1.validateSchema);
exports.default = router;
