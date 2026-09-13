import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.deps import session_middleware
from app.api.routes import documents, history, query, stats
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.core.rate_limit import SlidingWindowRateLimiter
from app.models.common import HealthResponse
from app.services.document_processor import DocumentProcessor
from app.services.query_rewriter import QueryRewriter
from app.services.rag_engine import RAGEngine
from app.services.reranker import Reranker
from app.services.vector_store import VectorStore

logger = logging.getLogger(__name__)

# style-src needs 'unsafe-inline': shadcn/ui's Radix primitives (Popover,
# DropdownMenu, Tooltip, Select) set inline `style` attributes for dynamic
# positioning - a stricter policy would visually break them.
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'"
    ),
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(settings.log_level)

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.vector_db_path.mkdir(parents=True, exist_ok=True)

    app.state.document_processor = DocumentProcessor(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    app.state.vector_store = VectorStore(
        persist_directory=str(settings.vector_db_path),
        embedding_model_name=settings.embedding_model,
    )
    app.state.rag_engine = RAGEngine(
        vector_store=app.state.vector_store,
        api_key=settings.anthropic_api_key,
        model=settings.anthropic_model,
        reranker=Reranker(model_name=settings.reranker_model),
        query_rewriter=QueryRewriter(api_key=settings.anthropic_api_key, model=settings.anthropic_rewrite_model),
        rerank_candidate_multiplier=settings.rerank_candidate_multiplier,
    )
    app.state.query_rate_limiter = SlidingWindowRateLimiter(limit=settings.rate_limit_query_per_minute)
    app.state.upload_rate_limiter = SlidingWindowRateLimiter(limit=settings.rate_limit_upload_per_minute)

    logger.info(
        "AI Document Intelligence Assistant started",
        extra={"extra_fields": {"has_api": app.state.rag_engine.has_api}},
    )

    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="AI Document Intelligence Assistant", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_headers_middleware(request, call_next):
        response = await call_next(request)
        for header, value in _SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        return response

    app.middleware("http")(session_middleware)

    register_exception_handlers(app)

    app.include_router(documents.router)
    app.include_router(query.router)
    app.include_router(stats.router)
    app.include_router(history.router)

    @app.get("/health", response_model=HealthResponse)
    async def health():
        return HealthResponse(has_api=app.state.rag_engine.has_api)

    # Guarded on the directory existing: StaticFiles raises immediately at
    # mount time if it doesn't, which would break every backend test (they
    # all call create_app()) in any environment without a built frontend -
    # a fresh clone, backend-only CI, or simply not having run `npm run
    # build` yet. Registered last: Starlette matches routes in registration
    # order, so this must come after the API routers or it would shadow them.
    frontend_dist = settings.frontend_dist_path
    if frontend_dist.is_dir():
        app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="frontend-assets")

        @app.get("/{full_path:path}")
        async def serve_frontend(full_path: str):
            # Prefix checks, not exact-match: the real /api/* and /health
            # routes are registered above and never reach this catch-all,
            # so anything landing here under those prefixes (e.g. a typo'd
            # /health/nope) is a genuine 404, not a client-side route to
            # hand off to the SPA.
            if full_path.startswith("api/") or full_path.startswith("health"):
                raise HTTPException(status_code=404)

            candidate = frontend_dist / full_path
            if full_path and candidate.is_file():
                return FileResponse(candidate)

            return FileResponse(frontend_dist / "index.html")

    return app


app = create_app()
