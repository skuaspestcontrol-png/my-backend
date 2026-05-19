const dns = require('dns').promises;
const net = require('net');

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

const PRIVATE_IPV4_PREFIXES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./
];

const isPrivateIpv6 = (value) => {
  const ip = String(value || '').toLowerCase();
  return ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd');
};

const isPrivateIp = (value) => {
  const ip = String(value || '').trim();
  if (!ip) return true;
  const family = net.isIP(ip);
  if (family === 4) return PRIVATE_IPV4_PREFIXES.some((pattern) => pattern.test(ip));
  if (family === 6) return isPrivateIpv6(ip);
  return true;
};

const normalizeGoogleMapsUrl = (value) => {
  const text = String(value || '').trim();
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

const extractCoordinatesFromUrl = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;

  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return {
      latitude: Number(atMatch[1]),
      longitude: Number(atMatch[2])
    };
  }

  const markerMatch = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  if (markerMatch) {
    return {
      latitude: Number(markerMatch[1]),
      longitude: Number(markerMatch[2])
    };
  }

  const reversedMarkerMatch = text.match(/!4d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/i);
  if (reversedMarkerMatch) {
    return {
      latitude: Number(reversedMarkerMatch[2]),
      longitude: Number(reversedMarkerMatch[1])
    };
  }

  try {
    const url = new URL(text);
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

const canResolveHost = async (host) => {
  if (!host) return false;
  if (net.isIP(host)) return !isPrivateIp(host);
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (!Array.isArray(records) || records.length === 0) return false;
    return records.every((record) => !isPrivateIp(record.address));
  } catch {
    return false;
  }
};

const fetchWithTimeout = async (url, { method = 'HEAD', timeoutMs = 5000 } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
  } finally {
    clearTimeout(timeout);
  }
};

const resolveGoogleMapsUrl = async (inputUrl, { timeoutMs = 5000, maxRedirects = 6 } = {}) => {
  const initialUrl = normalizeGoogleMapsUrl(inputUrl);
  if (!isAllowedGoogleMapsUrl(initialUrl)) {
    return { success: false, message: 'Could not extract coordinates from link' };
  }

  let currentUrl = initialUrl;
  let finalUrl = initialUrl;

  for (let i = 0; i < maxRedirects; i += 1) {
    let parsed;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return { success: false, message: 'Could not extract coordinates from link' };
    }

    if (!isAllowedGoogleMapsUrl(currentUrl)) {
      return { success: false, message: 'Could not extract coordinates from link' };
    }

    if (!(await canResolveHost(parsed.hostname))) {
      return { success: false, message: 'Could not extract coordinates from link' };
    }

    let response = null;
    try {
      response = await fetchWithTimeout(currentUrl, { method: 'HEAD', timeoutMs });
    } catch {
      response = null;
    }

    if (!response || response.status === 405 || response.status === 501) {
      try {
        response = await fetchWithTimeout(currentUrl, { method: 'GET', timeoutMs });
      } catch {
        response = null;
      }
    }

    if (!response) break;

    const status = Number(response.status || 0);
    const location = String(response.headers?.get?.('location') || '').trim();
    if (status >= 300 && status < 400 && location) {
      let nextUrl = '';
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch {
        nextUrl = String(location || '').trim();
      }
      if (!isAllowedGoogleMapsUrl(nextUrl)) {
        return { success: false, message: 'Could not extract coordinates from link' };
      }
      currentUrl = nextUrl;
      finalUrl = nextUrl;
      continue;
    }

    finalUrl = currentUrl;
    break;
  }

  const coordinates = extractCoordinatesFromUrl(finalUrl);
  if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
    return { success: false, message: 'Could not extract coordinates from link' };
  }

  return {
    success: true,
    finalUrl,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude
  };
};

module.exports = {
  extractCoordinatesFromUrl,
  isAllowedGoogleMapsUrl,
  normalizeGoogleMapsUrl,
  resolveGoogleMapsUrl
};
