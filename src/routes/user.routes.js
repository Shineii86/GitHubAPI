import express from 'express';
import {
  getUserAnalysis,
  compareUsers,
  generateProfileCard,
} from '../controllers/user.controller.js';

const router = express.Router();

router.get('/user/:username', getUserAnalysis);
router.get('/vs/:user1/:user2', compareUsers);
router.get('/card/:username', generateProfileCard);

router.get('/', (req, res) => {
  res.json({
    service: 'Smart GitHub Analyzer API',
    version: '2.0.0',
    endpoints: [
      '/api/user/:username',
      '/api/vs/:user1/:user2',
      '/api/card/:username',
    ],
    documentation: 'https://github.com/Shineii86/GitHubAPI',
  });
});

export default router;
