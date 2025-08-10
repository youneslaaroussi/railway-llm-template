'use client'

import { useRef, useEffect, useCallback, memo } from 'react'
import { ChatInput, ChatInputRef } from './chat-input'
import { StarterPrompts } from './starter-prompts'
import { useChatContext } from '@/contexts/chat-context'
import { ChatMessage } from './chat-message'
import { useMessageProcessor } from '@/hooks/use-message-processor'
import { ChatMessage as ChatMessageType } from '@/types/chat'

interface ChatInterfaceProps {
  className?: string
}

export const ChatInterface = memo(({ className }: ChatInterfaceProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<ChatInputRef>(null)
  
  // Get state from contexts
  const chat = useChatContext()
  
  // Custom hook to process messages
  useMessageProcessor();

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [chat.messages, scrollToBottom])

  // Focus input when loading completes
  useEffect(() => {
    if (!chat.isLoading) {
      setTimeout(() => chatInputRef.current?.focus(), 100)
    }
  }, [chat.isLoading])

  const hasUserMessages = chat.messages.some((msg: ChatMessageType) => msg.role === 'user')

  return (
    <div className={`h-full flex flex-col bg-white ${className || ''}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {chat.messages.map((message: ChatMessageType, index: number) => (
          <ChatMessage
            key={message.id}
            message={message}
            isStreaming={chat.isLoading && index === chat.messages.length - 1}
          />
        ))}
        
        {/* Show starter prompts only if no user messages */}
        {!hasUserMessages && !chat.isLoading && (
          <div className="pt-8 px-3 md:px-4">
            <StarterPrompts onPromptClick={() => {
              // The input is now handled by the starter prompt itself
              // We could potentially focus the input here if needed
            }} />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput ref={chatInputRef} />
    </div>
  )
})

ChatInterface.displayName = 'ChatInterface'