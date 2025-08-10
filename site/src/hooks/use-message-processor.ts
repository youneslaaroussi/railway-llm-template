// src/hooks/use-message-processor.ts

import { useEffect } from 'react';
import { useChatContext } from '@/contexts/chat-context';
import { useChatStore } from '@/stores/chat-store';
import { agentMessageQueue } from '@/lib/agent-message-queue';

export function useMessageProcessor() {
  const { addMessage } = useChatStore();
  const { submitMessage, isLoading } = useChatContext();

  useEffect(() => {
    // Initialize the message queue with the sender function
    agentMessageQueue.initialize(submitMessage);
  }, [submitMessage]);

  useEffect(() => {
    // Coordinate stream state with message queue
    if (isLoading) {
      agentMessageQueue.onMessageStreamStart();
    } else {
      agentMessageQueue.onMessageStreamEnd();
    }
  }, [isLoading]);
  
  // Template: no domain-specific post-processing
} 