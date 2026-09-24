import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'indigo' | 'slate' | 'rose' | 'sage' | 'halloween';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('classqna_theme');
    if (saved && ['indigo', 'slate', 'rose', 'sage', 'halloween'].includes(saved)) {
      return saved as AppTheme;
    }
    return 'indigo';
  });

  const [isDark, setIsDarkState] = useState<boolean>(() => {
    const saved = localStorage.getItem('classqna_dark_mode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    localStorage.setItem('classqna_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('classqna_dark_mode', String(isDark));
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const setTheme = (t: AppTheme) => {
    setThemeState(t);
  };

  const setIsDark = (d: boolean) => {
    setIsDarkState(d);
  };

  const toggleDark = () => {
    setIsDarkState((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, setIsDark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
