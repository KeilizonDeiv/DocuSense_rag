# DocuSense

An AI-powered document Q&A system: upload PDF, DOCX, TXT, or Markdown files and ask questions about them. Answers are grounded in your documents via retrieval augmented generation (RAG), streamed token-by-token, cited with sources, and paired with a plain-language **confidence report** on how well the retrieval step actually supported the answer.

## Architecture

```
backend/                FastAPI app - the only backend implementation
  app/
    api/routes/         documents, query (SSE streaming), stats, history
    core/               config, security headers, rate limiting, file validation
    services/           document processing, embeddings/vector store, reranker,
                         query rewriter, RAG orchestration, answer-quality scoring
    tests/

frontend/                React + TypeScript + Tailwind + shadcn/ui
  src/
    components/          UploadDock, ChatPanel, ConfidencePanel, SourcesList, ...
    lib/api.ts            typed API client + SSE stream parser
    hooks/useChatSession.ts
```

**Development**: the backend runs on `:8000`; the frontend's Vite dev server runs separately (default `:5173`, or the next free port) and proxies `/api` and `/health` to the backend.

**Production**: `npm run build` produces `frontend/dist`, which the FastAPI app serves directly (see `backend/app/main.py`) - one process, one port, no CORS involved.

## How it works

1. **Upload** - a document is chunked (with overlap, preferring sentence/paragraph boundaries), embedded with `all-MiniLM-L6-v2`, and stored in a per-session ChromaDB collection.
2. **Retrieve** - your question is embedded and matched against your documents' chunks; a cross-encoder reranker (`cross-encoder/ms-marco-MiniLM-L-6-v2`) re-scores the candidates for relevance. Follow-up questions are first rewritten into a standalone form (using recent conversation history) so retrieval doesn't miss context like "what about the second one?".
3. **Answer** - the top chunks are sent to Claude as context and the answer streams back over Server-Sent Events, alongside the sources used.
4. **Report** - retrieval scores are summarized into a confidence bucket (High/Moderate/Weak match) with a plain-language explanation, shown right under the answer - see [Design notes](#design-notes) for what this is (and isn't).

Without an `ANTHROPIC_API_KEY`, the app runs in **demo mode**: retrieval and the confidence report work exactly the same, but the "answer" is the retrieved excerpts themselves rather than a Claude-generated response.

## Setup

### Backend

```bash
cd backend
uv sync                       # or: pip install -e .
cp .env.example .env          # add ANTHROPIC_API_KEY to enable live answers (optional)
uv run uvicorn app.main:app --reload --port 8000
```

Requires Python 3.12+. First run downloads the embedding and reranker models (~200MB total).

### Frontend

```bash
cd frontend
npm install
npm run dev                   # dev server with hot reload, proxies to :8000
```

### Running the tests

```bash
cd backend
uv run pytest -q
```

## Production

```bash
cd frontend && npm run build
cd ../backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000` - the same process now serves the built frontend and the API.

## Configuration

All settings are environment variables (see `backend/.env.example` for the full list with explanations), loaded from `backend/.env`. Notable ones:

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | unset (demo mode) | Enables Claude-generated answers |
| `MAX_FILE_SIZE_MB` / `MAX_DOCUMENTS_PER_SESSION` / `MAX_TOTAL_UPLOAD_MB_PER_SESSION` | `10` / `50` / `100` | Per-session upload limits |
| `RATE_LIMIT_QUERY_PER_MINUTE` / `RATE_LIMIT_UPLOAD_PER_MINUTE` | `20` / `10` | Best-effort, single-process rate limits |
| `COOKIE_SECURE` | `false` | Set `true` once deployed behind HTTPS (see note below) |
| `CORS_ORIGINS` | Vite dev server origins | Only relevant when running the frontend dev server separately |

## Security notes

- **Sessions, not accounts.** An httpOnly cookie scopes documents/history to one browser - there is no login. Anyone with the cookie can access that session's data. This is a single-tenant, demo-appropriate design, not a multi-user access control system.
- **Uploads** are validated by both extension and content signature (a `.pdf` must actually start with a PDF header, etc.), size-capped with a streaming read (so an oversized upload can't exhaust memory before being rejected), and capped per-session by count and total bytes.
- **Rate limiting** is a best-effort, in-memory, single-process limiter (keyed by client IP + session) protecting the Claude API budget and the embedding/reranking CPU cost - not a substitute for a real gateway/WAF in front of a multi-instance deployment.
- **`COOKIE_SECURE`** defaults to `false` deliberately: browsers do not send `Secure` cookies over plain HTTP, even to `localhost` - only set it to `true` once the app is actually served over HTTPS, or the session cookie will silently stop working there instead.
- Security headers (CSP, `X-Frame-Options`, etc.) are set on every response; the CSP allows `'unsafe-inline'` styles specifically because shadcn/ui's Radix/Base UI primitives position floating elements (popovers, tooltips, dropdowns) via inline styles.

## Design notes

- **The confidence report is a heuristic, not a guarantee.** It's derived from the same reranker/embedding similarity scores retrieval already produces (sigmoid-normalized cross-encoder logits when reranking is on, cosine similarity when it's off) - a genuinely useful signal for "did retrieval find something relevant," but not a rigorous fact-checking or hallucination-detection pass over the generated answer itself.
- **Chunk IDs are scoped per session.** Two sessions uploading byte-identical content get distinct chunk IDs (the ID hash includes `session_id`) - without this, ChromaDB's upsert-by-ID behavior would let one session's upload silently vanish into another session's existing chunk.
- Conversation history and rate-limit state live in memory per process - restarting the backend clears them. Documents persist on disk (`vector_db/`, `uploads/`) across restarts.

## Advanced configuration

Chunk size/overlap, the embedding/reranker models, and the Claude models used for answers vs. query rewriting are all environment variables - see `backend/.env.example`. There's no need to edit source to change them.

## License

Open source, for educational and portfolio purposes.
