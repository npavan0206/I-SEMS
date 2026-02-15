"""
AI Prediction Service
Linear Regression and Time-Weighted Models
"""
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict
import logging

logger = logging.getLogger(__name__)

class AIPredictor:
    def __init__(self, csv_path: str = None):
        self.csv_path = csv_path or Path(__file__).parent.parent / "feeds.csv"
        self._df = None
        self._load_data()
    
    def _load_data(self) -> None:
        """Load and preprocess historical data"""
        try:
            if Path(self.csv_path).exists():
                self._df = pd.read_csv(self.csv_path)
                self._df['created_at'] = pd.to_datetime(self._df['created_at'])
                self._df['hour'] = self._df['created_at'].dt.hour
                self._df['day_of_week'] = self._df['created_at'].dt.dayofweek
                
                # Rename fields for clarity
                self._df = self._df.rename(columns={
                    'field1': 'solar_voltage',
                    'field2': 'solar_current',
                    'field3': 'solar_power',
                    'field4': 'battery_soc',
                    'field5': 'battery_voltage',
                    'field6': 'battery_current',
                    'field7': 'load_power',
                    'field8': 'load_current'
                })
                logger.info(f"Loaded {len(self._df)} records for AI predictions")
            else:
                logger.warning(f"CSV file not found: {self.csv_path}")
                self._df = pd.DataFrame()
        except Exception as e:
            logger.error(f"Failed to load CSV: {e}")
            self._df = pd.DataFrame()
    
    def linear_regression_predict(self, target_col: str, hours_ahead: int = 1) -> float:
        """Predict using Linear Regression"""
        if self._df.empty or target_col not in self._df.columns:
            return 0.0
        
        df_clean = self._df.dropna(subset=[target_col])
        if len(df_clean) < 10:
            return float(self._df[target_col].mean()) if target_col in self._df.columns else 0.0
        
        X = np.arange(len(df_clean)).reshape(-1, 1)
        y = df_clean[target_col].values
        
        model = LinearRegression()
        model.fit(X, y)
        
        # Predict future value (~6 readings per hour)
        future_x = np.array([[len(df_clean) + hours_ahead * 6]])
        prediction = model.predict(future_x)[0]
        
        return max(0, float(prediction))
    
    def time_weighted_predict(self, target_col: str, hours_ahead: int = 1) -> float:
        """Predict using time-of-day weighted average"""
        if self._df.empty or target_col not in self._df.columns:
            return 0.0
        
        current_hour = (datetime.now().hour + hours_ahead) % 24
        
        # Filter data for similar hours
        hour_data = self._df[self._df['hour'] == current_hour]
        
        if len(hour_data) < 3:
            hour_data = self._df[
                (self._df['hour'] >= current_hour - 1) & 
                (self._df['hour'] <= current_hour + 1)
            ]
        
        if len(hour_data) > 0 and target_col in hour_data.columns:
            values = hour_data[target_col].dropna().values
            if len(values) > 0:
                weights = np.linspace(0.5, 1.0, len(values))
                weighted_avg = np.average(values, weights=weights[-len(values):])
                return max(0, float(weighted_avg))
        
        return float(self._df[target_col].mean()) if target_col in self._df.columns else 0.0
    
    def get_predictions(self) -> Dict:
        """Get all predictions"""
        linear_results = {
            "solar_power_1h": self.linear_regression_predict('solar_power', 1),
            "solar_power_2h": self.linear_regression_predict('solar_power', 2),
            "solar_voltage_1h": self.linear_regression_predict('solar_voltage', 1),
            "load_demand_1h": self.linear_regression_predict('load_power', 1),
        }
        
        time_results = {
            "solar_power_1h": self.time_weighted_predict('solar_power', 1),
            "solar_power_2h": self.time_weighted_predict('solar_power', 2),
            "solar_voltage_1h": self.time_weighted_predict('solar_voltage', 1),
            "load_demand_1h": self.time_weighted_predict('load_power', 1),
        }
        
        # Calculate confidence based on data quality
        confidence = min(1.0, len(self._df) / 1000) if not self._df.empty else 0.5
        
        return {
            "linear_regression": linear_results,
            "time_weighted": time_results,
            "confidence": confidence,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# Global instance
predictor = AIPredictor()
