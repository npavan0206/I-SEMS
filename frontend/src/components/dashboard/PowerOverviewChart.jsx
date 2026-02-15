import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';
import { format, parseISO } from 'date-fns';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="glass-card rounded-lg p-3 text-sm" data-testid="chart-tooltip">
      <p className="font-mono text-xs text-muted-foreground mb-2">
        {label}
      </p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-bold">{entry.value?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export const PowerOverviewChart = ({ data = [], deviceOnline = true }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map(item => ({
      ...item,
      time: item.timestamp ? format(parseISO(item.timestamp), 'HH:mm') : '',
      solar: item.solar_power || 0,
      load: item.load_power || 0,
      battery: item.battery_soc || 0,
    })).slice(-50);
  }, [data]);

  // Render chart even if device is offline, just show the last available data

  if (chartData.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6" data-testid="power-overview-chart">
        <h3 className="font-rajdhani font-semibold text-lg mb-4">Power Overview</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-3 animate-pulse">
              <span className="text-muted-foreground text-lg">...</span>
            </div>
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6" data-testid="power-overview-chart">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-rajdhani font-semibold text-lg">Power Overview</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-battery animate-pulse" />
          Live
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="time" 
              stroke="rgba(255,255,255,0.5)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
              tickLine={{ stroke: 'rgba(255,255,255,0.2)' }}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.5)"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
              tickLine={{ stroke: 'rgba(255,255,255,0.2)' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '10px' }}
              formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
            />
            <Area 
              type="monotone" 
              dataKey="solar" 
              name="Solar (W)"
              fill="rgba(245, 158, 11, 0.2)" 
              stroke="#F59E0B"
              strokeWidth={2}
            />
            <Line 
              type="monotone" 
              dataKey="load" 
              name="Load (W)"
              stroke="#EF4444" 
              strokeWidth={2}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="battery" 
              name="Battery SOC (%)"
              stroke="#10B981" 
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PowerOverviewChart;
