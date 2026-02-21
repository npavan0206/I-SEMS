import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/dashboard/Navbar';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Sun, TrendingUp, Zap, Calendar, RefreshCw, Brain } from 'lucide-react';
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

export default function SolarPage() {
  const [solarData, setSolarData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getSolar();
      setSolarData(data);
    } catch (error) {
      console.error('Failed to fetch solar data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const chartData = solarData?.history?.map(item => ({
    ...item,
    time: item.timestamp ? format(parseISO(item.timestamp), 'HH:mm') : '',
  })).slice(-50) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="w-16 h-16 rounded-full border-4 border-solar border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  const current = solarData?.current || {};
  const predictions = solarData?.predictions || {};
  const deviceOnline = solarData?.device_online ?? false;

  return (
    <div className="min-h-screen bg-background grid-pattern" data-testid="solar-page">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-solar/20 flex items-center justify-center shadow-glow-solar">
              <Sun className="w-7 h-7 text-solar" />
            </div>
            <div>
              <h1 className="font-rajdhani font-bold text-3xl tracking-tight">Solar Panel</h1>
              <p className="text-muted-foreground text-sm">Photovoltaic System Monitoring</p>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" className="btn-ghost" data-testid="refresh-solar-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Offline Warning */}
        {!deviceOnline && (
          <div className="mb-6 p-4 rounded-xl bg-load/10 border border-load/20">
            <p className="text-load font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-load animate-pulse" />
              Device Offline - Showing last known values
            </p>
          </div>
        )}

        {/* Current Values Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-xl p-5 gradient-solar">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-solar" />
              <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">Power</span>
            </div>
            <p className="font-mono font-bold text-3xl text-solar">{(current.power || 0).toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Watts</p>
          </div>

          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">Voltage</span>
            </div>
            <p className="font-mono font-bold text-3xl">{(current.voltage || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Volts</p>
          </div>

          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">Current</span>
            </div>
            <p className="font-mono font-bold text-3xl">{(current.current || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Amps</p>
          </div>

          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">24h Energy</span>
            </div>
            <p className="font-mono font-bold text-3xl">{(current.energy_24h || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">kWh</p>
          </div>
        </div>

        {/* Charts and Predictions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Historical Chart */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6" data-testid="solar-history-chart">
            <h3 className="font-rajdhani font-semibold text-lg mb-4">Solar Output History</h3>
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
                      type="monotone" 
                      dataKey="power" 
                      name="Power (W)"
                      fill="rgba(245, 158, 11, 0.2)" 
                      stroke="#F59E0B"
                      strokeWidth={2}
                    />
                    <Line 
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

          {/* AI Predictions */}
          <div className="glass-card rounded-2xl p-6" data-testid="solar-predictions">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-rajdhani font-semibold text-lg">AI Forecast</h3>
                <p className="text-xs text-muted-foreground">
                  Confidence: {predictions.confidence}%
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-solar/10 border border-solar/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-solar" />
                  <span className="text-xs text-muted-foreground font-rajdhani uppercase">Next Hour</span>
                </div>
                <p className="font-mono font-bold text-2xl text-solar">
                  {(predictions.linear_regression?.solar_power_1h || 0).toFixed(1)} W
                </p>
                <p className="text-xs text-muted-foreground mt-1">Linear Regression</p>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-rajdhani uppercase">2 Hours</span>
                </div>
                <p className="font-mono font-bold text-2xl">
                  {(predictions.linear_regression?.solar_power_2h || 0).toFixed(1)} W
                </p>
                <p className="text-xs text-muted-foreground mt-1">Linear Regression</p>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-muted-foreground font-rajdhani uppercase">EWMA Prediction</span>
                <p className="font-mono font-bold text-2xl">{(predictions.ewma || 0).toFixed(1)} W</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-muted-foreground font-rajdhani uppercase">Time-Weighted Average</span>
                <p className="font-mono font-bold text-2xl">{(predictions.time_weighted || 0).toFixed(1)} W</p>
              </div>
            </div>
          </div>
        </div>

        {/* 7-Day Summary */}
        <div className="mt-6 glass-card rounded-2xl p-6">
          <h3 className="font-rajdhani font-semibold text-lg mb-4">7-Day Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-xl bg-white/5">
              <p className="text-3xl font-mono font-bold text-solar">{(current.energy_7d || 0).toFixed(1)}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Energy (kWh)</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5">
              <p className="text-3xl font-mono font-bold">{((current.energy_7d || 0) / 7).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">Avg Daily (kWh)</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5">
              <p className="text-3xl font-mono font-bold text-battery">{((current.power || 0) > 50 ? 'High' : 'Normal')}</p>
              <p className="text-xs text-muted-foreground mt-1">Output Level</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5">
              <p className="text-3xl font-mono font-bold">{deviceOnline ? 'OK' : 'N/A'}</p>
              <p className="text-xs text-muted-foreground mt-1">System Status</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
