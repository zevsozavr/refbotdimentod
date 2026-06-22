import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../axios';

const AppContext = createContext(null);

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const isAdmin = user?.is_admin === true;

  return (
    <AppContext.Provider value={{ user, setUser, loading, setLoading, theme, toggleTheme, isAdmin }}>
      {children}
    </AppContext.Provider>
  );
};
