import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const BASE_URL = import.meta.env.VITE_API_URL || 'https://backend-production-63370.up.railway.app';

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(null); // accesible desde fuera del ciclo React

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser  = localStorage.getItem('auth_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        tokenRef.current = savedToken;
        setUser(JSON.parse(savedUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback((accessToken, userData) => {
    setToken(accessToken);
    tokenRef.current = accessToken;
    setUser(userData);
    localStorage.setItem('auth_token', accessToken);
    localStorage.setItem('auth_user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    tokenRef.current = null;
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  const refreshToken = useCallback(async () => {
    const current = tokenRef.current;
    if (!current) throw new Error('No hay sesión activa');
    const res = await axios.post(`${BASE_URL}/auth/refresh`, null, {
      headers: { Authorization: `Bearer ${current}` },
    });
    const newToken = res.data.access_token;
    setToken(newToken);
    tokenRef.current = newToken;
    localStorage.setItem('auth_token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    return newToken;
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, login, logout, refreshToken,
      loading,
      isAuthenticated: !!token,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
