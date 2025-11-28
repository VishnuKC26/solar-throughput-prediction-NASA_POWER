import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (err) {
        console.error('Login response not JSON:', text);
        throw new Error('Invalid server response (not JSON). Check backend.');
      }

      if (!res.ok) {
        console.error('Login failed', res.status, data);
        throw new Error(data?.error || `Login failed (${res.status})`);
      }

      if (!data || !data.token) {
        console.error('Login returned no token', data);
        throw new Error('No token returned');
      }

      login({ token: data.token, user: data.user || { email } });
    } catch (err) {
      console.error('Login error', err);
      alert(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-slate-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Login</h2>
        <label className="block mb-2 text-sm">Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" className="w-full p-2 mb-3 rounded bg-slate-900" required />
        <label className="block mb-2 text-sm">Password</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" className="w-full p-2 mb-4 rounded bg-slate-900" required />
        <div className="flex items-center justify-between">
          <button className="px-4 py-2 bg-blue-600 rounded" disabled={loading}>{loading ? 'Logging in…' : 'Login'}</button>
        </div>
      </form>
    </div>
  );
}
