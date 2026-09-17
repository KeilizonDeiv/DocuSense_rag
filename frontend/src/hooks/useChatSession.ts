import { useCallback, useRef, useState } from 'react'

import { streamQuery } from '@/lib/api'
import type { AssistantMessage, ChatMessage } from '@/lib/chat'

export interface QueryOptions {
  nResults: number
  useReranking: boolean
  useContext: boolean
}

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendQuestion = useCallback(async (question: string, options: QueryOptions) => {
    const assistantId = crypto.randomUUID()
    const assistantMessage: AssistantMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      sources: [],
      quality: null,
      model: null,
      generationMs: null,
      isStreaming: true,
      error: null,
    }
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: question }, assistantMessage])
    setIsStreaming(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const updateAssistant = (updater: (msg: AssistantMessage) => Partial<AssistantMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId && m.role === 'assistant' ? { ...m, ...updater(m) } : m)),
      )
    }

    try {
      for await (const event of streamQuery(question, { ...options, signal: controller.signal })) {
        if (event.type === 'sources') {
          updateAssistant(() => ({ sources: event.sources, quality: event.quality }))
        } else if (event.type === 'token') {
          updateAssistant((m) => ({ text: m.text + event.text }))
        } else if (event.type === 'error') {
          updateAssistant(() => ({ error: event.message }))
        } else if (event.type === 'done') {
          updateAssistant(() => ({
            isStreaming: false,
            model: event.model,
            generationMs: event.generation_ms ?? null,
          }))
        }
      }
    } catch (err) {
      // A cancelled fetch (user hit "stop") isn't a failure worth surfacing.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        const message = err instanceof Error ? err.message : 'Something went wrong answering this question.'
        updateAssistant(() => ({ error: message, isStreaming: false }))
      } else {
        updateAssistant(() => ({ isStreaming: false }))
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [])

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, isStreaming, sendQuestion, stopStreaming, clearMessages }
}
