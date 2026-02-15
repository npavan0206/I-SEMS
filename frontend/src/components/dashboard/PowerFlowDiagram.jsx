import { useEffect, useState, useRef } from 'react';

export const PowerFlowDiagram = ({ solar, battery, load, grid }) => {
  const [animationKey, setAnimationKey] = useState(0);
  
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [solar?.power, battery?.current, load?.power, grid?.power]);

  // Determine flow directions
  const solarToLoad = (solar?.power || 0) > 0;
  const solarToBattery = (solar?.power || 0) > (load?.power || 0) && (battery?.current || 0) > 0;
  const batteryToLoad = (battery?.current || 0) < 0;
  const gridToLoad = (grid?.power || 0) > 0 && (grid?.online ?? true);
  
  const flowColor = (active) => active ? 'stroke-primary' : 'stroke-muted/30';
  const nodeActiveClass = (active) => active ? 'fill-primary/20 stroke-primary' : 'fill-muted/10 stroke-muted/30';

  return (
    <div className="glass-card rounded-2xl p-6" data-testid="power-flow-diagram">
      <h3 className="font-rajdhani font-semibold text-lg mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Power Flow
      </h3>
      
      <div className="relative w-full aspect-[2/1] min-h-[200px]">
        <svg 
          key={animationKey}
          viewBox="0 0 400 200" 
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Definitions */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" className="text-primary" />
            </marker>
          </defs>

          {/* Nodes */}
          {/* Solar Node */}
          <g transform="translate(50, 50)">
            <circle 
              r="35" 
              className={nodeActiveClass(solarToLoad || solarToBattery)}
              strokeWidth="2"
              filter="url(#glow)"
            />
            <text x="0" y="-5" textAnchor="middle" className="fill-solar font-rajdhani font-bold text-sm">
              SOLAR
            </text>
            <text x="0" y="12" textAnchor="middle" className="fill-foreground font-mono text-xs">
              {(solar?.power || 0).toFixed(1)}W
            </text>
          </g>

          {/* Battery Node */}
          <g transform="translate(200, 150)">
            <circle 
              r="35" 
              className={nodeActiveClass(solarToBattery || batteryToLoad)}
              strokeWidth="2"
              filter="url(#glow)"
            />
            <text x="0" y="-5" textAnchor="middle" className="fill-battery font-rajdhani font-bold text-sm">
              BATTERY
            </text>
            <text x="0" y="12" textAnchor="middle" className="fill-foreground font-mono text-xs">
              {(battery?.soc || 0).toFixed(0)}%
            </text>
          </g>

          {/* Load Node */}
          <g transform="translate(200, 50)">
            <circle 
              r="35" 
              className={nodeActiveClass(solarToLoad || batteryToLoad || gridToLoad)}
              strokeWidth="2"
              filter="url(#glow)"
            />
            <text x="0" y="-5" textAnchor="middle" className="fill-load font-rajdhani font-bold text-sm">
              LOADS
            </text>
            <text x="0" y="12" textAnchor="middle" className="fill-foreground font-mono text-xs">
              {(load?.power || 0).toFixed(1)}W
            </text>
          </g>

          {/* Grid Node */}
          <g transform="translate(350, 50)">
            <circle 
              r="35" 
              className={nodeActiveClass(grid?.online ?? true)}
              strokeWidth="2"
              filter="url(#glow)"
            />
            <text x="0" y="-5" textAnchor="middle" className="fill-grid font-rajdhani font-bold text-sm">
              GRID
            </text>
            <text x="0" y="12" textAnchor="middle" className="fill-foreground font-mono text-xs">
              {(grid?.online ?? true) ? 'Online' : 'Offline'}
            </text>
          </g>

          {/* Flow Lines */}
          {/* Solar to Load */}
          <path
            d="M 85 50 L 165 50"
            fill="none"
            strokeWidth="3"
            className={`${flowColor(solarToLoad)} ${solarToLoad ? 'flow-active' : ''}`}
            markerEnd={solarToLoad ? "url(#arrowhead)" : ""}
          />

          {/* Solar to Battery */}
          <path
            d="M 70 85 Q 100 120 165 140"
            fill="none"
            strokeWidth="3"
            className={`${flowColor(solarToBattery)} ${solarToBattery ? 'flow-active' : ''}`}
            markerEnd={solarToBattery ? "url(#arrowhead)" : ""}
          />

          {/* Battery to Load */}
          <path
            d="M 200 115 L 200 85"
            fill="none"
            strokeWidth="3"
            className={`${flowColor(batteryToLoad)} ${batteryToLoad ? 'flow-active' : ''}`}
            markerEnd={batteryToLoad ? "url(#arrowhead)" : ""}
          />

          {/* Grid to Load */}
          <path
            d="M 315 50 L 235 50"
            fill="none"
            strokeWidth="3"
            className={`${flowColor(gridToLoad)} ${gridToLoad ? 'flow-active' : ''}`}
            markerEnd={gridToLoad ? "url(#arrowhead)" : ""}
          />
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-solar" />
          <span className="text-muted-foreground">Solar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-battery" />
          <span className="text-muted-foreground">Battery</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-load" />
          <span className="text-muted-foreground">Loads</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-grid" />
          <span className="text-muted-foreground">Grid</span>
        </div>
      </div>
    </div>
  );
};

export default PowerFlowDiagram;
