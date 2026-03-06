"""
AI Prediction Service
Linear Regression, EWMA, Time-Weighted, and Neural Network (MLP) models
with automatic retraining using historical feeds.csv data.
"""
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path
import logging
import os
import joblib
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.exceptions import NotFittedError

from services.thingspeak import thingspeak
from utils.helpers import parse_float

logger = logging.getLogger(__name__)

class AIPredictor:
    def __init__(self, csv_path: str = None, model_path: str = None):
        self.csv_path = csv_path or Path(__file__).parent.parent / "feeds.csv"
        self.model_path = model_path or Path(__file__).parent.parent / "mlp_model.joblib"
        self.scaler_path = Path(__file__).parent.parent / "scaler.joblib"
        self._cache = None
        self._cache_time = None
        self.mlp_model = None
        self.scaler = None
        self.last_training_time = None
        self._load_or_train_model()

    def _load_or_train_model(self):
        """Load existing model if available, otherwise train from CSV."""
        if self.model_path.exists() and self.scaler_path.exists():
            try:
                self.mlp_model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.last_training_time = datetime.fromtimestamp(os.path.getmtime(self.model_path))
                logger.info(f"Loaded MLP model trained on {self.last_training_time}")
                return
            except Exception as e:
                logger.warning(f"Failed to load model, will retrain: {e}")
        self._train_model()

    def _train_model(self):
        """Train MLP model using historical feeds.csv."""
        if not Path(self.csv_path).exists():
            logger.warning(f"CSV file {self.csv_path} not found, skipping MLP training")
            return

        try:
            df = pd.read_csv(self.csv_path)
            if df.empty:
                logger.warning("CSV file is empty, skipping MLP training")
                return

            # Parse timestamps and sort
            df['created_at'] = pd.to_datetime(df['created_at'])
            df = df.sort_values('created_at').reset_index(drop=True)

            # Calculate solar power (field5 * field6)
            df['solar_power'] = df['field5'] * df['field6']
            df = df.dropna(subset=['solar_power', 'field5', 'field6'])

            if len(df) < 50:
                logger.warning(f"Not enough data for MLP training ({len(df)} rows), need at least 50")
                return

            # Create target: solar power 1 hour later (12 steps ahead, assuming 5-min intervals)
            df['target_1h'] = df['solar_power'].shift(-12)
            df = df.dropna(subset=['target_1h']).copy()

            # Feature engineering
            df['hour'] = df['created_at'].dt.hour
            df['dayofweek'] = df['created_at'].dt.dayofweek
            # Rolling mean of last 6 readings (30 min) – use bfill() instead of fillna(method='bfill')
            df['rolling_power'] = df['solar_power'].rolling(window=6, min_periods=1).mean().bfill()
            features = df[['hour', 'dayofweek', 'field5', 'field6', 'rolling_power']].values
            targets = df['target_1h'].values

            # Scale features
            scaler = StandardScaler()
            features_scaled = scaler.fit_transform(features)

            # Train MLP
            mlp = MLPRegressor(
                hidden_layer_sizes=(64, 32),
                activation='relu',
                solver='adam',
                max_iter=500,
                random_state=42,
                early_stopping=True,
                validation_fraction=0.1
            )
            mlp.fit(features_scaled, targets)

            # Save model and scaler
            joblib.dump(mlp, self.model_path)
            joblib.dump(scaler, self.scaler_path)
            self.mlp_model = mlp
            self.scaler = scaler
            self.last_training_time = datetime.now()
            logger.info(f"MLP model trained on {len(df)} samples, saved to {self.model_path}")

        except Exception as e:
            logger.error(f"MLP training failed: {e}")

    def _should_retrain(self):
        """Check if retraining is needed (CSV updated or last training > 24h)."""
        if not self.last_training_time:
            return True
        # Check if CSV file modified since last training
        if Path(self.csv_path).exists():
            mtime = datetime.fromtimestamp(os.path.getmtime(self.csv_path))
            if mtime > self.last_training_time:
                logger.info("CSV file updated, retraining needed")
                return True
        # Also retrain if last training was more than 24 hours ago
        age = (datetime.now() - self.last_training_time).total_seconds()
        if age > 86400:  # 24 hours
            logger.info("Model older than 24h, retraining")
            return True
        return False

    async def get_predictions(self):
        """Return cached predictions if fresh (<30s), otherwise compute new ones."""
        if self._cache and self._cache_time:
            age = (datetime.now(timezone.utc) - self._cache_time).total_seconds()
            if age < 30:
                logger.debug("Returning cached predictions")
                return self._cache

        # Check if retraining is needed
        if self._should_retrain():
            self._train_model()

        logger.info("Computing fresh predictions")
        result = await self._compute_predictions()
        self._cache = result
        self._cache_time = datetime.now(timezone.utc)
        return result

    async def _compute_predictions(self):
        """Generate AI predictions using MLP (if available) and fallback methods."""
        # Fetch recent data
        try:
            feeds = await thingspeak.fetch_feeds(results=288)
        except Exception as e:
            logger.error(f"Failed to fetch feeds for predictions: {e}")
            return self._fallback_predictions("ThingSpeak unavailable")

        if not feeds or len(feeds) < 30:
            logger.warning(f"Insufficient data for predictions: {len(feeds) if feeds else 0} points")
            return self._fallback_predictions("Insufficient data")

        # Extract solar power values for traditional methods
        solar_powers = []
        for feed in feeds:
            try:
                v = parse_float(feed.get('field5'))
                i = parse_float(feed.get('field6'))
                power = v * i
                solar_powers.append(power)
            except Exception:
                continue

        if len(solar_powers) < 30:
            return self._fallback_predictions("Insufficient valid power data")

        # 1. Linear regression on last 30 points
        recent = solar_powers[-30:]
        x = np.arange(len(recent))
        slope, intercept = np.polyfit(x, recent, 1)
        lr_1h = intercept + slope * (len(recent) + 12)
        lr_2h = intercept + slope * (len(recent) + 24)

        # 2. Exponential Weighted Moving Average
        alpha = 2 / (30 + 1)
        ewma = recent[0]
        for value in recent[1:]:
            ewma = alpha * value + (1 - alpha) * ewma

        # 3. Time-weighted average
        weights = np.exp(np.linspace(0, 2, len(solar_powers)))
        weights /= weights.sum()
        time_weighted = np.average(solar_powers, weights=weights)

        # 4. MLP prediction using latest feed
        mlp_1h = None
        if self.mlp_model and self.scaler:
            try:
                latest = feeds[0]  # most recent
                hour = datetime.now().hour
                day = datetime.now().weekday()
                v = parse_float(latest.get('field5'))
                i = parse_float(latest.get('field6'))
                rolling = np.mean(solar_powers[-6:]) if len(solar_powers) >= 6 else solar_powers[-1]
                features = np.array([[hour, day, v, i, rolling]])
                features_scaled = self.scaler.transform(features)
                mlp_1h = self.mlp_model.predict(features_scaled)[0]
                mlp_1h = max(0, float(mlp_1h))
            except Exception as e:
                logger.error(f"MLP prediction failed: {e}")
                mlp_1h = None

        # Confidence based on variance
        variance = np.var(recent) if len(recent) > 1 else 0
        max_power = max(solar_powers) if solar_powers else 1
        confidence = max(0, min(100, 100 * (1 - variance / (max_power**2 + 1)))) if max_power > 0 else 0

        # Battery status
        try:
            latest = await thingspeak.fetch_latest()
            battery_soc = parse_float(latest.get('field3')) if latest else 50.0
        except Exception:
            battery_soc = 50.0

        if battery_soc <= 10:
            status = "Battery CRITICAL - All Loads OFF"
        elif battery_soc <= 20:
            status = "Battery LOW - Only Pump Allowed"
        elif battery_soc <= 50:
            status = "Battery MEDIUM - Fan & Light Allowed"
        else:
            status = "Battery GOOD - All Loads Allowed"

        # Use MLP if available, otherwise fallback to LR
        solar_1h = round(mlp_1h, 1) if mlp_1h is not None else max(0, round(lr_1h, 1))
        solar_2h = max(0, round(lr_2h, 1))  # MLP only does 1h for now

        return {
            "linear_regression": {
                "solar_power_1h": solar_1h,
                "solar_power_2h": solar_2h,
                "load_demand_1h": 0.0
            },
            "ewma": round(ewma, 1),
            "time_weighted": round(time_weighted, 1),
            "mlp_1h": round(mlp_1h, 1) if mlp_1h is not None else None,
            "confidence": round(confidence, 1),
            "battery_status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    def _fallback_predictions(self, reason="Insufficient data for prediction"):
        return {
            "linear_regression": {
                "solar_power_1h": 0.0,
                "solar_power_2h": 0.0,
                "load_demand_1h": 0.0
            },
            "ewma": 0.0,
            "time_weighted": 0.0,
            "mlp_1h": None,
            "confidence": 0,
            "battery_status": reason,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# Global instance
predictor = AIPredictor()
