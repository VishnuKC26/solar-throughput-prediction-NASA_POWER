import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import SitesPage from './pages/sites/SitesPage';
import SiteFormPage from './pages/sites/SiteFormPage';
// // import AlertsPage from './pages/AlertsPage';
// import SettingsPage from './pages/SettingsPage';
// import AccountPage from './pages/AccountPage';

export default function App() {
  const { user, authLoaded, logout } = useAuth();

  if (!authLoaded) {
    return <div className="min-h-screen flex items-center justify-center">Initializing...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="bg-slate-800 border-b border-slate-700 p-3 flex items-center gap-4">
        <Link to="/" className="font-bold text-lg">SolarHQ</Link>
        <Link to="/sites" className="text-slate-300 hover:text-white">Sites</Link>
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <button onClick={logout} className="text-sm text-slate-200 px-3 py-1 border rounded hover:bg-slate-700">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-200 mr-3">Login</Link>
              <Link to="/signup" className="text-slate-200">Signup</Link>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />

        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/signup" element={user ? <Navigate to="/" /> : <SignupPage />} />

        <Route path="/sites" element={<ProtectedRoute><SitesPage /></ProtectedRoute>} />

        <Route path="/sites/:id/edit" element={<ProtectedRoute><SiteFormPage editMode /></ProtectedRoute>} />
        {/* <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} /> */}

        <Route path="*" element={<div className="p-6">Page not found</div>} />
      </Routes>
    </div>
  );
}
