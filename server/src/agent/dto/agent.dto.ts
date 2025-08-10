import { IsArray, IsOptional, IsString, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class MemoryDto {
  @IsString()
  key: string;

  @IsString()
  value: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  timestamp?: string;
}

export class ChatRequestDto {
  @IsString()
  message: string;

  @IsArray()
  @IsOptional()
  conversationHistory?: any[];

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MemoryDto)
  memories?: MemoryDto[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  timestamp?: string;
}

export interface AgentRequest {
  message: string;
  conversationHistory?: ConversationMessage[];
  sessionId?: string;
  userIp?: string;
  context?: Record<string, any>;
  memories?: MemoryDto[];
}

export interface AgentResponse {
  message: string;
  conversationHistory: ConversationMessage[];
  sessionId: string;
  toolCalls?: any[];
  completed: boolean;
}

export interface StreamingUpdate {
  type:
    | 'status'
    | 'thinking'
    | 'tool_start'
    | 'tool_progress'
    | 'tool_complete'
    | 'content'
    | 'content_stream'
    | 'complete'
    | 'reasoning_start'
    | 'reasoning_progress'
    | 'reasoning_complete';
  content?: string;
  toolName?: string;
  toolDescription?: string;
  progress?: number;
  data?: any;
  timestamp: string;
  reasoning?: {
    tokens?: number;
    effort?: 'low' | 'medium' | 'high';
    summary?: string;
    duration?: number; // Duration in milliseconds
  };
} 