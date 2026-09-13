"""Cheap, deterministic self-assessment of retrieval quality for one query.

Computes a confidence bucket and plain-language explanation from scores
retrieval already produces (reranker cross-encoder logits, or embedding
cosine similarity when reranking is off) - no extra LLM call, nothing to
tune beyond the thresholds below.
"""

import math

from app.models.query import AnswerQuality

# Tunable heuristic constants, not a rigorous groundedness metric. Chosen
# with the reranked (sigmoid-normalized) path in mind - see _signal().
_HIGH_TOP = 0.6
_HIGH_MEAN = 0.5
_MEDIUM_TOP = 0.35


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _signal(chunk: dict, used_reranking: bool) -> float:
    if used_reranking:
        # Cross-encoder logits are unbounded; sigmoid maps them to a 0-1
        # pseudo-probability (midpoint 0.5 at logit 0) - the standard
        # treatment for MS MARCO cross-encoders, which have no calibrated
        # probability output otherwise.
        return _sigmoid(chunk["rerank_score"])
    # Chroma's cosine distance is already ~0-1 for normalized text
    # embeddings; clamp defensively since cosine similarity can in theory
    # dip slightly negative. Not directly comparable to the sigmoid-scaled
    # signal above - see the caveat appended in _explain().
    return max(0.0, min(1.0, chunk.get("relevance_score", 0.0)))


def compute_answer_quality(chunks: list[dict], retrieval_ms: int) -> AnswerQuality:
    """Summarize how well retrieval did for one query's returned `chunks`.

    Callers must only pass a non-empty list (the zero-chunks case is
    handled separately upstream, before retrieval scores even exist).

    Whether reranking actually happened is read from the data itself
    (`"rerank_score" in chunks[0]`) rather than threaded through as a
    separate flag, since a caller can request reranking while none is
    configured - `RAGEngine._retrieve` silently falls back to plain
    similarity search in that case, and chunks then only ever carry
    `relevance_score`.
    """
    used_reranking = "rerank_score" in chunks[0]
    signals = [_signal(chunk, used_reranking) for chunk in chunks]

    top_score = max(signals)
    mean_score = sum(signals) / len(signals)

    if top_score >= _HIGH_TOP and mean_score >= _HIGH_MEAN:
        confidence = "high"
    elif top_score >= _MEDIUM_TOP:
        confidence = "medium"
    else:
        confidence = "low"

    return AnswerQuality(
        confidence=confidence,
        confidence_score=round(top_score, 3),
        explanation=_explain(confidence, len(chunks), used_reranking),
        retrieval_ms=retrieval_ms,
    )


def _explain(confidence: str, num_sources: int, used_reranking: bool) -> str:
    source_word = "source" if num_sources == 1 else "sources"

    if confidence == "high":
        text = (
            f"Strong match found across {num_sources} {source_word} - this answer "
            "should be well grounded in your documents."
        )
    elif confidence == "medium":
        text = (
            f"Moderate match found across {num_sources} {source_word} - the answer "
            "is likely partially supported. Worth double-checking against the source text."
        )
    else:
        text = (
            "Only weak matches found - the answer may be incomplete or off-topic. "
            "Try rephrasing your question or uploading more relevant documents."
        )

    # Raw embedding similarity is less discriminative than reranked scores
    # (see _signal) - say so rather than implying the same precision.
    if not used_reranking:
        text += " (based on semantic similarity only)"

    return text
