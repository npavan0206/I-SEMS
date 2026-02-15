"""
ThingSpeak Integration Service
"""
import httpx
import logging
from typing import Optional, List, Dict
from services.cache import cache
from core.config import THINGSPEAK_BASE_URL, THINGSPEAK_CHANNEL_ID, THINGSPEAK_READ_KEY

logger = logging.getLogger(__name__)

class ThingSpeakService:
    def __init__(self):
        self.base_url = THINGSPEAK_BASE_URL
        self.channel_id = THINGSPEAK_CHANNEL_ID
        self.api_key = THINGSPEAK_READ_KEY
    
    async def fetch_feeds(self, results: int = 10) -> Optional[List[Dict]]:
        """Fetch feeds from ThingSpeak with caching"""
        cache_key = f"thingspeak_{results}"
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                url = f"{self.base_url}/channels/{self.channel_id}/feeds.json"
                params = {"api_key": self.api_key, "results": results}
                response = await client.get(url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    feeds = data.get("feeds", [])
                    cache.set(cache_key, feeds)
                    return feeds
        except Exception as e:
            logger.error(f"ThingSpeak fetch error: {e}")
        return None
    
    async def fetch_latest(self) -> Optional[Dict]:
        """Fetch latest feed entry"""
        feeds = await self.fetch_feeds(results=1)
        if feeds and len(feeds) > 0:
            return feeds[-1]
        return None

# Global instance
thingspeak = ThingSpeakService()
