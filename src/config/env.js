/**
 * Centralised environment configuration.
 * All environment variables are loaded here and exported.
 */
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // GitHub API
  githubToken: process.env.GITHUB_TOKEN,

  // OpenAI (optional)
  openAiKey: process.env.OPENAI_API_KEY,

  // Redis (optional)
  redisUrl: process.env.REDIS_URL,
};

// Validate required variables
if (!config.githubToken) {
  console.error('❌ Missing GITHUB_TOKEN environment variable');
  process.exit(1);
}
