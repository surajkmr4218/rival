"""
Shared slowapi limiter. Keyed by client IP via `get_remote_address`.

Decorate endpoints with `@limiter.limit("5/minute")` and include `request: Request`
in the signature — slowapi pulls the key off `request.state` set by the middleware.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
