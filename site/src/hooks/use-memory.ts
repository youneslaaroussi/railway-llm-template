import { useState, useEffect, useCallback } from 'react'
import { memoryService } from '@/lib/memory-service'
import { Memory, MemoryDto } from '@/types/memory'
import { memoryStorage } from '@/lib/memory-storage'

export function useMemory() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load all memories
  const loadMemories = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const allMemories = await memoryStorage.getAllMemories()
      setMemories(allMemories)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories')
      console.error('Error loading memories:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Save a new memory
  const saveMemory = useCallback(async (memoryDto: MemoryDto) => {
    setIsLoading(true)
    setError(null)
    try {
      const savedMemory = await memoryStorage.saveMemory(memoryDto)
      setMemories(prev => {
        const existingIndex = prev.findIndex(m => m.key === savedMemory.key)
        if (existingIndex >= 0) {
          // Update existing memory
          const updated = [...prev]
          updated[existingIndex] = savedMemory
          return updated
        } else {
          // Add new memory
          return [...prev, savedMemory]
        }
      })
      return savedMemory
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save memory')
      console.error('Error saving memory:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Delete a memory
  const deleteMemory = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await memoryStorage.deleteMemory(id)
      setMemories(prev => prev.filter(m => m.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memory')
      console.error('Error deleting memory:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Delete memory by key
  const deleteMemoryByKey = useCallback(async (key: string) => {
    setIsLoading(true)
    setError(null)
    try {
      await memoryStorage.deleteMemoryByKey(key)
      setMemories(prev => prev.filter(m => m.key !== key))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete memory')
      console.error('Error deleting memory by key:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Clear all memories
  const clearAllMemories = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await memoryStorage.clearAllMemories()
      setMemories([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear memories')
      console.error('Error clearing memories:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Get memories by category
  const getMemoriesByCategory = useCallback((category: string) => {
    return memories.filter(memory => memory.category === category)
  }, [memories])

  // Get memories as DTOs for sending to API
  const getMemoriesAsDto = useCallback((): MemoryDto[] => {
    return memories.map(memory => ({
      key: memory.key,
      value: memory.value,
      category: memory.category
    }))
  }, [memories])

  // Load memories on mount
  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  return {
    memories,
    isLoading,
    error,
    loadMemories,
    saveMemory,
    deleteMemory,
    deleteMemoryByKey,
    clearAllMemories,
    getMemoriesByCategory,
    getMemoriesAsDto
  }
}