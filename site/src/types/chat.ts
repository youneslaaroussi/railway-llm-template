import { MemoryDto } from "./memory";

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'data'
  content: string
  createdAt?: Date
  memories?: MemoryDto[]
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

export interface ToolCall {
  id: string;
  toolName: string;
  description: string;
}

export interface ToolCallContent extends ToolCall {
  isComplete: boolean;
  data: any;
  result?: any;
}