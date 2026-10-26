import { applyPortalTheme, loadPortalTheme } from './themePreference.js';

export const accentPalette = {
  '#3B82F6': { primary: '#3B82F6', dark: '#1D4ED8', deep: '#1E3A8A', light: '#EFF6FF', soft: '#DBEAFE' },
  '#22C55E': { primary: '#22C55E', dark: '#15803D', deep: '#166534', light: '#F0FDF4', soft: '#DCFCE7' },
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

// Use actual contrast, rather than brightness, for arbitrary customer-selected colours.
const luminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const linear = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};

export const brandingContrast = (foreground, background) => {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

export const brandingTextColor = (background) => (
  brandingContrast('#FFFFFF', background) >= brandingContrast('#000000', background) ? '#FFFFFF' : '#000000'
);

const readableAccent = (accent, background, endpoint) => {
  for (let step = 0; step <= 20; step += 1) {
    const candidate = rgbToHex(mixRgb(hexToRgb(accent), hexToRgb(endpoint), step / 20));
    if ([background].flat().every((surface) => brandingContrast(candidate, surface) >= 4.5)) return candidate;
  }
  return endpoint;
};

export const getBrandingTokens = (settings = {}) => {
  const accent = normalizeHex(settings.brandingAccentColor || '#EF4444');
  const palette = accentPalette[accent] || derivePaletteFromAccent(accent);
  const text = brandingTextColor(accent);
  const softDark = rgbToHex(mixRgb(hexToRgb('#151A33'), hexToRgb(accent), 0.22));
  return {
    '--color-primary': accent,
    '--color-primary-dark': palette.dark,
    '--color-primary-deep': palette.deep,
    '--brand-on-primary': text,
    '--brand-on-hover': brandingTextColor(palette.dark),
    '--brand-soft-light': palette.light,
    '--brand-soft-dark': softDark,
    '--brand-ink-light': readableAccent(accent, [palette.light, '#FFFFFF'], '#000000'),
    '--brand-ink-dark': readableAccent(accent, [softDark, '#151A33'], '#FFFFFF'),
    '--color-primary-light': 'var(--brand-soft)',
    '--color-primary-soft': 'var(--brand-soft)',
    '--brand-border-color': brandBorderFromAccent(accent),
    '--brand-border-light': brandBorderFromAccent(accent, 0.3),
    '--brand-border-dark': brandBorderFromAccent(readableAccent(accent, [softDark, '#151A33'], '#FFFFFF'), 0.38),
    '--border': 'var(--brand-outline)',
    '--border-color': 'var(--brand-outline)',
    '--border-soft': 'var(--brand-outline)',
    '--input-border': 'var(--brand-outline)',
    '--card-border': 'var(--brand-outline)',
    '--focus-ring': brandBorderFromAccent(accent, 0.3),
    '--selected-bg': 'var(--brand-soft)',
    '--sky-soft': 'var(--brand-soft)',
    '--brand-header-bg': accent,
    '--brand-header-text': text,
    '--brand-logo-filter': text === '#000000' ? 'brightness(0)' : 'none',
    '--skuas-header': accent,
    '--skuas-header-secondary': accent,
    '--skuas-header-hover': palette.dark,
    '--card-header-bg': 'var(--brand-header-bg)',
    '--card-header-text': 'var(--brand-header-text)',
    '--table-header-bg': 'var(--brand-header-bg)',
    '--table-header-text': 'var(--brand-header-text)',
    '--table-footer-bg': 'var(--brand-header-bg)',
    '--table-footer-text': 'var(--brand-header-text)'
  };
};

export const applyBrandingTheme = (settings = {}) => {
  const root = document.documentElement;
  root.dataset.branding = 'true';
  Object.entries(getBrandingTokens(settings)).forEach(([key, value]) => root.style.setProperty(key, value));

  // Branding changes colours; the user's existing portal theme owns surfaces.
  applyPortalTheme(loadPortalTheme());
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
