/**
 * Redis cache wrapper.
 * All cache operations gracefully fall back to no‑op if Redis is not configured.
 */
import Redis from 'ioredis';
import { config } from '../config/env.js';

let redis = null;

if (config.redisUrl) {
  redis = new Redis(config.redisUrl);
  redis.on('error', (err) => console.warn('⚠️ Redis error:', err.message));
  console.log('✅ Redis cache enabled');
} else {
  console.log('ℹ️ Redis not configured – caching disabled');
}

/**
 * Get cached JSON data.
 * @param {string} key
 * @returns {Promise<object|null>}
 */
export const getCached = async (key) => {
  if (!redis) return null;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

/**
 * Store JSON data in cache with TTL.
 * @param {string} key
 * @param {object} value
 * @param {number} ttlSeconds - Time to live (default 300 seconds = 5 minutes)
 */
export const setCached = async (key, value, ttlSeconds = 300) => {
  if (!redis) return;
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
};
