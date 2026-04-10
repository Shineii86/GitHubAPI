/**
 * Redis Cache Service v3.0
 * Smart caching with stale-while-revalidate pattern
 */
import Redis from 'ioredis';
import { config } from '../config/env.js';

class CacheService {
  constructor() {
    this.redis = null;
    this.localCache = new Map(); // Fallback in-memory cache
    this.connectionStatus = 'disconnected';
    this.ttlSeconds = 300; // 5 minutes default
    
    this.initialize();
  }

  initialize() {
    if (!config.redisUrl) {
      console.log('ℹ️ Redis not configured – using in-memory fallback');
      this.connectionStatus = 'memory';
      return;
    }

    try {
      this.redis = new Redis(config.redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          if (times > 3) {
            console.warn(`⚠️ Redis retry ${times}, switching to memory cache`);
            this.connectionStatus = 'degraded';
          }
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
      });

      this.redis.on('connect', () => {
        console.log('✅ Redis cache connected');
        this.connectionStatus = 'connected';
      });

      this.redis.on('error', (err) => {
        console.warn('⚠️ Redis error:', err.message);
        this.connectionStatus = 'degraded';
      });

    } catch (err) {
      console.error('❌ Redis initialization failed:', err.message);
      this.connectionStatus = 'memory';
    }
  }

  async get(key) {
    // Try Redis first
    if (this.redis && this.connectionStatus === 'connected') {
      try {
        const data = await this.redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          return { ...parsed, _cacheSource: 'redis' };
        }
      } catch (err) {
        console.warn('Redis get failed, falling back to memory:', err.message);
      }
    }

    // Fallback to memory
    const memoryData = this.localCache.get(key);
    if (memoryData && memoryData.expires > Date.now()) {
      return { ...memoryData.value, _cacheSource: 'memory' };
    }

    return null;
  }

  async set(key, value, ttl = this.ttlSeconds) {
    const enrichedValue = {
      ...value,
      _cachedAt: new Date().toISOString(),
      _ttl: ttl
    };

    // Always save to memory as backup
    this.localCache.set(key, {
      value: enrichedValue,
      expires: Date.now() + (ttl * 1000)
    });

    // Try Redis
    if (this.redis && this.connectionStatus === 'connected') {
      try {
        await this.redis.set(key, JSON.stringify(enrichedValue), 'EX', ttl);
      } catch (err) {
        console.warn('Redis set failed, saved to memory only:', err.message);
      }
    }

    return true;
  }

  async delete(key) {
    this.localCache.delete(key);
    if (this.redis && this.connectionStatus === 'connected') {
      try {
        await this.redis.del(key);
      } catch (err) {
        console.warn('Redis delete failed:', err.message);
      }
    }
  }

  async getOrSet(key, factory, ttl = this.ttlSeconds) {
    const cached = await this.get(key);
    
    if (cached) {
      // If cache is old but not expired, trigger background refresh (stale-while-revalidate)
      const cachedTime = new Date(cached._cachedAt || 0).getTime();
      const age = Date.now() - cachedTime;
      const staleThreshold = (ttl * 1000) * 0.8; // 80% of TTL
      
      if (age > staleThreshold && this.connectionStatus === 'connected') {
        // Background refresh without awaiting
        this.refreshCache(key, factory, ttl);
      }
      
      return cached;
    }

    // Cache miss - generate and store
    const fresh = await factory();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  async refreshCache(key, factory, ttl) {
    try {
      const fresh = await factory();
      await this.set(key, fresh, ttl);
      console.log(`🔄 Background cache refresh: ${key}`);
    } catch (err) {
      console.error(`Failed to refresh cache for ${key}:`, err.message);
    }
  }

  getStats() {
    return {
      connectionStatus: this.connectionStatus,
      memoryCacheSize: this.localCache.size,
      redisAvailable: !!this.redis
    };
  }
}

export const cache = new CacheService();
export const getCached = (key) => cache.get(key);
export const setCached = (key, value, ttl) => cache.set(key, value, ttl);
