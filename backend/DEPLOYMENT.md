# ISEMS Backend - Railway Deployment

## Railway Configuration

### Environment Variables (Set in Railway Dashboard)
```
MONGO_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/solar_db
DB_NAME=solar_db
JWT_SECRET_KEY=<your-secure-random-secret>
CORS_ORIGINS=https://your-netlify-site.netlify.app
THINGSPEAK_CHANNEL_ID=3242868
THINGSPEAK_READ_KEY=8EV96WGL0PI2I1II
BLYNK_AUTH_TOKEN=yRiXDwdvT4p1j-d-M4tIe4rpEBbNV5ue
BLYNK_BASE_URL=https://blynk.cloud/external/api
```

### Start Command (Railway Settings)
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Health Check Path
```
/api/health
```

## MongoDB Atlas Setup
1. Create free cluster at https://cloud.mongodb.com
2. Create database user with read/write access
3. Whitelist all IPs (0.0.0.0/0) or Railway's IP ranges
4. Get connection string and update MONGO_URL

## Files Required for Deployment
- main.py (entry point)
- requirements.txt
- .env (local only, use Railway env vars for production)
- feeds.csv (for AI predictions)
- core/, services/, ai/, models/, utils/ directories
