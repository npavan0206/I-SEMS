"""
Pydantic Models for ISEMS API
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid

# ==================== AUTH MODELS ====================

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

# ==================== DATA MODELS ====================

class SolarData(BaseModel):
    voltage: float = 0.0
    current: float = 0.0
    power: float = 0.0
    energy_24h: float = 0.0
    energy_7d: float = 0.0
    timestamp: str = ""

class BatteryData(BaseModel):
    voltage: float = 0.0
    current: float = 0.0
    soc: float = 0.0
    soh: float = 100.0
    temperature: float = 25.0
    charging: bool = False
    timestamp: str = ""

class LoadData(BaseModel):
    power: float = 0.0
    current: float = 0.0
    light_on: bool = False
    fan_on: bool = False
    pump_on: bool = False
    timestamp: str = ""

class GridData(BaseModel):
    online: bool = True
    mode: str = "hybrid"
    power: float = 0.0
    timestamp: str = ""

class DashboardData(BaseModel):
    solar: SolarData
    battery: BatteryData
    load: LoadData
    grid: GridData
    device_online: bool = True
    last_update: str = ""

class LoadControl(BaseModel):
    device: str
    state: bool

class PredictionResult(BaseModel):
    linear_regression: dict
    time_weighted: dict
    confidence: float
    timestamp: str
