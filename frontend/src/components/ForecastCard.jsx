import React from 'react';

/**
 * Small inline SVG sparkline + 7-day list
 * props.forecast = [{day, pred}, ...]
 */
function Sparkline({ data = [], width = 300, height = 80 }) {
  if (!data.length) return null;
  const values = data.map(d => d.pred);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const len = values.length;
  const stepX = width / (len - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = (1 - (v - min) / (max - min || 1)) * height;
    return `${x},${y}`;
  }).join(' ');
  const areaPath = `M0,${height} L${points} L${width},${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <defs>
        <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.05"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#g1)" />
      <polyline points={points} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => {
        const x = i * stepX;
        const y = (1 - (v - min) / (max - min || 1)) * height;
        return <circle key={i} cx={x} cy={y} r={3} fill="#fff" opacity="0.9" />;
      })}
    </svg>
  );
}

export default function ForecastCard({ forecast = [] }) {
  const total = forecast.reduce((s, d) => s + d.pred, 0);
  const avg = (total / (forecast.length || 1)).toFixed(1);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-400">7-day production (kWh)</div>
          <div className="text-lg font-semibold mt-1">{avg} kWh avg</div>
        </div>
        <div className="text-right text-sm text-slate-400">Total: {total.toFixed(1)} kWh</div>
      </div>

      <div className="mt-4">
        <Sparkline data={forecast} />
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-xs text-slate-300">
        {forecast.map((d, i) => (
          <div key={i} className="p-2 bg-slate-900/40 rounded text-center">
            <div className="font-semibold">{d.pred}</div>
            <div className="text-slate-400">{new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
