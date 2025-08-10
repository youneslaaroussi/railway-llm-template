import { MemoryManager } from '@/components/memory-manager'
import { MemoryTest } from '@/components/memory-test'

export default function MemoryDemoPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Memory System Demo</h1>
        <p className="text-gray-600">
          This page demonstrates the memory system that allows the AI to remember information about users.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold mb-4">Memory Test</h2>
          <MemoryTest />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Memory Manager</h2>
          <MemoryManager />
        </div>
      </div>

      <div className="bg-blue-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">How it works:</h3>
        <div className="space-y-2 text-sm">
          <p>
            <strong>1. Save to Memory Tool:</strong> When the AI assistant wants to remember something about you, 
            it uses the <code className="bg-blue-200 px-1 rounded">save_to_memory</code> tool.
          </p>
          <p>
            <strong>2. Local Storage:</strong> Memories are stored locally in your browser using IndexedDB 
            for fast, offline access.
          </p>
          <p>
            <strong>3. Chat Integration:</strong> When you send messages, all stored memories are automatically 
            included in the request to provide context to the AI.
          </p>
          <p>
            <strong>4. Categories:</strong> Memories can be organized by categories like 'preferences', 
            'restrictions', 'history', etc.
          </p>
        </div>
      </div>

      <div className="bg-green-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Example Memory Tool Call:</h3>
        <pre className="bg-white p-4 rounded border text-sm overflow-x-auto">
{`{
  "name": "save_to_memory",
  "parameters": {
    "key": "dietary_restrictions",
    "value": "Vegetarian, allergic to nuts",
    "category": "restrictions"
  }
}`}
        </pre>
      </div>
    </div>
  )
}