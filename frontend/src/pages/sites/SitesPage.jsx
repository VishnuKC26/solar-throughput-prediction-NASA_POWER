// frontend/src/pages/SitesPage.jsx
import React, { useEffect, useState } from 'react';
import { getSites, createSite, updateSite } from '../../api';
import AddSiteForm from '../../components/AddSiteForm';
import EditSiteModal from '../../components/EditSiteModal';

export default function SitesPage() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getSites();
      setSites(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('SitesPage load failed', e);
      setError(e?.body?.error || e.message || 'Failed to load sites');
      setSites([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onCreated(created) {
    // if API returned the created site, simply reload
    await load();
    // optionally select or scroll to it (not necessary)
  }

  async function onSaveEdit(updated) {
    try {
      await updateSite(updated._id || updated.id, updated);
      setEditing(null);
      await load();
      alert('Site updated');
    } catch (e) {
      console.error('Update site failed', e);
      alert('Update failed: ' + (e.body?.error || e.message));
    }
  }

  return (
    <div className="min-h-screen p-6 bg-slate-900 text-white">
      <h1 className="text-2xl font-bold mb-4">Sites</h1>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <AddSiteForm onCreated={onCreated} />
        </div>

        <div>
          <h2 className="text-lg font-medium mb-3">Your sites</h2>
          {loading && <div>Loading...</div>}
          {!loading && sites.length === 0 && <div className="text-slate-400">No sites created yet.</div>}
          <div className="space-y-3">
            {sites.map(s => {
              const id = s._id || s.id;
              return (
                <div key={id} className="p-3 bg-slate-800 rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-sm text-slate-400">{s.latitude}, {s.longitude}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditing(s)} className="px-3 py-1 bg-slate-700 rounded text-sm">Edit</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {editing && <EditSiteModal site={editing} onClose={() => setEditing(null)} onSave={onSaveEdit} />}
    </div>
  );
}
