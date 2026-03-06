# services/blynk.py
import aiohttp
import logging
from core.config import BLYNK_AUTH_TOKEN, BLYNK_BASE_URL

logger = logging.getLogger(__name__)

class BlynkService:
    def __init__(self):
        self.token = BLYNK_AUTH_TOKEN
        self.base_url = BLYNK_BASE_URL

    async def set_value(self, pin: str, value: str) -> bool:
        """Set a virtual pin value via Blynk HTTP API."""
        url = f"{self.base_url}/update?token={self.token}&pin={pin}&value={value}"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as resp:
                    if resp.status == 200:
                        logger.info(f"Blynk set {pin} to {value}")
                        return True
                    else:
                        logger.error(f"Blynk set failed for {pin}: {resp.status}")
                        return False
        except Exception as e:
            logger.error(f"Blynk set error: {e}")
            return False

    async def get_pin_value(self, pin: str) -> str:
        """Read a virtual pin value via Blynk HTTP API."""
        url = f"{self.base_url}/get?token={self.token}&pin={pin}"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return str(data[0]) if data else "0"
                    else:
                        logger.error(f"Blynk get failed for {pin}: {resp.status}")
                        return "0"
        except Exception as e:
            logger.error(f"Blynk get error: {e}")
            return "0"

    async def get_load_states(self) -> dict:
        """Retrieve current on/off states of all loads from Blynk."""
        light = await self.get_pin_value("V31")
        fan = await self.get_pin_value("V32")
        pump = await self.get_pin_value("V30")
        return {
            "light_on": light == "1",
            "fan_on": fan == "1",
            "pump_on": pump == "1"
        }

    async def get_load_metrics(self) -> dict:
        """Retrieve per‑load voltage, current, and power from Blynk."""
        def safe_float(val):
            try:
                return float(val) if val else 0.0
            except (ValueError, TypeError):
                return 0.0

        # Pump: V10 = voltage, V11 = current, V12 = power
        pump_v = safe_float(await self.get_pin_value("V10"))
        pump_i = safe_float(await self.get_pin_value("V11"))
        pump_p = safe_float(await self.get_pin_value("V12"))
        # Light: V14 = voltage, V15 = current, V16 = power
        light_v = safe_float(await self.get_pin_value("V14"))
        light_i = safe_float(await self.get_pin_value("V15"))
        light_p = safe_float(await self.get_pin_value("V16"))
        # Fan: V18 = voltage, V19 = current, V20 = power
        fan_v = safe_float(await self.get_pin_value("V18"))
        fan_i = safe_float(await self.get_pin_value("V19"))
        fan_p = safe_float(await self.get_pin_value("V20"))

        return {
            "light": {"voltage": light_v, "current": light_i, "power": light_p},
            "fan": {"voltage": fan_v, "current": fan_i, "power": fan_p},
            "pump": {"voltage": pump_v, "current": pump_i, "power": pump_p}
        }

# Singleton instance
blynk = BlynkService()
