import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Bot, Check, Copy, User } from 'lucide-react'

import type { ChatMessage } from '@/lib/chat'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ConfidencePanel } from './ConfidencePanel'
import { SourcesList } from './SourcesList'

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div className={cn('flex min-w-0 max-w-[85%] flex-col', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.text}</p>
          ) : message.error ? (
            <p className="text-destructive">{message.error}</p>
          ) : message.text ? (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>:first-child]:mt-0 [&>:last-child]:mb-0">
              <ReactMarkdown>{message.text}</ReactMarkdown>
            </div>
          ) : message.isStreaming ? (
            <ThinkingDots />
          ) : null}
        </div>

        {!isUser && !message.error && message.quality && (
          <ConfidencePanel
            quality={message.quality}
            generationMs={message.generationMs}
            sourceCount={message.sources.length}
          />
        )}
        {!isUser && !message.error && message.sources.length > 0 && <SourcesList sources={message.sources} />}
        {!isUser && !message.error && message.text && !message.isStreaming && <CopyButton text={message.text} />}
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground mt-1"
      aria-label="Copy answer"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />}
    </Button>
  )
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Thinking">
      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full" />
    </div>
  )
}
