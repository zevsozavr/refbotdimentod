import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext(null);

export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [initKey, setInitKey] = useState(0);
  const [lightweightAnimations, setLightweightAnimations] = useState(
    () => localStorage.getItem('lightweightAnimations') === 'true'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const toggleLightweightAnimations = useCallback(() => {
    setLightweightAnimations(prev => {
      const next = !prev;
      localStorage.setItem('lightweightAnimations', String(next));
      return next;
    });
  }, []);

  const triggerInit = useCallback(() => {
    setInitKey((k) => k + 1);
  }, []);

  const isAdmin = user?.is_admin === true;

  return (
    <AppContext.Provider value={{
      user, setUser, loading, setLoading, theme, toggleTheme, isAdmin, initKey, triggerInit,
      lightweightAnimations, toggleLightweightAnimations,
    }}>
      {children}
    </AppContext.Provider>
  );
};
