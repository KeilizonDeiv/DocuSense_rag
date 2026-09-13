from app.services.quality import compute_answer_quality


def test_high_confidence_with_strong_reranked_scores():
    chunks = [{"rerank_score": 2.0}, {"rerank_score": 1.0}]

    result = compute_answer_quality(chunks, retrieval_ms=42)

    assert result.confidence == "high"
    assert "Strong match found across 2 sources" in result.explanation
    assert "(based on semantic similarity only)" not in result.explanation
    assert result.retrieval_ms == 42


def test_medium_confidence_with_weakly_positive_reranked_score():
    chunks = [{"rerank_score": -0.3}]

    result = compute_answer_quality(chunks, retrieval_ms=10)

    assert result.confidence == "medium"
    assert "Moderate match found across 1 source" in result.explanation


def test_low_confidence_with_negative_reranked_score():
    chunks = [{"rerank_score": -3.0}]

    result = compute_answer_quality(chunks, retrieval_ms=10)

    assert result.confidence == "low"
    assert "Only weak matches found" in result.explanation


def test_non_reranked_path_uses_relevance_score_and_adds_caveat():
    chunks = [{"relevance_score": 0.9}, {"relevance_score": 0.85}]

    result = compute_answer_quality(chunks, retrieval_ms=5)

    assert result.confidence == "high"
    assert result.explanation.endswith("(based on semantic similarity only)")


def test_non_reranked_low_relevance_still_gets_caveat():
    chunks = [{"relevance_score": 0.1}]

    result = compute_answer_quality(chunks, retrieval_ms=5)

    assert result.confidence == "low"
    assert result.explanation.endswith("(based on semantic similarity only)")


def test_reranking_detected_from_data_not_a_flag():
    # A chunk carrying rerank_score at all means reranking happened for
    # this batch, regardless of what the request asked for.
    chunks = [{"rerank_score": 2.0}]

    result = compute_answer_quality(chunks, retrieval_ms=1)

    assert "(based on semantic similarity only)" not in result.explanation


def test_confidence_score_is_top_signal_rounded():
    chunks = [{"rerank_score": 0.0}]  # sigmoid(0) == 0.5 exactly

    result = compute_answer_quality(chunks, retrieval_ms=1)

    assert result.confidence_score == 0.5
