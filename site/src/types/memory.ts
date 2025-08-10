export interface Memory {
  id: string
  key: string
  value: string
  category?: string
  createdAt: Date
  updatedAt: Date
}

export interface MemoryDto {
  key: string
  value: string
  category?: string
}

export interface SaveToMemoryTool {
  name: 'save_to_memory'
  description: string
  parameters: {
    type: 'object'
    properties: {
      key: {
        type: 'string'
        description: string
      }
      value: {
        type: 'string'
        description: string
      }
      category?: {
        type: 'string'
        description: string
      }
    }
    required: ['key', 'value']
  }
}

export interface ChatRequestDto {
  message: string
  conversationHistory?: any[]
  sessionId?: string
  memories?: MemoryDto[]
}

// Types are already exported above, no need to re-export