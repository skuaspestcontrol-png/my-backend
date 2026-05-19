import axios from 'axios';

const GOOGLE_MAPS_ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'maps.google.com',
  'www.google.com'
]);

const GOOGLE_MAPS_ALLOWED_PATH_PREFIXES = {
  'goo.gl': ['/maps'],
  'maps.google.com': ['/maps'],
  'www.google.com': ['/maps']
};

const toText = (value) => String(value || '').trim();

const normalizeGoogleMapsUrl = (value) => {
  const text = toText(value);
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (/^(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com|www\.google\.com\/maps)/i.test(text)) {
    return `https://${text}`;
  }
  return text;
};

const isAllowedGoogleMapsUrl = (value) => {
  const normalized = normalizeGoogleMapsUrl(value);
  if (!normalized || !/^https?:\/\//i.test(normalized)) return false;
  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    if (!GOOGLE_MAPS_ALLOWED_HOSTS.has(host)) return false;
    const path = url.pathname.toLowerCase();
    const allowedPrefixes = GOOGLE_MAPS_ALLOWED_PATH_PREFIXES[host] || null;
    if (allowedPrefixes && !allowedPrefixes.some((prefix) => path.startsWith(prefix))) return false;
    return true;
  } catch {
    return false;
  }
};

const isGoogleMapsShortLink = (value) => {
  const normalized = normalizeGoogleMapsUrl(value);
  if (!normalized || !/^https?:\/\//i.test(normalized)) return false;
  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    return host === 'maps.app.goo.gl' || (host === 'goo.gl' && url.pathname.toLowerCase().startsWith('/maps'));
  } catch {
    return false;
  }
};

const extractGoogleMapsCoordinates = (value) => {
  const text = toText(value);
  if (!text) return null;

  const plainMatch = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (plainMatch) {
    return {
      latitude: Number(plainMatch[1]),
      longitude: Number(plainMatch[2])
    };
  }

  const normalized = normalizeGoogleMapsUrl(text);
  if (!normalized) return null;

  const atMatch = normalized.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return {
      latitude: Number(atMatch[1]),
      longitude: Number(atMatch[2])
    };
  }

  const markerMatch = normalized.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  if (markerMatch) {
    return {
      latitude: Number(markerMatch[1]),
      longitude: Number(markerMatch[2])
    };
  }

  const reversedMarkerMatch = normalized.match(/!4d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/i);
  if (reversedMarkerMatch) {
    return {
      latitude: Number(reversedMarkerMatch[2]),
      longitude: Number(reversedMarkerMatch[1])
    };
  }

  try {
    const url = new URL(normalized);
    const query = url.searchParams.get('q')
      || url.searchParams.get('query')
      || url.searchParams.get('ll')
      || '';
    const queryMatch = query.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (queryMatch) {
      return {
        latitude: Number(queryMatch[1]),
        longitude: Number(queryMatch[2])
      };
    }
  } catch {
    return null;
  }

  return null;
};

const resolveGoogleMapsUrl = async (url, { apiBaseUrl = '', timeoutMs = 8000 } = {}) => {
  const normalized = normalizeGoogleMapsUrl(url);
  if (!normalized) {
    return { success: false, message: 'Could not extract coordinates from link' };
  }

  const base = String(apiBaseUrl || '').trim().replace(/\/+$/, '');
  const endpoint = `${base}/api/maps/resolve`;
  const response = await axios.get(endpoint, {
    params: { url: normalized },
    timeout: timeoutMs,
    validateStatus: () => true
  });

  const data = response?.data || {};
  if (data.success) {
    return {
      success: true,
      finalUrl: String(data.finalUrl || normalized).trim(),
      latitude: Number(data.latitude),
      longitude: Number(data.longitude)
    };
  }

  return {
    success: false,
    message: String(data.message || 'Could not extract coordinates from link').trim() || 'Could not extract coordinates from link'
  };
};

export {
  extractGoogleMapsCoordinates,
  isAllowedGoogleMapsUrl,
  isGoogleMapsShortLink,
  normalizeGoogleMapsUrl,
  resolveGoogleMapsUrl
};
