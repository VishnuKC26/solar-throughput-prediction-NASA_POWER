import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const nav = useNavigate();
  const { login } = useAuth();

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }

      if (!res.ok) {
        const message = (data && data.error) ? data.error : `Signup failed (${res.status})`;
        throw new Error(message);
      }

      if (data && data.token) {
        login({ token: data.token, user: data.user || { email } });
      } else {
        localStorage.setItem('token', data.token || '');
        nav('/');
      }
    } catch (e) {
      console.error('Signup error', e);
      setErr(e.message || 'Signup failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md bg-slate-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Create account</h2>
        {err && <div className="bg-red-600 text-white p-2 rounded mb-3">{err}</div>}
        <label className="block mb-2 text-sm">Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" className="w-full p-2 mb-3 rounded bg-slate-900" />
        <label className="block mb-2 text-sm">Password</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="new-password" className="w-full p-2 mb-4 rounded bg-slate-900" />
        <div className="flex justify-between items-center">
          <button className="px-4 py-2 bg-blue-600 rounded">Sign up</button>
          <button type="button" onClick={()=>{ nav('/login'); }} className="text-slate-300">Already have an account?</button>
        </div>
      </form>
    </div>
  );
}
