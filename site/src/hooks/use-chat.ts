'use client'

import { useCallback, useRef, useEffect } from 'react'
import { ChatMessage } from '@/types/chat'
import { useAnalytics } from './use-analytics'
import { useChatStore } from '@/stores/chat-store'
import { getChatWorker } from '@/workers/chat.worker.factory'
import * as Comlink from 'comlink'
import { useNotifications } from './use-notifications'
import { nanoid } from 'nanoid'

export type UseChatOptions = {
  initialMessages?: ChatMessage[]
}

export function useChat({ initialMessages = [] }: UseChatOptions = {}) {
  const { trackEvent } = useAnalytics()
  const abortControllerRef = useRef<AbortController | null>(null)
  const { permission, requestPermission, showNotification } = useNotifications()
  
  console.log('[CHAT] useChat initialized, notification permission:', permission)

  const {
    currentSession,
    isLoading,
    addMessage,
    updateMessage,
    setLoading,
    createSession,
  } = useChatStore()

  if (!currentSession && initialMessages.length > 0) {
    createSession()
    initialMessages.forEach(msg => addMessage(msg))
  }

  const messages = currentSession?.messages || []
  const assistantMsgIdRef = useRef<string | null>(null)
  const toolCallIdsRef = useRef<Record<string, string>>({})
  // Track message components separately to avoid race conditions
  const messagePartsRef = useRef<{
    toolCalls: string
    streamedContent: string
  }>({ toolCalls: '', streamedContent: '' })

  const updateFullMessage = useCallback(() => {
    const assistantMsgId = assistantMsgIdRef.current
    if (!assistantMsgId) return
    
    const { toolCalls, streamedContent } = messagePartsRef.current
    const fullContent = toolCalls + streamedContent
    
    useChatStore.getState().updateMessage(assistantMsgId, () => fullContent)
  }, [])

  const onUpdateRef = useRef((update: string) => {
    console.log('[FRONTEND] onUpdate called with content length:', update.length);
    
    const assistantMsgId = assistantMsgIdRef.current;
    if (!assistantMsgId) return
    
    // Update only the streamed content part
    messagePartsRef.current.streamedContent = update
    updateFullMessage()
  });

  const onToolCallRef = useRef((toolCall: any) => {
    const assistantMsgId = assistantMsgIdRef.current;
    if (!assistantMsgId) return;

    console.log('[CHAT] Tool call received:', toolCall.type, toolCall.toolName, 'ID:', toolCall.id);

    if (toolCall.type === 'tool_start') {
      const toolId = toolCall.id || nanoid();
      const toolKey = `${toolCall.toolName}_${toolId}`;
      toolCallIdsRef.current[toolKey] = toolId;
      const toolMarkdown = `\n{% tool_start '${toolCall.toolName}' '${toolId}' %}\n{% tool_description %}${
        toolCall.toolDescription || toolCall.description || 'Processing...'
      }{% end_tool_description %}\n{% endtool %}\n`;
      
      console.log('[CHAT] Adding tool start markdown for:', toolCall.toolName, 'with ID:', toolId);
      
      // Add to tool calls part
      messagePartsRef.current.toolCalls += toolMarkdown
      updateFullMessage()
      
    } else if (toolCall.type === 'tool_complete') {
      console.log('[CHAT] Tool complete for:', toolCall.toolName, 'with data:', toolCall.data);

      const toolId = toolCall.id || Object.values(toolCallIdsRef.current).find(id => 
        messagePartsRef.current.toolCalls.includes(`{% tool_start '${toolCall.toolName}' '${id}' %}`)
      );
      
      if (!toolId) {
        console.error('[CHAT] No tool ID found for:', toolCall.toolName, 'Available IDs:', toolCallIdsRef.current);
        return;
      }

      console.log('[CHAT] Completing tool:', toolCall.toolName, 'with ID:', toolId);

      // Create complete tool markdown
      let completeToolMarkdown = `{% tool_complete '${toolCall.toolName}' '${toolId}' %}\n{% tool_description %}${
        toolCall.toolDescription || toolCall.description || 'Completed'
      }{% end_tool_description %}\n`;
      
      if (toolCall.data) {
        completeToolMarkdown += (typeof toolCall.data === 'string' ? toolCall.data : JSON.stringify(toolCall.data, null, 2)) + '\n';
      }
      completeToolMarkdown += '{% endtool %}\n';

      // Use regex to find and replace the tool call by ID instead of exact pattern matching
      const toolStartRegex = new RegExp(`{% tool_start '${toolCall.toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}' '${toolId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}' %}[\\s\\S]*?{% endtool %}`, 'g');
      
      const oldToolCalls = messagePartsRef.current.toolCalls;
      messagePartsRef.current.toolCalls = messagePartsRef.current.toolCalls.replace(toolStartRegex, completeToolMarkdown);
      
      if (oldToolCalls === messagePartsRef.current.toolCalls) {
        console.error('[CHAT] Tool replacement failed for:', toolCall.toolName, toolId);
        console.log('[CHAT] Looking for pattern in:', oldToolCalls);
      } else {
        console.log('[CHAT] Successfully replaced tool:', toolCall.toolName);
      }
      
      updateFullMessage()
    }
  });

  // Update the current functions and create new proxies
  useEffect(() => {
    onUpdateRef.current = (update: string) => {
      console.log('[FRONTEND] onUpdate called with content length:', update.length);
      
      const assistantMsgId = assistantMsgIdRef.current;
      if (!assistantMsgId) return
      
      // Update only the streamed content part
      messagePartsRef.current.streamedContent = update
      updateFullMessage()
    };

    onToolCallRef.current = (toolCall: any) => {
      const assistantMsgId = assistantMsgIdRef.current;
      if (!assistantMsgId) return;

      console.log('[CHAT] Tool call received:', toolCall.type, toolCall.toolName, 'ID:', toolCall.id);

      if (toolCall.type === 'tool_start') {
        const toolId = toolCall.id || nanoid();
        const toolKey = `${toolCall.toolName}_${toolId}`;
        toolCallIdsRef.current[toolKey] = toolId;
        const toolMarkdown = `\n{% tool_start '${toolCall.toolName}' '${toolId}' %}\n{% tool_description %}${
          toolCall.toolDescription || toolCall.description || 'Processing...'
        }{% end_tool_description %}\n{% endtool %}\n`;
        
        console.log('[CHAT] Adding tool start markdown for:', toolCall.toolName, 'with ID:', toolId);
        
        // Add to tool calls part
        messagePartsRef.current.toolCalls += toolMarkdown
        updateFullMessage()
        
      } else if (toolCall.type === 'tool_complete') {
        console.log('[CHAT] Tool complete for:', toolCall.toolName, 'with data:', toolCall.data);
        
        const toolId = toolCall.id || Object.values(toolCallIdsRef.current).find(id => 
          messagePartsRef.current.toolCalls.includes(`{% tool_start '${toolCall.toolName}' '${id}' %}`)
        );
        
        if (!toolId) {
          console.error('[CHAT] No tool ID found for:', toolCall.toolName, 'Available IDs:', toolCallIdsRef.current);
          return;
        }

        console.log('[CHAT] Completing tool:', toolCall.toolName, 'with ID:', toolId);

        // Create complete tool markdown
        let completeToolMarkdown = `{% tool_complete '${toolCall.toolName}' '${toolId}' %}\n{% tool_description %}${
          toolCall.toolDescription || toolCall.description || 'Completed'
        }{% end_tool_description %}\n`;
        
        if (toolCall.data) {
          completeToolMarkdown += (typeof toolCall.data === 'string' ? toolCall.data : JSON.stringify(toolCall.data, null, 2)) + '\n';
        }
        completeToolMarkdown += '{% endtool %}\n';

        // Use regex to find and replace the tool call by ID instead of exact pattern matching
        const toolStartRegex = new RegExp(`{% tool_start '${toolCall.toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}' '${toolId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}' %}[\\s\\S]*?{% endtool %}`, 'g');
        
        const oldToolCalls = messagePartsRef.current.toolCalls;
        messagePartsRef.current.toolCalls = messagePartsRef.current.toolCalls.replace(toolStartRegex, completeToolMarkdown);
        
        if (oldToolCalls === messagePartsRef.current.toolCalls) {
          console.error('[CHAT] Tool replacement failed for:', toolCall.toolName, toolId);
          console.log('[CHAT] Looking for pattern in:', oldToolCalls);
        } else {
          console.log('[CHAT] Successfully replaced tool:', toolCall.toolName);
        }
        
        updateFullMessage()
      }
    };
  }, [updateFullMessage]);

  const submitMessage = useCallback(
    async (message: string) => {
      console.log('[SUBMIT] submitMessage called with:', message);
      
      if (isLoading) {
        console.log('[SUBMIT] Already loading, returning');
        return;
      }

      // Reset message state
      assistantMsgIdRef.current = null;
      toolCallIdsRef.current = {};
      messagePartsRef.current = { toolCalls: '', streamedContent: '' }

      console.log('[SUBMIT] Adding user message');
      addMessage({
        role: 'user',
        content: message,
      })
      setLoading(true)

      try {
        console.log('[SUBMIT] Getting chat worker');
        const worker = getChatWorker()
        if (!worker) {
          console.error('[SUBMIT] Chat worker not available');
          throw new Error('Chat worker not available')
        }

        const assistantMessage: Omit<ChatMessage, 'id' | 'createdAt'> = {
          role: 'assistant',
          content: '',
        }
        console.log('[SUBMIT] Adding assistant message');
        const assistantMsgId = addMessage(assistantMessage)
        assistantMsgIdRef.current = assistantMsgId

        if (!assistantMsgId) {
          console.error('[SUBMIT] Failed to create assistant message');
          throw new Error('Failed to create assistant message')
        }
        
        const currentMessages = useChatStore.getState().currentSession?.messages ?? []
        console.log('[SUBMIT] Current messages count:', currentMessages.length);

        // Create fresh Comlink proxies for this call
        const proxiedOnUpdate = Comlink.proxy(onUpdateRef.current);
        const proxiedOnToolCall = Comlink.proxy(onToolCallRef.current);

        console.log('[SUBMIT] Calling worker.sendMessage');
        await worker.sendMessage(message, currentMessages, proxiedOnUpdate, proxiedOnToolCall)
        console.log('[SUBMIT] Worker.sendMessage completed');

        if (document.visibilityState === 'hidden') {
          await showNotification('New message from SignalBox LLM', {
            body: 'Your chat response is ready.',
            icon: '/android-chrome-192x192.png',
          })
        }
      } catch (error) {
        console.error('[SUBMIT] Chat error:', error)
        addMessage({
          role: 'assistant',
          content: "I'm sorry, I encountered an error. Please try again. Error: " + error,
        })
      } finally {
        console.log('[SUBMIT] Setting loading to false');
        setLoading(false)
        abortControllerRef.current = null
      }
    },
    [
      isLoading,
      addMessage,
      setLoading,
      showNotification,
      updateFullMessage,
    ]
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent | undefined, message: string) => {
      e?.preventDefault()

      console.log('[CHAT] handleSubmit called, current notification permission:', permission)

      // Always request notification permission on first interaction, regardless of current state
      const notificationRequestedKey = 'signalbox-llm-notification-requested'
      const hasRequestedNotification = sessionStorage.getItem(notificationRequestedKey)
      
      if (!hasRequestedNotification) {
        console.log('[CHAT] First interaction - forcing notification permission request, current state:', permission)
        const result = await requestPermission()
        console.log('[CHAT] Permission request result:', result)
        sessionStorage.setItem(notificationRequestedKey, 'true')
      } else {
        console.log('[CHAT] Notification permission already requested in this session')
      }

      if (!message || isLoading) return
      
      await submitMessage(message)
    },
    [
      isLoading,
      permission,
      requestPermission,
      submitMessage,
    ]
  )
  
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  const reload = useCallback(() => {
    if (messages.length === 0) return

    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user')
    if (lastUserMessage) {
      // setInput(lastUserMessage.content) // This needs to be handled differently now
      const userMessageIndex = messages.findIndex(
        (msg: ChatMessage) => msg.id === lastUserMessage.id
      )
      if (userMessageIndex !== -1) {
        const newMessages = messages.slice(0, userMessageIndex)
        if (currentSession) {
          currentSession.messages = newMessages
        }
      }
    }
  }, [messages, currentSession])

  return {
    messages,
    handleSubmit,
    submitMessage,
    isLoading,
    stop,
    reload,
  }
} 