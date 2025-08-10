import { Module } from '@nestjs/common';
import { RedisService } from './redis/redis.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimitExceptionFilter } from './filters/rate-limit-exception.filter';

@Module({
  providers: [RedisService, RateLimitGuard, RateLimitExceptionFilter],
  exports: [RedisService, RateLimitGuard, RateLimitExceptionFilter],
})
export class CommonModule {} 