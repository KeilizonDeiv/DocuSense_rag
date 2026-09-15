import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  clearDocuments,
  clearHistory,
  deleteDocument,
  getHealth,
  getSampleQuestions,
  getStats,
  type HealthResponse,
  type VectorStoreStats,
} from '@/lib/api'
import { conversationToMarkdown } from '@/lib/chat'
import { useChatSession } from '@/hooks/useChatSession'
import { useDarkMode } from '@/hooks/useDarkMode'
import { DEFAULT_QUERY_SETTINGS, type QuerySettings } from '@/components/AdvancedSettings'
import { ChatPanel } from '@/components/ChatPanel'
import { DocumentLibrary } from '@/components/DocumentLibrary'
import { TopBar } from '@/components/TopBar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  const [isDark, toggleDark] = useDarkMode()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [stats, setStats] = useState<VectorStoreStats | null>(null)
  const [sampleQuestions, setSampleQuestions] = useState<string[]>([])
  const [settings, setSettings] = useState<QuerySettings>(DEFAULT_QUERY_SETTINGS)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)

  const { messages, isStreaming, sendQuestion, stopStreaming, clearMessages } = useChatSession()

  const refreshDocuments = useCallback(async () => {
    try {
      const [newStats, newSamples] = await Promise.all([getStats(), getSampleQuestions()])
      setStats(newStats)
      setSampleQuestions(newSamples)
    } catch {
      toast.error("Couldn't load your document library")
    }
  }, [])

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
    refreshDocuments()
  }, [refreshDocuments])

  const averageConfidence = useMemo(() => {
    const scores = messages
      .filter((m) => m.role === 'assistant' && m.quality != null)
      .map((m) => (m.role === 'assistant' ? m.quality!.confidence_score : 0))
    if (scores.length === 0) return null
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }, [messages])

  const handleDelete = async (source: string) => {
    try {
      await deleteDocument(source)
      await refreshDocuments()
      toast.success(`Removed "${source}"`)
    } catch {
      toast.error(`Couldn't remove "${source}"`)
    }
  }

  const handleClearAll = async () => {
    try {
      await clearDocuments()
      clearMessages()
      await refreshDocuments()
      toast.success('Cleared all documents and conversation history')
    } catch {
      toast.error("Couldn't clear your documents")
    }
  }

  const handleSend = (question: string) => {
    sendQuestion(question, settings).catch(() => {
      toast.error('Something went wrong answering that question')
    })
  }

  const handleExportConversation = () => {
    const markdown = conversationToMarkdown(messages)
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `docusense-conversation-${new Date().toISOString().slice(0, 10)}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleClearConversation = async () => {
    try {
      await clearHistory()
      clearMessages()
      toast.success('Cleared conversation history')
    } catch {
      toast.error("Couldn't clear the conversation")
    }
  }

  const hasDocuments = (stats?.total_chunks ?? 0) > 0

  return (
    <div className="bg-background flex h-svh flex-col">
      <TopBar
        hasApi={health?.has_api ?? null}
        isDark={isDark}
        onToggleDark={toggleDark}
        averageConfidence={averageConfidence}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        hasMessages={messages.length > 0}
        onExportConversation={handleExportConversation}
        onClearConversation={handleClearConversation}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="border-border hidden w-72 shrink-0 overflow-y-auto border-r p-4 lg:block">
          <DocumentLibrary
            stats={stats}
            onUploaded={refreshDocuments}
            onDelete={handleDelete}
            onClearAll={handleClearAll}
          />
        </aside>

        <main className="min-w-0 flex-1">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            hasDocuments={hasDocuments}
            sampleQuestions={sampleQuestions}
            settings={settings}
            onSettingsChange={setSettings}
            onSend={handleSend}
            onStop={stopStreaming}
          />
        </main>
      </div>

      <Sheet open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
        <SheetContent side="left" className="overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Document library</SheetTitle>
          </SheetHeader>
          <div className="px-4 pt-4 pb-4">
            <DocumentLibrary
              stats={stats}
              onUploaded={refreshDocuments}
              onDelete={handleDelete}
              onClearAll={handleClearAll}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Toaster theme={isDark ? 'dark' : 'light'} position="bottom-right" />
    </div>
  )
}
