"""In-memory rate limiting for the query and upload routes.

This is a best-effort, single-process limiter: state lives in a plain dict
per app instance (see `app.state.query_rate_limiter` / `.upload_rate_limiter`,
created fresh per `create_app()` call in `app.main`'s lifespan - the same
per-process-state tradeoff `RAGEngine.conversation_history` already makes).
It resets on restart and isn't shared across multiple worker
processes/instances. That's acceptable for a single-developer demo app, but
a real multi-instance deployment behind a load balancer would need a shared
store (e.g. Redis) instead.

Keyed by (client IP, session_id) rather than session_id alone: `get_session_id`
mints a fresh session for any cookie-less request, so keying on session_id
alone would let a scripted caller get unlimited fresh buckets just by
dropping the cookie each time. Client IP isn't spoofable the way a cookie
is, absent a trusted reverse proxy in front of this app (out of scope
here) - combining both raises the bar meaningfully without adding real
infrastructure.
"""

import time
from collections import defaultdict, deque

from fastapi import Depends, Request

from app.api.deps import get_session_id
from app.core.exceptions import RateLimitedError


class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window_seconds: float = 60.0):
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        """Record one hit for `key` and return whether it's within the limit."""
        now = time.monotonic()
        hits = self._hits[key]

        while hits and now - hits[0] > self.window_seconds:
            hits.popleft()

        if len(hits) >= self.limit:
            return False

        hits.append(now)
        return True


def get_query_rate_limiter(request: Request) -> SlidingWindowRateLimiter:
    return request.app.state.query_rate_limiter


def get_upload_rate_limiter(request: Request) -> SlidingWindowRateLimiter:
    return request.app.state.upload_rate_limiter


def _enforce(request: Request, session_id: str, limiter: SlidingWindowRateLimiter) -> None:
    client_host = request.client.host if request.client else "unknown"
    key = f"{client_host}:{session_id}"
    if not limiter.allow(key):
        raise RateLimitedError("Too many requests - please wait a moment and try again.")


def rate_limit_query(
    request: Request,
    session_id: str = Depends(get_session_id),
    limiter: SlidingWindowRateLimiter = Depends(get_query_rate_limiter),
) -> None:
    _enforce(request, session_id, limiter)


def rate_limit_upload(
    request: Request,
    session_id: str = Depends(get_session_id),
    limiter: SlidingWindowRateLimiter = Depends(get_upload_rate_limiter),
) -> None:
    _enforce(request, session_id, limiter)
