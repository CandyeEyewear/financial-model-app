/**
 * Theme Toggle Component
 * Dark/Light mode toggle with system preference detection
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

// Theme Context
const ThemeContext = createContext(null);

/**
 * ThemeProvider - Wrap your app to enable theme switching
 * 
 * @example
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 */
export function ThemeProvider({ children, defaultTheme = 'system', storageKey = 'finsight-theme' }) {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored) return stored;
    }
    return defaultTheme;
  });

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark');
    
    // Determine actual theme
    let actualTheme = theme;
    if (theme === 'system') {
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    // Apply theme class
    root.classList.add(actualTheme);
    
    // Store preference
    localStorage.setItem(storageKey, theme);
  }, [theme, storageKey]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setThemeValue = useCallback((newTheme) => {
    setTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeValue, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme - Access theme context
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * ThemeToggle - Button to toggle between themes
 */
export function ThemeToggle({ className = '' }) {
  const { theme, setTheme, toggleTheme } = useTheme();
  
  const getIcon = () => {
    switch (theme) {
      case 'light': return Sun;
      case 'dark': return Moon;
      default: return Monitor;
    }
  };
  
  const getLabel = () => {
    switch (theme) {
      case 'light': return 'Light mode (click for dark)';
      case 'dark': return 'Dark mode (click for system)';
      default: return 'System theme (click for light)';
    }
  };
  
  const Icon = getIcon();
  
  return (
    <button
      onClick={toggleTheme}
      className={`
        p-2 rounded-button
        text-neutral-600 dark:text-neutral-400
        hover:text-neutral-900 dark:hover:text-neutral-100
        hover:bg-neutral-100 dark:hover:bg-neutral-700
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
        transition-colors duration-fast
        ${className}
      `}
      aria-label={getLabel()}
      title={getLabel()}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

/**
 * ThemeSelect - Dropdown to select theme
 */
export function ThemeSelect({ className = '' }) {
  const { theme, setTheme } = useTheme();
  
  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];
  
  return (
    <div className={`flex gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-card ${className}`}>
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;
        
        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={`
              flex items-center gap-1.5
              px-3 py-1.5
              text-sm font-medium
              rounded-button
              transition-all duration-fast
              ${isActive
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }
            `}
            aria-pressed={isActive}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeProvider;
