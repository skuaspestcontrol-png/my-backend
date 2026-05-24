export const accentPalette = {
  '#3B82F6': { primary: '#3B82F6', dark: '#1D4ED8', deep: '#1E3A8A', light: '#EFF6FF', soft: '#DBEAFE' },
  '#22C55E': { primary: '#22C55E', dark: '#15803D', deep: '#166534', light: '#F0FDF4', soft: '#DCFCE7' },
  '#EF4444': { primary: '#EF4444', dark: '#B91C1C', deep: '#991B1B', light: '#FEF2F2', soft: '#FEE2E2' },
  '#F59E0B': { primary: '#F59E0B', dark: '#B45309', deep: '#92400E', light: '#FFFBEB', soft: '#FEF3C7' },
  '#EF4444': { primary: '#EF4444', dark: '#DC2626', deep: '#B91C1C', light: '#FEF2F2', soft: '#FEE2E2' }
};

const normalizeHex = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '#EF4444';
  if (/^#[0-9A-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9A-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#EF4444';
};

const hexToRgb = (hex) => {
  const safe = normalizeHex(hex);
  const n = parseInt(safe.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const brandBorderFromAccent = (hex, alpha = 0.24) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const APP_THEME_STORAGE_KEY = 'skuas_portal_theme_preference';

const rgbToHex = ({ r, g, b }) => {
  const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const mixRgb = (a, b, ratio) => ({
  r: a.r + (b.r - a.r) * ratio,
  g: a.g + (b.g - a.g) * ratio,
  b: a.b + (b.b - a.b) * ratio
});

const derivePaletteFromAccent = (accent) => {
  const primaryHex = normalizeHex(accent);
  const primary = hexToRgb(primaryHex);
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };

  return {
    primary: primaryHex,
    dark: rgbToHex(mixRgb(primary, black, 0.18)),
    deep: rgbToHex(mixRgb(primary, black, 0.32)),
    light: rgbToHex(mixRgb(primary, white, 0.9)),
    soft: rgbToHex(mixRgb(primary, white, 0.82))
  };
};

export const applyBrandingTheme = (settings = {}) => {
  const root = document.documentElement;
  const accent = normalizeHex(settings.brandingAccentColor || '#EF4444');
  const palette = accentPalette[accent] || derivePaletteFromAccent(accent);
  const appearance = String(settings.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light';
  const isDark = appearance === 'dark';
  const neutralLight = isDark ? '#18181B' : '#F3F4F6';
  const neutralSoft = isDark ? '#27272A' : '#E5E7EB';
  root.style.setProperty('--color-primary', palette.primary);
  root.style.setProperty('--color-primary-dark', palette.dark);
  root.style.setProperty('--color-primary-deep', palette.deep);
  root.style.setProperty('--color-primary-light', neutralLight);
  root.style.setProperty('--color-primary-soft', neutralSoft);
  root.style.setProperty('--brand-border-color', isDark ? 'rgba(255, 255, 255, 0.10)' : brandBorderFromAccent(palette.primary));
  root.style.setProperty('--color-bg', isDark ? '#09090B' : '#F8FAFC');
  root.style.setProperty('--color-text', isDark ? '#F5F5F5' : '#111827');
  root.style.setProperty('--color-muted', isDark ? '#A1A1AA' : '#6B7280');
  root.style.setProperty('--color-border', 'var(--brand-border-color)');
  root.style.setProperty('--color-white', isDark ? '#111214' : '#FFFFFF');
  root.style.setProperty('--shadow-sm', isDark ? '0 1px 2px rgba(0, 0, 0, 0.38)' : '0 1px 2px rgba(15, 23, 42, 0.06)');
  root.style.setProperty('--shadow-md', isDark ? '0 10px 28px rgba(0, 0, 0, 0.40)' : '0 8px 24px rgba(15, 23, 42, 0.08)');
  root.style.setProperty('--shadow-lg', isDark ? '0 16px 38px rgba(0, 0, 0, 0.48)' : '0 12px 32px rgba(239, 68, 68, 0.12)');
  root.style.setProperty('--bg', isDark ? '#09090B' : '#F8FAFC');
  root.style.setProperty('--bg-soft', isDark ? '#111214' : '#F3F4F6');
  root.style.setProperty('--panel', isDark ? '#111214' : '#FFFFFF');
  root.style.setProperty('--panel-strong', isDark ? '#17181B' : '#FFFFFF');
  root.style.setProperty('--panel-dark', isDark ? '#0A0A0B' : palette.deep);
  root.style.setProperty('--border', 'var(--brand-border-color)');
  root.style.setProperty('--border-strong', 'var(--brand-border-color)');
  root.style.setProperty('--sky-soft', isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(159, 23, 77, 0.12)');
  root.dataset.theme = appearance;
  if (root.ownerDocument?.body) {
    root.ownerDocument.body.dataset.theme = appearance;
  }
};

export const BRANDING_STORAGE_KEY = 'skuas_branding_settings';

export const pickBrandingSettings = (settings = {}) => ({
  brandingAppearance: String(settings.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light',
  brandingAccentColor: normalizeHex(settings.brandingAccentColor || '#EF4444'),
  companyName: String(settings.companyName || '').trim(),
  dashboardImageUrl: String(settings.dashboardImageUrl || '').trim()
});

export const saveBrandingSettings = (settings = {}) => {
  try {
    const safe = pickBrandingSettings(settings);
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(safe));
  } catch (_error) {
    // Ignore localStorage errors in private mode / restricted environments.
  }
};

export const loadBrandingSettings = () => {
  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return null;
    return pickBrandingSettings(JSON.parse(raw));
  } catch (_error) {
    return null;
  }
};

export const loadPortalThemePreference = () => {
  try {
    const raw = localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (!raw) return null;
    const value = String(raw || '').trim().toLowerCase();
    return value === 'dark' ? 'dark' : value === 'light' ? 'light' : null;
  } catch (_error) {
    return null;
  }
};

export const savePortalThemePreference = (appearance) => {
  try {
    const value = String(appearance || '').trim().toLowerCase() === 'dark' ? 'dark' : 'light';
    localStorage.setItem(APP_THEME_STORAGE_KEY, value);
  } catch (_error) {
    // Ignore localStorage errors in private mode / restricted environments.
  }
};
