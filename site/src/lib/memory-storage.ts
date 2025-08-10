import { Memory, MemoryDto } from '@/types/memory'
import { nanoid } from 'nanoid'

const DB_NAME = 'SignalBoxLLMMemories'
const DB_VERSION = 1
const STORE_NAME = 'memories'

class MemoryStorage {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('key', 'key', { unique: false })
          store.createIndex('category', 'category', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
    })
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB')
    }
    return this.db
  }

  async saveMemory(memoryDto: MemoryDto): Promise<Memory> {
    const db = await this.ensureDB()
    const now = new Date()

    const memory: Memory = {
      id: nanoid(),
      key: memoryDto.key,
      value: memoryDto.value,
      category: memoryDto.category,
      createdAt: now,
      updatedAt: now
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(memory)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(memory)
    })
  }

  async getMemoriesByKey(key: string): Promise<Memory[]> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('key')
      const request = index.getAll(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async getAllMemories(): Promise<Memory[]> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async getMemoriesByCategory(category: string): Promise<Memory[]> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('category')
      const request = index.getAll(category)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || [])
    })
  }

  async deleteMemory(id: string): Promise<void> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async deleteMemoryByKey(key: string): Promise<void> {
    const memories = await this.getMemoriesByKey(key)
    if (memories && memories.length > 0) {
      const db = await this.ensureDB()
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      
      memories.forEach(memory => store.delete(memory.id))

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = (event) => reject(transaction.error)
      });
    }
  }

  async clearAllMemories(): Promise<void> {
    const db = await this.ensureDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getMemoriesAsDto(): Promise<MemoryDto[]> {
    const memories = await this.getAllMemories()
    return memories.map(memory => ({
      key: memory.key,
      value: memory.value,
      category: memory.category
    }))
  }
}

// Create singleton instance
export const memoryStorage = new MemoryStorage()

// Initialize on module load in browser environment
if (typeof window !== 'undefined') {
  memoryStorage.init().catch(console.error)
}