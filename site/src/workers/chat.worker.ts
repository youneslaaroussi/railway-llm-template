/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import { nanoid } from 'nanoid';
import { ChatMessage } from '@/types/chat';
import { memoryService, SaveToMemoryToolCall } from '@/lib/memory-service';
import { MemoryDto } from '@/types/memory';

const chatApi = {
  async sendMessage(
    message: string,
    conversationHistory: ChatMessage[],
    onUpdate: (update: string) => void,
    onToolCall: (toolCall: any) => void
  ) {
    console.log('[WORKER] Starting sendMessage');
    
    // Get memories to include in the request
    const memories = await memoryService.getMemoriesForChat();
    console.log('[WORKER] Memories loaded:', memories.length);
    
    // Build conversation history
    const conversation = conversationHistory.map(msg => {
      const baseMessage = {
        role: msg.role,
        content: msg.content,
      };
      
      // No domain-specific augmentation
      
      return baseMessage;
    });

    // No domain-specific context
    
    const requestBody = {
      message,
      conversationHistory: conversation,
      memories,
    };

    console.log('[WORKER] Request body conversation history length:', conversation.length);

    // Make request to external API
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3000'}/agent/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok || !response.body) {
      throw new Error(`API responded with ${response.status}`);
    }

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';

    let currentEvent = '';
    let currentId = '';
    let currentData = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      // Parse SSE format - collect all parts of an event
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('event: ')) {
          currentEvent = trimmedLine.slice(7);
        } else if (trimmedLine.startsWith('id: ')) {
          currentId = trimmedLine.slice(4);
        } else if (trimmedLine.startsWith('data: ')) {
          // Accumulate data lines to handle multi-line SSE payloads correctly
          const lineData = trimmedLine.slice(6);
          if (currentData) {
            currentData += lineData;
          } else {
            currentData = lineData;
          }
        } else if (trimmedLine === '') {
          // Empty line indicates end of event - process if we have data
          if (currentData) {
            try {
              const data = JSON.parse(currentData);
              console.log('[WORKER] Parsed event:', { event: currentEvent, id: currentId, type: data.type, contentLength: data.content?.length });

              if (data.type === 'content_stream' && data.content) {
                content += data.content;
                console.log('[WORKER] Content stream update, total length:', content.length);
                onUpdate(content);
              } else if (data.type === 'content' && data.content) {
                // Handle final content event - this is the complete message
                console.log('[WORKER] Final content received, length:', data.content.length);
                console.log('[WORKER] Final content preview:', data.content.substring(0, 100) + '...');
                content = data.content;
                console.log('[WORKER] Calling onUpdate with final content, length:', content.length);
                onUpdate(content);
              } else if (data.type === 'tool_start' && data.toolName) {
                console.log('[WORKER] Tool start:', data.toolName);
                onToolCall(data);
              } else if (data.type === 'tool_complete' && data.toolName) {
                console.log('[WORKER] Tool complete:', data.toolName);
                
                // Handle save_to_memory tool specifically
                if (data.toolName === 'save_to_memory' && (data.parameters || data.data)) {
                  console.log('[WORKER] Handling save_to_memory tool call');
                  try {
                    let toolParams = data.parameters;

                    if (!toolParams && data.data) {
                      const callKey = Object.keys(data.data)[0];
                      const callData = callKey ? data.data[callKey] : null;
                      if (callData && callData.memoryItem) {
                        toolParams = callData.memoryItem;
                      } else {
                        toolParams = callData;
                      }
                    }

                    if (!toolParams) throw new Error('Could not find parameters for save_to_memory');

                    const toolCall: SaveToMemoryToolCall = {
                      id: data.id || nanoid(),
                      toolName: 'save_to_memory',
                      description: data.toolDescription || data.description || 'Save information to memory',
                      parameters: toolParams,
                    };
                    
                    const result = await memoryService.handleSaveToMemoryTool(toolCall);
                    console.log('[WORKER] Memory save result:', result);
                    
                    // The frontend expects the result in the `data` property
                    data.data = result;
                    delete (data as any).result;
                    delete (data as any).parameters;

                  } catch (error) {
                    console.error('[WORKER] Error handling save_to_memory tool:', error);
                    data.data = {
                      success: false,
                      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                    };
                  }
                }
                
                onToolCall(data);
              } else if (data.type === 'complete') {
                // Conversation completed
                console.log('[WORKER] Conversation completed');
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError, 'Raw data:', currentData);
            }
          }
          
          // Reset for next event
          currentEvent = '';
          currentId = '';
          currentData = '';
        }
      }
    }
    
    // Final processing for any remaining data in the buffer, in case the stream
    // ends without a final newline.
    if (currentData) {
      try {
        const data = JSON.parse(currentData);
        console.log('[WORKER] Parsed event (final):', { event: currentEvent, id: currentId, type: data.type, contentLength: data.content?.length });

        if (data.type === 'content_stream' && data.content) {
          content += data.content;
          onUpdate(content);
        } else if (data.type === 'content' && data.content) {
          content = data.content;
          onUpdate(content);
        } else if (data.type === 'tool_complete' && data.toolName) {
            if (data.toolName === 'save_to_memory' && (data.parameters || data.data)) {
              try {
                let toolParams = data.parameters;
                if (!toolParams && data.data) {
                  const callKey = Object.keys(data.data)[0];
                  const callData = callKey ? data.data[callKey] : null;
                  if (callData && callData.memoryItem) {
                    toolParams = callData.memoryItem;
                  } else {
                    toolParams = callData;
                  }
                }
                if (!toolParams) throw new Error('Could not find parameters for save_to_memory');
                const toolCall: SaveToMemoryToolCall = {
                  id: data.id || nanoid(),
                  toolName: 'save_to_memory',
                  description: data.toolDescription || data.description || 'Save information to memory',
                  parameters: toolParams,
                };
                const result = await memoryService.handleSaveToMemoryTool(toolCall);
                data.data = result;
                delete (data as any).result;
                delete (data as any).parameters;
              } catch (error) {
                console.error('[WORKER] Error handling save_to_memory tool (final):', error);
                data.data = { success: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
              }
            }
            onToolCall(data);
        }
      } catch (parseError) {
        console.error('Error parsing SSE data (final):', parseError, 'Raw data:', currentData);
      }
    }

    console.log('[WORKER] Final return content length:', content.length);
    return content;
  },
};

export type ChatWorker = typeof chatApi;

Comlink.expose(chatApi); 