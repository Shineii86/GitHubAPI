import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import userRoutes from './routes/user.routes.js';
import { config } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security & performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  },
}));
app.use(cors());
app.use(compression());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (only in development)
if (config.nodeEnv !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// API routes
app.use('/api', userRoutes);

// Static files – serve from /public, but gracefully handle missing directory
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath, { fallthrough: true }));

// Root route – fallback to simple message if index.html missing
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'), (err) => {
    if (err) {
      // If index.html is missing (e.g., in pure API deployment), show API info
      res.json({
        service: 'GitHub Smart API',
        version: '2.0.0',
        endpoints: ['/api/user/:username', '/api/vs/:user1/:user2', '/api/card/:username'],
        docs: 'https://github.com/Shineii86/GitHubAPI',
      });
    }
  });
});

// Catch-all – SPA fallback or API 404
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
      if (err) res.status(404).json({ error: 'Not found' });
    });
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export for Vercel
export default app;
