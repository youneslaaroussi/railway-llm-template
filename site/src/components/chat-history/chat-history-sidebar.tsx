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
  MoreHorizontal
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
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
import { useChatStore } from '@/stores/chat-store'
import { 
  exportSessionToFile, 
  exportAllSessionsToFile, 
  openImportFilePicker, 
  getStorageStats 
} from '@/lib/chat-storage'
import { toast } from 'sonner'

export function ChatHistorySidebar() {
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
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              onClick={handleNewChat}
              className="w-full justify-start"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chat History</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {Object.entries(groupedSessions).map(([date, dateSessions]) => (
                <SidebarMenuItem key={date}>
                  <SidebarMenuButton className="text-sm font-medium text-muted-foreground cursor-default">
                    {getRelativeDate(date)}
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    {dateSessions.map((session) => (
                      <SidebarMenuSubItem key={session.id}>
                        <SidebarMenuSubButton
                          onClick={() => loadSession(session.id)}
                          isActive={currentSession?.id === session.id}
                          className="group"
                        >
                          <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0" />
                          {editingSessionId === session.id ? (
                            <div className="flex-1 flex items-center gap-2">
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
                              />
                            </div>
                          ) : (
                            <span className="truncate flex-1">{session.title}</span>
                          )}
                        </SidebarMenuSubButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction>
                              <MoreHorizontal className="h-4 w-4" />
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start">
                            <DropdownMenuItem
                              onClick={() => handleStartEditing(session.id, session.title)}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleExportSession(session.id)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Export
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteSession(session.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ))}
              
              {sessions.length === 0 && (
                <SidebarMenuItem>
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No chat history yet</p>
                    <p className="text-xs">Start a new conversation to see it here</p>
                  </div>
                </SidebarMenuItem>
              )}
              
              {filteredSessions.length === 0 && sessions.length > 0 && (
                <SidebarMenuItem>
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No chats found</p>
                    <p className="text-xs">Try a different search term</p>
                  </div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <Settings className="h-4 w-4 mr-2" />
                  <span>Options</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export function ChatHistorySkeleton() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Skeleton className="h-10 w-full" />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Skeleton className="h-10 w-full" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <Skeleton className="h-4 w-20" />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {Array.from({ length: 5 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <Skeleton className="h-8 w-full" />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Skeleton className="h-10 w-full" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
} 