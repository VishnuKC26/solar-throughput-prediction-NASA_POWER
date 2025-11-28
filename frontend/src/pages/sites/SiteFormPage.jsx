import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createSite } from '../../api';

export default function SiteFormPage({ editMode }) {
  const [form, setForm] = useState({ name:'', latitude:'', longitude:'', panel_area_m2:10, efficiency:0.18, settings: { notify_email:'' }});
  const [err, setErr] = useState(null);
  const nav = useNavigate();
  const { id } = useParams();

  useEffect(()=> {
    if (editMode && id) {
      // fetch site details for edit (optional - implement when backend returns single site)
    }
  }, [editMode, id]);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    try {
      await createSite(form);
      nav('/sites');
    } catch (e) {
      setErr(e.message || 'Failed');
    }
  }

  return (
    <div className="p-6">
      <form onSubmit={submit} className="max-w-lg bg-slate-900/60 p-6 rounded">
        <h3 className="text-xl mb-4">{editMode ? 'Edit Site' : 'Add Site'}</h3>
        {err && <div className="bg-red-600 p-2 rounded mb-3">{err}</div>}
        <label className="block text-sm mb-1">Name</label>
        <input className="w-full mb-3 p-2 rounded bg-slate-800" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm">Latitude</label>
            <input className="w-full p-2 rounded bg-slate-800" value={form.latitude} onChange={e=>setForm({...form, latitude: parseFloat(e.target.value)})} />
          </div>
          <div>
            <label className="text-sm">Longitude</label>
            <input className="w-full p-2 rounded bg-slate-800" value={form.longitude} onChange={e=>setForm({...form, longitude: parseFloat(e.target.value)})} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <label className="text-sm">Panel area (m²)</label>
            <input className="w-full p-2 rounded bg-slate-800" value={form.panel_area_m2} onChange={e=>setForm({...form, panel_area_m2: parseFloat(e.target.value)})} />
          </div>
          <div>
            <label className="text-sm">Efficiency</label>
            <input className="w-full p-2 rounded bg-slate-800" value={form.efficiency} onChange={e=>setForm({...form, efficiency: parseFloat(e.target.value)})} />
          </div>
        </div>

        <label className="block text-sm mt-3">Notification email</label>
        <input className="w-full p-2 rounded bg-slate-800" value={form.settings.notify_email} onChange={e=>setForm({...form, settings: {...form.settings, notify_email: e.target.value}})} />

        <div className="mt-4 flex gap-2">
          <button className="px-3 py-2 bg-blue-600 rounded">{editMode ? 'Save' : 'Create'}</button>
          <button type="button" className="px-3 py-2 bg-white/5 rounded" onClick={()=>nav('/sites')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
