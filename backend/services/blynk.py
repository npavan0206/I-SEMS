import aiohttp
import asyncio
import logging
from core.config import BLYNK_AUTH_TOKEN, BLYNK_BASE_URL, CACHE_TTL_SECONDS
from utils.helpers import parse_float
from services.cache import cache

logger = logging.getLogger(__name__)
BLYNK_TIMEOUT = 5

class BlynkService:
    def __init__(self):
        self.token = BLYNK_AUTH_TOKEN
        self.base_url = BLYNK_BASE_URL

    async def set_value(self, pin: str, value: str) -> bool:
        url = f"{self.base_url}/update?token={self.token}&pin={pin}&value={value}"
        try:
            timeout = aiohttp.ClientTimeout(total=BLYNK_TIMEOUT)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as resp:
                    if resp.status == 200:
                        logger.info(f"Blynk set {pin} to {value}")
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
                        return "0"
        except asyncio.TimeoutError:
            logger.error(f"Blynk get timeout for {pin}")
            return "0"
        except Exception as e:
            logger.error(f"Blynk get error: {e}")
            return "0"

    async def get_load_states(self) -> dict:
        cached = cache.get("load_states")
        if cached:
            return cached

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
        cache.set("load_states", result, ttl=CACHE_TTL_SECONDS)
        return result

    async def get_load_metrics(self) -> dict:
        cached = cache.get("load_metrics")
        if cached:
            return cached

        # Correct order: light V14-16, fan V18-20, pump V10-12
        pins = ["V14", "V15", "V16", "V18", "V19", "V20", "V10", "V11", "V12"]
        results = await asyncio.gather(
            *[self.get_pin_value(pin) for pin in pins],
            return_exceptions=True
        )

        def safe_parse(val, default=0.0):
            if isinstance(val, Exception):
                return default
            return parse_float(val)

        result = {
            "light_voltage": safe_parse(results[0]),
            "light_current": safe_parse(results[1]),
            "light_power": safe_parse(results[2]),
            "fan_voltage": safe_parse(results[3]),
            "fan_current": safe_parse(results[4]),
            "fan_power": safe_parse(results[5]),
            "pump_voltage": safe_parse(results[6]),
            "pump_current": safe_parse(results[7]),
            "pump_power": safe_parse(results[8]),
        }
        cache.set("load_metrics", result, ttl=CACHE_TTL_SECONDS)
        return result

blynk = BlynkService()
