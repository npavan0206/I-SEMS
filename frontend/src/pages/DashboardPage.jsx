import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/App';
import { Navbar } from '@/components/dashboard/Navbar';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { PowerFlowDiagram } from '@/components/dashboard/PowerFlowDiagram';
import { PowerOverviewChart } from '@/components/dashboard/PowerOverviewChart';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Brain, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { token } = useAuth();
  const { data: wsData, connected } = useWebSocket(null, token);
  const [dashboardData, setDashboardData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [dashboard, history, preds] = await Promise.all([
        api.getDashboard(),
        api.getHistory(100),
        api.getPredictions()
      ]);
      setDashboardData(dashboard);
      setHistoryData(history.data || []);
      setPredictions(preds);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll only when WebSocket is not connected
  useEffect(() => {
    if (!connected) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [connected, fetchData]);

  // Update from WebSocket
  useEffect(() => {
    if (wsData) {
      setDashboardData(wsData);
    }
  }, [wsData]);

  const handleExportCSV = async () => {
    try {
      const result = await api.exportCSV();
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported successfully');
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  const data = dashboardData || {};
  const deviceOnline = data.device_online !== undefined ? data.device_online : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar connected={false} />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground font-rajdhani">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid-pattern" data-testid="dashboard-page">
      <Navbar connected={connected} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-rajdhani font-bold text-3xl sm:text-4xl tracking-tight">
              Energy Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Real-time monitoring and control
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="btn-ghost"
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="btn-ghost"
              data-testid="export-csv-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            type="solar"
            title="Solar PV"
            deviceOnline={deviceOnline}
            status={deviceOnline ? { type: 'success', label: 'Active' } : { type: 'error', label: 'Offline' }}
            metrics={[
              { label: 'Power', value: (data.solar?.power || 0).toFixed(1), unit: 'W', trend: 1 },
              { label: 'Voltage', value: (data.solar?.voltage || 0).toFixed(2), unit: 'V' },
              { label: '24h Energy', value: (data.solar?.energy_24h || 0).toFixed(2), unit: 'kWh' },
            ]}
          />
          
          <MetricCard
            type="battery"
            title="Battery"
            deviceOnline={deviceOnline}
            status={
              (data.battery?.soc || 0) < 20 
                ? { type: 'warning', label: 'Low' }
                : data.battery?.charging 
                  ? { type: 'success', label: 'Charging' }
                  : { type: 'info', label: 'Standby' }
            }
            metrics={[
              { label: 'SOC', value: (data.battery?.soc || 0).toFixed(0), unit: '%', charging: data.battery?.charging },
              { label: 'Voltage', value: (data.battery?.voltage || 0).toFixed(2), unit: 'V' },
              { label: 'SOH', value: (data.battery?.soh || 0).toFixed(0), unit: '%' },
            ]}
          />
          
          <MetricCard
            type="load"
            title="Loads"
            deviceOnline={deviceOnline}
            status={{ type: 'info', label: `${[(data.load?.light_on && 'L'), (data.load?.fan_on && 'F'), (data.load?.pump_on && 'P')].filter(Boolean).join('+') || 'All Off'}` }}
            metrics={[
              { label: 'Power', value: (data.load?.power || 0).toFixed(1), unit: 'W' },
              { label: 'Current', value: (data.load?.current || 0).toFixed(2), unit: 'A' },
            ]}
          />
          
          <MetricCard
            type="grid"
            title="Grid"
            deviceOnline={deviceOnline}
            status={data.grid?.online ? { type: 'success', label: 'Online' } : { type: 'error', label: 'Offline' }}
            metrics={[
              { label: 'Mode', value: data.grid?.mode || 'Hybrid', unit: '' },
              { label: 'Power', value: (data.grid?.power || 0).toFixed(1), unit: 'W' },
            ]}
          />
        </div>

        {/* Charts and Flow Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <PowerOverviewChart data={historyData} deviceOnline={deviceOnline} />
          </div>
          <div>
            <PowerFlowDiagram 
              solar={data.solar}
              battery={data.battery}
              load={data.load}
              grid={data.grid}
            />
          </div>
        </div>

        {/* AI Predictions Panel */}
        {predictions && (
          <div className="glass-card rounded-2xl p-6" data-testid="ai-predictions-panel">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-rajdhani font-semibold text-lg">AI Predictions</h3>
                <p className="text-xs text-muted-foreground">
                  Confidence: {predictions.confidence}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-solar/10 border border-solar/20">
                <h4 className="text-xs text-muted-foreground mb-2">1h Solar Power</h4>
                <p className="font-mono font-bold text-2xl text-solar">
                  {predictions.linear_regression?.solar_power_1h?.toFixed(1)} W
                </p>
                <p className="text-xs text-muted-foreground">Linear Regression</p>
              </div>
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <h4 className="text-xs text-muted-foreground mb-2">EWMA</h4>
                <p className="font-mono font-bold text-2xl text-primary">
                  {predictions.ewma?.toFixed(1)} W
                </p>
                <p className="text-xs text-muted-foreground">Exponential Weighted</p>
              </div>
              <div className="p-4 rounded-xl bg-battery/10 border border-battery/20">
                <h4 className="text-xs text-muted-foreground mb-2">Time-Weighted</h4>
                <p className="font-mono font-bold text-2xl text-battery">
                  {predictions.time_weighted?.toFixed(1)} W
                </p>
                <p className="text-xs text-muted-foreground">Recent bias</p>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-white/5">
              <p className="text-sm">{predictions.battery_status}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
