// frontend/src/components/RunForecastButton.jsx
import React, { useState } from 'react';
import { triggerForecast } from '../api';

export default function RunForecastButton({ siteId, onSuccess }) {
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    try {
      const res = await triggerForecast(siteId);
      const forecast = res.forecast || res;
      if (typeof onSuccess === 'function') onSuccess(forecast);
      alert('Forecast completed.');
    } catch (e) {
      console.error('RunForecastButton error', e);
      alert('Forecast failed: ' + (e.body?.error || e.message));
    } finally { setLoading(false); }
  }
  return (
    <button onClick={run} disabled={loading || !siteId} className="px-3 py-1 bg-blue-600 rounded disabled:opacity-50">
      {loading ? 'Running...' : 'Run Forecast'}
    </button>
  );
}
