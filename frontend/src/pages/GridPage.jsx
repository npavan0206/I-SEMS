import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/dashboard/Navbar';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Zap, RefreshCw, Power, Activity, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

export default function GridPage() {
  const [gridData, setGridData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settingMode, setSettingMode] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getGrid();
      setGridData(data);
    } catch (error) {
      console.error('Failed to fetch grid data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleModeChange = async (mode) => {
    setSettingMode(true);
    try {
      await api.setGridMode(mode);
      toast.success(`Grid mode set to ${mode}`);
      await fetchData();
    } catch (error) {
      toast.error('Failed to change grid mode');
    } finally {
      setSettingMode(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="w-16 h-16 rounded-full border-4 border-grid border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  const current = gridData?.current || {};
  const deviceOnline = gridData?.device_online ?? false;
  const isOnline = current.online ?? true;
  const currentMode = current.mode || 'hybrid';

  const modes = [
    {
      id: 'solar',
      name: 'Solar Priority',
      description: 'Maximize solar usage. Use grid only when solar is insufficient.',
      icon: '☀️',
      color: 'solar'
    },
    {
      id: 'battery',
      name: 'Battery Priority',
      description: 'Use battery first. Charge from solar, minimal grid usage.',
      icon: '🔋',
      color: 'battery'
    },
    {
      id: 'hybrid',
      name: 'Hybrid Mode',
      description: 'Intelligent switching between solar, battery, and grid.',
      icon: '⚡',
      color: 'primary'
    }
  ];

  return (
    <div className="min-h-screen bg-background grid-pattern" data-testid="grid-page">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-grid/20 flex items-center justify-center shadow-glow-grid">
              <Zap className="w-7 h-7 text-grid" />
            </div>
            <div>
              <h1 className="font-rajdhani font-bold text-3xl tracking-tight">Grid Management</h1>
              <p className="text-muted-foreground text-sm">Power Source Control</p>
            </div>
          </div>
          <Button onClick={fetchData} variant="outline" className="btn-ghost" data-testid="refresh-grid-btn">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Offline Warning */}
        {!deviceOnline && (
          <div className="mb-6 p-4 rounded-xl bg-load/10 border border-load/20">
            <p className="text-load font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-load animate-pulse" />
              Device Offline
            </p>
          </div>
        )}

        {/* Grid Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Connection Status */}
          <div className={`glass-card rounded-2xl p-8 ${isOnline ? 'gradient-grid neon-border-grid' : ''}`}>
            <div className="flex flex-col items-center text-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
                isOnline ? 'bg-grid/20' : 'bg-load/20'
              }`}>
                {isOnline ? (
                  <Wifi className="w-12 h-12 text-grid" />
                ) : (
                  <WifiOff className="w-12 h-12 text-load" />
                )}
              </div>
              
              <h2 className={`font-rajdhani font-bold text-3xl mb-2 ${isOnline ? 'text-grid' : 'text-load'}`}>
                Grid {isOnline ? 'Online' : 'Offline'}
              </h2>
              
              <p className="text-muted-foreground mb-6">
                {isOnline 
                  ? 'Connected to utility grid. Backup power available.'
                  : 'Grid disconnected. Running on solar and battery.'}
              </p>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Power className={`w-4 h-4 ${isOnline ? 'text-grid' : 'text-muted-foreground'}`} />
                  <span>{isOnline ? 'Active' : 'Standby'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className={`w-4 h-4 ${isOnline ? 'text-grid' : 'text-muted-foreground'}`} />
                  <span>{(current.power || 0).toFixed(1)} W</span>
                </div>
              </div>
            </div>
          </div>

          {/* Power Flow Visualization */}
          <div className="glass-card rounded-2xl p-8">
            <h3 className="font-rajdhani font-semibold text-lg mb-6">Grid Power Flow</h3>
            
            <div className="relative h-48">
              <svg viewBox="0 0 300 200" className="w-full h-full">
                {/* Grid Node */}
                <g transform="translate(150, 30)">
                  <circle 
                    r="25" 
                    className={`${isOnline ? 'fill-grid/20 stroke-grid' : 'fill-muted/20 stroke-muted'}`}
                    strokeWidth="2"
                  />
                  <text 
                    y="5" 
                    textAnchor="middle" 
                    className="fill-current text-[10px] font-rajdhani font-bold"
                  >
                    GRID
                  </text>
                </g>

                {/* Solar Node */}
                <g transform="translate(50, 170)">
                  <circle r="25" className="fill-solar/20 stroke-solar" strokeWidth="2"/>
                  <text y="5" textAnchor="middle" className="fill-solar text-[10px] font-rajdhani font-bold">
                    SOLAR
                  </text>
                </g>

                {/* Load Node */}
                <g transform="translate(150, 170)">
                  <circle r="25" className="fill-load/20 stroke-load" strokeWidth="2"/>
                  <text y="5" textAnchor="middle" className="fill-load text-[10px] font-rajdhani font-bold">
                    LOAD
                  </text>
                </g>

                {/* Battery Node */}
                <g transform="translate(250, 170)">
                  <circle r="25" className="fill-battery/20 stroke-battery" strokeWidth="2"/>
                  <text y="5" textAnchor="middle" className="fill-battery text-[10px] font-rajdhani font-bold">
                    BATT
                  </text>
                </g>

                {/* Flow Lines */}
                {/* Grid to Load */}
                <path
                  d="M 150 55 L 150 145"
                  fill="none"
                  strokeWidth="2"
                  className={`${isOnline ? 'stroke-grid flow-active' : 'stroke-muted/30'}`}
                />

                {/* Solar to Load */}
                <path
                  d="M 75 160 L 125 160"
                  fill="none"
                  strokeWidth="2"
                  className="stroke-solar flow-active"
                />

                {/* Battery to Load */}
                <path
                  d="M 225 160 L 175 160"
                  fill="none"
                  strokeWidth="2"
                  className="stroke-battery flow-active"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="glass-card rounded-2xl p-6" data-testid="grid-mode-selector">
          <h3 className="font-rajdhani font-semibold text-lg mb-6">Power Mode Selection</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {modes.map(mode => (
              <button
                key={mode.id}
                onClick={() => handleModeChange(mode.id)}
                disabled={settingMode || !deviceOnline}
                data-testid={`mode-${mode.id}`}
                className={`
                  p-6 rounded-xl text-left transition-all duration-200
                  ${currentMode === mode.id 
                    ? `bg-${mode.color}/20 border-2 border-${mode.color}/50 shadow-lg` 
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'}
                  ${settingMode || !deviceOnline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{mode.icon}</span>
                  <h4 className={`font-rajdhani font-semibold ${currentMode === mode.id ? `text-${mode.color}` : ''}`}>
                    {mode.name}
                  </h4>
                </div>
                <p className="text-sm text-muted-foreground">{mode.description}</p>
                {currentMode === mode.id && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full bg-${mode.color} animate-pulse`} />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Descriptions */}
        <div className="mt-6 glass-card rounded-2xl p-6">
          <h3 className="font-rajdhani font-semibold text-lg mb-4">Current Mode: {currentMode.charAt(0).toUpperCase() + currentMode.slice(1)}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-sm text-muted-foreground mb-1">How it works</p>
              <p className="text-sm">
                {currentMode === 'solar' && 'Solar panels are the primary power source. Grid supplements only when solar production is insufficient.'}
                {currentMode === 'battery' && 'Battery is discharged first during peak hours. Solar charges battery, grid is used minimally.'}
                {currentMode === 'hybrid' && 'System intelligently switches between solar, battery, and grid based on demand and availability.'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-sm text-muted-foreground mb-1">Best for</p>
              <p className="text-sm">
                {currentMode === 'solar' && 'Maximum solar utilization, daytime operations, reducing grid dependency.'}
                {currentMode === 'battery' && 'Time-of-use rate optimization, backup power priority, off-grid scenarios.'}
                {currentMode === 'hybrid' && 'General use, balanced efficiency, automatic optimization without manual intervention.'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
