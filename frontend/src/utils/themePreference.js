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
    root.style.setProperty('--color-bg', '#0B1220');
    root.style.setProperty('--color-text', '#f8fafc');
    root.style.setProperty('--color-muted', '#AAB8CF');
    root.style.setProperty('--color-border', '#30415D');
    root.style.setProperty('--color-white', '#17243B');
  } else {
    root.style.setProperty('--color-bg', '#F4F6FB');
    root.style.setProperty('--color-text', '#172033');
    root.style.setProperty('--color-muted', '#64748B');
    root.style.setProperty('--color-border', '#E2E8F0');
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
