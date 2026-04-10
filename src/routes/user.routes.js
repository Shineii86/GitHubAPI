import express from 'express';
import { 
  getUserAnalysis, 
  compareUsers, 
  generateProfileCard 
} from '../controllers/user.controller.js';

const router = express.Router();

// Version prefix for future API versioning
const v1 = express.Router();

v1.get('/user/:username', getUserAnalysis);
v1.get('/vs/:user1/:user2', compareUsers);
v1.get('/card/:username', generateProfileCard);
v1.get('/compare/:user1/:user2', compareUsers); // Alias

// Root info
v1.get('/', (req, res) => {
  res.json({
    service: 'GitHub Profile Analyzer',
    version: '3.0.0',
    endpoints: {
      analyze: '/api/user/:username',
      compare: '/api/vs/:user1/:user2',
      card: '/api/card/:username?theme=dark&bgImage=1',
      health: '/health'
    },
    documentation: 'https://github.com/Shineii86/GitHubAPI'
  });
});

router.use('/', v1);

export default router;
