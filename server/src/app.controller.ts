import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Welcome message', description: 'Get a welcome message from the API' })
  @ApiResponse({ status: 200, description: 'Welcome message returned successfully' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('healthcheck')
  @ApiOperation({ summary: 'Health check for AWS', description: 'Global health check endpoint for AWS load balancers' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiTags('health')
  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }
}
