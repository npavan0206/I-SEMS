const API_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = process.env.REACT_APP_WS_URL || API_URL?.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';

const getAuthHeaders = () => {
  const token = localStorage.getItem('isems-token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

export const api = {
  // Auth
  login: async (email, password) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error('Invalid credentials');
    return response.json();
  },

  register: async (email, password, name) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }
    return response.json();
  },

  // Dashboard
  getDashboard: async () => {
    const response = await fetch(`${API_URL}/api/dashboard`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch dashboard');
    return response.json();
  },

  getDashboardPublic: async () => {
    const response = await fetch(`${API_URL}/api/dashboard/public`);
    if (!response.ok) throw new Error('Failed to fetch dashboard');
    return response.json();
  },

  // Solar
  getSolar: async () => {
    const response = await fetch(`${API_URL}/api/solar`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch solar data');
    return response.json();
  },

  // Battery
  getBattery: async () => {
    const response = await fetch(`${API_URL}/api/battery`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch battery data');
    return response.json();
  },

  // Load
  getLoad: async () => {
    const response = await fetch(`${API_URL}/api/load`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch load data');
    return response.json();
  },

  controlLoad: async (device, state) => {
    const response = await fetch(`${API_URL}/api/load/control`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ device, state })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to control load');
    }
    return response.json();
  },

  // Grid
  getGrid: async () => {
    const response = await fetch(`${API_URL}/api/grid`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch grid data');
    return response.json();
  },

  setGridMode: async (mode) => {
    const response = await fetch(`${API_URL}/api/grid/mode?mode=${mode}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to set grid mode');
    return response.json();
  },

  // Predictions
  getPredictions: async () => {
    const response = await fetch(`${API_URL}/api/predictions`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch predictions');
    return response.json();
  },

  // History
  getHistory: async (results = 100) => {
    const response = await fetch(`${API_URL}/api/history?results=${results}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch history');
    return response.json();
  },

  // Export
  exportCSV: async () => {
    const response = await fetch(`${API_URL}/api/export/csv`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to export CSV');
    return response.json();
  }
};

// WebSocket connection
export const createWebSocket = (token) => {
  const wsUrl = WS_URL || API_URL.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';
  const ws = new WebSocket(`${wsUrl}?token=${token || ''}`);
  return ws;
};

export default api;
