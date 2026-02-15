# ISEMS Deployment Guide
## Intelligent Solar Energy Management System

### Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Netlify      │────▶│    Railway      │────▶│  MongoDB Atlas  │
│   (Frontend)    │     │   (Backend)     │     │   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       ├───▶ ThingSpeak API
        │                       ├───▶ Blynk Cloud API
        └───────────────────────┴───▶ WebSocket Connection
```

---

## Step 1: MongoDB Atlas Setup

1. Go to https://cloud.mongodb.com
2. Create a free M0 cluster
3. Create database user:
   - Username: `isems_user`
   - Password: `<strong-password>`
4. Network Access: Add `0.0.0.0/0` to allow all IPs
5. Get connection string:
   ```
   mongodb+srv://isems_user:<password>@cluster0.xxxxx.mongodb.net/solar_db
   ```

---

## Step 2: Railway Backend Deployment

### 2.1 Prepare Repository
```bash
# Your backend folder should contain:
backend/
├── main.py           # Entry point
├── server.py         # Re-exports app
├── requirements.txt
├── feeds.csv         # AI training data
├── core/
│   ├── __init__.py
│   └── config.py
├── services/
│   ├── __init__.py
│   ├── cache.py
│   ├── thingspeak.py
│   └── blynk.py
├── ai/
│   ├── __init__.py
│   └── predictor.py
├── models/
│   ├── __init__.py
│   └── schemas.py
└── utils/
    ├── __init__.py
    ├── auth.py
    └── helpers.py
```

### 2.2 Railway Configuration

1. Go to https://railway.app
2. Create new project from GitHub repo
3. Select the `backend` directory as root
4. Set **Start Command**:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

### 2.3 Environment Variables (Railway Dashboard)
```env
MONGO_URL=mongodb+srv://isems_user:<password>@cluster0.xxxxx.mongodb.net/solar_db
DB_NAME=solar_db
JWT_SECRET_KEY=<generate-a-strong-random-secret-min-32-chars>
CORS_ORIGINS=https://your-site.netlify.app
THINGSPEAK_CHANNEL_ID=3242868
THINGSPEAK_READ_KEY=8EV96WGL0PI2I1II
BLYNK_AUTH_TOKEN=yRiXDwdvT4p1j-d-M4tIe4rpEBbNV5ue
BLYNK_BASE_URL=https://blynk.cloud/external/api
```

### 2.4 Generate JWT Secret
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2.5 Health Check
Set health check path: `/api/health`

---

## Step 3: Netlify Frontend Deployment

### 3.1 Prepare Repository
Ensure `netlify.toml` is in root:
```toml
[build]
  base = "frontend"
  publish = "build"
  command = "yarn build"

[build.environment]
  CI = "false"
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 3.2 Netlify Configuration

1. Go to https://app.netlify.com
2. Import from Git
3. Build settings are auto-detected from `netlify.toml`

### 3.3 Environment Variables (Netlify Dashboard)
```env
REACT_APP_BACKEND_URL=https://your-railway-app.up.railway.app
REACT_APP_WS_URL=wss://your-railway-app.up.railway.app/ws
CI=false
```

---

## Step 4: Update CORS After Deployment

Once you have your Netlify URL, update Railway's `CORS_ORIGINS`:
```env
CORS_ORIGINS=https://your-actual-site.netlify.app
```

---

## API Endpoints Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Health check |
| `/api/auth/register` | POST | No | User registration |
| `/api/auth/login` | POST | No | User login |
| `/api/auth/me` | GET | Yes | Get current user |
| `/api/dashboard` | GET | Yes | Dashboard data |
| `/api/dashboard/public` | GET | No | Public dashboard |
| `/api/solar` | GET | Yes | Solar data + history |
| `/api/battery` | GET | Yes | Battery data + history |
| `/api/load` | GET | Yes | Load data + history |
| `/api/load/control` | POST | Yes | Control loads |
| `/api/grid` | GET | Yes | Grid status |
| `/api/grid/mode` | POST | Yes | Set grid mode |
| `/api/predictions` | GET | Yes | AI predictions |
| `/api/history` | GET | Yes | Historical data |
| `/api/export/csv` | GET | Yes | Export CSV |
| `/ws` | WS | Optional | Real-time updates |

---

## Troubleshooting

### Backend Issues
1. Check Railway logs for errors
2. Verify MongoDB connection string
3. Ensure all environment variables are set
4. Test health endpoint: `curl https://your-app.up.railway.app/api/health`

### Frontend Issues
1. Check Netlify build logs
2. Verify environment variables are set before build
3. Check browser console for API errors
4. Ensure CORS is configured correctly

### WebSocket Issues
1. Ensure `REACT_APP_WS_URL` uses `wss://` (not `ws://`)
2. Check Railway logs for WebSocket connection attempts
3. Verify JWT token is being sent correctly

---

## Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Edit with local values
uvicorn main:app --reload --port 8001
```

### Frontend
```bash
cd frontend
yarn install
# Create .env.local
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env.local
echo "REACT_APP_WS_URL=ws://localhost:8001/ws" >> .env.local
yarn start
```

---

## Security Notes

1. **Never commit `.env` files** - Use `.gitignore`
2. **Rotate JWT_SECRET_KEY** regularly in production
3. **Use strong passwords** for MongoDB
4. **Restrict CORS** to your specific Netlify domain
5. **Enable HTTPS** (automatic on Railway and Netlify)
