# services/blynk.py
import aiohttp
import logging
from core.config import BLYNK_AUTH_TOKEN, BLYNK_BASE_URL
from utils.helpers import parse_float

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
                        # Blynk returns an array with the current value(s)
                        return str(data[0]) if data else "0"
                    else:
                        logger.error(f"Blynk get failed for {pin}: {resp.status}")
                        return "0"
        except Exception as e:
            logger.error(f"Blynk get error: {e}")
            return "0"

    async def get_load_states(self) -> dict:
        """Retrieve current states of all loads from Blynk."""
        # Using correct pins: V30 = pump, V31 = light, V32 = fan
        light = await self.get_pin_value("V31")
        fan = await self.get_pin_value("V32")
        pump = await self.get_pin_value("V30")
        return {
            "light_on": light == "1",
            "fan_on": fan == "1",
            "pump_on": pump == "1"
        }

    async def get_load_metrics(self) -> dict:
        """
        Retrieve per‑load voltage, current, and power from Blynk.
        Pin mapping (adjust these to match your actual Blynk project):
          - Light:  voltage V33, current V34, power V35
          - Fan:    voltage V36, current V37, power V38
          - Pump:   voltage V39, current V40, power V41
        """
        # Light metrics
        light_voltage = parse_float(await self.get_pin_value("V33"))
        light_current = parse_float(await self.get_pin_value("V34"))
        light_power   = parse_float(await self.get_pin_value("V35"))

        # Fan metrics
        fan_voltage   = parse_float(await self.get_pin_value("V36"))
        fan_current   = parse_float(await self.get_pin_value("V37"))
        fan_power     = parse_float(await self.get_pin_value("V38"))

        # Pump metrics
        pump_voltage  = parse_float(await self.get_pin_value("V39"))
        pump_current  = parse_float(await self.get_pin_value("V40"))
        pump_power    = parse_float(await self.get_pin_value("V41"))

        return {
            "light_voltage": light_voltage,
            "light_current": light_current,
            "light_power": light_power,
            "fan_voltage": fan_voltage,
            "fan_current": fan_current,
            "fan_power": fan_power,
            "pump_voltage": pump_voltage,
            "pump_current": pump_current,
            "pump_power": pump_power,
        }

# Singleton instance
blynk = BlynkService()
