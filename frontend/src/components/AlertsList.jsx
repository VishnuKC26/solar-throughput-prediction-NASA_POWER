import React from 'react';

function Badge({ type }) {
  const cls = type === 'low' ? 'bg-red-600' : type === 'opportunity' ? 'bg-green-600' : 'bg-yellow-600';
  return <span className={`${cls} text-xs text-white px-2 py-0.5 rounded-full`}>{type}</span>;
}

export default function AlertsList({ alerts = [] }) {
  if (!alerts.length) {
    return <div className="text-slate-400">No active alerts</div>;
  }
  return (
    <div className="space-y-3">
      {alerts.map(a => (
        <div key={a.id} className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge type={a.type} />
              <div className="font-medium">{a.title}</div>
            </div>
            <div className="text-xs text-slate-400 mt-1">{a.details}</div>
          </div>
          <div className="text-xs text-slate-500">{new Date(a.date).toLocaleDateString()}</div>
        </div>
      ))}
    </div>
  );
}
