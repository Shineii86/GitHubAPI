import express from 'express';
import {
  getUserAnalysis,
  compareUsers,
  generateProfileCard,
} from '../controllers/user.controller.js';
import { config } from '../config/env.js';

const router = express.Router();

// Optional rate limiting
if (config.isProduction) {
  // In production, you might add express-rate-limit middleware here
}

// API routes
router.get('/user/:username', getUserAnalysis);
router.get('/vs/:user1/:user2', compareUsers);
router.get('/card/:username', generateProfileCard);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root API info
router.get('/', (req, res) => {
  res.json({
    service: 'Smart GitHub Analyzer API',
    version: '3.0.0',
    endpoints: [
      'GET /api/user/:username',
      'GET /api/vs/:user1/:user2',
      'GET /api/card/:username',
      'GET /api/health',
    ],
    documentation: 'https://github.com/Shineii86/GitHubAPI',
  });
});

export default router;
