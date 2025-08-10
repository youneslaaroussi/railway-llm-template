'use client'

import { createContext, useContext, ReactNode, useMemo } from 'react'
import { useChat as useChatHook, type UseChatOptions } from '@/hooks/use-chat'
import { useAnalytics } from '@/hooks/use-analytics'
import { ChatMessage } from '@/types/chat'

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: "Hi! I'm your AI assistant. I can answer questions, transform text, and call tools like memory and currency conversion. What can I help you with today?",
  createdAt: new Date(),
}

type ChatContextType = ReturnType<typeof useChatHook> & {
  trackEvent: (
    action: string,
    category: string,
    label: string,
    value: number,
  ) => void
}

const ChatContext = createContext<ChatContextType | null>(null)

interface ChatProviderProps {
  children: ReactNode
}

export const ChatProvider = ({
  children,
}: ChatProviderProps) => {
  const chat = useChatHook()
  const { trackEvent } = useAnalytics()

  const contextValue = useMemo(
    () => ({
      ...chat,
      trackEvent,
    }),
    [chat, trackEvent],
  )

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  )
}

export function useChatContext() {
  const context = useContext(ChatContext)
  if (context === null) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}