// src/services/api.js
// API Service for ISEMS Frontend

const API_URL = process.env.REACT_APP_BACKEND_URL;
if (!API_URL) {
  throw new Error('REACT_APP_BACKEND_URL is not defined. Please set it in your environment variables.');
}

const WS_URL = process.env.REACT_APP_WS_URL || 
  (API_URL ? API_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws' : null);

const getAuthHeaders = () => {
  const token = localStorage.getItem('isems-token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

const handleResponse = async (response) => {
  if (!response.ok) {
    let errorDetail = 'Request failed';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.message || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    // If unauthorized, redirect to login
    if (response.status === 401) {
      localStorage.removeItem('isems-token');
      window.location.href = '/login';
    }
    throw new Error(errorDetail);
  }
  return response.json();
};

export const api = {
  // Auth
  login: async (email, password) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(response);
  },

  register: async (email, password, name) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    return handleResponse(response);
  },

  // Dashboard
  getDashboard: async () => {
    const response = await fetch(`${API_URL}/api/dashboard`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  getDashboardPublic: async () => {
    const response = await fetch(`${API_URL}/api/dashboard/public`);
    return handleResponse(response);
  },

  // Solar
  getSolar: async () => {
    const response = await fetch(`${API_URL}/api/solar`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Battery
  getBattery: async () => {
    const response = await fetch(`${API_URL}/api/battery`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Load
  getLoad: async () => {
    const response = await fetch(`${API_URL}/api/load`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  controlLoad: async (device, state) => {
    const response = await fetch(`${API_URL}/api/load/control`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ device, state })
    });
    return handleResponse(response);
  },

  // Grid
  getGrid: async () => {
    const response = await fetch(`${API_URL}/api/grid`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  setGridMode: async (mode) => {
    const response = await fetch(`${API_URL}/api/grid/mode?mode=${mode}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Predictions
  getPredictions: async () => {
    const response = await fetch(`${API_URL}/api/predictions`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // History
  getHistory: async (results = 100) => {
    const response = await fetch(`${API_URL}/api/history?results=${results}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Export
  exportCSV: async () => {
    const response = await fetch(`${API_URL}/api/export/csv`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};

// WebSocket connection
export const createWebSocket = (token) => {
  if (!WS_URL) {
    throw new Error('WebSocket URL could not be constructed. Check REACT_APP_BACKEND_URL or set REACT_APP_WS_URL.');
  }
  const ws = new WebSocket(`${WS_URL}?token=${token || ''}`);
  return ws;
};

export default api;
