import { Sun, Battery, Plug, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';

const cardConfig = {
  solar: {
    icon: Sun,
    color: 'solar',
    gradient: 'gradient-solar',
    glow: 'shadow-glow-solar',
    neon: 'neon-border-solar',
    link: '/solar'
  },
  battery: {
    icon: Battery,
    color: 'battery',
    gradient: 'gradient-battery',
    glow: 'shadow-glow-battery',
    neon: 'neon-border-battery',
    link: '/battery'
  },
  load: {
    icon: Plug,
    color: 'load',
    gradient: 'gradient-load',
    glow: 'shadow-glow-load',
    neon: 'neon-border-load',
    link: '/load'
  },
  grid: {
    icon: Zap,
    color: 'grid',
    gradient: 'gradient-grid',
    glow: 'shadow-glow-grid',
    neon: 'neon-border-grid',
    link: '/grid'
  }
};

export const MetricCard = ({ type, title, metrics, status, deviceOnline = true }) => {
  const config = cardConfig[type];
  const Icon = config.icon;
  
  const colorClasses = {
    solar: 'text-solar',
    battery: 'text-battery',
    load: 'text-load',
    grid: 'text-grid'
  };

  return (
    <Link
      to={config.link}
      data-testid={`${type}-card`}
      className={`
        glass-card rounded-2xl p-6 card-hover cursor-pointer
        ${config.gradient}
        ${deviceOnline ? config.neon : ''}
        block
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-${config.color}/20 flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${colorClasses[config.color]}`} />
          </div>
          <h3 className="font-rajdhani font-semibold text-lg tracking-wide">{title}</h3>
        </div>
        
        {/* Status Badge */}
        {status && (
          <div className={`
            px-2 py-1 rounded-full text-xs font-rajdhani uppercase tracking-wider
            ${status.type === 'success' ? 'bg-battery/20 text-battery' : ''}
            ${status.type === 'warning' ? 'bg-solar/20 text-solar' : ''}
            ${status.type === 'error' ? 'bg-load/20 text-load' : ''}
            ${status.type === 'info' ? 'bg-grid/20 text-grid' : ''}
          `}>
            {status.label}
          </div>
        )}
      </div>

      {/* Offline Warning */}
      {!deviceOnline && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-load/10 border border-load/20">
          <p className="text-xs text-load font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-load animate-pulse" />
            Device Offline
          </p>
        </div>
      )}

      {/* Metrics */}
      <div className="space-y-3">
        {metrics.map((metric, index) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground font-inter">{metric.label}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg">{metric.value}</span>
              <span className="text-xs text-muted-foreground">{metric.unit}</span>
              {metric.trend !== undefined && (
                <span className={`
                  flex items-center text-xs
                  ${metric.trend > 0 ? 'text-battery' : ''}
                  ${metric.trend < 0 ? 'text-load' : ''}
                  ${metric.trend === 0 ? 'text-muted-foreground' : ''}
                `}>
                  {metric.trend > 0 && <TrendingUp className="w-3 h-3" />}
                  {metric.trend < 0 && <TrendingDown className="w-3 h-3" />}
                  {metric.trend === 0 && <Minus className="w-3 h-3" />}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Optional Animation Ring for Battery */}
      {type === 'battery' && metrics.find(m => m.label === 'SOC')?.charging && (
        <div className="mt-4 flex justify-center">
          <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-battery animate-pulse"
                strokeDasharray={`${(metrics.find(m => m.label === 'SOC')?.value || 0) * 1.76} 176`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-mono font-bold text-battery">
                {metrics.find(m => m.label === 'SOC')?.value}%
              </span>
            </div>
          </div>
        </div>
      )}
    </Link>
  );
};

export default MetricCard;
