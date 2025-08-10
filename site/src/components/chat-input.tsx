'use client'

import { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Send, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useChatContext } from '@/contexts/chat-context'

interface ChatInputProps {
  placeholder?: string
  className?: string
}

export interface ChatInputRef {
  focus: () => void
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  ({ placeholder = "Message SignalBox LLM...", className }, ref) => {
    const [input, setInput] = useState('')
    const chat = useChatContext()
    const isSearching = false
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    const adjustTextareaHeight = useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) return

      textarea.style.height = 'auto'
      const scrollHeight = textarea.scrollHeight
      const lineHeight = 24 // Approximate line height
      const newRows = Math.min(Math.max(Math.ceil(scrollHeight / lineHeight), 1), 5)
      
      textarea.style.height = `${Math.min(scrollHeight, lineHeight * 5)}px`
    }, [])

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value)
      adjustTextareaHeight()
    }, [adjustTextareaHeight])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!chat.isLoading && input.trim()) {
          chat.handleSubmit(e, input.trim())
          setInput('')
          chat.trackEvent('send_message', 'chat', 'chat_message', 1)
        }
      }
    }, [chat, input])

    const handleSubmit = useCallback((e: React.FormEvent) => {
      e.preventDefault()
      if (!chat.isLoading && input.trim()) {
        chat.handleSubmit(e, input.trim())
        setInput('')
        chat.trackEvent('send_message', 'chat', 'chat_message', 1)
      }
    }, [chat, input])

    // Expose focus method
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus()
    }), [])

    return (
      <div className={cn("chat-input-container", className)}>
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-end gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-gray-300 transition-colors">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                className="flex-1 shadow-none outline-none resize-none border-0 bg-transparent p-0 text-base placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                style={{ minHeight: '24px', maxHeight: '120px' }}
                disabled={chat.isLoading}
              />
              
              <div className="flex-shrink-0">
                {chat.isLoading || isSearching ? (
                  <Button
                    type="button"
                    onClick={chat.stop}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim()}
                    className="h-8 w-8 rounded-lg disabled:opacity-30"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </form>
          
          <p className="text-xs text-gray-500 text-center mt-2 px-4">
            SignalBox LLM can make mistakes. Verify important details.
          </p>
        </div>
      </div>
    )
  }
)

ChatInput.displayName = 'ChatInput'