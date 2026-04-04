/**
 * API route definitions.
 * Contains all public endpoints for user analysis, comparison, badges, and profile cards.
 */
import express from 'express';
import {
  getUserAnalysis,
  compareUsers,
  generateBadge,
  generateProfileCard,
} from '../controllers/user.controller.js';

const router = express.Router();

// Main analysis endpoint
router.get('/user/:username', getUserAnalysis);

// Compare two users side by side
router.get('/compare/:user1/:user2', compareUsers);

// Simple horizontal SVG badge
router.get('/badge/:username', generateBadge);

// Professional profile card with avatar, stats, rank, and score
router.get('/card/:username', generateProfileCard);

// Health check / API information
router.get('/', (req, res) => {
  res.json({
    service: 'Smart GitHub Analyzer API',
    version: '2.0.0',
    endpoints: [
      '/api/user/:username',
      '/api/compare/:user1/:user2',
      '/api/badge/:username',
      '/api/card/:username',
    ],
    documentation: 'https://github.com/Shineii86/GitHubAPI',
  });
});

export default router;
