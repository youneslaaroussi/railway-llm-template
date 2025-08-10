import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class RateLimitExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RateLimitExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      const exceptionResponse = exception.getResponse() as any;
      
      this.logger.warn('Rate limit exceeded - returning agent response format');

      // Return response in agent format
      const agentResponse = {
        message: exceptionResponse.message || "I'm currently experiencing high traffic and need to limit requests. Please try again in a few minutes. Your patience is appreciated!",
        conversationHistory: [],
        sessionId: `rate-limited-${Date.now()}`,
        completed: true,
        rateLimited: true,
        retryAfter: exceptionResponse.retryAfter || 300,
      };

      response
        .status(HttpStatus.TOO_MANY_REQUESTS)
        .set({
          'Retry-After': (exceptionResponse.retryAfter || 300).toString(),
          'Content-Type': 'application/json',
        })
        .json(agentResponse);
    } else {
      // Re-throw other HTTP exceptions
      throw exception;
    }
  }
} 