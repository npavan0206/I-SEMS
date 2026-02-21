"""
ISEMS - Intelligent Solar Energy Management System
Main FastAPI Application
"""
import sys
from pathlib import Path

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from typing import List
import asyncio
import logging
import jwt

# Internal imports
from core.config import (
    MONGO_URL, DB_NAME, CORS_ORIGINS, JWT_SECRET, JWT_ALGORITHM, PORT,
    CACHE_TTL_SECONDS
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

# ==================== HELPER FUNCTIONS ====================

async def calculate_energy_24h() -> float:
    """Calculate actual energy produced in the last 24 hours (kWh) by integrating power over time."""
    try:
        feeds = await thingspeak.fetch_feeds(results=288)  # 24h * 12 per hour (5-min intervals)
    except Exception as e:
        logger.error(f"Failed to fetch feeds for energy calculation: {e}")
        return 0.0

    if not feeds or len(feeds) < 2:
        return 0.0

    total_energy_wh = 0.0
    for i in range(1, len(feeds)):
        prev = feeds[i-1]
        curr = feeds[i]

        # Parse timestamps (ThingSpeak returns ISO strings with 'Z')
        try:
            t_prev = datetime.fromisoformat(prev['created_at'].replace('Z', '+00:00'))
            t_curr = datetime.fromisoformat(curr['created_at'].replace('Z', '+00:00'))
        except (KeyError, ValueError) as e:
            logger.debug(f"Timestamp parsing error: {e}")
            continue

        delta_hours = (t_curr - t_prev).total_seconds() / 3600.0
        if delta_hours <= 0:
            continue

        # Average power between two points (field5 * field6)
        power_prev = parse_float(prev.get('field5')) * parse_float(prev.get('field6'))
        power_curr = parse_float(curr.get('field5')) * parse_float(curr.get('field6'))
        avg_power_w = (power_prev + power_curr) / 2.0

        # Energy in Wh = avg power (W) * delta_hours (h)
        total_energy_wh += avg_power_w * delta_hours

    return round(total_energy_wh / 1000.0, 2)  # convert to kWh

async def build_dashboard_data() -> DashboardData:
    """Build dashboard data from ThingSpeak with caching."""
    cache_key = "dashboard_data"
    cached = cache.get(cache_key)
    if cached:
        return DashboardData(**cached)

    # Fetch latest data with error handling
    try:
        feed = await thingspeak.fetch_latest()
        device_online = await thingspeak.check_online(max_age_seconds=60)
    except Exception as e:
        logger.error(f"ThingSpeak fetch failed in build_dashboard_data: {e}")
        feed = None
        device_online = False

    now = datetime.now(timezone.utc).isoformat()

    if feed:
        battery_voltage = parse_float(feed.get('field1'))
        battery_current = parse_float(feed.get('field2'))
        battery_soc = parse_float(feed.get('field3'))
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

    solar_power = solar_voltage * solar_current

    # Accurate energy calculations
    energy_24h = await calculate_energy_24h()
    # Rough 7-day estimate (could be improved with 7 days of data)
    energy_7d = round(energy_24h * 7, 2) if energy_24h > 0 else 0.0

    data = DashboardData(
        solar=SolarData(
            voltage=solar_voltage,
            current=solar_current,
            power=solar_power,
            energy_24h=energy_24h,
            energy_7d=energy_7d,
            timestamp=timestamp
        ),
        battery=BatteryData(
            voltage=battery_voltage,
            current=battery_current,
            soc=battery_soc,
            soh=98.5,
            temperature=27.5,
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

    cache.set(cache_key, data.model_dump(), ttl=CACHE_TTL_SECONDS)
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
    # created_at is already a datetime object – store natively
    await db.users.insert_one(user_dict)
    token = create_token(user.id, user.email)
    return TokenResponse(access_token=token, user=user)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc or not verify_password(credentials.password, user_doc.get('password_hash', '')):
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
    return await build_dashboard_data()

# ==================== SOLAR ROUTES ====================

@api_router.get("/solar")
async def get_solar_data(payload: dict = Depends(verify_token)):
    data = await build_dashboard_data()
    try:
        feeds = await thingspeak.fetch_feeds(results=100)
    except Exception as e:
        logger.error(f"Failed to fetch solar history: {e}")
        feeds = []

    history = []
    if feeds:
        for feed in feeds:
            solar_v = parse_float(feed.get('field5'))
            solar_i = parse_float(feed.get('field6'))
            history.append({
                "timestamp": feed.get('created_at'),
                "voltage": solar_v,
                "current": solar_i,
                "power": solar_v * solar_i
            })

    predictions = await predictor.get_predictions()  # cached internally
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
    try:
        feeds = await thingspeak.fetch_feeds(results=100)
    except Exception as e:
        logger.error(f"Failed to fetch battery history: {e}")
        feeds = []

    history = []
    if feeds:
        for feed in feeds:
            history.append({
                "timestamp": feed.get('created_at'),
                "voltage": parse_float(feed.get('field1')),
                "current": parse_float(feed.get('field2')),
                "soc": parse_float(feed.get('field3'))
            })

    predictions = await predictor.get_predictions()
    return {
        "current": data.battery.model_dump(),
        "history": history,
        "device_online": data.device_online,
        "status_text": predictions.get("battery_status", "")
    }

# ==================== LOAD ROUTES ====================

@api_router.get("/load")
async def get_load_data(payload: dict = Depends(verify_token)):
    data = await build_dashboard_data()
    try:
        feeds = await thingspeak.fetch_feeds(results=100)
    except Exception as e:
        logger.error(f"Failed to fetch load history: {e}")
        feeds = []

    history = []
    if feeds:
        for feed in feeds:
            history.append({
                "timestamp": feed.get('created_at'),
                "power": parse_float(feed.get('field7')),
                "current": parse_float(feed.get('field8'))
            })

    load_states = await blynk.get_load_states()
    load_data = data.load.model_dump()
    load_data.update(load_states)

    predictions = await predictor.get_predictions()
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
    if control.device == "pump" and control.state and data.battery.soc < 20:
        raise HTTPException(status_code=400, detail="Cannot enable pump: Battery SOC below 20%. Pump locked.")
    if control.device == "light" and control.state and data.battery.soc < 10:
        raise HTTPException(status_code=400, detail="Critical battery level: Only essential loads allowed.")
    # Correct pin mapping: light V30, fan V31, pump V32
    pin_map = {"light": "V30", "fan": "V31", "pump": "V32"}
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
        raise HTTPException(status_code=400, detail="Invalid mode")
    cache.set("grid_mode", mode, ttl=3600)
    return {"success": True, "mode": mode}

# ==================== PREDICTIONS ROUTES ====================

@api_router.get("/predictions")
async def get_ai_predictions(payload: dict = Depends(verify_token)):
    return await predictor.get_predictions()

# ==================== HISTORY ROUTES ====================

@api_router.get("/history")
async def get_historical_data(results: int = 100, payload: dict = Depends(verify_token)):
    try:
        feeds = await thingspeak.fetch_feeds(results=results)
    except Exception as e:
        logger.error(f"Failed to fetch history: {e}")
        raise HTTPException(status_code=503, detail="Historical data temporarily unavailable")

    if not feeds:
        return {"data": [], "device_online": False}

    processed = []
    for feed in feeds:
        solar_v = parse_float(feed.get('field5'))
        solar_i = parse_float(feed.get('field6'))
        processed.append({
            "timestamp": feed.get('created_at'),
            "solar_voltage": solar_v,
            "solar_current": solar_i,
            "solar_power": solar_v * solar_i,
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
    try:
        feeds = await thingspeak.fetch_feeds(results=500)
    except Exception as e:
        logger.error(f"Failed to fetch data for CSV export: {e}")
        raise HTTPException(status_code=503, detail="Data source unavailable")

    if not feeds:
        raise HTTPException(status_code=404, detail="No data available for export")

    csv_data = "timestamp,solar_voltage,solar_current,solar_power,battery_soc,battery_voltage,battery_current,load_power,load_current\n"
    for feed in feeds:
        solar_v = parse_float(feed.get('field5', '0'))
        solar_i = parse_float(feed.get('field6', '0'))
        solar_p = solar_v * solar_i
        row = f"{feed.get('created_at','')},{solar_v},{solar_i},{solar_p},{feed.get('field3','')},{feed.get('field1','')},{feed.get('field2','')},{feed.get('field7','')},{feed.get('field8','')}\n"
        csv_data += row

    filename = f"isems_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    # Optionally check ThingSpeak connectivity
    try:
        await thingspeak.check_online()
        ts_status = "ok"
    except:
        ts_status = "unreachable"
    return {
        "status": "healthy",
        "thingspeak": ts_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/")
async def root():
    return {"message": "ISEMS API v1.0", "status": "running"}

# ==================== WEBSOCKET ====================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    # Optional authentication – if token provided, verify; else allow public (adjust as needed)
    if token:
        try:
            jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.InvalidTokenError:
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
