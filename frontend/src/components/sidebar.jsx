// Sidebar.jsx (safe version)
import React from 'react';

export default function Sidebar({ sites }) {
  // Normalize to array so map is always safe
  const list = Array.isArray(sites) ? sites : [];

  if (!list.length) {
    return (
      <aside className="p-4">
        <h3 className="text-lg font-semibold">Sites</h3>
        <div className="text-sm text-slate-400 mt-2">No sites yet — add one or wait for data to load.</div>
      </aside>
    );
  }

  return (
    <aside className="p-4">
      <h3 className="text-lg font-semibold">Sites</h3>
      <ul className="mt-3 space-y-2">
        {list
          // remove any totally invalid items
          .filter(s => s && (s.avg_kwh !== undefined || s.name))
          .map((s, idx) => {
            // defensive extraction — adjust to your actual shape (maybe s.stats.avg_kwh etc)
            const name = s.name || `Site ${idx + 1}`;
            const avg = (s.avg_kwh ?? s.stats?.avg_kwh ?? 0); // fallback chain
            const avgNum = Number(avg) || 0;

            return (
              <li key={s._id ?? idx} className="flex items-center justify-between p-2 bg-slate-800 rounded">
                <div>
                  <div className="text-sm font-medium">{name}</div>
                  <div className="text-xs text-slate-400">Avg: {avgNum.toFixed(2)} kWh</div>
                </div>
                <div className="text-sm text-slate-300">{/* any other meta */}</div>
              </li>
            );
          })}
      </ul>
    </aside>
  );
}
