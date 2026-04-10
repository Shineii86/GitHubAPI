/**
 * Centralised environment configuration with validation.
 * All environment variables are loaded and validated here.
 */
import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = ['GITHUB_TOKEN'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

export const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // GitHub API
  githubToken: process.env.GITHUB_TOKEN,
  githubApiTimeout: parseInt(process.env.GITHUB_API_TIMEOUT, 10) || 10000,

  // OpenAI (optional)
  openAiKey: process.env.OPENAI_API_KEY || null,
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // Redis (optional)
  redisUrl: process.env.REDIS_URL || null,
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL, 10) || 300, // 5 minutes

  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  // Logging
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
};

// Log configuration on startup (except secrets)
if (!config.isProduction) {
  console.log('📋 Configuration:', {
    port: config.port,
    nodeEnv: config.nodeEnv,
    openAiEnabled: !!config.openAiKey,
    redisEnabled: !!config.redisUrl,
    cacheTtl: config.cacheTtlSeconds,
  });
}
