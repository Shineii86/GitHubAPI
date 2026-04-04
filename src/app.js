/**
 * Main Express application.
 * Serves:
 * - API routes under /api
 * - Static frontend website (from /public folder)
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import userRoutes from './routes/user.routes.js';
import { config } from './config/env.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json());

// Request logging (development only)
if (config.nodeEnv !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// Serve static frontend files from /public
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// API routes (all under /api)
app.use('/api', userRoutes);

// Root route – serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Catch-all for any other non-API routes – serve the frontend (SPA style)
app.get('*', (req, res) => {
  // If the request is not for an API endpoint, serve index.html
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(publicPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server only when run directly (not imported as a module)
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`📊 API: http://localhost:${config.port}/api/user/octocat`);
    console.log(`🌐 Website: http://localhost:${config.port}`);
  });
}

export default app;
