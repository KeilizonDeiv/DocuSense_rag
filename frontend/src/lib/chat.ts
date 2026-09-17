import type { AnswerQuality, SourceCitation } from './api'

export interface UserMessage {
  id: string
  role: 'user'
  text: string
}

export interface AssistantMessage {
  id: string
  role: 'assistant'
  text: string
  sources: SourceCitation[]
  quality: AnswerQuality | null
  model: string | null
  generationMs: number | null
  isStreaming: boolean
  error: string | null
}

export type ChatMessage = UserMessage | AssistantMessage

export function conversationToMarkdown(messages: ChatMessage[]): string {
  const lines: string[] = ['# DocuSense conversation', '']

  for (const message of messages) {
    if (message.role === 'user') {
      lines.push(`## Q: ${message.text}`, '')
      continue
    }

    lines.push(message.text || '_(no answer)_', '')
    if (message.sources.length > 0) {
      lines.push('**Sources:**', '')
      for (const [index, source] of message.sources.entries()) {
        lines.push(`${index + 1}. ${source.source} (${Math.round(source.relevance * 100)}% relevance)`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}
