import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, Square } from 'lucide-react'

import type { ChatMessage } from '@/lib/chat'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { AdvancedSettings, type QuerySettings } from './AdvancedSettings'
import { MessageBubble } from './MessageBubble'

export function ChatPanel({
  messages,
  isStreaming,
  hasDocuments,
  sampleQuestions,
  settings,
  onSettingsChange,
  onSend,
  onStop,
}: {
  messages: ChatMessage[]
  isStreaming: boolean
  hasDocuments: boolean
  sampleQuestions: string[]
  settings: QuerySettings
  onSettingsChange: (settings: QuerySettings) => void
  onSend: (question: string) => void
  onStop: () => void
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const submit = () => {
    const question = input.trim()
    if (!question || isStreaming || !hasDocuments) return
    setInput('')
    onSend(question)
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          {messages.length === 0 ? (
            <WelcomeState hasDocuments={hasDocuments} />
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-border border-t p-3 sm:p-4">
        {sampleQuestions.length > 0 && messages.length === 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {sampleQuestions.map((question) => (
              <button
                key={question}
                type="button"
                disabled={!hasDocuments}
                onClick={() => onSend(question)}
                className="bg-muted hover:bg-muted/70 text-muted-foreground rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={hasDocuments ? 'Ask a question about your documents...' : 'Upload a document to get started'}
            disabled={!hasDocuments}
            rows={1}
            className="max-h-32 min-h-10 resize-none py-2"
          />
          <AdvancedSettings settings={settings} onChange={onSettingsChange} />
          {isStreaming ? (
            <Button variant="outline" size="icon" onClick={onStop} aria-label="Stop generating">
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button size="icon" onClick={submit} disabled={!input.trim() || !hasDocuments} aria-label="Send question">
              <Send />
            </Button>
          )}
        </div>
        <p className="text-muted-foreground mt-1.5 text-center text-xs">
          Press Enter to send, Shift+Enter for a new line
        </p>
      </div>
    </div>
  )
}

function WelcomeState({ hasDocuments }: { hasDocuments: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <Sparkles className="text-muted-foreground size-6" />
      </div>
      <h2 className="text-lg font-medium">
        {hasDocuments ? 'Ask anything about your documents' : 'Upload a document to get started'}
      </h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        {hasDocuments
          ? 'Try one of the sample questions below, or ask your own.'
          : 'Once you upload a PDF, Word document, or text file, you can ask questions about its content here.'}
      </p>
    </div>
  )
}
