"""
ThingSpeak Integration Service
"""
import httpx
import logging
from typing import Optional, List, Dict
from datetime import datetime, timezone
from services.cache import cache
from core.config import THINGSPEAK_BASE_URL, THINGSPEAK_CHANNEL_ID, THINGSPEAK_READ_KEY

logger = logging.getLogger(__name__)

class ThingSpeakService:
    def __init__(self):
        self.base_url = THINGSPEAK_BASE_URL
        self.channel_id = THINGSPEAK_CHANNEL_ID
        self.api_key = THINGSPEAK_READ_KEY

    async def fetch_feeds(self, results: int = 10) -> Optional[List[Dict]]:
        """Fetch feeds from ThingSpeak with caching.
        Returns feeds in reverse chronological order (most recent first)."""
        cache_key = f"thingspeak_{results}"
        cached = cache.get(cache_key)
        if cached:
            logger.debug(f"Returning cached ThingSpeak feeds (key={cache_key})")
            return cached

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                url = f"{self.base_url}/channels/{self.channel_id}/feeds.json"
                params = {"api_key": self.api_key, "results": results}
                response = await client.get(url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    feeds = data.get("feeds", [])
                    cache.set(cache_key, feeds, ttl=10)
                    logger.info(f"Fetched {len(feeds)} feeds from ThingSpeak")
                    return feeds
                else:
                    logger.error(f"ThingSpeak fetch_feeds failed: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"ThingSpeak fetch_feeds error: {e}")
            return None

    async def fetch_latest(self) -> Optional[Dict]:
        """Fetch the single most recent feed entry."""
        feeds = await self.fetch_feeds(results=1)
        if feeds and len(feeds) > 0:
            return feeds[0]  # newest first
        return None

    async def check_online(self, max_age_seconds: int = 60) -> bool:
        """Check if the device is online by verifying a recent feed.
        Returns True if the latest feed is newer than max_age_seconds (default 60s)."""
        latest = await self.fetch_latest()
        if not latest:
            return False
        created = latest.get("created_at")
        if not created:
            return False
        try:
            last_time = datetime.fromisoformat(created.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            delta = (now - last_time).total_seconds()
            logger.debug(f"Latest feed timestamp: {created}, delta: {delta}s")
            return delta <= max_age_seconds
        except Exception as e:
            logger.error(f"Error parsing timestamp: {e}")
            return False

# Global instance
thingspeak = ThingSpeakService()
