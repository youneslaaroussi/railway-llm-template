import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import { ChatMessage } from '@/types/chat'
import { nanoid } from 'nanoid'

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

interface ChatState {
  // Current active session
  currentSession: ChatSession | null
  
  // All saved sessions
  sessions: ChatSession[]
  
  // Loading states
  isLoading: boolean
  isSaving: boolean
  
  // UI state
  sidebarOpen: boolean
  mobileSheetOpen: boolean
}

interface ChatActions {
  // Session management
  createSession: (title?: string) => void
  loadSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  updateSessionTitle: (sessionId: string, title: string) => void
  
  // Message management
  addMessage: (message: Omit<ChatMessage, 'id' | 'createdAt'>) => string
  updateMessage: (
    messageId: string, 
    updater: string | ((prevContent: string) => string)
  ) => void
  clearMessages: () => void
  
  // Loading states
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  
  // UI state
  setSidebarOpen: (open: boolean) => void
  setMobileSheetOpen: (open: boolean) => void
  
  // Export/Import
  exportSession: (sessionId: string) => string
  exportAllSessions: () => string
  importSessions: (data: string) => void
  
  // Utilities
  generateSessionTitle: (messages: ChatMessage[]) => string
}

type ChatStore = ChatState & ChatActions

const createInitialSession = (): ChatSession => ({
  id: crypto.randomUUID(),
  title: 'New Chat',
  messages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
})

export const useChatStore = create<ChatStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      currentSession: null,
      sessions: [],
      isLoading: false,
      isSaving: false,
      sidebarOpen: false,
      mobileSheetOpen: false,
      
      // Session management
      createSession: (title?: string) => {
        set((state) => {
          const newSession = createInitialSession()
          if (title) {
            newSession.title = title
          }
          state.currentSession = newSession
          state.sessions.unshift(newSession)
        })
      },
      
      loadSession: (sessionId: string) => {
        set((state) => {
          const session = state.sessions.find(s => s.id === sessionId)
          if (session) {
            state.currentSession = session
          }
        })
      },
      
      deleteSession: (sessionId: string) => {
        set((state) => {
          state.sessions = state.sessions.filter(s => s.id !== sessionId)
          if (state.currentSession?.id === sessionId) {
            state.currentSession = state.sessions[0] || null
          }
        })
      },
      
      updateSessionTitle: (sessionId: string, title: string) => {
        set((state) => {
          const session = state.sessions.find(s => s.id === sessionId)
          if (session) {
            session.title = title
            session.updatedAt = new Date()
          }
          if (state.currentSession?.id === sessionId) {
            state.currentSession.title = title
            state.currentSession.updatedAt = new Date()
          }
        })
      },
      
      // Message management
      addMessage: (message) => {
        const newMessage: ChatMessage = {
          ...message,
          id: nanoid(),
          createdAt: new Date(),
        }
        set(state => {
          if (state.currentSession) {
            state.currentSession.messages.push(newMessage)
            // Assuming saveSessionToStorage is defined elsewhere or will be added
            // saveSessionToStorage(state.currentSession) 
          } else {
            const newSession = createInitialSession()
            newSession.messages.push(newMessage)
            state.sessions.unshift(newSession) // Changed from state.sessions[newSession.id] = newSession to state.sessions.unshift(newSession)
            state.currentSession = newSession
            // Assuming saveSessionToStorage is defined elsewhere or will be added
            // saveSessionToStorage(newSession)
          }
        })
        return newMessage.id
      },
      
      updateMessage: (messageId, updateFn) => {
        set(state => {
          if (state.currentSession) {
            const message = state.currentSession.messages.find(m => m.id === messageId)
            if (message) {
              if (typeof updateFn === 'function') {
                message.content = updateFn(message.content)
              } else {
                message.content = updateFn
              }
              state.currentSession.updatedAt = new Date()
              
              // Update session in sessions array
              const sessionIndex = state.sessions.findIndex(s => s.id === state.currentSession!.id)
              if (sessionIndex !== -1) {
                state.sessions[sessionIndex] = state.currentSession
              }
            }
          }
        })
      },
      
      clearMessages: () => {
        set((state) => {
          if (state.currentSession) {
            state.currentSession.messages = []
            state.currentSession.updatedAt = new Date()
            
            // Update session in sessions array
            const sessionIndex = state.sessions.findIndex(s => s.id === state.currentSession!.id)
            if (sessionIndex !== -1) {
              state.sessions[sessionIndex] = state.currentSession
            }
          }
        })
      },
      
      // Input management
      
      // Loading states
      setLoading: (loading: boolean) => {
        set((state) => {
          state.isLoading = loading
        })
      },
      
      setSaving: (saving: boolean) => {
        set((state) => {
          state.isSaving = saving
        })
      },
      
      // UI state
      setSidebarOpen: (open: boolean) => {
        set((state) => {
          state.sidebarOpen = open
        })
      },
      
      setMobileSheetOpen: (open: boolean) => {
        set((state) => {
          state.mobileSheetOpen = open
        })
      },
      
      // Export/Import
      exportSession: (sessionId: string) => {
        const session = get().sessions.find(s => s.id === sessionId)
        if (!session) return ''
        
        return JSON.stringify({
          version: '1.0.0',
          type: 'single',
          session,
          exportedAt: new Date().toISOString(),
        }, null, 2)
      },
      
      exportAllSessions: () => {
        const sessions = get().sessions
        
        return JSON.stringify({
          version: '1.0.0',
          type: 'all',
          sessions,
          exportedAt: new Date().toISOString(),
        }, null, 2)
      },
      
      importSessions: (data: string) => {
        try {
          const parsed = JSON.parse(data)
          
          if (parsed.version !== '1.0.0') {
            throw new Error('Unsupported version')
          }
          
          set((state) => {
            if (parsed.type === 'single' && parsed.session) {
              // Import single session
              const importedSession = {
                ...parsed.session,
                id: crypto.randomUUID(), // Generate new ID to avoid conflicts
                createdAt: new Date(parsed.session.createdAt),
                updatedAt: new Date(parsed.session.updatedAt),
              }
              
              state.sessions.unshift(importedSession)
            } else if (parsed.type === 'all' && parsed.sessions) {
              // Import all sessions
              const importedSessions = parsed.sessions.map((session: any) => ({
                ...session,
                id: crypto.randomUUID(), // Generate new ID to avoid conflicts
                createdAt: new Date(session.createdAt),
                updatedAt: new Date(session.updatedAt),
              }))
              
              state.sessions.push(...importedSessions)
            }
          })
        } catch (error) {
          console.error('Failed to import sessions:', error)
          throw new Error('Invalid import data')
        }
      },
      
      // Utilities
      generateSessionTitle: (messages: ChatMessage[]) => {
        const firstUserMessage = messages.find(m => m.role === 'user')
        if (!firstUserMessage) return 'New Chat'
        
        // Take first 50 characters and add ellipsis if needed
        const title = firstUserMessage.content.slice(0, 50)
        return title.length < firstUserMessage.content.length ? `${title}...` : title
      },
    })),
    {
      name: 'chat-store',
      // Only persist sessions and UI state, not temporary state
      partialize: (state) => ({
        sessions: state.sessions,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
) 