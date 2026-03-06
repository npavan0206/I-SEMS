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
        light = await self.get_pin_value("V31")
        fan = await self.get_pin_value("V32")
        pump = await self.get_pin_value("V30")
        return {
            "light_on": light == "1",
            "fan_on": fan == "1",
            "pump_on": pump == "1"
        }

    # NEW: Get per-load parameters (voltage, current, power)
    async def get_load_params(self) -> dict:
        # Pump (V30 is state, V10=V, V11=I, V12=P)
        pump_v = await self.get_pin_value("V10")
        pump_i = await self.get_pin_value("V11")
        pump_p = await self.get_pin_value("V12")
        # Light (V31 state, V14=V, V15=I, V16=P)
        light_v = await self.get_pin_value("V14")
        light_i = await self.get_pin_value("V15")
        light_p = await self.get_pin_value("V16")
        # Fan (V32 state, V18=V, V19=I, V20=P)
        fan_v = await self.get_pin_value("V18")
        fan_i = await self.get_pin_value("V19")
        fan_p = await self.get_pin_value("V20")

        return {
            "pump": {
                "voltage": float(pump_v),
                "current": float(pump_i),
                "power": float(pump_p)
            },
            "light": {
                "voltage": float(light_v),
                "current": float(light_i),
                "power": float(light_p)
            },
            "fan": {
                "voltage": float(fan_v),
                "current": float(fan_i),
                "power": float(fan_p)
            }
        }

# Singleton instance
blynk = BlynkService()
