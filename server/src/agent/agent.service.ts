import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI, APIError } from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as moment from 'moment';
import { encoding_for_model, Tiktoken } from 'tiktoken';
import {
  AgentRequest,
  AgentResponse,
  ConversationMessage,
  StreamingUpdate,
} from './dto/agent.dto';
import { ToolRegistry } from './tools/tool-registry.service';
import { RedisService } from '../common/redis/redis.service';

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private openai: OpenAI | null = null;
  private systemPrompt: string;
  private toolDefinitions: AgentToolDefinition[];
  private maxToolResultTokens: number;
  private maxParallelToolResultTokens: number;
  private isReasoningModel: boolean;
  private reasoningEffort: 'low' | 'medium' | 'high';
  private maxCompletionTokens: number;
  private reasoningTokenReservation: number;
  private tokenEncoder: Tiktoken | null;
  private cacheEnabled: boolean;
  private cacheTtlSeconds: number;
  private toolCacheEnabled: boolean;
  private toolCacheTtlSeconds: number;

  constructor(
    private configService: ConfigService,
    private toolRegistry: ToolRegistry,
    private redisService: RedisService,
  ) { }

  async onModuleInit() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not set. Running in no-LLM mode.');
      this.openai = null;
    } else {
      this.openai = new OpenAI({ apiKey, baseURL });
    }

    this.maxToolResultTokens = parseInt(
      this.configService.get<string>('MAX_TOOL_RESULT_TOKENS', '10000'),
    );
    // Removed -specific limits in template version
    this.maxParallelToolResultTokens = parseInt(
      this.configService.get<string>(
        'MAX_PARALLEL_TOOL_RESULT_TOKENS',
        '15000',
      ),
    );

    const modelName = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o');
    this.isReasoningModel = this.isReasoningModelName(modelName);
    this.reasoningEffort = this.configService.get<'low' | 'medium' | 'high'>(
      'REASONING_EFFORT',
      'medium',
    );
    this.maxCompletionTokens = parseInt(
      this.configService.get<string>('MAX_COMPLETION_TOKENS', '4096'),
    );
    this.reasoningTokenReservation = parseInt(
      this.configService.get<string>('REASONING_TOKEN_RESERVATION', '25000'),
    );

    this.loadSystemPrompt();
    this.loadToolDefinitions();

    try {
      this.tokenEncoder = encoding_for_model('gpt-4');
      this.logger.log('Token encoder initialized successfully');
    } catch (error) {
      this.logger.warn(
        'Failed to initialize token encoder, falling back to estimation:',
        error.message,
      );
      this.tokenEncoder = null;
    }

          this.cacheEnabled = this.configService.get<string>('CACHE_ENABLED', 'false') === 'true';
      this.cacheTtlSeconds = parseInt(
        this.configService.get<string>('CACHE_TTL_SECONDS', '300'),
      );
      this.toolCacheEnabled = this.configService.get<string>('TOOL_CACHE_ENABLED', 'false') === 'true';
      this.toolCacheTtlSeconds = parseInt(
        this.configService.get<string>('TOOL_CACHE_TTL_SECONDS', '600'),
      );

          this.logger.log(
        `Agent service initialized successfully - Model: ${modelName} (reasoning: ${this.isReasoningModel}) - Response caching: ${this.cacheEnabled ? 'enabled' : 'disabled'} - Tool caching: ${this.toolCacheEnabled ? 'enabled' : 'disabled'} - Max tool result tokens: ${this.maxToolResultTokens}`,
      );
  }

  private loadSystemPrompt(): void {
    try {
      const promptPath = join(process.cwd(), 'prompts', 'main.txt');
      this.systemPrompt = readFileSync(promptPath, 'utf-8');
      this.logger.log('System prompt loaded successfully');
    } catch (error) {
      this.logger.warn('Could not load system prompt file; using built-in default.');
      this.systemPrompt = [
        'You are SignalBox, a helpful, general-purpose AI assistant.',
        'Current date and time: {{CURRENT_DATE_TIME}}',
        '{{MEMORIES_SECTION}}',
        'Respond concisely. Use tools when it improves accuracy (memory, currency).'
      ].join('\n');
    }
  }

  private loadToolDefinitions(): void {
    try {
      const toolsPath = join(process.cwd(), 'prompts', 'tools.json');
      const toolsData = readFileSync(toolsPath, 'utf-8');
      this.toolDefinitions = JSON.parse(toolsData);
      this.logger.log('Tool definitions loaded successfully');
    } catch (error) {
      this.logger.error('Could not load tools.json file:', error);
      throw new Error(
        'Tools definition file is required but could not be loaded',
      );
    }
  }

  async *processRequestStream(
    request: AgentRequest,
  ): AsyncGenerator<StreamingUpdate, void, unknown> {
    try {
      if (!this.openai) {
        const msg = 'Configure your API key to enable responses (set OPENAI_API_KEY).';
        yield { type: 'content', content: msg, timestamp: new Date().toISOString() } as any;
        yield { type: 'complete', content: msg, timestamp: new Date().toISOString() } as any;
        return;
      }
      // Check for mock responses environment variable
      const mockEnabled = this.configService.get<string>('MOCK_RESPONSES_ENABLED', 'false') === 'true';
      
      if (mockEnabled) {
        yield* this.processMockResponse(request);
        return;
      }

      const sessionId = request.sessionId || this.generateSessionId();

      this.logger.log(`Processing request for session: ${sessionId}`);

      const conversationHistory: ConversationMessage[] =
        request.conversationHistory || [];

      const userMessage: ConversationMessage = {
        role: 'user',
        content: request.message,
        timestamp: new Date().toISOString(),
      };
      conversationHistory.push(userMessage);

      const systemPromptWithContext = this.replacePlaceholders(
        this.systemPrompt,
        request.memories,
      );

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPromptWithContext,
        },
        ...this.convertConversationToOpenAI(conversationHistory),
      ];

      yield* this.processConversationWithToolsStream(messages, request.userIp);

      yield {
        type: 'complete',
        content: 'Conversation completed successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error processing agent request:', error);

      let content =
        'I apologize, but I encountered an error processing your request. Please try again.';
      if (error instanceof APIError) {
        if (error.code === 'overloaded_error') {
          content =
            'The service is currently overloaded. Please try again in a few moments.';
        } else if (error.status === 400) {
          content =
            "I'm sorry, I couldn't process that. There seems to be an issue with the information provided.";
        }
      }

      yield {
        type: 'complete',
        content: content,
        data: { error: error.message },
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async *processConversationWithToolsStream(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    userIp?: string,
  ): AsyncGenerator<StreamingUpdate, void, unknown> {
    if (!this.openai) {
      const msg = 'Configure your API key to enable responses (set OPENAI_API_KEY).';
      yield { type: 'content', content: msg, timestamp: new Date().toISOString() } as any;
      return;
    }
    const currentMessages = [...messages];
    let toolResults: Record<string, any> = {};
    let iterations = 0;
    const maxIterations = parseInt(
      this.configService.get<string>('MAX_ITERATIONS', '5'),
    );
    let reasoningStartTime: moment.Moment | null = null;

    while (iterations < maxIterations) {
      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParams =
      {
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4o'),
        messages: currentMessages,
        tools: this.toolDefinitions.map((tool) => ({
          type: 'function' as const,
          function: tool,
        })),
        tool_choice: 'auto',
        temperature: parseFloat(
          this.configService.get<string>('OPENAI_TEMPERATURE', '0.1'),
        ),
        stream: true,
      };

      if (this.isReasoningModel) {
        completionParams.reasoning_effort = this.reasoningEffort;
        completionParams.max_completion_tokens = this.maxCompletionTokens;
        delete completionParams.temperature;

        reasoningStartTime = moment();

        yield {
          type: 'reasoning_start',
          content: `Thinking...`,
          reasoning: {
            effort: this.reasoningEffort,
          },
          timestamp: new Date().toISOString(),
        };

        this.logger.log(
          `Agent starting reasoning with ${this.reasoningEffort} effort...`,
        );
      } else {
        completionParams.max_tokens = parseInt(
          this.configService.get<string>('OPENAI_MAX_TOKENS', '4096'),
        );
      }

      const response =
        await this.openai.chat.completions.create(completionParams);

      const assistantMessage = {
        content: '',
        tool_calls:
          [] as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
      };

      let reasoningTokens = 0;
      let completionTokens = 0;
      let reasoningComplete = false;

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta;
        const usage = chunk.usage;

        if (
          this.isReasoningModel &&
          usage?.completion_tokens_details?.reasoning_tokens
        ) {
          const newReasoningTokens =
            usage.completion_tokens_details.reasoning_tokens;
          if (newReasoningTokens > reasoningTokens) {
            reasoningTokens = newReasoningTokens;
            yield {
              type: 'reasoning_progress',
              content: `Thinking...`,
              reasoning: {
                tokens: reasoningTokens,
                effort: this.reasoningEffort,
              },
              timestamp: new Date().toISOString(),
            };

            this.logger.log(
              `Agent reasoning progress: ${reasoningTokens} tokens`,
            );
          }
        }

        if (this.isReasoningModel && delta?.content && !reasoningComplete) {
          reasoningComplete = true;

          const thinkingDuration = reasoningStartTime
            ? moment.duration(moment().diff(reasoningStartTime))
            : null;
          const durationText = thinkingDuration
            ? thinkingDuration.humanize()
            : 'unknown duration';

          yield {
            type: 'reasoning_complete',
            content: `Thought for ${durationText}`,
            reasoning: {
              tokens: reasoningTokens,
              effort: this.reasoningEffort,
              duration: thinkingDuration?.asMilliseconds(),
            },
            timestamp: new Date().toISOString(),
          };

          this.logger.log(
            `Agent reasoning complete: ${reasoningTokens} tokens used in ${durationText}`,
          );
        }

        if (delta?.content) {
          assistantMessage.content += delta.content;
          yield {
            type: 'content_stream',
            content: delta.content,
            timestamp: new Date().toISOString(),
          };
        }

        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            if (toolCall.index !== undefined) {
              if (!assistantMessage.tool_calls[toolCall.index]) {
                assistantMessage.tool_calls[toolCall.index] = {
                  id: toolCall.id || '',
                  type: 'function',
                  function: {
                    name: toolCall.function?.name || '',
                    arguments: toolCall.function?.arguments || '',
                  },
                };
              } else {
                if (toolCall.function?.arguments) {
                  assistantMessage.tool_calls[
                    toolCall.index
                  ].function.arguments += toolCall.function.arguments;
                }
              }
            }
          }
        }

        if (usage?.completion_tokens) {
          completionTokens = usage.completion_tokens;
        }
      }

      if (
        !assistantMessage.tool_calls ||
        assistantMessage.tool_calls.length === 0
      ) {
        yield {
          type: 'content',
          content:
            assistantMessage.content || "I couldn't process your request.",
          data: {
            toolResults:
              Object.keys(toolResults).length > 0 ? toolResults : undefined,
          },
          timestamp: new Date().toISOString(),
        };
        return;
      }

      const currentToolResults: Record<string, any> = {};
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const tool = this.toolRegistry.getTool(toolName);

        yield {
          type: 'tool_start',
          toolName,
          toolDescription: tool?.description,
          timestamp: new Date().toISOString(),
        };

        this.logger.log(`Executing tool: ${toolName} with ID: ${toolCall.id}`);

        if (!tool) {
          this.logger.warn(`Unknown tool: ${toolName}`);
          const errorResult = {
            error: `Unknown tool: ${toolName}`,
          };
          currentToolResults[toolCall.id] = errorResult;
          yield {
            type: 'tool_complete',
            toolName,
            content: `Error: Unknown tool ${toolName}`,
            data: { [toolCall.id]: errorResult },
            timestamp: new Date().toISOString(),
          };
          continue;
        }

        try {
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          // Check tool cache if enabled
          let result = null;
          let cacheHit = false;
          if (this.toolCacheEnabled) {
            try {
              const argsHash = await this.redisService.generateToolCacheKey(toolName, toolArgs);
              result = await this.redisService.getCachedToolResult(toolName, argsHash);
              
              if (result) {
                this.logger.debug(`Tool cache hit for ${toolName}:${argsHash}`);
                cacheHit = true;
                
                // Log cached response for debugging
                console.log(`=== CACHED TOOL RESULT (${toolName}) ===`);
                console.log(JSON.stringify(result, null, 2));
                console.log(`=== END CACHED TOOL RESULT (${toolName}) ===`);
              }
            } catch (error) {
              this.logger.warn(`Tool cache lookup failed for ${toolName}:`, error);
            }
          }

          // Execute tool if not cached
          if (!result) {
            result = await tool.execute({ ...toolArgs, userIp });
            
            // Cache the result if enabled and successful (don't cache errors)
            if (this.toolCacheEnabled && result && typeof result === 'object' && !(result as any).error) {
              try {
                const argsHash = await this.redisService.generateToolCacheKey(toolName, toolArgs);
                await this.redisService.setCachedToolResult(toolName, argsHash, result, this.toolCacheTtlSeconds);
              } catch (error) {
                this.logger.warn(`Failed to cache tool result for ${toolName}:`, error);
              }
            }
          }
          
          currentToolResults[toolCall.id] = result;

          yield {
            type: 'tool_complete',
            toolName,
            content: `Processing completed successfully.`,
            data: { [toolCall.id]: result },
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          this.logger.error(`Error executing tool ${toolName}:`, error);
          const errorResult = {
            error: `Error executing ${toolName}: ${error.message}`,
            toolName,
            toolCallId: toolCall.id,
          };
          currentToolResults[toolCall.id] = errorResult;
          yield {
            type: 'tool_complete',
            toolName,
            content: `Error executing ${toolName}: ${error.message}`,
            data: { [toolCall.id]: errorResult },
            timestamp: new Date().toISOString(),
          };
        }
      }

      currentMessages.push({
        role: 'assistant',
        content: assistantMessage.content || null,
        tool_calls: assistantMessage.tool_calls,
      });

      for (const toolCall of assistantMessage.tool_calls) {
        currentMessages.push({
          role: 'tool',
          content: JSON.stringify(currentToolResults[toolCall.id]),
          tool_call_id: toolCall.id,
        });
      }

      iterations++;
    }

    yield {
      type: 'content',
      content: 'I reached the maximum number of tool calls.',
      data: {
        toolResults:
          Object.keys(toolResults).length > 0 ? toolResults : undefined,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      if (!this.openai) {
        return {
          message: 'Configure your API key to enable responses (set OPENAI_API_KEY).',
          conversationHistory: request.conversationHistory || [],
          sessionId: request.sessionId || this.generateSessionId(),
          completed: true,
        };
      }
      const sessionId = request.sessionId || this.generateSessionId();

      // Check cache if enabled
      if (this.cacheEnabled) {
        const cacheKey = this.generateCacheKey(request);
        try {
          const cachedResponse = await this.redisService.getCachedResponse(cacheKey);
          if (cachedResponse) {
            this.logger.debug(`Cache hit for request: ${cacheKey}`);
            return {
              ...cachedResponse,
              sessionId, // Update session ID
            };
          }
        } catch (error) {
          this.logger.warn('Cache lookup failed, proceeding without cache:', error);
        }
      }

      this.logger.log(`Processing request for session: ${sessionId}`);

      // Build conversation history
      const conversationHistory: ConversationMessage[] =
        request.conversationHistory || [];

      // Add user message to history
      const userMessage: ConversationMessage = {
        role: 'user',
        content: request.message,
        timestamp: new Date().toISOString(),
      };
      conversationHistory.push(userMessage);

      // Create system prompt with dynamic context
      const systemPromptWithContext = this.replacePlaceholders(
        this.systemPrompt,
        request.memories,
      );

      // Convert conversation history to OpenAI format
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPromptWithContext,
        },
        ...this.convertConversationToOpenAI(conversationHistory),
      ];

      // Continue conversation with tool calls until completion
      const finalMessage = await this.processConversationWithTools(messages, request.userIp);

      // Add assistant response to history
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: finalMessage.content,
        tool_calls: finalMessage.tool_calls,
        timestamp: new Date().toISOString(),
      };
      conversationHistory.push(assistantMessage);

      // Add any tool results to history
      if (finalMessage.toolResults) {
        for (const [toolCallId, result] of Object.entries(
          finalMessage.toolResults,
        )) {
          const toolMessage: ConversationMessage = {
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCallId,
            timestamp: new Date().toISOString(),
          };
          conversationHistory.push(toolMessage);
        }
      }

      const response: AgentResponse = {
        message:
          finalMessage.content ||
          "I apologize, but I couldn't process your request.",
        conversationHistory,
        sessionId,
        toolCalls: finalMessage.tool_calls,
        completed: true,
      };

      // Cache the response if enabled
      if (this.cacheEnabled) {
        try {
          const cacheKey = this.generateCacheKey(request);
          await this.redisService.setCachedResponse(cacheKey, response, this.cacheTtlSeconds);
          this.logger.debug(`Cached response for key: ${cacheKey}`);
        } catch (error) {
          this.logger.warn('Failed to cache response:', error);
        }
      }

      return response;
    } catch (error) {
      this.logger.error('Error processing agent request:', error);

      let message =
        'I apologize, but I encountered an error processing your request. Please try again.';
      if (error instanceof APIError) {
        if (error.code === 'overloaded_error') {
          message =
            'The service is currently overloaded. Please try again in a few moments.';
        } else if (error.status === 400) {
          message =
            "I'm sorry, I couldn't process that. There seems to be an issue with the information provided.";
        }
      }

      return {
        message: message,
        conversationHistory: request.conversationHistory || [],
        sessionId: request.sessionId || this.generateSessionId(),
        completed: false,
      };
    }
  }

  private generateCacheKey(request: AgentRequest): string {
    // Create a simple hash of the message and conversation history for caching
    const messageHash = this.simpleHash(request.message);
    const historyHash = request.conversationHistory
      ? this.simpleHash(JSON.stringify(request.conversationHistory))
      : '0';

    return `agent_response:${messageHash}:${historyHash}`;
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

  private async processConversationWithTools(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    userIp?: string,
  ): Promise<{
    content: string;
    tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
    toolResults?: Record<string, any>;
  }> {
    if (!this.openai) {
      return { content: 'Configure your API key to enable responses (set OPENAI_API_KEY).' };
    }
    const currentMessages = [...messages];
    let toolResults: Record<string, any> = {};
    let iterations = 0;
    const maxIterations = 5; // Prevent infinite loops

    while (iterations < maxIterations) {
      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParams =
      {
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4o'),
        messages: currentMessages,
        tools: this.toolDefinitions.map((tool) => ({
          type: 'function' as const,
          function: tool,
        })),
        tool_choice: 'auto',
        temperature: parseFloat(
          this.configService.get<string>('OPENAI_TEMPERATURE', '0.1'),
        ),
      };

      // Add reasoning model specific parameters
      if (this.isReasoningModel) {
        completionParams.reasoning_effort = this.reasoningEffort;
        completionParams.max_completion_tokens = this.maxCompletionTokens;
        // Don't set temperature for reasoning models as they don't support it
        delete completionParams.temperature;
      } else {
        completionParams.max_tokens = parseInt(
          this.configService.get<string>('OPENAI_MAX_TOKENS', '4096'),
        );
      }

      const response =
        await this.openai.chat.completions.create(completionParams);

      const assistantMessage = response.choices[0].message;

      // If no tool calls, we're done
      if (
        !assistantMessage.tool_calls ||
        assistantMessage.tool_calls.length === 0
      ) {
        return {
          content:
            assistantMessage.content || "I couldn't process your request.",
          toolResults:
            Object.keys(toolResults).length > 0 ? toolResults : undefined,
        };
      }

      // Execute tool calls
      const currentToolResults = await this.executeToolCalls(
        assistantMessage.tool_calls,
        userIp,
      );
      toolResults = { ...toolResults, ...currentToolResults };

      // Add assistant message with tool calls
      currentMessages.push({
        role: 'assistant',
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls,
      });

      // Add tool results
      for (const toolCall of assistantMessage.tool_calls) {
        currentMessages.push({
          role: 'tool',
          content: JSON.stringify(currentToolResults[toolCall.id]),
          tool_call_id: toolCall.id,
        });
      }

      iterations++;
    }

    // If we hit max iterations, return the last assistant message
    const lastAssistantMessage = currentMessages
      .filter((msg) => msg.role === 'assistant')
      .pop();

    return {
      content:
        typeof lastAssistantMessage?.content === 'string'
          ? lastAssistantMessage.content
          : 'I reached the maximum number of tool calls.',
      toolResults:
        Object.keys(toolResults).length > 0 ? toolResults : undefined,
    };
  }

  private async executeToolCalls(
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
    userIp?: string,
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const tool = this.toolRegistry.getTool(toolName);

      this.logger.log(`Executing tool: ${toolName} with ID: ${toolCall.id}`);

      if (!tool) {
        this.logger.warn(`Unknown tool: ${toolName}`);
        results[toolCall.id] = {
          error: `Unknown tool: ${toolName}`,
        };
        continue;
      }

      try {
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        // Check tool cache if enabled
        let toolResult = null;
        if (this.toolCacheEnabled) {
          try {
            const argsHash = await this.redisService.generateToolCacheKey(toolName, toolArgs);
            toolResult = await this.redisService.getCachedToolResult(toolName, argsHash);
            
            if (toolResult) {
              this.logger.debug(`Tool cache hit for ${toolName}:${argsHash}`);
              
              // Log cached response for debugging
              this.logger.debug(`=== CACHED TOOL RESULT (${toolName}) ===`);
              this.logger.debug(JSON.stringify(toolResult, null, 2));
              this.logger.debug(`=== END CACHED TOOL RESULT (${toolName}) ===`);
              
              results[toolCall.id] = toolResult;
              continue;
            }
          } catch (error) {
            this.logger.warn(`Tool cache lookup failed for ${toolName}:`, error);
          }
        }

        // Execute tool if not cached
        toolResult = await tool.execute({ ...toolArgs, userIp });
        results[toolCall.id] = toolResult;

        // Cache the result if enabled and successful (don't cache errors)
        if (this.toolCacheEnabled && toolResult && typeof toolResult === 'object' && !(toolResult as any).error) {
          try {
            const argsHash = await this.redisService.generateToolCacheKey(toolName, toolArgs);
            await this.redisService.setCachedToolResult(toolName, argsHash, toolResult, this.toolCacheTtlSeconds);
          } catch (error) {
            this.logger.warn(`Failed to cache tool result for ${toolName}:`, error);
          }
        }
      } catch (error) {
        this.logger.error(`Error executing tool ${toolName}:`, error);
        results[toolCall.id] = {
          error: `Error executing ${toolName}: ${error.message}`,
          toolName,
          toolCallId: toolCall.id,
        };
      }
    }

    return results;
  }

  private convertConversationToOpenAI(
    history: ConversationMessage[],
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    // Preprocess messages to change role 'data' to 'assistant'
    const preprocessedHistory = history.map((msg) => {
      if ((msg as any).role === 'data') {
        return {
          ...msg,
          role: 'assistant' as const,
        };
      }
      return msg;
    });

    const filteredHistory = preprocessedHistory.filter((msg) => {
      if (msg.role === 'user' || msg.role === 'tool') {
        return !!msg.content;
      }
      if (msg.role === 'assistant') {
        return !!msg.content || (msg.tool_calls && msg.tool_calls.length > 0);
      }
      return true; // Keep system messages
    });

    return filteredHistory.map((msg) => {
      switch (msg.role) {
        case 'user':
          return {
            role: 'user',
            content: msg.content,
          };
        case 'assistant':
          return {
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.tool_calls,
          };
        case 'tool':
          return {
            role: 'tool',
            content: msg.content,
            tool_call_id: msg.tool_call_id!,
          };
        case 'system':
          return {
            role: 'system',
            content: msg.content,
          };
        default:
          // This should not be reached due to the filter, but as a safeguard:
          throw new Error(`Unknown or invalid message role: ${msg.role}`);
      }
    });
  }

  private replacePlaceholders(prompt: string, memories?: any[]): string {
    const currentDateTime = new Date()
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d{3}Z$/, ' UTC');

    let processedPrompt = prompt.replace('{{CURRENT_DATE_TIME}}', currentDateTime);
    
    // Handle memories section
    if (memories && memories.length > 0) {
      const memoriesSection = this.formatMemoriesSection(memories);
      processedPrompt = processedPrompt.replace('{{MEMORIES_SECTION}}', memoriesSection);
    } else {
      processedPrompt = processedPrompt.replace('{{MEMORIES_SECTION}}', '');
    }

    return processedPrompt;
  }

  private formatMemoriesSection(memories: any[]): string {
    if (!memories || memories.length === 0) {
      return '';
    }

    const memoriesByCategory = memories.reduce((acc, memory) => {
      const category = memory.category || 'general';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(memory);
      return acc;
    }, {} as Record<string, any[]>);

    let memoriesText = '\n## User Memories:\n';
    memoriesText += 'Use this information to provide personalized recommendations and maintain context:\n';

    Object.entries(memoriesByCategory).forEach(([category, categoryMemories]) => {
      memoriesText += `\n### ${category.charAt(0).toUpperCase() + category.slice(1)}:\n`;
      (categoryMemories as any[]).forEach((memory) => {
        memoriesText += `- **${memory.key}**: ${memory.value}\n`;
      });
    });

    return memoriesText;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isReasoningModelName(modelName: string): boolean {
    const reasoningModels = [
      'o1',
      'o1-mini',
      'o1-preview',
      'o3',
      'o3-mini',
      'o4-mini',
    ];
    return reasoningModels.some((reasoningModel) =>
      modelName.includes(reasoningModel),
    );
  }

  private async *processMockResponse(
    request: AgentRequest,
  ): AsyncGenerator<StreamingUpdate, void, unknown> {
    this.logger.log('Processing mock response');

    let mockData: any;
    const fallbackMessage = "I'm a mock response! The system is currently in mock mode for testing. This would normally be a real AI response.";

    try {
      // Try to load mock.json
      const mockPath = join(process.cwd(), 'prompts', 'mock.json');
      const mockFileContent = readFileSync(mockPath, 'utf-8');
      mockData = JSON.parse(mockFileContent);
      this.logger.log('Mock data loaded successfully from mock.json');
    } catch (error) {
      this.logger.warn('Could not load mock.json, using fallback message:', error.message);
      mockData = { message: fallbackMessage };
    }

    const messagesToStream: string[] = [];

    // Extract all assistant messages from conversation history
    if (mockData.conversationHistory && Array.isArray(mockData.conversationHistory)) {
      const assistantMessages = mockData.conversationHistory
        .filter((msg: any) => msg.role !== 'user' && msg.content)
        .map((msg: any) => msg.content);
      
      messagesToStream.push(...assistantMessages);
      this.logger.log(`Found ${assistantMessages.length} assistant messages in conversation history`);
    }

    messagesToStream.reverse();

    // If no messages found, use fallback
    if (messagesToStream.length === 0) {
      messagesToStream.push(fallbackMessage);
    }

    // Stream each message in sequence
    for (let msgIndex = 0; msgIndex < messagesToStream.length; msgIndex++) {
      const messageToStream = messagesToStream[msgIndex];
      
      // Add a pause between messages if there are multiple
      if (msgIndex > 0) {
        await new Promise(resolve => setTimeout(resolve, 50)); // 500ms pause between messages
        
        yield {
          type: 'content_stream',
          content: '\n\n---\n\n', // Separator between messages
          timestamp: new Date().toISOString(),
        };
        
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      // Stream the message character by character with fake delays
      for (let i = 0; i < messageToStream.length; i++) {
        const char = messageToStream[i];
        
        yield {
          type: 'content_stream',
          content: char,
          timestamp: new Date().toISOString(),
        };

        // Add a small delay between characters (5-25ms for realistic typing)
        const delay = 1; // Random delay between 5-25ms
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Send completion message
    yield {
      type: 'complete',
      content: 'Mock conversation completed successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
