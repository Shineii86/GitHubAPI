import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = ['GITHUB_TOKEN'];
const missing = requiredEnvVars.filter(v => !process.env[v]);

export const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  githubToken: process.env.GITHUB_TOKEN || '',
  githubApiTimeout: parseInt(process.env.GITHUB_API_TIMEOUT, 10) || 10000,

  openAiKey: process.env.OPENAI_API_KEY || null,
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  redisUrl: process.env.REDIS_URL || null,
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL, 10) || 300,

  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,

  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  // Validation flag – set to true if required vars are present
  isValid: missing.length === 0,
  missingEnvVars: missing,
};

// Log but don't exit
if (!config.isValid) {
  console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
  if (!config.isProduction) {
    console.warn('⚠️ Running in development mode without required variables – some features may fail.');
  }
} else {
  console.log('✅ Environment configuration valid');
}
