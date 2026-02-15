import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebSocket = (url, token) => {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    const API_URL = process.env.REACT_APP_BACKEND_URL;
    const WS_URL = process.env.REACT_APP_WS_URL || API_URL?.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';
    
    try {
      wsRef.current = new WebSocket(`${WS_URL}${token ? `?token=${token}` : ''}`);
      
      wsRef.current.onopen = () => {
        setConnected(true);
        console.log('WebSocket connected');
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          setData(parsedData);
        } catch (e) {
          console.error('Failed to parse WebSocket data:', e);
        }
      };
      
      wsRef.current.onclose = () => {
        setConnected(false);
        console.log('WebSocket disconnected, reconnecting...');
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [token]);

  useEffect(() => {
    connect();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { data, connected };
};

export default useWebSocket;
