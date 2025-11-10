const HEX_PATTERN = /^[0-9a-f]{6}$/i;

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type SurfaceTheme = {
  background: string;
  foreground: string;
  muted: string;
  border: string;
  subtle: string;
  surface: string;
  hover: string;
};

const DEFAULT_BASE_COLOR = '#0ea5e9';
const DEFAULT_SECONDARY_COLOR = '#1f2937';
const DEFAULT_ACCENT_COLOR = '#f97316';
const DARK_REFERENCE = '#111827';
const LIGHT_REFERENCE = '#ffffff';

function ensureHex(color: string | null | undefined, fallback: string) {
  const normalized = normalizeHex(color);
  return normalized ?? fallback;
}

function clampAlpha(value: number) {
  if (Number.isNaN(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

function normalizeHex(color?: string | null): string | null {
  if (!color) {
    return null;
  }

  let hex = color.trim();
  if (!hex) {
    return null;
  }

  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(char => `${char}${char}`)
      .join('');
  }

  if (!HEX_PATTERN.test(hex)) {
    return null;
  }

  return `#${hex.toLowerCase()}`;
}

function hexToRgb(color: string): RgbColor | null {
  const normalized = normalizeHex(color);
  if (!normalized) {
    return null;
  }

  const value = normalized.slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function toRgba(color: string, alpha: number) {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return `rgba(255, 255, 255, ${clampAlpha(alpha).toFixed(3)})`;
  }

  const safeAlpha = clampAlpha(alpha);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha.toFixed(3)})`;
}

function relativeLuminance({ r, g, b }: RgbColor) {
  const srgb = [r, g, b].map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  const [red, green, blue] = srgb;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function pickContrastColor(base: string) {
  const rgb = hexToRgb(base);
  if (!rgb) {
    return LIGHT_REFERENCE;
  }

  const luminance = relativeLuminance(rgb);
  return luminance > 0.55 ? DARK_REFERENCE : LIGHT_REFERENCE;
}

export function createSurfaceTheme(baseColor?: string | null): SurfaceTheme {
  const background = normalizeHex(baseColor) ?? DEFAULT_BASE_COLOR;
  const foreground = pickContrastColor(background);
  const isLightForeground = foreground === LIGHT_REFERENCE;

  const muted = toRgba(foreground, isLightForeground ? 0.78 : 0.72);
  const border = toRgba(foreground, isLightForeground ? 0.25 : 0.18);
  const subtle = toRgba(isLightForeground ? LIGHT_REFERENCE : DARK_REFERENCE, isLightForeground ? 0.18 : 0.12);
  const surface = toRgba(isLightForeground ? LIGHT_REFERENCE : DARK_REFERENCE, isLightForeground ? 0.22 : 0.16);
  const hover = toRgba(foreground, isLightForeground ? 0.32 : 0.24);

  return {
    background,
    foreground,
    muted,
    border,
    subtle,
    surface,
    hover
  };
}

export function applyBrandingVariables(primary: string, secondary: string, accent: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.style.setProperty('--tenant-primary', ensureHex(primary, DEFAULT_BASE_COLOR));
  root.style.setProperty('--tenant-secondary', ensureHex(secondary, DEFAULT_SECONDARY_COLOR));
  root.style.setProperty('--tenant-accent', ensureHex(accent, DEFAULT_ACCENT_COLOR));
}

