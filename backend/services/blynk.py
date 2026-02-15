"""
Blynk IoT Integration Service
"""
import httpx
import logging
from typing import Optional
from core.config import BLYNK_BASE_URL, BLYNK_AUTH_TOKEN

logger = logging.getLogger(__name__)

class BlynkService:
    def __init__(self):
        self.base_url = BLYNK_BASE_URL
        self.auth_token = BLYNK_AUTH_TOKEN
    
    async def get_value(self, pin: str) -> Optional[str]:
        """Get value from Blynk virtual pin"""
        if not self.auth_token:
            logger.warning("Blynk auth token not configured")
            return None
            
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                url = f"{self.base_url}/get"
                params = {"token": self.auth_token, pin: ""}
                response = await client.get(url, params=params)
                if response.status_code == 200:
                    return response.text.strip('[]"')
        except Exception as e:
            logger.error(f"Blynk get error: {e}")
        return None
    
    async def set_value(self, pin: str, value: str) -> bool:
        """Set value on Blynk virtual pin"""
        if not self.auth_token:
            logger.warning("Blynk auth token not configured")
            return False
            
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                url = f"{self.base_url}/update"
                params = {"token": self.auth_token, pin: value}
                response = await client.get(url, params=params)
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Blynk set error: {e}")
        return False
    
    async def get_load_states(self) -> dict:
        """Get all load states (Light=V0, Fan=V1, Pump=V2)"""
        light = await self.get_value("V0")
        fan = await self.get_value("V1")
        pump = await self.get_value("V2")
        
        return {
            "light_on": light == "1",
            "fan_on": fan == "1",
            "pump_on": pump == "1"
        }

# Global instance
blynk = BlynkService()
