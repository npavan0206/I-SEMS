from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Dict

class CacheService:
    def __init__(self, default_ttl: int = 10):
        self._store: Dict[str, Any] = {}
        self._expiry: Dict[str, datetime] = {}
        self._default_ttl = default_ttl

    def get(self, key: str) -> Optional[Any]:
        if key in self._store and key in self._expiry:
            if datetime.now(timezone.utc) < self._expiry[key]:
                return self._store[key]
            else:
                del self._store[key]
                del self._expiry[key]
        return None

    def set(self, key: str, value: Any, ttl: int = None) -> None:
        ttl = ttl or self._default_ttl
        self._store[key] = value
        self._expiry[key] = datetime.now(timezone.utc) + timedelta(seconds=ttl)

    def delete(self, key: str) -> bool:
        if key in self._store:
            del self._store[key]
            if key in self._expiry:
                del self._expiry[key]
            return True
        return False

    def clear(self) -> None:
        self._store.clear()
        self._expiry.clear()

cache = CacheService(default_ttl=10)
