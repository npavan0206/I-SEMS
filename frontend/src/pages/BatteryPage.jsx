import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/dashboard/Navbar';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Battery, Thermometer, Activity, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';
import { format, parseISO } from 'date-fns';

export default function BatteryPage() {
  const [batteryData, setBatteryData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getBattery();
      setBatteryData(data);
    } catch (error) {
      console.error('Failed to fetch battery data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const chartData = batteryData?.history?.map(item => ({
    ...item,
    time: item.timestamp ? format(parseISO(item.timestamp), 'HH:mm') : '',
  })).slice(-50) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="w-16 h-16 rounded-full border-4 border-battery border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  const current = batteryData?.current || {};
  const deviceOnline = batteryData?.device_online ?? false;
  const socLevel = current.soc || 0;
  const isLowBattery = socLevel < 20;
  const isCritical = socLevel < 10;

  return (
    <div className="min-h-screen bg-background grid-pattern" data-testid="battery-page">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-battery/20 flex items-center justify-center shadow-glow-battery">
              <Battery className="w-7 h-7 text-battery" />
            </div>
            <div>
              <h1 className="font-rajdhani font-bold text-3xl tracking-tight">Battery Storage</h1>
              <p className="text-muted-foreground text-sm">Energy Storage System</p>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" className="btn-ghost" data-testid="refresh-battery-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Warnings */}
        {!deviceOnline && (
          <div className="mb-6 p-4 rounded-xl bg-load/10 border border-load/20">
            <p className="text-load font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-load animate-pulse" />
              Device Offline - Showing last known values
            </p>
          </div>
        )}

        {isCritical && deviceOnline && (
          <div className="mb-6 p-4 rounded-xl bg-load/20 border border-load/40">
            <p className="text-load font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              CRITICAL: Battery below 10% - Only essential loads allowed
            </p>
          </div>
        )}

        {isLowBattery && !isCritical && deviceOnline && (
          <div className="mb-6 p-4 rounded-xl bg-solar/10 border border-solar/20">
            <p className="text-solar font-medium flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Warning: Battery below 20% - Pump disabled for safety
            </p>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SOC Gauge */}
          <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center gradient-battery">
            <h3 className="font-rajdhani font-semibold text-lg mb-6">State of Charge</h3>
            
            {/* Circular Gauge */}
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className="text-muted/20"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="none"
                  className={`${isCritical ? 'text-load' : isLowBattery ? 'text-solar' : 'text-battery'} ${current.charging ? 'animate-pulse' : ''}`}
                  strokeDasharray={`${socLevel * 5.53} 553`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-5xl font-mono font-bold ${isCritical ? 'text-load' : isLowBattery ? 'text-solar' : 'text-battery'}`}>
                  {socLevel.toFixed(0)}
                </span>
                <span className="text-sm text-muted-foreground">%</span>
                {current.charging && (
                  <span className="mt-2 text-xs text-battery flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Charging
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {current.charging ? 'Currently charging' : 'On standby'}
              </p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-battery" />
                <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">Voltage</span>
              </div>
              <p className="font-mono font-bold text-3xl">{(current.voltage || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Volts</p>
            </div>

            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">Current</span>
              </div>
              <p className="font-mono font-bold text-3xl">{(current.current || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Amps</p>
            </div>

            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Thermometer className="w-4 h-4 text-solar" />
                <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">Temperature</span>
              </div>
              <p className="font-mono font-bold text-3xl">{(current.temperature || 0).toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">°C</p>
            </div>

            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Battery className="w-4 h-4 text-battery" />
                <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">SOH</span>
              </div>
              <p className="font-mono font-bold text-3xl text-battery">{(current.soh || 0).toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">%</p>
            </div>
          </div>
        </div>

        {/* History Chart */}
        <div className="mt-6 glass-card rounded-2xl p-6" data-testid="battery-history-chart">
          <h3 className="font-rajdhani font-semibold text-lg mb-4">Battery History</h3>
          {chartData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="time" 
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="soc" 
                    name="SOC (%)"
                    fill="rgba(16, 185, 129, 0.2)" 
                    stroke="#10B981"
                    strokeWidth={2}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="voltage" 
                    name="Voltage (V)"
                    stroke="#66FCF1" 
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
