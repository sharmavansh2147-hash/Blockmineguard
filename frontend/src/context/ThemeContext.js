import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

const THEME_STORAGE_KEY = 'bmg_theme_preference';

export function ThemeProvider({ children }) {
  // preference: 'dark' | 'light' | 'system'
  const [preference, setPreference] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        return saved;
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return 'dark'; // Default to dark for cybersecurity SOC platform
  });

  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Calculate the active resolved theme ('dark' or 'light')
  const resolvedTheme = preference === 'system' 
    ? (systemIsDark ? 'dark' : 'light') 
    : preference;

  // Apply data-theme attribute to <html> and <body>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    root.style.colorScheme = resolvedTheme;
    document.body.setAttribute('data-theme', resolvedTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [resolvedTheme, preference]);

  // Listen to OS prefers-color-scheme changes
  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      setSystemIsDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const changeTheme = useCallback((newPref) => {
    if (newPref === 'dark' || newPref === 'light' || newPref === 'system') {
      setPreference(newPref);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        preference,
        changeTheme,
        toggleTheme,
        isDark: resolvedTheme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
