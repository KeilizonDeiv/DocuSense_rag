import uuid

from fastapi import Request

from app.core.config import get_settings
from app.services.rag_engine import RAGEngine
from app.services.document_processor import DocumentProcessor
from app.services.vector_store import VectorStore

SESSION_COOKIE_NAME = "session_id"
SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


def get_document_processor(request: Request) -> DocumentProcessor:
    return request.app.state.document_processor


def get_vector_store(request: Request) -> VectorStore:
    return request.app.state.vector_store


def get_rag_engine(request: Request) -> RAGEngine:
    return request.app.state.rag_engine


def get_session_id(request: Request) -> str:
    """Identify the caller so documents/history stay scoped to one browser.

    This is a lightweight session concept for a single-tenant demo app, not
    authentication - anyone who has (or guesses) the cookie value can access
    that session's data. See the README's design notes.

    The actual cookie read/validate/mint work happens in `session_middleware`
    below, not here - this just reads the result it stashed on
    `request.state`. It used to live in this function as a `Response`-typed
    dependency parameter, but FastAPI only merges headers set that way into
    the final response when the endpoint returns normally: if any handler
    down the line raises an `AppError` (NoDocumentsError, RateLimitedError,
    etc. - all routine, expected control flow, not bugs), the exception
    handler builds its own response from scratch and the cookie silently
    never gets sent. Doing this in middleware instead means it wraps the
    exception-handled response too.
    """
    return request.state.session_id


async def session_middleware(request: Request, call_next):
    """Ensure every request has a valid session_id, and that a freshly
    minted one actually reaches the client - even on responses built by an
    exception handler (see `get_session_id`'s docstring).

    The value must be a valid UUID: it's used to build filesystem paths
    elsewhere (upload_dir / session_id). A cookie is client-controlled and
    unvalidated input, so without this check a crafted
    `session_id=../../whatever` cookie would let a client traverse or delete
    arbitrary directories on the server.
    """
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    is_valid = False
    if session_id:
        try:
            uuid.UUID(session_id)
            is_valid = True
        except ValueError:
            pass

    if not is_valid:
        session_id = str(uuid.uuid4())
    request.state.session_id = session_id

    response = await call_next(request)

    if not is_valid:
        response.set_cookie(
            SESSION_COOKIE_NAME,
            session_id,
            max_age=SESSION_COOKIE_MAX_AGE,
            httponly=True,
            samesite="lax",
            secure=get_settings().cookie_secure,
        )
    return response
