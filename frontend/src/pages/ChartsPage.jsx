import { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/dashboard/Navbar';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Sun, Battery, Plug, Download, RefreshCw } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="glass-card rounded-lg p-3 text-sm">
      <p className="font-mono text-xs text-muted-foreground mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-bold">{entry.value?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export default function ChartsPage() {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deviceOnline, setDeviceOnline] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getHistory(200);
      setHistoryData(data.data || []);
      setDeviceOnline(data.device_online ?? true);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

  const chartData = historyData.map(item => ({
    ...item,
    time: item.timestamp ? format(parseISO(item.timestamp), 'HH:mm') : '',
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid-pattern" data-testid="charts-page">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center shadow-glow-primary">
              <BarChart3 className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="font-rajdhani font-bold text-3xl tracking-tight">Analytics</h1>
              <p className="text-muted-foreground text-sm">Historical Data & Charts</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button onClick={fetchData} variant="outline" className="btn-ghost" data-testid="refresh-charts-btn">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleExportCSV} variant="outline" className="btn-ghost" data-testid="export-charts-csv">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Offline Warning */}
        {!deviceOnline && (
          <div className="mb-6 p-4 rounded-xl bg-load/10 border border-load/20">
            <p className="text-load font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-load animate-pulse" />
              Device Offline - Showing cached data
            </p>
          </div>
        )}

        {/* Charts Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="glass-card p-1 w-full sm:w-auto">
            <TabsTrigger value="overview" className="font-rajdhani" data-testid="tab-overview">
              Overview
            </TabsTrigger>
            <TabsTrigger value="solar" className="font-rajdhani" data-testid="tab-solar">
              <Sun className="w-4 h-4 mr-2" />
              Solar
            </TabsTrigger>
            <TabsTrigger value="battery" className="font-rajdhani" data-testid="tab-battery">
              <Battery className="w-4 h-4 mr-2" />
              Battery
            </TabsTrigger>
            <TabsTrigger value="load" className="font-rajdhani" data-testid="tab-load">
              <Plug className="w-4 h-4 mr-2" />
              Load
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="glass-card rounded-2xl p-6" data-testid="overview-chart">
              <h3 className="font-rajdhani font-semibold text-lg mb-4">System Overview</h3>
              {chartData.length > 0 ? (
                <div className="h-80">
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
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="solar_power" 
                        name="Solar (W)"
                        fill="rgba(245, 158, 11, 0.2)" 
                        stroke="#F59E0B"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="load_power" 
                        name="Load (W)"
                        stroke="#EF4444" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="battery_soc" 
                        name="Battery SOC (%)"
                        stroke="#10B981" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </TabsContent>

          {/* Solar Tab */}
          <TabsContent value="solar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-2xl p-6" data-testid="solar-power-chart">
                <h3 className="font-rajdhani font-semibold text-lg mb-4 flex items-center gap-2">
                  <Sun className="w-5 h-5 text-solar" />
                  Solar Power
                </h3>
                {chartData.length > 0 ? (
                  <div className="h-64">
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
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="solar_power" 
                          name="Power (W)"
                          fill="rgba(245, 158, 11, 0.3)" 
                          stroke="#F59E0B"
                          strokeWidth={2}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>

              <div className="glass-card rounded-2xl p-6" data-testid="solar-voltage-chart">
                <h3 className="font-rajdhani font-semibold text-lg mb-4">Solar Voltage & Current</h3>
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
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="solar_voltage" 
                          name="Voltage (V)"
                          stroke="#66FCF1" 
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="solar_current" 
                          name="Current (A)"
                          stroke="#F59E0B" 
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
            </div>
          </TabsContent>

          {/* Battery Tab */}
          <TabsContent value="battery" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-2xl p-6" data-testid="battery-soc-chart">
                <h3 className="font-rajdhani font-semibold text-lg mb-4 flex items-center gap-2">
                  <Battery className="w-5 h-5 text-battery" />
                  Battery SOC
                </h3>
                {chartData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis 
                          dataKey="time" 
                          stroke="rgba(255,255,255,0.5)"
                          tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                        />
                        <YAxis 
                          domain={[0, 100]}
                          stroke="rgba(255,255,255,0.5)"
                          tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="battery_soc" 
                          name="SOC (%)"
                          fill="rgba(16, 185, 129, 0.3)" 
                          stroke="#10B981"
                          strokeWidth={2}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>

              <div className="glass-card rounded-2xl p-6" data-testid="battery-voltage-chart">
                <h3 className="font-rajdhani font-semibold text-lg mb-4">Battery Voltage & Current</h3>
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
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="battery_voltage" 
                          name="Voltage (V)"
                          stroke="#66FCF1" 
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="battery_current" 
                          name="Current (A)"
                          stroke="#10B981" 
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
            </div>
          </TabsContent>

          {/* Load Tab */}
          <TabsContent value="load" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-2xl p-6" data-testid="load-power-chart">
                <h3 className="font-rajdhani font-semibold text-lg mb-4 flex items-center gap-2">
                  <Plug className="w-5 h-5 text-load" />
                  Load Power
                </h3>
                {chartData.length > 0 ? (
                  <div className="h-64">
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
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="load_power" 
                          name="Power (W)"
                          fill="rgba(239, 68, 68, 0.3)" 
                          stroke="#EF4444"
                          strokeWidth={2}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>

              <div className="glass-card rounded-2xl p-6" data-testid="load-current-chart">
                <h3 className="font-rajdhani font-semibold text-lg mb-4">Load Current</h3>
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
                        <Tooltip content={<CustomTooltip />} />
                        <Line 
                          type="monotone" 
                          dataKey="load_current" 
                          name="Current (A)"
                          stroke="#EF4444" 
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
            </div>
          </TabsContent>
        </Tabs>

        {/* Data Stats */}
        <div className="mt-6 glass-card rounded-2xl p-6">
          <h3 className="font-rajdhani font-semibold text-lg mb-4">Data Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-3xl font-mono font-bold text-primary">{chartData.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Data Points</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-3xl font-mono font-bold text-solar">
                {chartData.length > 0 ? Math.max(...chartData.map(d => d.solar_power || 0)).toFixed(0) : 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Peak Solar (W)</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-3xl font-mono font-bold text-battery">
                {chartData.length > 0 ? Math.max(...chartData.map(d => d.battery_soc || 0)).toFixed(0) : 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Max SOC (%)</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <p className="text-3xl font-mono font-bold text-load">
                {chartData.length > 0 ? Math.max(...chartData.map(d => d.load_power || 0)).toFixed(0) : 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Peak Load (W)</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
