# Quick Start

## 1. Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

*First run downloads the embedding and reranker models (~200MB) - be patient.*

Optional: add your Anthropic API key for Claude-generated answers (works fine without it too, in **demo mode**):

```bash
cp .env.example .env
# then edit .env and set ANTHROPIC_API_KEY=your_key_here
```

## 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`).

## 3. Try it

1. Drag a PDF, DOCX, TXT, or MD file onto the upload area (or click it).
2. Ask a question about it in the chat box.
3. Watch the answer stream in, along with a **confidence badge** (Strong/Moderate/Weak match) explaining how well your documents actually supported that answer, and an expandable list of the sources it drew from.

## Demo mode vs. live mode

| | Without `ANTHROPIC_API_KEY` (demo) | With `ANTHROPIC_API_KEY` (live) |
|---|---|---|
| Upload & search | Full semantic search + reranking | Same |
| Confidence report | Full report | Same |
| Answer | The retrieved excerpts themselves | A Claude-generated, cited answer |

## Sample things to try

- Upload a document and ask: *"What are the main topics covered in this document?"*
- Ask a follow-up like *"Can you say more about that?"* - the app rewrites vague follow-ups into standalone search queries automatically, so it still finds the right passages.
- Upload an unrelated file and ask about something the documents don't cover - the confidence badge should read **Weak match**, which is the point: it's telling you the answer may not be trustworthy rather than confidently making something up.

## Something not working?

- **"No documents uploaded yet"** - upload at least one supported file first.
- **Upload rejected** - check the file is actually a valid PDF/DOCX (content is checked, not just the extension) and under the size/count limits shown in the sidebar.
- **Frontend can't reach the backend** - make sure the backend is running on `:8000`; the frontend dev server proxies to it automatically (see `frontend/vite.config.ts`).
- More detail, configuration options, and the full architecture: see [README.md](README.md).
