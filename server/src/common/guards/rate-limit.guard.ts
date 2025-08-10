import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { Request } from 'express';

export interface RateLimitResult {
  allowed: boolean;
  blocked: boolean;
  remaining: number;
  resetTime: number;
  blockExpiresAt?: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly enabled: boolean;
  private readonly maxRequests: number;
  private readonly windowSeconds: number;
  private readonly blockDurationSeconds: number;

  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.enabled = this.configService.get<string>('RATE_LIMIT_ENABLED', 'true') === 'true';
    this.maxRequests = parseInt(this.configService.get<string>('RATE_LIMIT_MAX_REQUESTS', '20'), 10);
    this.windowSeconds = parseInt(this.configService.get<string>('RATE_LIMIT_TTL', '300'), 10);
    this.blockDurationSeconds = parseInt(this.configService.get<string>('RATE_LIMIT_BLOCK_DURATION', '900'), 10);

    this.logger.log(
      `Rate limiting ${this.enabled ? 'enabled' : 'disabled'} - Max: ${this.maxRequests} requests per ${this.windowSeconds}s, Block duration: ${this.blockDurationSeconds}s`,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const identifier = this.getClientIdentifier(request);

    try {
      const result = await this.checkRateLimit(identifier);

      if (result.blocked) {
        this.logger.warn(
          `Client ${identifier} is blocked. Block expires in ${Math.ceil(result.blockExpiresAt! / 1000)}s`
        );
        
        throw new HttpException(
          {
            message: "I'm currently experiencing high traffic and need to limit requests. Please try again in a few minutes. Your patience is appreciated!",
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            retryAfter: Math.ceil(result.blockExpiresAt! / 1000),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (!result.allowed) {
        this.logger.warn(
          `Rate limit exceeded for ${identifier}. Blocking for ${this.blockDurationSeconds}s`
        );

        // Block the client
        await this.redisService.setBlock(identifier, this.blockDurationSeconds);

        throw new HttpException(
          {
            message: "I'm currently experiencing high traffic and need to limit requests. Please try again in a few minutes. Your patience is appreciated!",
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            retryAfter: this.blockDurationSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Add rate limit headers to response
      const response = context.switchToHttp().getResponse();
      response.set({
        'X-RateLimit-Limit': this.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      });

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Rate limiting error for ${identifier}:`, error);
      // Fail open - allow request if Redis is down
      return true;
    }
  }

  private getClientIdentifier(request: Request): string {
    // Get real IP address considering proxies
    const forwarded = request.headers['x-forwarded-for'];
    const realIp = request.headers['x-real-ip'];
    const ip = forwarded 
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
      : realIp || request.ip || request.connection.remoteAddress || 'unknown';

    return `ip:${ip}`;
  }

  private async checkRateLimit(identifier: string): Promise<RateLimitResult> {
    // First check if the client is blocked
    const blockInfo = await this.redisService.getBlockInfo(identifier);
    if (blockInfo.isBlocked) {
      return {
        allowed: false,
        blocked: true,
        remaining: 0,
        resetTime: Date.now() + (blockInfo.ttl * 1000),
        blockExpiresAt: blockInfo.ttl * 1000,
      };
    }

    // Check current rate limit
    const { count, isFirstRequest } = await this.redisService.incrementRateLimit(
      identifier,
      this.windowSeconds,
    );

    const allowed = count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - count);
    
    // Calculate reset time
    let resetTime: number;
    if (isFirstRequest) {
      resetTime = Date.now() + (this.windowSeconds * 1000);
    } else {
      const rateLimitInfo = await this.redisService.getRateLimitInfo(identifier);
      resetTime = Date.now() + (rateLimitInfo.ttl * 1000);
    }

    this.logger.debug(
      `Rate limit check for ${identifier}: ${count}/${this.maxRequests} requests, remaining: ${remaining}, allowed: ${allowed}`,
    );

    return {
      allowed,
      blocked: false,
      remaining,
      resetTime,
    };
  }
} 