import { useEffect, useState } from 'react';
import { useUserPreferences } from '../context/UserPreferencesContext.jsx';

// Local storage is the instant, pre-network source (avoids a flash of the
// wrong theme before the user_preferences round-trip resolves). Once real
// preferences load, they win — that's what makes theme follow you cross-device.
export function useTheme() {
  const { preferences, loading, updatePreferences } = useUserPreferences();
  const [theme, setThemeState] = useState(() => localStorage.getItem('grainline_theme') || 'light');

  // Every call site holds its own copy of `theme`, so they have to stay in step
  // through the one thing they share: preferences. This used to run once behind
  // a `reconciled` ref, which meant a later change was never picked up — switch
  // the theme in Settings and the sidebar's sun/moon button kept the old icon,
  // because its local state was never told. Syncing on every change costs
  // nothing (the value is usually identical) and keeps the two honest.
  useEffect(() => {
    if (loading) return;
    if (preferences.theme && preferences.theme !== theme) setThemeState(preferences.theme);
  }, [loading, preferences.theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('grainline_theme', theme);
  }, [theme]);

  const setTheme = (next) => {
    setThemeState(next);
    updatePreferences({ theme: next });
  };
  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return { theme, isDark: theme === 'dark', toggle, setTheme };
}
