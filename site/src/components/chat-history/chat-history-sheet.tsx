'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Download, 
  Upload, 
  Settings, 
  Trash2, 
  Edit2,
  MoreHorizontal,
  X
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useChatStore } from '@/stores/chat-store'
import { 
  exportSessionToFile, 
  exportAllSessionsToFile, 
  openImportFilePicker, 
  getStorageStats 
} from '@/lib/chat-storage'
import { toast } from 'sonner'

interface ChatHistorySheetProps {
  children: React.ReactNode
}

export function ChatHistorySheet({ children }: ChatHistorySheetProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  
  const {
    sessions,
    currentSession,
    createSession,
    loadSession,
    deleteSession,
    updateSessionTitle,
    importSessions,
    mobileSheetOpen,
    setMobileSheetOpen,
  } = useChatStore()

  // Filter sessions based on search
  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group sessions by date
  const groupedSessions = filteredSessions.reduce((groups, session) => {
    const date = format(new Date(session.createdAt), 'yyyy-MM-dd')
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(session)
    return groups
  }, {} as Record<string, typeof sessions>)

  const handleNewChat = () => {
    createSession()
    setMobileSheetOpen(false)
  }

  const handleLoadSession = (sessionId: string) => {
    loadSession(sessionId)
    setMobileSheetOpen(false)
  }

  const handleExportSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (session) {
      exportSessionToFile(session)
    }
  }

  const handleExportAll = () => {
    exportAllSessionsToFile(sessions)
  }

  const handleImport = () => {
    openImportFilePicker(
      (data) => {
        importSessions(JSON.stringify(data))
      },
      (error) => {
        console.error('Import failed:', error)
        toast.error('Failed to import chats')
      }
    )
  }

  const handleDeleteSession = (sessionId: string) => {
    if (window.confirm('Are you sure you want to delete this chat?')) {
      deleteSession(sessionId)
    }
  }

  const handleStartEditing = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId)
    setEditingTitle(currentTitle)
  }

  const handleSaveEdit = () => {
    if (editingSessionId && editingTitle.trim()) {
      updateSessionTitle(editingSessionId, editingTitle.trim())
    }
    setEditingSessionId(null)
    setEditingTitle('')
  }

  const handleCancelEdit = () => {
    setEditingSessionId(null)
    setEditingTitle('')
  }

  const getRelativeDate = (date: string) => {
    const sessionDate = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (format(sessionDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return 'Today'
    } else if (format(sessionDate, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return 'Yesterday'
    } else {
      return format(sessionDate, 'MMMM d, yyyy')
    }
  }

  const storageStats = getStorageStats()

  return (
    <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="text-left">Chat History</SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col h-full">
          {/* Header Controls */}
          <div className="p-4 space-y-3">
            <Button
              onClick={handleNewChat}
              className="w-full justify-start"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <Separator />
          
          {/* Chat List */}
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-4 py-4">
              {Object.entries(groupedSessions).map(([date, dateSessions]) => (
                <div key={date} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground px-2">
                    {getRelativeDate(date)}
                  </h3>
                  <div className="space-y-1">
                    {dateSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`group relative rounded-lg p-2 hover:bg-accent cursor-pointer ${
                          currentSession?.id === session.id ? 'bg-accent' : ''
                        }`}
                        onClick={() => handleLoadSession(session.id)}
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          {editingSessionId === session.id ? (
                            <Input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={handleSaveEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveEdit()
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit()
                                }
                              }}
                              className="h-6 text-sm"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="truncate flex-1 text-sm">{session.title}</span>
                          )}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStartEditing(session.id, session.title)
                                }}
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleExportSession(session.id)
                                }}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Export
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteSession(session.id)
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {sessions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No chat history yet</p>
                  <p className="text-xs">Start a new conversation to see it here</p>
                </div>
              )}
              
              {filteredSessions.length === 0 && sessions.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No chats found</p>
                  <p className="text-xs">Try a different search term</p>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <Separator />
          
          {/* Footer */}
          <div className="p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Options
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem onClick={handleExportAll}>
                  <Download className="h-4 w-4 mr-2" />
                  Export All Chats
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImport}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Chats
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-medium">Storage</span>
                    <span className="text-xs text-muted-foreground">
                      {storageStats.totalSessions} chats, {storageStats.totalMessages} messages
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {storageStats.estimatedSize}
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function ChatHistorySheetSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="text-left">Chat History</SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col h-full">
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          
          <Separator />
          
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-4 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <div className="space-y-1">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Skeleton key={j} className="h-10 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <Separator />
          
          <div className="p-4">
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
} 