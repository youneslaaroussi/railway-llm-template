import { memoryStorage } from './memory-storage'
import { MemoryDto } from '@/types/memory'

export interface SaveToMemoryToolCall {
  id: string
  toolName: 'save_to_memory'
  description: string
  parameters: {
    key: string
    value: string
    category?: string
  }
}

export class MemoryService {
  /**
   * Handle the save_to_memory tool call
   */
  async handleSaveToMemoryTool(toolCall: SaveToMemoryToolCall): Promise<{ success: boolean; message: string; memory?: MemoryDto }> {
    try {
      const { key, value, category } = toolCall.parameters
      
      if (!key || !value) {
        return {
          success: false,
          message: 'Missing required parameters: key and value are required'
        }
      }

      const memoryDto: MemoryDto = {
        key: key.trim(),
        value: value.trim(),
        category: category?.trim()
      }

      const savedMemory = await memoryStorage.saveMemory(memoryDto)
      
      console.log('[MEMORY_SERVICE] Saved memory:', savedMemory)
      
      return {
        success: true,
        message: `Memory saved successfully with key: ${key}`,
        memory: {
          key: savedMemory.key,
          value: savedMemory.value,
          category: savedMemory.category
        }
      }
    } catch (error) {
      console.error('[MEMORY_SERVICE] Error saving memory:', error)
      return {
        success: false,
        message: `Failed to save memory: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Get all memories for sending with chat requests
   */
  async getMemoriesForChat(): Promise<MemoryDto[]> {
    try {
      return await memoryStorage.getMemoriesAsDto()
    } catch (error) {
      console.error('[MEMORY_SERVICE] Error retrieving memories:', error)
      return []
    }
  }

  /**
   * Get memories by category
   */
  async getMemoriesByCategory(category: string): Promise<MemoryDto[]> {
    try {
      const memories = await memoryStorage.getMemoriesByCategory(category)
      return memories.map(memory => ({
        key: memory.key,
        value: memory.value,
        category: memory.category
      }))
    } catch (error) {
      console.error('[MEMORY_SERVICE] Error retrieving memories by category:', error)
      return []
    }
  }

  /**
   * Delete a memory by key
   */
  async deleteMemoryByKey(key: string): Promise<{ success: boolean; message: string }> {
    try {
      await memoryStorage.deleteMemoryByKey(key)
      return {
        success: true,
        message: `Memory with key '${key}' deleted successfully`
      }
    } catch (error) {
      console.error('[MEMORY_SERVICE] Error deleting memory:', error)
      return {
        success: false,
        message: `Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Clear all memories
   */
  async clearAllMemories(): Promise<{ success: boolean; message: string }> {
    try {
      await memoryStorage.clearAllMemories()
      return {
        success: true,
        message: 'All memories cleared successfully'
      }
    } catch (error) {
      console.error('[MEMORY_SERVICE] Error clearing memories:', error)
      return {
        success: false,
        message: `Failed to clear memories: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

// Create singleton instance
export const memoryService = new MemoryService()