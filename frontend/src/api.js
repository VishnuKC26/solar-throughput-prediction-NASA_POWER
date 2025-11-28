// frontend/src/api.js
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('token') || null;
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
// src/api.js
export async function sendAlerts(siteId, forecast, recipients) {
  const resp = await fetch(`/api/sites/${siteId}/send-alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipients,
      subject: `Solar forecast for ${siteId}`,
      forecast,
      extraText: `Forecast generated on ${new Date().toLocaleString()}`,
      unsubscribeUrl: `https://your-site.example.com/unsubscribe?site=${siteId}`
    })
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error || 'send failed');
  return json;
}

async function handleRes(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    const err = new Error('Invalid JSON from server');
    err.raw = text;
    err.status = res.status;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

/** Auth */
export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await handleRes(res);
  if (data?.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
}

export async function signup(email, password, name) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });
  const data = await handleRes(res);
  if (data?.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
}

/** Sites */
export async function getSites() {
  const res = await fetch(`${API_BASE}/api/sites`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    }
  });
  return handleRes(res);
}

export async function getSite(siteId) {
  const res = await fetch(`${API_BASE}/api/sites/${siteId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    }
  });
  return handleRes(res);
}

export async function createSite(payload) {
  const res = await fetch(`${API_BASE}/api/sites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify(payload)
  });
  return handleRes(res);
}

export async function updateSite(siteId, payload) {
  const res = await fetch(`${API_BASE}/api/sites/${siteId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify(payload)
  });
  return handleRes(res);
}

export async function deleteSite(siteId) {
  const res = await fetch(`${API_BASE}/api/sites/${siteId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    }
  });
  return handleRes(res);
}

/** Forecast */
export async function triggerForecast(siteId) {
  const res = await fetch(`${API_BASE}/api/sites/${siteId}/forecast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
  });
  return handleRes(res);
}

/** Utility: logout */
export function logout() {
  localStorage.removeItem('token');
}

export default {
  login,
  signup,
  getSites,
  getSite,
  createSite,
  updateSite,
  deleteSite,
  triggerForecast,
  logout
};