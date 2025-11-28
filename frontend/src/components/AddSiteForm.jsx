// frontend/src/components/AddSiteForm.jsx
import React, { useState } from 'react';
import { createSite } from '../api';

export default function AddSiteForm({ onCreated }) {
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [area, setArea] = useState('1');
  const [efficiency, setEfficiency] = useState('0.18');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  function isValidEmail(e) {
    return /\S+@\S+\.\S+/.test((e || '').trim());
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (alertEmail && !isValidEmail(alertEmail)) {
        throw new Error('Enter a valid alert email or leave empty.');
      }

      const payload = {
        name,
        latitude: Number(latitude),
        longitude: Number(longitude),
        panel_area_m2: Number(area),
        efficiency: Number(efficiency),
        // new alert fields
        alert_recipients: alertEmail ? [alertEmail.trim()] : [],
        alerts_enabled: !!alertsEnabled
      };

      const created = await createSite(payload);
      alert('Site added');
      // reset
      setName(''); setLatitude(''); setLongitude(''); setArea('1'); setEfficiency('0.18');
      setAlertEmail(''); setAlertsEnabled(false);
      if (onCreated) onCreated(created);
    } catch (err) {
      console.error('Add site failed', err);
      alert('Add site failed: ' + (err?.body?.error || err.message || String(err)));
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="bg-slate-800 p-4 rounded space-y-3">
      <h3 className="text-lg font-medium">Add site</h3>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="w-full p-2 rounded bg-slate-900" required/>
      <div className="grid grid-cols-2 gap-2">
        <input value={latitude} onChange={e=>setLatitude(e.target.value)} placeholder="Latitude" className="p-2 rounded bg-slate-900" required/>
        <input value={longitude} onChange={e=>setLongitude(e.target.value)} placeholder="Longitude" className="p-2 rounded bg-slate-900" required/>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={area} onChange={e=>setArea(e.target.value)} placeholder="Area m²" className="p-2 rounded bg-slate-900" type="number" step="0.1"/>
        <input value={efficiency} onChange={e=>setEfficiency(e.target.value)} placeholder="Efficiency" className="p-2 rounded bg-slate-900" type="number" step="0.01"/>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <label className="text-sm text-slate-300">Alert email (optional)</label>
        <input
          value={alertEmail}
          onChange={e=>setAlertEmail(e.target.value)}
          placeholder="name@example.com"
          className="p-2 rounded bg-slate-900"
          type="email"
        />
        <div className="flex items-center gap-2">
          <input
            id="enable-alerts"
            type="checkbox"
            checked={alertsEnabled}
            onChange={e=>setAlertsEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="enable-alerts" className="text-sm text-slate-300">Enable alerts for this site</label>
        </div>
      </div>

      <button type="submit" className="px-4 py-2 bg-green-600 rounded" disabled={loading}>
        {loading ? 'Adding...' : 'Add site'}
      </button>
    </form>
  );
}
