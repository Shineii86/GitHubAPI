/**
 * Redis cache wrapper with graceful fallback.
 */
import Redis from 'ioredis';
import { config } from '../config/env.js';

let redis = null;
let memoryCache = new Map(); // Fallback in-memory cache

if (config.redisUrl) {
  redis = new Redis(config.redisUrl, {
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('⚠️ Redis connection failed, using in-memory cache');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
  });

  redis.on('connect', () => console.log('✅ Redis connected'));
  redis.on('error', (err) => {
    console.warn('⚠️ Redis error:', err.message);
    redis = null; // Fallback to memory
  });
} else {
  console.log('ℹ️ Redis not configured – using in-memory cache');
}

/**
 * Get cached data.
 * @param {string} key
 * @returns {Promise<object|null>}
 */
export const getCached = async (key) => {
  if (redis) {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Redis get error:', err.message);
      // Fall through to memory cache
    }
  }
  // In-memory fallback
  const entry = memoryCache.get(key);
  if (entry && entry.expiry > Date.now()) {
    return entry.value;
  }
  memoryCache.delete(key);
  return null;
};

/**
 * Store data in cache with TTL.
 * @param {string} key
 * @param {object} value
 * @param {number} ttlSeconds
 */
export const setCached = async (key, value, ttlSeconds = config.cacheTtlSeconds) => {
  const serialized = JSON.stringify(value);
  if (redis) {
    try {
      await redis.set(key, serialized, 'EX', ttlSeconds);
      return;
    } catch (err) {
      console.error('Redis set error:', err.message);
    }
  }
  // In-memory fallback
  memoryCache.set(key, {
    value,
    expiry: Date.now() + ttlSeconds * 1000,
  });
  // Cleanup old entries periodically
  if (memoryCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of memoryCache) {
      if (v.expiry <= now) memoryCache.delete(k);
    }
  }
};
