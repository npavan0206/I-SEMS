import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/dashboard/Navbar';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plug, Lightbulb, Fan, Droplets, RefreshCw, AlertTriangle, Lock, Brain } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [controlling, setControlling] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getLoad();
      setLoadData(data);
    } catch (error) {
      console.error('Failed to fetch load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleToggle = async (device, currentState) => {
    setControlling(prev => ({ ...prev, [device]: true }));
    try {
      await api.controlLoad(device, !currentState);
      toast.success(`${device.charAt(0).toUpperCase() + device.slice(1)} ${!currentState ? 'enabled' : 'disabled'}`);
      await fetchData();
    } catch (error) {
      toast.error(error.message || `Failed to control ${device}`);
    } finally {
      setControlling(prev => ({ ...prev, [device]: false }));
    }
  };

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
  const predictions = loadData?.predictions || {};
  const deviceOnline = loadData?.device_online ?? false;

  // Determine load tiers and lock status
  const loads = [
    {
      id: 'light',
      name: 'Light',
      icon: Lightbulb,
      isOn: current.light_on,
      tier: 'essential',
      tierLabel: 'Essential',
      description: 'Indoor lighting system',
      locked: false
    },
    {
      id: 'fan',
      name: 'Fan',
      icon: Fan,
      isOn: current.fan_on,
      tier: 'semi-essential',
      tierLabel: 'Semi-Essential',
      description: 'Ventilation system',
      locked: false
    },
    {
      id: 'pump',
      name: 'Pump',
      icon: Droplets,
      isOn: current.pump_on,
      tier: 'non-essential',
      tierLabel: 'Non-Essential',
      description: 'Water pumping system',
      locked: (current.soc || 100) < 20
    }
  ];

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
              <h1 className="font-rajdhani font-bold text-3xl tracking-tight">Load Control</h1>
              <p className="text-muted-foreground text-sm">Smart Load Management</p>
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
              Device Offline - Controls may not respond
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
              <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">Current</span>
            </div>
            <p className="font-mono font-bold text-3xl">{(current.current || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Amps</p>
          </div>

          <div className="glass-card rounded-xl p-5 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground font-rajdhani uppercase tracking-wider">Predicted (1h)</span>
            </div>
            <p className="font-mono font-bold text-3xl text-primary">{(predictions.load_demand_1h || 0).toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Watts</p>
          </div>
        </div>

        {/* Load Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {loads.map(load => {
            const Icon = load.icon;
            return (
              <div
                key={load.id}
                className={`glass-card rounded-2xl p-6 card-hover ${load.isOn ? 'neon-border-load' : ''}`}
                data-testid={`load-control-${load.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${load.isOn ? 'bg-load/20' : 'bg-muted/20'}`}>
                      <Icon className={`w-6 h-6 ${load.isOn ? 'text-load' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <h3 className="font-rajdhani font-semibold text-lg">{load.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        load.tier === 'essential' ? 'bg-battery/20 text-battery' :
                        load.tier === 'semi-essential' ? 'bg-solar/20 text-solar' :
                        'bg-muted/20 text-muted-foreground'
                      }`}>
                        {load.tierLabel}
                      </span>
                    </div>
                  </div>
                  
                  {load.locked ? (
                    <div className="flex items-center gap-1 text-solar" title="Locked due to low battery">
                      <Lock className="w-4 h-4" />
                    </div>
                  ) : (
                    <Switch
                      checked={load.isOn}
                      onCheckedChange={() => handleToggle(load.id, load.isOn)}
                      disabled={controlling[load.id] || !deviceOnline}
                      data-testid={`toggle-${load.id}`}
                    />
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-4">{load.description}</p>

                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${load.isOn ? 'text-load' : 'text-muted-foreground'}`}>
                    {load.isOn ? 'Active' : 'Inactive'}
                  </span>
                  {controlling[load.id] && (
                    <span className="text-xs text-muted-foreground animate-pulse">Updating...</span>
                  )}
                </div>

                {load.locked && (
                  <div className="mt-4 p-3 rounded-lg bg-solar/10 border border-solar/20">
                    <p className="text-xs text-solar flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Locked: Battery SOC below 20%
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

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
              <p className="text-sm text-muted-foreground mb-2">Load Scheduling</p>
              <p className="text-sm">
                {(current.power || 0) > 50 
                  ? 'Consider reducing non-essential loads to conserve battery during low solar hours.'
                  : 'Current load levels are optimal for battery conservation.'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-sm text-muted-foreground mb-2">Peak Hours Alert</p>
              <p className="text-sm">
                Run high-power loads like pumps during peak solar hours (10 AM - 3 PM) for optimal efficiency.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
