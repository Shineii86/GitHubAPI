/**
 * API route definitions.
 */
import express from 'express';
import {
  getUserAnalysis,
  compareUsers,
  generateBadge,
} from '../controllers/user.controller.js';

const router = express.Router();

// Main analysis endpoint
router.get('/user/:username', getUserAnalysis);

// Compare two users
router.get('/compare/:user1/:user2', compareUsers);

// SVG badge
router.get('/badge/:username', generateBadge);

// Health check / root (optional)
router.get('/', (req, res) => {
  res.json({
    service: 'Smart GitHub Analyzer API',
    version: '2.0',
    endpoints: [
      '/api/user/:username',
      '/api/compare/:user1/:user2',
      '/api/badge/:username',
    ],
  });
});

export default router;
