import { Body, Controller, Post, Sse, UseGuards, UseFilters } from '@nestjs/common';
import { RealIP } from 'nestjs-real-ip';
import { AgentService } from './agent.service';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { ChatRequestDto } from './dto/agent.dto';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RateLimitExceptionFilter } from '../common/filters/rate-limit-exception.filter';

@Controller('agent')
@UseGuards(RateLimitGuard)
@UseFilters(RateLimitExceptionFilter)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  async chat(@Body() chatRequestDto: ChatRequestDto, @RealIP() userIp: string) {
    return this.agentService.processRequest({
      message: chatRequestDto.message,
      conversationHistory: chatRequestDto.conversationHistory,
      sessionId: chatRequestDto.sessionId,
      userIp: userIp,
      memories: chatRequestDto.memories,
    });
  }

  @Post('chat/stream')
  @Sse()
  chatStream(
    @Body() chatRequestDto: ChatRequestDto,
    @RealIP() userIp: string,
  ): Observable<MessageEvent> {
    const stream = this.agentService.processRequestStream({
      message: chatRequestDto.message,
      conversationHistory: chatRequestDto.conversationHistory,
      sessionId: chatRequestDto.sessionId,
      userIp: userIp,
      memories: chatRequestDto.memories,
    });

    return from(stream).pipe(map((data) => new MessageEvent('message', { data })));
  }
} 