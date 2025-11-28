// frontend/src/components/EditSiteModal.jsx
import React, { useState } from 'react';

export default function EditSiteModal({ site, onClose, onSave }) {
  const [name, setName] = useState(site.name || '');
  const [latitude, setLatitude] = useState(String(site.latitude || ''));
  const [longitude, setLongitude] = useState(String(site.longitude || ''));
  const [area, setArea] = useState(String(site.panel_area_m2 || site.area || '1'));
  const [eff, setEff] = useState(String(site.efficiency || '0.18'));

  // alert fields
  const initialEmail = (Array.isArray(site.alert_recipients) && site.alert_recipients[0]) || site.user_email || '';
  const [alertEmail, setAlertEmail] = useState(initialEmail);
  const [alertsEnabled, setAlertsEnabled] = useState(Boolean(site.alerts_enabled));

  const [saving, setSaving] = useState(false);

  function isValidEmail(e) {
    return /\S+@\S+\.\S+/.test((e || '').trim());
  }

  async function save() {
    setSaving(true);
    try {
      if (alertEmail && !isValidEmail(alertEmail)) {
        alert('Enter a valid alert email or clear the field.');
        setSaving(false);
        return;
      }

      const updated = {
        ...site,
        name,
        latitude: Number(latitude),
        longitude: Number(longitude),
        panel_area_m2: Number(area),
        efficiency: Number(eff),
        // send alert_recipients as array (empty array if no email)
        alert_recipients: alertEmail ? [alertEmail.trim()] : [],
        alerts_enabled: !!alertsEnabled
      };

      await onSave(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-4 rounded w-full max-w-md">
        <h3 className="text-lg font-medium mb-2">Edit site</h3>
        <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-2 rounded bg-slate-900 mb-2" />

        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={latitude} onChange={e=>setLatitude(e.target.value)} className="p-2 rounded bg-slate-900" />
          <input value={longitude} onChange={e=>setLongitude(e.target.value)} className="p-2 rounded bg-slate-900" />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <input value={area} onChange={e=>setArea(e.target.value)} className="p-2 rounded bg-slate-900" />
          <input value={eff} onChange={e=>setEff(e.target.value)} className="p-2 rounded bg-slate-900" />
        </div>

        {/* Alert email + toggle */}
        <div className="mb-3">
          <label className="block text-sm text-slate-300 mb-1">Alert email (optional)</label>
          <input
            value={alertEmail}
            onChange={e=>setAlertEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full p-2 rounded bg-slate-900 mb-2"
            type="email"
          />
          <div className="flex items-center gap-2">
            <input
              id="edit-enable-alerts"
              type="checkbox"
              checked={alertsEnabled}
              onChange={e=>setAlertsEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="edit-enable-alerts" className="text-sm text-slate-300">Enable alerts for this site</label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 bg-slate-700 rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-3 py-1 bg-blue-600 rounded">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
