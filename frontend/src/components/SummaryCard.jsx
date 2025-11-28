import React from 'react';

export default function SummaryCard({ title, value, unit, hint }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl shadow-sm min-w-[160px]">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value} <span className="text-sm text-slate-400">{unit}</span></div>
      {hint && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
