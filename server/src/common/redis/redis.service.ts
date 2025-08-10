import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis | null = null;
  private isEnabled = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('UPSTASH_REDIS_REST_URL');
    const token = this.configService.get<string>('UPSTASH_REDIS_REST_TOKEN');

    if (!url || !token) {
      this.isEnabled = false;
      this.redis = null;
      this.logger.warn('Redis is not configured (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN missing). Proceeding without caching or rate limiting.');
      return;
    }

    try {
      this.redis = new Redis({
        url,
        token,
        automaticDeserialization: false,
      });
      // Test the connection
      await this.redis.ping();
      this.isEnabled = true;
      this.logger.log('Redis connection established successfully');
    } catch (error) {
      this.isEnabled = false;
      this.redis = null;
      this.logger.error('Failed to connect to Redis. Continuing without Redis:', error);
    }
  }

  async onModuleDestroy() {
    // Upstash Redis doesn't require explicit disconnection for REST API
    this.logger.log('Redis service destroyed');
  }

  async get(key: string): Promise<string | null> {
    if (!this.isEnabled || !this.redis) return null;
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      throw error;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isEnabled || !this.redis) return;
    try {
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, value);
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isEnabled || !this.redis) return;
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.isEnabled || !this.redis) return 0;
    try {
      return await this.redis.incr(key);
    } catch (error) {
      this.logger.error(`Error incrementing key ${key}:`, error);
      throw error;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.isEnabled || !this.redis) return;
    try {
      await this.redis.expire(key, ttlSeconds);
    } catch (error) {
      this.logger.error(`Error setting expiration for key ${key}:`, error);
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isEnabled || !this.redis) return 0;
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error(`Error getting TTL for key ${key}:`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.redis) return false;
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking existence of key ${key}:`, error);
      throw error;
    }
  }

  // Rate limiting specific methods
  async incrementRateLimit(identifier: string, windowSeconds: number): Promise<{ count: number; isFirstRequest: boolean }> {
    if (!this.isEnabled || !this.redis) {
      return { count: 0, isFirstRequest: true };
    }
    try {
      const key = `rate_limit:${identifier}`;
      const count = await this.redis.incr(key);
      const isFirstRequest = count === 1;
      
      if (isFirstRequest) {
        await this.redis.expire(key, windowSeconds);
      }
      
      return { count, isFirstRequest };
    } catch (error) {
      this.logger.error(`Error incrementing rate limit for ${identifier}:`, error);
      throw error;
    }
  }

  async getRateLimitInfo(identifier: string): Promise<{ count: number; ttl: number }> {
    if (!this.isEnabled || !this.redis) {
      return { count: 0, ttl: 0 };
    }
    try {
      const key = `rate_limit:${identifier}`;
      const [count, ttl] = await Promise.all([
        this.redis.get(key),
        this.redis.ttl(key)
      ]);
      
      return {
        count: count && typeof count === 'string' ? parseInt(count, 10) : 0,
        ttl: ttl || 0
      };
    } catch (error) {
      this.logger.error(`Error getting rate limit info for ${identifier}:`, error);
      throw error;
    }
  }

  async setBlock(identifier: string, durationSeconds: number): Promise<void> {
    if (!this.isEnabled || !this.redis) return;
    try {
      const key = `blocked:${identifier}`;
      await this.redis.setex(key, durationSeconds, '1');
    } catch (error) {
      this.logger.error(`Error setting block for ${identifier}:`, error);
      throw error;
    }
  }

  async isBlocked(identifier: string): Promise<boolean> {
    if (!this.isEnabled || !this.redis) return false;
    try {
      const key = `blocked:${identifier}`;
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking if ${identifier} is blocked:`, error);
      // In case of error, allow the request (fail open)
      return false;
    }
  }

  async getBlockInfo(identifier: string): Promise<{ isBlocked: boolean; ttl: number }> {
    if (!this.isEnabled || !this.redis) {
      return { isBlocked: false, ttl: 0 };
    }
    try {
      const key = `blocked:${identifier}`;
      const [exists, ttl] = await Promise.all([
        this.redis.exists(key),
        this.redis.ttl(key)
      ]);
      
      return {
        isBlocked: exists === 1,
        ttl: ttl || 0
      };
    } catch (error) {
      this.logger.error(`Error getting block info for ${identifier}:`, error);
      return { isBlocked: false, ttl: 0 };
    }
  }

  // Caching methods for API responses
  async getCachedResponse(cacheKey: string): Promise<any | null> {
    if (!this.isEnabled || !this.redis) return null;
    try {
      const cached = await this.redis.get(cacheKey);
      
      if (!cached) {
        return null;
      }
      
      // Ensure cached value is a string
      if (typeof cached !== 'string') {
        this.logger.warn(`Found non-string cached response for ${cacheKey}, clearing cache entry`, {
          actualType: typeof cached,
          value: cached
        });
        await this.redis.del(cacheKey);
        return null;
      }
      
      const cachedString = cached;
      
      // Check for invalid cached data
      if (cachedString === '[object Object]' || cachedString.startsWith('[object ')) {
        this.logger.warn(`Found invalid cached response for ${cacheKey}, clearing cache entry`);
        await this.redis.del(cacheKey);
        return null;
      }
      
      try {
        return JSON.parse(cachedString);
      } catch (parseError) {
        this.logger.warn(`Invalid JSON in cached response for ${cacheKey}, clearing cache entry`, {
          error: parseError.message,
          cachedData: cachedString.substring(0, 100)
        });
        await this.redis.del(cacheKey);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error getting cached response for ${cacheKey}:`, error);
      return null;
    }
  }

  async setCachedResponse(cacheKey: string, data: any, ttlSeconds: number): Promise<void> {
    if (!this.isEnabled || !this.redis) return;
    try {
      // Validate that the data can be serialized to JSON
      let serializedData: string;
      try {
        serializedData = JSON.stringify(data);
        if (serializedData === undefined || serializedData === '[object Object]') {
          throw new Error('Invalid serialization result');
        }
      } catch (serializationError) {
        this.logger.warn(`Cannot serialize cached response for ${cacheKey}`, {
          error: serializationError.message,
          dataType: typeof data,
          dataConstructor: data?.constructor?.name
        });
        return; // Skip caching if we can't serialize
      }
      
      await this.redis.setex(cacheKey, ttlSeconds, serializedData);
    } catch (error) {
      this.logger.error(`Error setting cached response for ${cacheKey}:`, error);
      // Don't throw error for caching failures
    }
  }

  // Individual tool result caching
  async getCachedToolResult(toolName: string, argsHash: string): Promise<any | null> {
    if (!this.isEnabled || !this.redis) return null;
    try {
      const cacheKey = `tool_result:${toolName}:${argsHash}`;
      const cached = await this.redis.get(cacheKey);
      
      if (!cached) {
        return null;
      }
      
      // Ensure cached value is a string
      if (typeof cached !== 'string') {
        this.logger.warn(`Found non-string cached data for ${toolName}:${argsHash}, clearing cache entry`, {
          actualType: typeof cached,
          value: cached
        });
        await this.redis.del(cacheKey);
        return null;
      }
      
      const cachedString = cached;
      
      // Check for invalid cached data
      if (cachedString === '[object Object]' || cachedString.startsWith('[object ')) {
        this.logger.warn(`Found invalid cached data for ${toolName}:${argsHash}, clearing cache entry`);
        await this.redis.del(cacheKey);
        return null;
      }
      
      try {
        return JSON.parse(cachedString);
      } catch (parseError) {
        this.logger.warn(`Invalid JSON in cache for ${toolName}:${argsHash}, clearing cache entry`, {
          error: parseError.message,
          cachedData: cachedString.substring(0, 100) // First 100 chars for debugging
        });
        await this.redis.del(cacheKey);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error getting cached tool result for ${toolName}:`, error);
      return null;
    }
  }

  async setCachedToolResult(toolName: string, argsHash: string, result: any, ttlSeconds: number): Promise<void> {
    if (!this.isEnabled || !this.redis) return;
    try {
      const cacheKey = `tool_result:${toolName}:${argsHash}`;
      
      // Validate that the result can be serialized to JSON
      let serializedResult: string;
      try {
        serializedResult = JSON.stringify(result);
        if (serializedResult === undefined || serializedResult === '[object Object]') {
          throw new Error('Invalid serialization result');
        }
      } catch (serializationError) {
        this.logger.warn(`Cannot serialize tool result for ${toolName}:${argsHash}`, {
          error: serializationError.message,
          resultType: typeof result,
          resultConstructor: result?.constructor?.name
        });
        return; // Skip caching if we can't serialize
      }
      
      await this.redis.setex(cacheKey, ttlSeconds, serializedResult);
      this.logger.debug(`Cached tool result for ${toolName}:${argsHash}`);
    } catch (error) {
      this.logger.error(`Error setting cached tool result for ${toolName}:`, error);
      // Don't throw error for caching failures
    }
  }

  async generateToolCacheKey(toolName: string, args: any): Promise<string> {
    // Create a stable hash of the tool arguments
    const argsString = JSON.stringify(args, Object.keys(args).sort());
    return this.simpleHash(argsString);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
} 