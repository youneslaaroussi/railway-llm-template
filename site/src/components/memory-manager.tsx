'use client'

import { useState } from 'react'
import { useMemory } from '@/hooks/use-memory'
import { MemoryDto } from '@/types/memory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Brain } from 'lucide-react'
import { toast } from 'sonner'

interface MemoryManagerProps {
  className?: string
}

export function MemoryManager({ className }: MemoryManagerProps) {
  const { 
    memories, 
    isLoading, 
    error, 
    saveMemory, 
    deleteMemory, 
    clearAllMemories 
  } = useMemory()

  const [isAddingMemory, setIsAddingMemory] = useState(false)
  const [newMemory, setNewMemory] = useState<MemoryDto>({
    key: '',
    value: '',
    category: ''
  })

  const handleSaveMemory = async () => {
    if (!newMemory.key.trim() || !newMemory.value.trim()) {
      toast.error('Key and value are required')
      return
    }

    try {
      await saveMemory({
        key: newMemory.key.trim(),
        value: newMemory.value.trim(),
        category: newMemory.category ? newMemory.category.trim() || undefined : undefined
      })
      
      setNewMemory({ key: '', value: '', category: '' })
      setIsAddingMemory(false)
      toast.success('Memory saved successfully')
    } catch (error) {
      toast.error('Failed to save memory')
    }
  }

  const handleDeleteMemory = async (id: string, key: string) => {
    try {
      await deleteMemory(id)
      toast.success(`Memory "${key}" deleted`)
    } catch (error) {
      toast.error('Failed to delete memory')
    }
  }

  const handleClearAllMemories = async () => {
    if (memories.length === 0) {
      toast.info('No memories to clear')
      return
    }

    if (window.confirm(`Are you sure you want to delete all ${memories.length} memories? This action cannot be undone.`)) {
      try {
        await clearAllMemories()
        toast.success('All memories cleared')
      } catch (error) {
        toast.error('Failed to clear memories')
      }
    }
  }

  const groupedMemories = memories.reduce((acc, memory) => {
    const category = memory.category || 'Uncategorized'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(memory)
    return acc
  }, {} as Record<string, typeof memories>)

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Memory Manager
          </CardTitle>
          <CardDescription>
            Manage saved memories that help the AI remember information about you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              Error: {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => setIsAddingMemory(!isAddingMemory)}
              variant="outline"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Memory
            </Button>
            <Button
              onClick={handleClearAllMemories}
              variant="outline"
              size="sm"
              disabled={memories.length === 0}
            >
              Clear All
            </Button>
          </div>

          {isAddingMemory && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add New Memory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="memory-key">Key</Label>
                  <Input
                    id="memory-key"
                    placeholder="e.g., preferred_destinations, dietary_restrictions"
                    value={newMemory.key}
                    onChange={(e) => setNewMemory(prev => ({ ...prev, key: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="memory-value">Value</Label>
                  <Textarea
                    id="memory-value"
                    placeholder="e.g., Loves adventure travel and hiking"
                    value={newMemory.value}
                    onChange={(e) => setNewMemory(prev => ({ ...prev, value: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="memory-category">Category (optional)</Label>
                  <Input
                    id="memory-category"
                    placeholder="e.g., preferences, history, restrictions"
                    value={newMemory.category}
                    onChange={(e) => setNewMemory(prev => ({ ...prev, category: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveMemory} disabled={isLoading}>
                    Save Memory
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingMemory(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              {memories.length} memories saved
            </div>

            {Object.entries(groupedMemories).map(([category, categoryMemories]) => (
              <div key={category}>
                <h3 className="font-medium text-sm text-gray-700 mb-2">{category}</h3>
                <div className="space-y-2">
                  {categoryMemories.map((memory) => (
                    <Card key={memory.id} className="bg-gray-50">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                {memory.key}
                              </Badge>
                              {memory.category && (
                                <Badge variant="outline" className="text-xs">
                                  {memory.category}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 break-words">
                              {memory.value}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Updated: {memory.updatedAt.toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMemory(memory.id, memory.key)}
                            className="h-8 w-8 p-0 flex-shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            {memories.length === 0 && !isLoading && (
              <div className="text-center py-8 text-gray-500">
                <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No memories saved yet</p>
                <p className="text-sm">Add memories to help the AI remember information about you</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}