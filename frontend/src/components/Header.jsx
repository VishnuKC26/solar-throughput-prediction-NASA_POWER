import React from 'react';

export default function Header({ siteName }) {
  return (
    <header className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
      <div>
        <h3 className="text-2xl font-semibold">{siteName}</h3>
        <p className="text-sm text-slate-400">7-day forecast • actionable alerts</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-400">Timezone: IST</div>
        <button className="px-3 py-2 rounded bg-blue-600 text-white">New Forecast</button>
      </div>
    </header>
  );
}
