'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Wand2, FileText, DollarSign } from 'lucide-react'
import { useChatContext } from '@/contexts/chat-context'
import { useAnalytics } from '@/hooks/use-analytics'

type Props = {
  onPromptClick: () => void
}

export const StarterPrompts = ({ onPromptClick }: Props) => {
  const { trackEvent } = useAnalytics()
  const { handleSubmit } = useChatContext()
  

  const prompts = [
    {
      icon: <Wand2 className="w-4 h-4" />,
      text: "Summarize this text into three bullet points: Paste text here.",
    },
    {
      icon: <FileText className="w-4 h-4" />,
      text: "Extract all dates and names from this paragraph: Paste paragraph here.",
    },
    {
      icon: <DollarSign className="w-4 h-4" />,
      text: "Convert 129.99 USD to EUR and explain the steps.",
    },
  ]

  const handlePromptClick = (prompt: string) => {
    trackEvent('starter_prompt', 'chat', prompt, 1)
    onPromptClick()
    
    handleSubmit(undefined, prompt)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wand2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-medium text-gray-900 mb-2">
          How can I help you today?
        </h1>
        <p className="text-gray-600">
          Ask questions, transform text, and call tools like memory and currency conversion
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {prompts.map((prompt, index) => (
          <Button
            key={index}
            variant="outline"
            onClick={() => handlePromptClick(prompt.text)}
            className="h-auto p-4 text-left justify-start hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start gap-3 w-full">
              <div className="text-gray-600 mt-0.5">
                {prompt.icon}
              </div>
              <span className="text-sm text-gray-800 leading-relaxed text-ellipsis overflow-hidden line-clamp-1 w-full">
                {prompt.text}
              </span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  )
}

StarterPrompts.displayName = 'StarterPrompts'