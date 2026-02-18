"""
AI Prediction Service
Linear Regression and Time-Weighted Models using live ThingSpeak data
"""
import numpy as np
from datetime import datetime, timezone
from services.thingspeak import thingspeak
from utils.helpers import parse_float
import logging

logger = logging.getLogger(__name__)

class AIPredictor:
    async def get_predictions(self):
        """Generate AI predictions based on recent solar data from ThingSpeak"""
        # Fetch last 24 hours of data (288 entries if 5-min intervals)
        feeds = await thingspeak.fetch_feeds(results=288)
        if not feeds or len(feeds) < 10:
            return self._fallback_predictions()

        # Extract solar power values (field5 * field6)
        solar_powers = []
        for feed in feeds:
            try:
                v = parse_float(feed.get('field5'))
                i = parse_float(feed.get('field6'))
                power = v * i
                solar_powers.append(power)
            except:
                continue

        if len(solar_powers) < 10:
            return self._fallback_predictions()

        # Simple linear regression on last 10 points
        recent = solar_powers[-10:]
        x = np.arange(len(recent))
        slope, intercept = np.polyfit(x, recent, 1)
        # Predict 1 hour ahead (assuming 5‑min intervals → 12 steps)
        next_hour = intercept + slope * (len(recent) + 12)
        # Predict 2 hours ahead (24 steps)
        next_2_hour = intercept + slope * (len(recent) + 24)

        # Time-weighted average (more recent = higher weight)
        weights = np.exp(np.linspace(0, 1, len(solar_powers)))
        weights /= weights.sum()
        time_weighted = np.average(solar_powers, weights=weights)

        # Get latest battery SOC for status message
        latest = await thingspeak.fetch_latest()
        battery_soc = parse_float(latest.get('field3')) if latest else 50.0

        # Determine battery status text (matches your Arduino logic)
        if battery_soc <= 10:
            status = "Battery CRITICAL - All Loads OFF"
        elif battery_soc <= 20:
            status = "Battery LOW - Only Pump Allowed"
        elif battery_soc <= 50:
            status = "Battery MEDIUM - Fan & Light Allowed"
        else:
            status = "Battery GOOD - All Loads Allowed"

        return {
            "linear_regression": {
                "solar_power_1h": max(0, round(next_hour, 1)),
                "solar_power_2h": max(0, round(next_2_hour, 1)),
                "load_demand_1h": 0.0  # placeholder
            },
            "time_weighted": round(time_weighted, 1),
            "confidence": 0,  # removed from UI
            "battery_status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    def _fallback_predictions(self):
        return {
            "linear_regression": {
                "solar_power_1h": 0.0,
                "solar_power_2h": 0.0,
                "load_demand_1h": 0.0
            },
            "time_weighted": 0.0,
            "confidence": 0,
            "battery_status": "Insufficient data for prediction",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# Global instance
predictor = AIPredictor()
