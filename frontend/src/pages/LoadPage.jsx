import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/dashboard/Navbar';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Plug, Lightbulb, Fan, Droplets, RefreshCw, Brain, Activity, Zap } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function LoadPage() {
  const [loadData, setLoadData] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [loadResponse, predResponse] = await Promise.all([
        api.getLoad(),
        api.getPredictions()
      ]);
      setLoadData(loadResponse);
      setPredictions(predResponse);
    } catch (error) {
      console.error('Failed to fetch load data:', error);
      toast.error('Could not fetch load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  const chartData = loadData?.history?.map(item => ({
    ...item,
    time: item.timestamp ? format(parseISO(item.timestamp), 'HH:mm') : '',
  })).slice(-50) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="w-16 h-16 rounded-full border-4 border-load border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  const current = loadData?.current || {};
  const deviceOnline = loadData?.device_online ?? false;
  const batterySoc = loadData?.battery_soc ?? 100;

  // Define all possible loads with their metrics
  const allLoads = [
    {
      id: 'light',
      name: 'Light',
      icon: Lightbulb,
      isOn: current.light_on || false,
      tier: 'Essential',
      description: 'Indoor lighting system',
      voltage: current.light_voltage ?? 0.0,
      current: current.light_current ?? 0.0,
      power: current.light_power ?? 0.0
    },
    {
      id: 'fan',
      name: 'Fan',
      icon: Fan,
      isOn: current.fan_on || false,
      tier: 'Semi-Essential',
      description: 'Ventilation system',
      voltage: current.fan_voltage ?? 0.0,
      current: current.fan_current ?? 0.0,
      power: current.fan_power ?? 0.0
    },
    {
      id: 'pump',
      name: 'Pump',
      icon: Droplets,
      isOn: current.pump_on || false,
      tier: 'Non-Essential',
      description: 'Water pumping system',
      voltage: current.pump_voltage ?? 0.0,
      current: current.pump_current ?? 0.0,
      power: current.pump_power ?? 0.0
    }
  ];

  // Filter to only show loads that are ON
  const activeLoads = allLoads.filter(load => load.isOn);

  const batteryStatus = predictions?.battery_status || "Insufficient data for prediction";

  return (
    <div className="min-h-screen bg-background grid-pattern" data-testid="load-page">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-load/20 flex items-center justify-center shadow-glow-load">
              <Plug className="w-7 h-7 text-load" />
            </div>
            <div>
              <h1 className="font-rajdhani font-bold text-3xl tracking-tight">Active Loads</h1>
              <p className="text-muted-foreground text-sm">Currently running equipment</p>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" className="btn-ghost" data-testid="refresh-load-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Offline Warning */}
        {!deviceOnline && (
          <div className="mb-6 p-4 rounded-xl bg-load/10 border border-load/20">
            <p className="text-load font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-load animate-pulse" />
              Device Offline – Showing last known values
            </p>
          </div>
        )}

        {/* Current Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="glass-card rounded-xl p-5 gradient-load">
            <div className="flex items-center gap-2 mb-2">
              <Plug className="w-4 h-4 text-load" />
              <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">Total Power</span>
            </div>
            <p className="font-mono font-bold text-3xl text-load">{(current.power || 0).toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Watts</p>
          </div>

          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">Total Current</span>
            </div>
            <p className="font-mono font-bold text-3xl">{(current.current || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Amps</p>
          </div>

          <div className="glass-card rounded-xl p-5 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">Predicted Load (1h)</span>
            </div>
            <p className="font-mono font-bold text-3xl text-primary">
              {(predictions?.linear_regression?.load_demand_1h || 0).toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">Watts</p>
          </div>
        </div>

        {/* Active Loads Display */}
        {activeLoads.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Plug className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-rajdhani font-semibold text-xl mb-2">No Active Loads</h3>
            <p className="text-muted-foreground">All equipment is currently off</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {activeLoads.map(load => {
              const Icon = load.icon;
              return (
                <div
                  key={load.id}
                  className="glass-card rounded-2xl p-6 neon-border-load"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-load/20 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-load" />
                    </div>
                    <div>
                      <h3 className="font-rajdhani font-semibold text-lg">{load.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-load/20 text-load">
                        {load.tier}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">{load.description}</p>

                  {/* Load Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-md bg-white/5">
                      <Zap className="w-3 h-3 mx-auto mb-1 text-load" />
                      <span className="block font-mono font-bold">{load.voltage.toFixed(1)}</span>
                      <span className="text-muted-foreground">V</span>
                    </div>
                    <div className="p-2 rounded-md bg-white/5">
                      <Activity className="w-3 h-3 mx-auto mb-1 text-load" />
                      <span className="block font-mono font-bold">{load.current.toFixed(2)}</span>
                      <span className="text-muted-foreground">A</span>
                    </div>
                    <div className="p-2 rounded-md bg-white/5">
                      <Plug className="w-3 h-3 mx-auto mb-1 text-load" />
                      <span className="block font-mono font-bold">{load.power.toFixed(1)}</span>
                      <span className="text-muted-foreground">W</span>
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-load">
                      <span className="w-2 h-2 rounded-full bg-load animate-pulse" />
                      Active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* History Chart */}
        <div className="glass-card rounded-2xl p-6" data-testid="load-history-chart">
          <h3 className="font-rajdhani font-semibold text-lg mb-4">Load History</h3>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
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
                  <Line 
                    type="monotone" 
                    dataKey="power" 
                    name="Power (W)"
                    stroke="#EF4444" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="current" 
                    name="Current (A)"
                    stroke="#66FCF1" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </div>

        {/* AI Recommendations */}
        <div className="mt-6 glass-card rounded-2xl p-6" data-testid="load-recommendations">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="font-rajdhani font-semibold text-lg">AI Recommendations</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-sm text-muted-foreground mb-2">Battery Status</p>
              <p className="text-sm font-medium">{batteryStatus}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-sm text-muted-foreground mb-2">Load Scheduling</p>
              <p className="text-sm">
                {(current.power || 0) > 50 
                  ? 'Consider reducing non-essential loads to conserve battery during low solar hours.'
                  : 'Current load levels are optimal for battery conservation.'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
