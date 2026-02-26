# services/blynk.py
import aiohttp
import asyncio
import logging
from core.config import BLYNK_AUTH_TOKEN, BLYNK_BASE_URL, CACHE_TTL_SECONDS
from utils.helpers import parse_float
from services.cache import cache

logger = logging.getLogger(__name__)

# Timeout for each Blynk API call (seconds)
BLYNK_TIMEOUT = 5

class BlynkService:
    def __init__(self):
        self.token = BLYNK_AUTH_TOKEN
        self.base_url = BLYNK_BASE_URL

    async def set_value(self, pin: str, value: str) -> bool:
        """Set a virtual pin value via Blynk HTTP API."""
        url = f"{self.base_url}/update?token={self.token}&pin={pin}&value={value}"
        try:
            timeout = aiohttp.ClientTimeout(total=BLYNK_TIMEOUT)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as resp:
                    if resp.status == 200:
                        logger.info(f"Blynk set {pin} to {value}")
                        # Invalidate cache for states/metrics since they changed
                        cache.delete("load_states")
                        cache.delete("load_metrics")
                        return True
                    else:
                        text = await resp.text()
                        logger.error(f"Blynk set failed for {pin}: {resp.status} - {text}")
                        return False
        except asyncio.TimeoutError:
            logger.error(f"Blynk set timeout for {pin}")
            return False
        except Exception as e:
            logger.error(f"Blynk set error: {e}")
            return False

    async def get_pin_value(self, pin: str) -> str:
        """Read a virtual pin value via Blynk HTTP API."""
        url = f"{self.base_url}/get?token={self.token}&pin={pin}"
        try:
            timeout = aiohttp.ClientTimeout(total=BLYNK_TIMEOUT)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return str(data[0]) if data else "0"
                    else:
                        text = await resp.text()
                        logger.error(f"Blynk get failed for {pin}: {resp.status} - {text}")
                        # If rate limit error, cache a special marker to avoid repeated failures?
                        return "0"
        except asyncio.TimeoutError:
            logger.error(f"Blynk get timeout for {pin}")
            return "0"
        except Exception as e:
            logger.error(f"Blynk get error: {e}")
            return "0"

    async def get_load_states(self) -> dict:
        """Retrieve current states of all loads from Blynk, with caching."""
        cached = cache.get("load_states")
        if cached:
            return cached

        # Fetch concurrently
        light, fan, pump = await asyncio.gather(
            self.get_pin_value("V30"),
            self.get_pin_value("V31"),
            self.get_pin_value("V32"),
            return_exceptions=True
        )

        result = {
            "light_on": light == "1" if not isinstance(light, Exception) else False,
            "fan_on": fan == "1" if not isinstance(fan, Exception) else False,
            "pump_on": pump == "1" if not isinstance(pump, Exception) else False,
        }
        # Cache for 30 seconds (or your configured CACHE_TTL_SECONDS)
        cache.set("load_states", result, ttl=CACHE_TTL_SECONDS)
        return result

    async def get_load_metrics(self) -> dict:
        """Retrieve per‑load metrics from Blynk, with caching."""
        cached = cache.get("load_metrics")
        if cached:
            return cached

        pins = ["V10", "V11", "V12", "V14", "V15", "V16", "V18", "V19", "V20"]
        results = await asyncio.gather(
            *[self.get_pin_value(pin) for pin in pins],
            return_exceptions=True
        )

        def safe_parse(val, default=0.0):
            if isinstance(val, Exception):
                return default
            return parse_float(val)

        result = {
            "pump_voltage": safe_parse(results[0]),
            "pump_current": safe_parse(results[1]),
            "pump_power": safe_parse(results[2]),
            "light_voltage": safe_parse(results[3]),
            "light_current": safe_parse(results[4]),
            "light_power": safe_parse(results[5]),
            "fan_voltage": safe_parse(results[6]),
            "fan_current": safe_parse(results[7]),
            "fan_power": safe_parse(results[8]),
        }
        cache.set("load_metrics", result, ttl=CACHE_TTL_SECONDS)
        return result

# Singleton instance
blynk = BlynkService()
