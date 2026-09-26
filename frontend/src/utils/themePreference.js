export const PORTAL_THEME_STORAGE_KEY = 'skuas-theme';

export const normalizePortalTheme = (value) => (String(value || '').toLowerCase() === 'dark' ? 'dark' : 'light');

export const loadPortalTheme = () => {
  try {
    const stored = localStorage.getItem(PORTAL_THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'light';
  } catch (_error) {
    return 'light';
  }
};

export const applyPortalTheme = (theme) => {
  if (typeof document === 'undefined') return 'light';
  const normalized = normalizePortalTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = normalized;
  root.style.colorScheme = normalized;

  if (normalized === 'dark') {
    root.style.setProperty('--color-bg', '#0b1024');
    root.style.setProperty('--color-text', '#f8fafc');
    root.style.setProperty('--color-muted', '#a8b3c7');
    root.style.setProperty('--color-border', 'rgba(148, 163, 184, 0.22)');
    root.style.setProperty('--color-white', '#151a33');
  } else {
    root.style.setProperty('--color-bg', '#f3f4f8');
    root.style.setProperty('--color-text', '#111827');
    root.style.setProperty('--color-muted', '#6b7280');
    root.style.setProperty('--color-border', 'var(--brand-border-color)');
    root.style.setProperty('--color-white', '#ffffff');
  }

  return normalized;
};

export const savePortalTheme = (theme) => {
  const normalized = applyPortalTheme(theme);
  try {
    localStorage.setItem(PORTAL_THEME_STORAGE_KEY, normalized);
  } catch (_error) {
    // Ignore localStorage write failures in restricted browsing modes.
  }
  return normalized;
};

export const initializePortalTheme = () => applyPortalTheme(loadPortalTheme());
