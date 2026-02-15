"""
ISEMS Configuration Module
All environment variables and constants
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# Database Configuration
MONGO_URL = os.environ.get('MONGO_URL', "mongodb+srv://isems_user:isems123@isems.dwmngwp.mongodb.net/?appName=isems")
DB_NAME = os.environ.get('DB_NAME', "solar_db")

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "j5OtWovOPNqw9VNvj7BPYJ50xnpf0e3e_vu0EhkeVlw")
JWT_SECRET = JWT_SECRET_KEY  # for compatibility with imports expecting JWT_SECRET
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# CORS Configuration
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', "https://your-site.netlify.app").split(',')

# ThingSpeak Configuration
THINGSPEAK_CHANNEL_ID = os.environ.get('THINGSPEAK_CHANNEL_ID', '3242868')
THINGSPEAK_READ_KEY = os.environ.get('THINGSPEAK_READ_KEY', '8EV96WGL0PI2I1II')
THINGSPEAK_BASE_URL = "https://api.thingspeak.com"

# Blynk Configuration
BLYNK_AUTH_TOKEN = os.environ.get('BLYNK_AUTH_TOKEN', 'yRiXDwdvT4p1j-d-M4tIe4rpEBbNV5ue')
BLYNK_BASE_URL = os.environ.get('BLYNK_BASE_URL', 'https://blynk.cloud/external/api')

# Cache Configuration
CACHE_TTL_SECONDS = 10

# Server Configuration
PORT = int(os.environ.get('PORT', 8001))
