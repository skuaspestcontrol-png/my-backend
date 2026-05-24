const DEFAULT_ACCENT = '#EF4444';

const normalizeHex = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return DEFAULT_ACCENT;
  if (/^#[0-9A-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9A-F]{3}$/.test(raw)) {
    const [r, g, b] = raw.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return DEFAULT_ACCENT;
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

const rgbToString = ({ r, g, b }) => `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;

const rgbaFromRgb = (rgb, alpha) => `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${alpha})`;

const mixRgb = (a, b, ratio) => ({
  r: a.r + (b.r - a.r) * ratio,
  g: a.g + (b.g - a.g) * ratio,
  b: a.b + (b.b - a.b) * ratio
});

const derivePaletteFromAccent = (accent) => {
  const primaryHex = normalizeHex(accent);
  const primary = hexToRgb(primaryHex);
  const black = { r: 17, g: 24, b: 39 };
  const white = { r: 255, g: 255, b: 255 };

  return {
    primary: primaryHex,
    dark: rgbToHex(mixRgb(primary, black, 0.18)),
    deep: rgbToHex(mixRgb(primary, black, 0.32)),
    light: rgbToHex(mixRgb(primary, white, 0.9)),
    soft: rgbToHex(mixRgb(primary, white, 0.82)),
    rgb: rgbToString(primary)
  };
};

const applyPalette = (root, palette, appearance) => {
  const isDark = appearance === 'dark';
  const surface = isDark ? '#111827' : '#FFFFFF';
  const surfaceElevated = isDark ? '#0F172A' : '#FFFFFF';
  const surfaceSoft = isDark ? '#1E293B' : '#F8FAFC';
  const surfaceMuted = isDark ? '#0B1220' : '#F1F5F9';
  const appBg = isDark ? '#020617' : '#F8FAFC';
  const appBgAlt = isDark ? '#0F172A' : '#EEF2FF';
  const text = isDark ? '#E5E7EB' : '#111827';
  const muted = isDark ? '#94A3B8' : '#6B7280';
  const border = isDark ? `rgba(148, 163, 184, 0.18)` : rgbaFromRgb(hexToRgb(palette.primary), 0.22);
  const borderSoft = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.16)';
  const sidebarBg = isDark ? 'rgba(15, 23, 42, 0.84)' : 'rgba(255, 255, 255, 0.88)';
  const sidebarBorder = isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(226, 232, 240, 0.92)';
  const topbarBg = isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.84)';
  const panelBg = isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.92)';
  const panelBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(226, 232, 240, 0.84)';
  const panelGlow = isDark
    ? `0 22px 60px rgba(2, 6, 23, 0.38), 0 0 0 1px rgb(${palette.rgb} / 0.18)`
    : `0 22px 60px rgba(15, 23, 42, 0.12), 0 0 0 1px rgb(${palette.rgb} / 0.1)`;

  root.dataset.brandingAppearance = appearance;
  root.style.setProperty('--color-primary', palette.primary);
  root.style.setProperty('--color-primary-dark', palette.dark);
  root.style.setProperty('--color-primary-deep', palette.deep);
  root.style.setProperty('--color-primary-light', palette.light);
  root.style.setProperty('--color-primary-soft', palette.soft);
  root.style.setProperty('--color-primary-rgb', palette.rgb);
  root.style.setProperty('--brand-border-color', border);
  root.style.setProperty('--color-bg', appBg);
  root.style.setProperty('--color-bg-alt', appBgAlt);
  root.style.setProperty('--color-text', text);
  root.style.setProperty('--color-muted', muted);
  root.style.setProperty('--color-border', border);
  root.style.setProperty('--color-border-soft', borderSoft);
  root.style.setProperty('--color-surface', surface);
  root.style.setProperty('--color-surface-elevated', surfaceElevated);
  root.style.setProperty('--color-surface-soft', surfaceSoft);
  root.style.setProperty('--color-surface-muted', surfaceMuted);
  root.style.setProperty('--color-panel', surfaceElevated);
  root.style.setProperty('--color-panel-border', panelBorder);
  root.style.setProperty('--color-panel-glow', panelGlow);
  root.style.setProperty('--color-sidebar-bg', sidebarBg);
  root.style.setProperty('--color-sidebar-border', sidebarBorder);
  root.style.setProperty('--color-topbar-bg', topbarBg);
  root.style.setProperty('--color-overlay', isDark ? 'rgba(2, 6, 23, 0.6)' : 'rgba(15, 23, 42, 0.45)');
  root.style.setProperty('--color-on-primary', '#FFFFFF');
  root.style.setProperty('--color-white', surface);
  root.style.setProperty('--color-card-shadow', panelGlow);
};

export const applyBrandingTheme = (settings = {}) => {
  const root = document.documentElement;
  const accent = normalizeHex(settings.brandingAccentColor || DEFAULT_ACCENT);
  const palette = derivePaletteFromAccent(accent);
  const appearance = String(settings.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light';

  applyPalette(root, palette, appearance);
};

export const BRANDING_STORAGE_KEY = 'skuas_branding_settings';

export const pickBrandingSettings = (settings = {}) => ({
  brandingAppearance: String(settings.brandingAppearance || 'light').toLowerCase() === 'dark' ? 'dark' : 'light',
  brandingAccentColor: normalizeHex(settings.brandingAccentColor || DEFAULT_ACCENT),
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

export { normalizeHex };
