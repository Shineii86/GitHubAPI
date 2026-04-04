/**
 * Main Express application.
 * Used both for local development (listens on a port) and as a serverless function (exported).
 */
import express from 'express';
import userRoutes from './routes/user.routes.js';
import { config } from './config/env.js';

const app = express();

// Middleware
app.use(express.json());

// Request logging (optional, for local debugging)
if (config.nodeEnv !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// Mount API routes
app.use('/api', userRoutes);

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/api');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
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
    console.log(`📊 Try: http://localhost:${config.port}/api/user/octocat`);
  });
}

// Export for Vercel serverless deployment
export default app;
