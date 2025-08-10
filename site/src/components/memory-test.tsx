'use client'

import { useState } from 'react'
import { memoryService } from '@/lib/memory-service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function MemoryTest() {
  const [testResult, setTestResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const runMemoryTest = async () => {
    setIsLoading(true)
    setTestResult('')

    try {
      // Test saving a memory
      const testToolCall = {
        id: 'test-1',
        toolName: 'save_to_memory' as const,
        description: 'Test memory save',
        parameters: {
          key: 'test_preference',
          value: 'Loves mountaineering and extreme sports',
          category: 'preferences'
        }
      }

      const saveResult = await memoryService.handleSaveToMemoryTool(testToolCall)
      console.log('Save result:', saveResult)

      // Test retrieving memories
      const memories = await memoryService.getMemoriesForChat()
      console.log('Retrieved memories:', memories)

      setTestResult(`
Memory Test Results:
✅ Save Memory: ${saveResult.success ? 'SUCCESS' : 'FAILED'}
   Message: ${saveResult.message}
   
✅ Retrieve Memories: ${memories.length > 0 ? 'SUCCESS' : 'FAILED'}
   Found ${memories.length} memories
   
Memory Details:
${memories.map(m => `- ${m.key}: ${m.value} (${m.category || 'no category'})`).join('\n')}
      `)
    } catch (error) {
      setTestResult(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      console.error('Memory test error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearTestMemories = async () => {
    setIsLoading(true)
    try {
      const result = await memoryService.clearAllMemories()
      setTestResult(`Clear memories: ${result.success ? 'SUCCESS' : 'FAILED'}\nMessage: ${result.message}`)
    } catch (error) {
      setTestResult(`❌ Clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Memory System Test</CardTitle>
        <CardDescription>
          Test the save_to_memory tool and memory persistence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={runMemoryTest} disabled={isLoading}>
            {isLoading ? 'Testing...' : 'Run Memory Test'}
          </Button>
          <Button variant="outline" onClick={clearTestMemories} disabled={isLoading}>
            Clear Test Memories
          </Button>
        </div>

        {testResult && (
          <pre className="bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap font-mono">
            {testResult}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}