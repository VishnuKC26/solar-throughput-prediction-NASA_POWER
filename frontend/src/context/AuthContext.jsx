import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [authLoaded, setAuthLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const t = localStorage.getItem('token');
      const u = localStorage.getItem('user');
      if (t) setToken(t);
      if (u) setUser(JSON.parse(u));
    } catch (e) {
      console.error('Auth init error', e);
    } finally {
      setAuthLoaded(true);
    }
  }, []);

  const login = ({ token: newToken, user: newUser } = {}) => {
    try {
      if (newToken) {
        localStorage.setItem('token', newToken);
        setToken(newToken);
      }
      if (newUser) {
        localStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
      }
      navigate('/');
    } catch (e) {
      console.error('login error', e);
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      navigate('/login');
    } catch (e) {
      console.error('logout error', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, authLoaded, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
