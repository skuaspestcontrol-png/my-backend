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

const normalizeApiBaseUrl = (value = '') => {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return parsed.origin === 'http://localhost' && !/^https?:\/\//i.test(raw) ? '' : parsed.origin.replace(/\/+$/, '');
  } catch {
    return raw;
  }
};

const normalizeGooglePlaceSearchResult = (result = {}, fallbackText = '') => {
  const formattedAddress = String(result.formatted_address || result.formattedAddress || '').trim();
  const addressComponents = Array.isArray(result.address_components)
    ? result.address_components
    : Array.isArray(result.addressComponents)
      ? result.addressComponents
      : [];
  const location = result.geometry?.location
    || result.location
    || (Number.isFinite(Number(result.latitude)) && Number.isFinite(Number(result.longitude))
      ? { lat: Number(result.latitude), lng: Number(result.longitude) }
      : null);
  const name = String(result.name || result.displayName?.text || result.displayName || fallbackText || '').trim();
  const placeId = String(result.place_id || result.placeId || result.id || '').trim();
  const phone = String(result.formatted_phone_number || result.international_phone_number || result.nationalPhoneNumber || result.internationalPhoneNumber || '').trim();
  const website = String(result.website || result.websiteURI || '').trim();

  return {
    ...result,
    id: placeId,
    place_id: placeId,
    name,
    displayName: { text: name },
    formattedAddress,
    formatted_address: formattedAddress,
    addressComponents,
    address_components: addressComponents,
    location,
    geometry: result.geometry || (location ? { location } : undefined),
    nationalPhoneNumber: phone,
    internationalPhoneNumber: phone,
    formatted_phone_number: phone,
    websiteURI: website,
    website
  };
};

const resolveGoogleMapsPlaceText = async (text, { apiBaseUrl = '' } = {}) => {
  const address = String(text || '').trim();
  if (!address) {
    return { success: false, message: 'Address is required' };
  }

  const base = normalizeApiBaseUrl(apiBaseUrl || import.meta.env.VITE_API_BASE_URL || '');
  const endpoint = `${base}/api/maps/geocode`;
  const response = await axios.post(endpoint, { address }, {
    validateStatus: () => true
  });
  const data = response?.data || {};
  if (response.status >= 200 && response.status < 300 && data.result) {
    return {
      success: true,
      result: normalizeGooglePlaceSearchResult(data.result, address)
    };
  }

  return {
    success: false,
    message: String(data.error || data.message || 'Could not find this address').trim() || 'Could not find this address'
  };
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
  resolveGoogleMapsUrl,
  resolveGoogleMapsPlaceText
};
