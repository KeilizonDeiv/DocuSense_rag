from typing import Literal

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    question: str
    n_results: int = Field(default=5, ge=1, le=20)
    use_reranking: bool = True
    use_context: bool = True


class SourceCitation(BaseModel):
    source: str
    relevance: float
    chunk_id: str
    preview: str
    rerank_score: float | None = None
    page: int | None = None
    paragraph: int | None = None


class AnswerQuality(BaseModel):
    """A cheap, heuristic self-assessment of retrieval quality for one query.

    Not a rigorous groundedness metric - it's derived from reranker/embedding
    similarity scores that already exist, meant to give a rough, honest
    signal of "how well did retrieval do here", not a guarantee the answer
    is fully correct.
    """

    confidence: Literal["high", "medium", "low"]
    confidence_score: float
    explanation: str
    retrieval_ms: int


class SourcesEvent(BaseModel):
    """First SSE event: the sources /api/query is about to answer from."""

    type: Literal["sources"] = "sources"
    sources: list[SourceCitation]
    retrieved_chunks: int
    quality: AnswerQuality | None = None


class TokenEvent(BaseModel):
    """One chunk of the streamed answer text."""

    type: Literal["token"] = "token"
    text: str


class DoneEvent(BaseModel):
    """Final SSE event once the answer has finished streaming."""

    type: Literal["done"] = "done"
    model: str
    generation_ms: int | None = None


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


QueryStreamEvent = SourcesEvent | TokenEvent | DoneEvent | ErrorEvent


class ConversationExchange(BaseModel):
    question: str
    answer: str
    sources: list[str]


class ClearHistoryResponse(BaseModel):
    success: bool = True
    message: str
