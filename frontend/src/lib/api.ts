import { createParser, type EventSourceMessage } from 'eventsource-parser'

// Same-origin in both dev (Vite proxies /api and /health to FastAPI, see
// vite.config.ts) and production (FastAPI serves this app's build output
// directly) - no base URL needed.
const API_BASE = ''

export interface DocumentStats {
  total_chunks: number
  total_characters: number
  avg_chunk_size: number
  sources: string[]
}

export interface DocumentUploadResponse {
  success: boolean
  filename: string
  chunks_created: number
  stats: DocumentStats
}

export interface VectorStoreStats {
  total_chunks: number
  unique_sources: number
  sources: string[]
  collection_name: string
  has_api: boolean | null
  conversation_length: number | null
}

export interface DeleteDocumentResponse {
  success: boolean
  deleted_chunks: number
  message: string
}

export interface ClearDocumentsResponse {
  success: boolean
  message: string
}

export interface AnswerQuality {
  confidence: 'high' | 'medium' | 'low'
  confidence_score: number
  explanation: string
  retrieval_ms: number
}

export interface SourceCitation {
  source: string
  relevance: number
  chunk_id: string
  preview: string
  rerank_score?: number | null
  page?: number | null
  paragraph?: number | null
}

export type QueryStreamEvent =
  | { type: 'sources'; sources: SourceCitation[]; retrieved_chunks: number; quality: AnswerQuality | null }
  | { type: 'token'; text: string }
  | { type: 'done'; model: string; generation_ms?: number | null }
  | { type: 'error'; message: string }

export interface ConversationExchange {
  question: string
  answer: string
  sources: string[]
}

export interface HealthResponse {
  status: string
  has_api: boolean
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body?.error === 'string') return body.error
  } catch {
    // Body wasn't JSON (or was empty) - fall through to a generic message.
  }
  return `Request failed with status ${response.status}`
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
  })
  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response))
  }
  return response.json() as Promise<T>
}

export function getHealth(): Promise<HealthResponse> {
  return requestJson('/health')
}

export function getStats(): Promise<VectorStoreStats> {
  return requestJson('/api/stats')
}

export function listDocuments(): Promise<VectorStoreStats> {
  return requestJson('/api/documents')
}

/** XHR rather than fetch: `upload.onprogress` is the simple, broadly
 * supported way to report upload progress. Fetch's equivalent (a
 * ReadableStream request body) isn't worth the complexity here. */
export function uploadDocument(file: File, onProgress?: (fraction: number) => void): Promise<DocumentUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/documents`)
    xhr.withCredentials = true

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total)
      }
    }

    xhr.onload = () => {
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // Non-JSON error body (e.g. a proxy's HTML error page) - handled below.
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as DocumentUploadResponse)
        return
      }

      const message =
        body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
          ? (body as { error: string }).error
          : `Upload failed with status ${xhr.status}`
      reject(new ApiError(xhr.status, message))
    }

    xhr.onerror = () => reject(new ApiError(0, 'Network error during upload'))

    const formData = new FormData()
    formData.append('file', file)
    xhr.send(formData)
  })
}

export function deleteDocument(source: string): Promise<DeleteDocumentResponse> {
  return requestJson(`/api/documents/${encodeURIComponent(source)}`, { method: 'DELETE' })
}

export function clearDocuments(): Promise<ClearDocumentsResponse> {
  return requestJson('/api/documents', { method: 'DELETE' })
}

export function getHistory(): Promise<ConversationExchange[]> {
  return requestJson('/api/history')
}

export function clearHistory(): Promise<{ success: boolean; message: string }> {
  return requestJson('/api/history', { method: 'DELETE' })
}

export function getSampleQuestions(): Promise<string[]> {
  return requestJson('/api/sample-questions')
}

export interface QueryOptions {
  nResults?: number
  useReranking?: boolean
  useContext?: boolean
  signal?: AbortSignal
}

/** Streams `/api/query`'s Server-Sent Events as they arrive.
 *
 * Not built on `EventSource`: that API can't send a POST body, and the
 * backend emits bare `data: {...}` frames with no `event:`/`id:`/`retry:`
 * fields anyway (see backend/app/api/routes/query.py), so EventSource's
 * auto-reconnect wouldn't add anything even if it could be used here.
 *
 * `eventsource-parser` owns frame buffering across chunk boundaries (a
 * `\n\n` frame terminator can land anywhere relative to a `reader.read()`
 * chunk) - re-implementing that by hand is exactly the kind of thing that
 * looks simple and then silently drops/splits events in production.
 *
 * Pass `options.signal` (tied to a "stop" button or effect cleanup) to
 * cancel an in-flight query - otherwise the backend's generator, and the
 * underlying Claude stream, keeps running after the caller stops reading.
 */
export async function* streamQuery(question: string, options: QueryOptions = {}): AsyncGenerator<QueryStreamEvent> {
  const response = await fetch(`${API_BASE}/api/query`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      n_results: options.nResults ?? 5,
      use_reranking: options.useReranking ?? true,
      use_context: options.useContext ?? true,
    }),
    signal: options.signal,
  })

  if (!response.ok || !response.body) {
    throw new ApiError(response.status, await parseErrorMessage(response))
  }

  const pending: QueryStreamEvent[] = []
  const parser = createParser({
    onEvent(message: EventSourceMessage) {
      pending.push(JSON.parse(message.data) as QueryStreamEvent)
    },
  })

  const reader = response.body.getReader()
  // One decoder instance for the whole stream (not a fresh one per chunk):
  // `{ stream: true }` carries incomplete multi-byte UTF-8 sequences across
  // `read()` calls instead of mangling characters split at a chunk boundary.
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      parser.feed(decoder.decode(value, { stream: true }))
      while (pending.length > 0) {
        yield pending.shift()!
      }
    }

    parser.feed(decoder.decode())
    while (pending.length > 0) {
      yield pending.shift()!
    }
  } finally {
    reader.releaseLock()
  }
}
