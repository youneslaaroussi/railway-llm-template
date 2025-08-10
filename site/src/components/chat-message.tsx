'use client'

import { memo } from 'react'
import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatMessage as ChatMessageType } from '@/types/chat'
import { AdvancedMessageContent } from './message-renderer/advanced-message-content'

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming?: boolean
}

export const ChatMessage = memo(({ message, isStreaming }: ChatMessageProps) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="chat-message border-b border-gray-100 mb-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">{message.content}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("chat-message mb-4", isUser ? "user bg-gray-50" : "assistant bg-white")}>
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-5">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              isUser 
                ? "bg-gray-600 text-white" 
                : "bg-blue-600 text-white"
            )}>
              {isUser ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {isUser ? 'You' : 'SignalBox LLM'}
                </span>
              </div>
              
              <div className="text-gray-800">
                {message.content ? (
                  isUser ? (
                    <div className="prose prose-sm max-w-none prose-gray">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <AdvancedMessageContent content={message.content} />
                  )
                ) : isStreaming ? (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

ChatMessage.displayName = 'ChatMessage'