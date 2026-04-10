/**
 * Express Application v3.0
 * Security headers, compression, and health checks
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';
import userRoutes from './routes/user.routes.js';
import { config } from './config/env.js';
import { cache } from './services/cache.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  crossOriginEmbedderPolicy: false // Allow images from GitHub
}));

app.use(compression());
app.use(express.json({ limit: '10kb' })); // Prevent large payloads

// Request logging
if (config.nodeEnv !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const cacheStats = cache.getStats();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    cache: cacheStats,
    uptime: process.uptime()
  });
});

// API routes
app.use('/api', userRoutes);

// Static files
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath, { maxAge: '1d' }));

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(publicPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found', path: req.path });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString()
  });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(config.port, () => {
    console.log(`
    🚀 GitHub Analyzer v3.0.0
    ━━━━━━━━━━━━━━━━━━━━━━━━
    📊 API:    http://localhost:${config.port}/api/user/octocat
    🏥 Health: http://localhost:${config.port}/health
    🌐 Web:    http://localhost:${config.port}
    `);
  });
}

export default app;
