import express from 'express';
import {
  getUserAnalysis,
  compareUsers,
  generateBadge,
  generateProfileCard,
} from '../controllers/user.controller.js';

const router = express.Router();

router.get('/user/:username', getUserAnalysis);
router.get('/compare/:user1/:user2', compareUsers);
router.get('/badge/:username', generateBadge);
router.get('/card/:username', generateProfileCard);
router.get('/rank-badge/:username', generateRankBadge);
router.get('/rank-level/:username', generateRankLevelBadge);

router.get('/', (req, res) => {
  res.json({
    service: 'Smart GitHub Analyzer API',
    version: '2.0.0',
    endpoints: [
      '/api/user/:username',
      '/api/compare/:user1/:user2',
      '/api/badge/:username',
      '/api/card/:username',
      'api/rank-badge/:username',
      'api/rank-level/:username',
    ],
    documentation: 'https://github.com/Shineii86/GitHubAPI',
  });
});

export default router;
