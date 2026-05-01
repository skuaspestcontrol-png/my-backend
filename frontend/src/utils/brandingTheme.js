export const accentPalette = {
  '#3B82F6': { primary: '#3B82F6', dark: '#1D4ED8', deep: '#1E3A8A', light: '#EFF6FF', soft: '#DBEAFE' },
  '#22C55E': { primary: '#22C55E', dark: '#15803D', deep: '#166534', light: '#F0FDF4', soft: '#DCFCE7' },
  '#EF4444': { primary: '#EF4444', dark: '#B91C1C', deep: '#991B1B', light: '#FEF2F2', soft: '#FEE2E2' },
  '#F59E0B': { primary: '#F59E0B', dark: '#B45309', deep: '#92400E', light: '#FFFBEB', soft: '#FEF3C7' },
  '#9F174D': { primary: '#9F174D', dark: '#831843', deep: '#701A3D', light: '#FDF2F8', soft: '#FCE7F3' }
};

const normalizeHex = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '#9F174D';
  if (/^#[0-9A-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9A-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#9F174D';
};

const hexToRgb = (hex) => {
  const safe = normalizeHex(hex);
  const n = parseInt(safe.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

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
  const accent = normalizeHex(settings.brandingAccentColor || '#9F174D');
  const palette = accentPalette[accent] || derivePaletteFromAccent(accent);
  const neutralLight = '#F3F4F6';
  const neutralSoft = '#E5E7EB';
  root.style.setProperty('--color-primary', palette.primary);
  root.style.setProperty('--color-primary-dark', palette.dark);
  root.style.setProperty('--color-primary-deep', palette.deep);
  root.style.setProperty('--color-primary-light', neutralLight);
  root.style.setProperty('--color-primary-soft', neutralSoft);

  const appearance = String(settings.brandingAppearance || 'light').toLowerCase();
  if (appearance === 'dark') {
    root.style.setProperty('--color-bg', '#0F172A');
    root.style.setProperty('--color-text', '#E5E7EB');
    root.style.setProperty('--color-muted', '#94A3B8');
    root.style.setProperty('--color-border', '#334155');
    root.style.setProperty('--color-white', '#111827');
  } else {
    root.style.setProperty('--color-bg', '#F8FAFC');
    root.style.setProperty('--color-text', '#111827');
    root.style.setProperty('--color-muted', '#6B7280');
    root.style.setProperty('--color-border', '#E5E7EB');
    root.style.setProperty('--color-white', '#FFFFFF');
  }
};

export const BRANDING_STORAGE_KEY = 'skuas_branding_settings';

export const pickBrandingSettings = (settings = {}) => ({
  brandingAppearance: String(settings.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light',
  brandingAccentColor: normalizeHex(settings.brandingAccentColor || '#9F174D')
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
