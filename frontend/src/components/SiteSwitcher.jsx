// frontend/src/components/SiteSwitcher.jsx
import React from 'react';

export default function SiteSwitcher({ sites = [], selectedSiteId, onChange }) {
  return (
    <div className="inline-block">
      <label className="block text-sm text-slate-300 mb-1">Selected site</label>
      <select
        value={selectedSiteId || ''}
        onChange={e => {
          const id = e.target.value;
          const site = sites.find(s => (s._id || s.id) === id);
          if (typeof onChange === 'function') onChange(site || null);
        }}
        className="p-2 rounded bg-slate-800"
      >
        <option value="">-- choose site --</option>
        {sites.map(s => (
          <option key={s._id || s.id} value={s._id || s.id}>
            {s.name || `Site ${s._id?.slice?.(0,6) || s.id}`}
          </option>
        ))}
      </select>
    </div>
  );
}
