"""
ISEMS - Intelligent Solar Energy Management System
Main FastAPI Application
"""
import sys
from pathlib import Path

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from typing import List
import asyncio
import logging
import jwt

# Internal imports
from core.config import (
    MONGO_URL, DB_NAME, CORS_ORIGINS, JWT_SECRET, JWT_ALGORITHM, PORT
)
from services.cache import cache
from services.thingspeak import thingspeak
from services.blynk import blynk
from ai.predictor import predictor
from models.schemas import (
    UserCreate, UserLogin, User, TokenResponse,
    SolarData, BatteryData, LoadData, GridData, DashboardData,
    LoadControl, PredictionResult
)
from utils.auth import hash_password, verify_password, create_token, verify_token
from utils.helpers import parse_float

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Create FastAPI app
app = FastAPI(
    title="ISEMS API",
    description="Intelligent Solar Energy Management System API",
    version="1.0.0"
)

# Create API router with /api prefix
api_router = APIRouter(prefix="/api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# ==================== DATA PROCESSING ====================

async def build_dashboard_data() -> DashboardData:
    """Build dashboard data from ThingSpeak"""
    cache_key = "dashboard_data"
    cached = cache.get(cache_key)
    if cached:
        return DashboardData(**cached)
    
    feed = await thingspeak.fetch_latest()
    device_online = feed is not None
    now = datetime.now(timezone.utc).isoformat()
    
    if feed:
        # Correct mapping based on Arduino (field1..field8)
        battery_voltage = parse_float(feed.get('field1'))
        battery_current = parse_float(feed.get('field2'))
        battery_soc = parse_float(feed.get('field3'))
        battery_soh = parse_float(feed.get('field4'))          # Optional
        solar_voltage = parse_float(feed.get('field5'))
        solar_current = parse_float(feed.get('field6'))
        load_power = parse_float(feed.get('field7'))
        load_current = parse_float(feed.get('field8'))
        timestamp = feed.get('created_at', now)
    else:
        solar_voltage = solar_current = 0.0
        battery_voltage = battery_current = 0.0
        battery_soc = 0.0
        load_power = load_current = 0.0
        timestamp = now
    
    # Calculate solar power from voltage and current
    solar_power = solar_voltage * solar_current
    
    # Calculate energy estimates (kWh)
    energy_24h = solar_power * 24 / 1000
    energy_7d = energy_24h * 7
    
    data = DashboardData(
        solar=SolarData(
            voltage=solar_voltage,
            current=solar_current,
            power=solar_power,
            energy_24h=round(energy_24h, 2),
            energy_7d=round(energy_7d, 2),
            timestamp=timestamp
        ),
        battery=BatteryData(
            voltage=battery_voltage,
            current=battery_current,
            soc=battery_soc,
            soh=98.5,                     # Could use battery_soh if desired
            temperature=27.5,              # Not from ThingSpeak (use Blynk or default)
            charging=battery_current > 0,
            timestamp=timestamp
        ),
        load=LoadData(
            power=load_power,
            current=load_current,
            light_on=False,
            fan_on=False,
            pump_on=False,
            timestamp=timestamp
        ),
        grid=GridData(
            online=True,
            mode="hybrid",
            power=max(0, load_power - solar_power),
            timestamp=timestamp
        ),
        device_online=device_online,
        last_update=now
    )
    
    cache.set(cache_key, data.model_dump())
    return data

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(email=user_data.email, name=user_data.name)
    user_dict = user.model_dump()
    user_dict['password_hash'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    token = create_token(user.id, user.email)
    return TokenResponse(access_token=token, user=user)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = User(id=user_doc['id'], email=user_doc['email'], name=user_doc['name'])
    token = create_token(user.id, user.email)
    return TokenResponse(access_token=token, user=user)

@api_router.get("/auth/me", response_model=User)
async def get_current_user(payload: dict = Depends(verify_token)):
    user_doc = await db.users.find_one({"email": payload['email']}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    return User(id=user_doc['id'], email=user_doc['email'], name=user_doc['name'])

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard", response_model=DashboardData)
async def get_dashboard(payload: dict = Depends(verify_token)):
    return await build_dashboard_data()

@api_router.get("/dashboard/public", response_model=DashboardData)
async def get_dashboard_public():
    """Public endpoint for demo purposes"""
    return await build_dashboard_data()

# ==================== SOLAR ROUTES ====================

@api_router.get("/solar")
async def get_solar_data(payload: dict = Depends(verify_token)):
    data = await build_dashboard_data()
    feeds = await thingspeak.fetch_feeds(results=100)
    
    history = []
    if feeds:
        for feed in feeds:
            # Use fields 5 (solar V), 6 (solar I), 7/8 not needed
            history.append({
                "timestamp": feed.get('created_at'),
                "voltage": parse_float(feed.get('field5')),
                "current": parse_float(feed.get('field6')),
                "power": parse_float(feed.get('field5')) * parse_float(feed.get('field6'))
            })
    
    predictions = predictor.get_predictions()
    
    return {
        "current": data.solar.model_dump(),
        "history": history,
        "predictions": predictions,
        "device_online": data.device_online
    }

# ==================== BATTERY ROUTES ====================

@api_router.get("/battery")
async def get_battery_data(payload: dict = Depends(verify_token)):
    data = await build_dashboard_data()
    feeds = await thingspeak.fetch_feeds(results=100)
    
    history = []
    if feeds:
        for feed in feeds:
            # Fields 1 (V), 2 (I), 3 (SOC)
            history.append({
                "timestamp": feed.get('created_at'),
                "voltage": parse_float(feed.get('field1')),
                "current": parse_float(feed.get('field2')),
                "soc": parse_float(feed.get('field3'))
            })
    
    return {
        "current": data.battery.model_dump(),
        "history": history,
        "device_online": data.device_online
    }

# ==================== LOAD ROUTES ====================

@api_router.get("/load")
async def get_load_data(payload: dict = Depends(verify_token)):
    data = await build_dashboard_data()
    feeds = await thingspeak.fetch_feeds(results=100)
    
    history = []
    if feeds:
        for feed in feeds:
            # Fields 7 (power) and 8 (current)
            history.append({
                "timestamp": feed.get('created_at'),
                "power": parse_float(feed.get('field7')),
                "current": parse_float(feed.get('field8'))
            })
    
    # Get load states from Blynk (uses updated pins V30/V31/V32)
    load_states = await blynk.get_load_states()
    load_data = data.load.model_dump()
    load_data.update(load_states)
    
    predictions = predictor.get_predictions()
    
    return {
        "current": load_data,
        "history": history,
        "predictions": {"load_demand_1h": predictions['linear_regression'].get('load_demand_1h', 0)},
        "device_online": data.device_online
    }

@api_router.post("/load/control")
async def control_load(control: LoadControl, payload: dict = Depends(verify_token)):
    data = await build_dashboard_data()
    
    # SOC safety checks
    if control.device == "pump" and control.state:
        if data.battery.soc < 20:
            raise HTTPException(
                status_code=400,
                detail="Cannot enable pump: Battery SOC below 20%. Pump locked for safety."
            )
    
    if control.device == "light" and control.state and data.battery.soc < 10:
        raise HTTPException(
            status_code=400,
            detail="Critical battery level: Only essential loads allowed."
        )
    
    # Correct pin mapping based on Arduino (V30 = pump, V31 = light, V32 = fan)
    pin_map = {"light": "V31", "fan": "V32", "pump": "V30"}
    pin = pin_map.get(control.device)
    
    if not pin:
        raise HTTPException(status_code=400, detail="Invalid device")
    
    success = await blynk.set_value(pin, "1" if control.state else "0")
    
    return {
        "success": success,
        "device": control.device,
        "state": control.state,
        "message": f"{'Enabled' if control.state else 'Disabled'} {control.device}"
    }

# ==================== GRID ROUTES ====================

@api_router.get("/grid")
async def get_grid_data(payload: dict = Depends(verify_token)):
    data = await build_dashboard_data()
    return {"current": data.grid.model_dump(), "device_online": data.device_online}

@api_router.post("/grid/mode")
async def set_grid_mode(mode: str, payload: dict = Depends(verify_token)):
    valid_modes = ["solar", "battery", "hybrid"]
    if mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Choose from: {valid_modes}")
    
    cache.set("grid_mode", mode, ttl=3600)
    return {"success": True, "mode": mode}

# ==================== PREDICTIONS ROUTES ====================

@api_router.get("/predictions")
async def get_ai_predictions(payload: dict = Depends(verify_token)):
    return predictor.get_predictions()

# ==================== HISTORY ROUTES ====================

@api_router.get("/history")
async def get_historical_data(results: int = 100, payload: dict = Depends(verify_token)):
    feeds = await thingspeak.fetch_feeds(results=results)
    
    if not feeds:
        return {"data": [], "device_online": False}
    
    processed = []
    for feed in feeds:
        processed.append({
            "timestamp": feed.get('created_at'),
            "solar_voltage": parse_float(feed.get('field5')),
            "solar_current": parse_float(feed.get('field6')),
            "solar_power": parse_float(feed.get('field5')) * parse_float(feed.get('field6')),
            "battery_soc": parse_float(feed.get('field3')),
            "battery_voltage": parse_float(feed.get('field1')),
            "battery_current": parse_float(feed.get('field2')),
            "load_power": parse_float(feed.get('field7')),
            "load_current": parse_float(feed.get('field8'))
        })
    
    return {"data": processed, "device_online": True}

# ==================== CSV EXPORT ====================

@api_router.get("/export/csv")
async def export_csv(payload: dict = Depends(verify_token)):
    feeds = await thingspeak.fetch_feeds(results=500)
    
    if not feeds:
        raise HTTPException(status_code=404, detail="No data available for export")
    
    csv_data = "timestamp,solar_voltage,solar_current,solar_power,battery_soc,battery_voltage,battery_current,load_power,load_current\n"
    
    for feed in feeds:
        row = f"{feed.get('created_at','')},{feed.get('field5','')},{feed.get('field6','')},{parse_float(feed.get('field5'))*parse_float(feed.get('field6'))},{feed.get('field3','')},{feed.get('field1','')},{feed.get('field2','')},{feed.get('field7','')},{feed.get('field8','')}\n"
        csv_data += row
    
    return {"csv": csv_data, "filename": f"isems_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/")
async def root():
    return {"message": "ISEMS API v1.0", "status": "running"}

# ==================== WEBSOCKET ====================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    if token:
        try:
            jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except:
            await websocket.close(code=4001)
            return
    
    await manager.connect(websocket)
    try:
        while True:
            data = await build_dashboard_data()
            await websocket.send_json(data.model_dump())
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Include router and add middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# For Railway deployment
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
