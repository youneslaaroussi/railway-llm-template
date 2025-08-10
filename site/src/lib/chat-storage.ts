import { format } from 'date-fns'
import { ChatSession } from '@/stores/chat-store'

interface ExportData {
  version: string
  type: 'single' | 'all'
  session?: ChatSession
  sessions?: ChatSession[]
  exportedAt: string
}

/**
 * Download a JSON file with the provided data
 */
export const downloadJson = (data: string, filename: string): void => {
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  
  // Append to body, click, and remove
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // Clean up the URL object
  URL.revokeObjectURL(url)
}

/**
 * Generate a filename for export based on session data
 */
export const generateExportFilename = (
  type: 'single' | 'all',
  session?: ChatSession
): string => {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss')
  
  if (type === 'single' && session) {
    // Clean the session title for filename
    const cleanTitle = session.title
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 50)
    
    return `chat_${cleanTitle}_${timestamp}.json`
  }
  
  return `chat_history_${timestamp}.json`
}

/**
 * Export a single session as JSON file
 */
export const exportSessionToFile = (session: ChatSession): void => {
  const exportData: ExportData = {
    version: '1.0.0',
    type: 'single',
    session,
    exportedAt: new Date().toISOString(),
  }
  
  const jsonData = JSON.stringify(exportData, null, 2)
  const filename = generateExportFilename('single', session)
  
  downloadJson(jsonData, filename)
}

/**
 * Export all sessions as JSON file
 */
export const exportAllSessionsToFile = (sessions: ChatSession[]): void => {
  const exportData: ExportData = {
    version: '1.0.0',
    type: 'all',
    sessions,
    exportedAt: new Date().toISOString(),
  }
  
  const jsonData = JSON.stringify(exportData, null, 2)
  const filename = generateExportFilename('all')
  
  downloadJson(jsonData, filename)
}

/**
 * Read a file as text
 */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        resolve(event.target.result)
      } else {
        reject(new Error('Failed to read file as text'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsText(file)
  })
}

/**
 * Validate import data structure
 */
export const validateImportData = (data: string): ExportData => {
  try {
    const parsed = JSON.parse(data)
    
    // Check required fields
    if (!parsed.version || !parsed.type || !parsed.exportedAt) {
      throw new Error('Invalid import data: missing required fields')
    }
    
    // Check version compatibility
    if (parsed.version !== '1.0.0') {
      throw new Error(`Unsupported version: ${parsed.version}`)
    }
    
    // Check type-specific fields
    if (parsed.type === 'single') {
      if (!parsed.session) {
        throw new Error('Invalid import data: missing session data')
      }
    } else if (parsed.type === 'all') {
      if (!parsed.sessions || !Array.isArray(parsed.sessions)) {
        throw new Error('Invalid import data: missing sessions array')
      }
    } else {
      throw new Error(`Invalid import type: ${parsed.type}`)
    }
    
    return parsed as ExportData
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON format')
    }
    throw error
  }
}

/**
 * Import sessions from a file
 */
export const importSessionsFromFile = (file: File): Promise<ExportData> => {
  return new Promise(async (resolve, reject) => {
    try {
      // Validate file type
      if (!file.type.includes('json') && !file.name.endsWith('.json')) {
        throw new Error('Please select a JSON file')
      }
      
      // Read file content
      const content = await readFileAsText(file)
      
      // Validate and parse data
      const validatedData = validateImportData(content)
      
      resolve(validatedData)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Create a file input element for importing
 */
export const createFileInput = (
  onFileSelected: (file: File) => void,
  accept: string = '.json'
): HTMLInputElement => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.style.display = 'none'
  
  input.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) {
      onFileSelected(file)
    }
  })
  
  return input
}

/**
 * Open file picker and handle import
 */
export const openImportFilePicker = (
  onImportSuccess: (data: ExportData) => void,
  onImportError: (error: Error) => void
): void => {
  const input = createFileInput(async (file) => {
    try {
      const data = await importSessionsFromFile(file)
      onImportSuccess(data)
    } catch (error) {
      onImportError(error as Error)
    }
  })
  
  // Append to body, click, and remove
  document.body.appendChild(input)
  input.click()
  document.body.removeChild(input)
}

/**
 * Get storage usage statistics
 */
export const getStorageStats = (): {
  totalSessions: number
  totalMessages: number
  estimatedSize: string
} => {
  try {
    // Check if we're in the browser environment
    if (typeof window === 'undefined') {
      return { totalSessions: 0, totalMessages: 0, estimatedSize: '0 KB' }
    }
    
    const storedData = localStorage.getItem('chat-store')
    if (!storedData) {
      return { totalSessions: 0, totalMessages: 0, estimatedSize: '0 KB' }
    }
    
    const parsed = JSON.parse(storedData)
    const sessions = parsed.state?.sessions || []
    
    const totalSessions = sessions.length
    const totalMessages = sessions.reduce((acc: number, session: ChatSession) => {
      return acc + (session.messages?.length || 0)
    }, 0)
    
    // Estimate size in KB
    const sizeInBytes = new Blob([storedData]).size
    const sizeInKB = (sizeInBytes / 1024).toFixed(2)
    
    return {
      totalSessions,
      totalMessages,
      estimatedSize: `${sizeInKB} KB`
    }
  } catch (error) {
    console.error('Error getting storage stats:', error)
    return { totalSessions: 0, totalMessages: 0, estimatedSize: '0 KB' }
  }
}

/**
 * Clear all chat data from storage
 */
export const clearAllChatData = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('chat-store')
  }
} 