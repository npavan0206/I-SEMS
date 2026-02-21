"""
AI Prediction Service
Linear Regression, EWMA, and Time-Weighted Models using live ThingSpeak data
"""
import numpy as np
from datetime import datetime, timezone
from services.thingspeak import thingspeak
from utils.helpers import parse_float
import logging

logger = logging.getLogger(__name__)

class AIPredictor:
    def __init__(self):
        self._cache = None
        self._cache_time = None

    async def get_predictions(self):
        """Return cached predictions if fresh (<30s), otherwise compute new ones."""
        if self._cache and self._cache_time:
            age = (datetime.now(timezone.utc) - self._cache_time).total_seconds()
            if age < 30:
                logger.debug("Returning cached predictions")
                return self._cache

        logger.info("Computing fresh predictions")
        result = await self._compute_predictions()
        self._cache = result
        self._cache_time = datetime.now(timezone.utc)
        return result

    async def _compute_predictions(self):
        """Generate AI predictions based on recent solar data from ThingSpeak."""
        # Fetch last 24 hours of data (288 entries if 5-min intervals)
        try:
            feeds = await thingspeak.fetch_feeds(results=288)
        except Exception as e:
            logger.error(f"Failed to fetch feeds for predictions: {e}")
            return self._fallback_predictions("ThingSpeak unavailable")

        if not feeds or len(feeds) < 30:
            logger.warning(f"Insufficient data for predictions: {len(feeds) if feeds else 0} points")
            return self._fallback_predictions("Insufficient data")

        # Extract solar power values (field5 * field6)
        solar_powers = []
        for feed in feeds:
            try:
                v = parse_float(feed.get('field5'))
                i = parse_float(feed.get('field6'))
                power = v * i
                solar_powers.append(power)
            except Exception as e:
                logger.debug(f"Skipping feed due to parsing error: {e}")
                continue

        if len(solar_powers) < 30:
            return self._fallback_predictions("Insufficient valid power data")

        # 1. Linear regression on last 30 points
        recent = solar_powers[-30:]
        x = np.arange(len(recent))
        slope, intercept = np.polyfit(x, recent, 1)
        # Predict 1 hour ahead (12 steps) and 2 hours ahead (24 steps)
        next_1h = intercept + slope * (len(recent) + 12)
        next_2h = intercept + slope * (len(recent) + 24)

        # 2. Exponential Weighted Moving Average (EWMA) with span 30
        # Manual implementation to avoid pandas dependency
        alpha = 2 / (30 + 1)  # smoothing factor for span=30
        ewma = recent[0]
        for value in recent[1:]:
            ewma = alpha * value + (1 - alpha) * ewma

        # 3. Time-weighted average (exponential weights, more recent higher)
        weights = np.exp(np.linspace(0, 2, len(solar_powers)))  # stronger recency bias
        weights /= weights.sum()
        time_weighted = np.average(solar_powers, weights=weights)

        # Confidence based on variance of recent data (inverse relationship)
        variance = np.var(recent) if len(recent) > 1 else 0
        max_power = max(solar_powers) if solar_powers else 1
        if max_power > 0:
            confidence = max(0, min(100, 100 * (1 - variance / (max_power**2 + 1))))
        else:
            confidence = 0

        # Get latest battery SOC for status message
        try:
            latest = await thingspeak.fetch_latest()
            battery_soc = parse_float(latest.get('field3')) if latest else 50.0
        except Exception as e:
            logger.error(f"Failed to fetch latest for battery SOC: {e}")
            battery_soc = 50.0

        # Determine battery status text (matches Arduino logic)
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
                "solar_power_1h": max(0, round(next_1h, 1)),
                "solar_power_2h": max(0, round(next_2h, 1)),
                "load_demand_1h": 0.0  # placeholder for future enhancement
            },
            "ewma": round(ewma, 1),
            "time_weighted": round(time_weighted, 1),
            "confidence": round(confidence, 1),
            "battery_status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    def _fallback_predictions(self, reason="Insufficient data for prediction"):
        """Return safe fallback values when prediction fails."""
        return {
            "linear_regression": {
                "solar_power_1h": 0.0,
                "solar_power_2h": 0.0,
                "load_demand_1h": 0.0
            },
            "ewma": 0.0,
            "time_weighted": 0.0,
            "confidence": 0,
            "battery_status": reason,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# Global instance
predictor = AIPredictor()
