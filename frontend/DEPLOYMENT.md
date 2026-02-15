# ISEMS Frontend - Netlify Deployment

## Netlify Configuration

### Environment Variables (Set in Netlify Dashboard)
```
REACT_APP_BACKEND_URL=https://your-railway-backend.up.railway.app
REACT_APP_WS_URL=wss://your-railway-backend.up.railway.app/ws
CI=false
```

### Build Settings
- **Base directory:** frontend
- **Build command:** yarn build
- **Publish directory:** frontend/build

### Local Development
Create `frontend/.env.local`:
```
REACT_APP_BACKEND_URL=http://localhost:8001
REACT_APP_WS_URL=ws://localhost:8001/ws
```

## Deployment Steps
1. Push code to GitHub
2. Connect repository to Netlify
3. Set environment variables in Netlify Dashboard
4. Deploy!

## Important Notes
- The `netlify.toml` file in the root directory handles build configuration
- SPA routing is configured to redirect all routes to index.html
- Make sure to update CORS_ORIGINS on Railway backend to include your Netlify URL
