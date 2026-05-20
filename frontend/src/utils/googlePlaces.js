const MAPS_SCRIPT_ID = 'google-maps-places-script';
import { attachMapsAppCheckTokenProvider, initFirebaseAppCheck } from './firebaseAppCheck';

const GOOGLE_MAPS_AUTH_FAILURE_EVENT = 'skuas:google-maps-auth-failure';
const getApiKey = () => String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const hasGoogleMapsApiKey = () => Boolean(getApiKey());
const createGoogleMapsError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const normalizeComponent = (components = [], ...types) => {
  for (const type of types) {
    const match = components.find((entry) => Array.isArray(entry?.types) && entry.types.includes(type));
    const value = match?.long_name || match?.longText || match?.short_name || match?.shortText || '';
    if (value) return String(value).trim();
  }
  return '';
};

const normalizeAddressText = (value = '') => String(value || '').trim().replace(/\s*,\s*/g, ', ');

const uniqueParts = (parts = []) => Array.from(new Set(parts.map((part) => normalizeAddressText(part)).filter(Boolean)));

const normalizeComparableAddressText = (value = '') => normalizeAddressText(value).toLowerCase();

const splitAddressSegments = (value = '') => normalizeAddressText(value)
  .split(',')
  .map((part) => normalizeAddressText(part))
  .filter(Boolean);

const isSameSegment = (segment = '', candidate = '') => {
  const left = normalizeComparableAddressText(segment);
  const right = normalizeComparableAddressText(candidate);
  return Boolean(left) && left === right;
};

const isPincodeSegment = (segment = '', pincode = '') => {
  const value = normalizeAddressText(segment);
  if (!value) return false;
  if (pincode && value.includes(pincode)) return true;
  return /\b[1-9][0-9]{5}\b/.test(value);
};

const getGoogleAddressParts = (source = {}) => {
  const components = Array.isArray(source.address_components)
    ? source.address_components
    : Array.isArray(source.addressComponents)
      ? source.addressComponents
      : [];
  const formattedAddress = normalizeAddressText(
    source.formatted_address
    || source.formattedAddress
    || source.name
    || source.displayName?.text
    || source.displayName
    || ''
  );

  const streetParts = uniqueParts([
    normalizeComponent(components, 'premise'),
    normalizeComponent(components, 'subpremise'),
    normalizeComponent(components, 'street_number'),
    normalizeComponent(components, 'route')
  ]);

  const areaParts = uniqueParts([
    normalizeComponent(components, 'sublocality_level_1'),
    normalizeComponent(components, 'sublocality_level_2'),
    normalizeComponent(components, 'sublocality'),
    normalizeComponent(components, 'neighborhood')
  ]);
  const componentAreaSet = new Set(areaParts.map((part) => normalizeComparableAddressText(part)).filter(Boolean));

  const city = normalizeComponent(
    components,
    'locality',
    'postal_town',
    'administrative_area_level_3',
    'administrative_area_level_2'
  );
  const state = normalizeComponent(components, 'administrative_area_level_1');
  const country = normalizeComponent(components, 'country');
  let pincode = normalizeComponent(components, 'postal_code');
  if (!pincode) pincode = normalizeComponent(components, 'postal_code_suffix');
  if (!pincode && formattedAddress) {
    const match = formattedAddress.match(/\b[1-9][0-9]{5}\b/);
    pincode = match ? match[0] : '';
  }

  const formattedSegments = splitAddressSegments(formattedAddress);
  const placeName = normalizeAddressText(source.name || source.displayName?.text || source.displayName || '');
  const cleanSegments = formattedSegments.filter(Boolean);
  if (placeName && cleanSegments.length > 1 && isSameSegment(cleanSegments[0], placeName)) {
    cleanSegments.shift();
  }

  const matchedSegments = [];
  let suffixStart = cleanSegments.length;
  for (let index = cleanSegments.length - 1; index >= 0; index -= 1) {
    const segment = cleanSegments[index];
    const normalized = normalizeComparableAddressText(segment);
    const isSuffix =
      isPincodeSegment(segment, pincode)
      || (country && isSameSegment(segment, country))
      || (city && isSameSegment(segment, city))
      || (state && isSameSegment(segment, state))
      || componentAreaSet.has(normalized);

    if (!isSuffix) break;
    suffixStart = index;
    matchedSegments.unshift(segment);
  }

  const addressSegments = cleanSegments.slice(0, suffixStart);
  let address = addressSegments.join(', ').trim();
  if (!address) {
    address = streetParts.join(', ');
  }
  if (!address) {
    address = cleanSegments.join(', ');
  }
  if (country.toLowerCase() === 'india') {
    address = String(address || '').replace(/,\s*India\s*$/i, '').replace(/\s+India\s*$/i, '').trim();
  }

  const suffixAreaParts = uniqueParts(
    matchedSegments.filter((segment) => {
      if (isPincodeSegment(segment, pincode)) return false;
      if (country && isSameSegment(segment, country)) return false;
      if (city && isSameSegment(segment, city)) return false;
      if (state && isSameSegment(segment, state)) return false;
      return true;
    })
  );
  const areaName = uniqueParts([...areaParts, ...suffixAreaParts]).join(' / ');

  return {
    address: normalizeAddressText(address),
    areaName,
    city,
    state,
    pincode,
    country
  };
};

const stripAutoFilledIndiaSuffix = (value = '', components = []) => {
  const formatted = String(value || '').trim();
  if (!formatted) return '';
  const country = normalizeComponent(components, 'country');
  if (country.toLowerCase() !== 'india') return formatted;

  return formatted
    .replace(/,\s*India\s*$/i, '')
    .replace(/\s+India\s*$/i, '')
    .trim();
};

const placeToDetails = (place = {}) => {
  const location = place.geometry?.location;
  const lat = typeof location?.lat === 'function' ? location.lat() : Number(location?.lat || 0);
  const lng = typeof location?.lng === 'function' ? location.lng() : Number(location?.lng || 0);
  const parts = getGoogleAddressParts(place);

  return {
    place_id: String(place.place_id || '').trim(),
    name: String(place.name || '').trim(),
    formatted_address: String(place.formatted_address || '').trim(),
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    formatted_phone_number: String(place.formatted_phone_number || '').trim(),
    international_phone_number: String(place.international_phone_number || '').trim(),
    website: String(place.website || '').trim(),
    types: Array.isArray(place.types) ? place.types : [],
    address: parts.address,
    areaName: parts.areaName,
    city: parts.city,
    state: parts.state,
    pincode: parts.pincode
  };
};

export const formatGoogleAddressParts = (source = {}) => getGoogleAddressParts(source);

let scriptPromise = null;
let scriptLoadError = null;

const emitGoogleMapsAuthFailure = (message = 'Google Maps authentication failed') => {
  scriptLoadError = createGoogleMapsError(message, 'GOOGLE_MAPS_AUTH_FAILED');
  scriptPromise = null;
  if (typeof window === 'undefined') return;
  window.__skuasGoogleMapsAuthFailed = true;
  window.dispatchEvent(new CustomEvent(GOOGLE_MAPS_AUTH_FAILURE_EVENT, {
    detail: { message }
  }));
};

const waitForPlacesReady = async (timeoutMs = 5000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.google?.maps?.places) return true;
    if (window.google?.maps?.importLibrary) {
      try {
        await window.google.maps.importLibrary('places');
        if (window.google?.maps?.places) return true;
      } catch {
        // Retry until timeout.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return false;
};

export const loadGooglePlacesScript = async () => {
  if (scriptLoadError) throw scriptLoadError;
  if (window.google?.maps?.places) {
    if (window.__skuasGoogleMapsAuthFailed) {
      throw createGoogleMapsError('Google Maps authentication failed', 'GOOGLE_MAPS_AUTH_FAILED');
    }
    initFirebaseAppCheck();
    await attachMapsAppCheckTokenProvider();
    return window.google;
  }
  if (scriptPromise) return scriptPromise;

  const apiKey = getApiKey();
  if (!apiKey) {
    throw createGoogleMapsError('Google Maps API key not configured', 'GOOGLE_MAPS_KEY_MISSING');
  }

  scriptPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined') {
      window.__skuasGoogleMapsAuthFailed = false;
      window.gm_authFailure = () => {
        emitGoogleMapsAuthFailure('Google Maps authentication failed. Check API key, billing, and allowed domains.');
        reject(scriptLoadError);
      };
    }

    const existing = document.getElementById(MAPS_SCRIPT_ID);
    if (existing) {
      const finishExisting = async () => {
        if (window.__skuasGoogleMapsAuthFailed) {
          reject(createGoogleMapsError('Google Maps authentication failed', 'GOOGLE_MAPS_AUTH_FAILED'));
          return;
        }
        const ok = await waitForPlacesReady();
        if (!ok) {
          reject(createGoogleMapsError('Google Places API not enabled or failed to initialize', 'GOOGLE_MAPS_INIT_FAILED'));
          return;
        }
        initFirebaseAppCheck();
        await attachMapsAppCheckTokenProvider();
        resolve(window.google);
      };
      if (window.google?.maps) {
        finishExisting();
      } else {
        existing.addEventListener('load', finishExisting);
      }
      existing.addEventListener('error', () => reject(createGoogleMapsError('Failed to load Google Maps script', 'GOOGLE_MAPS_SCRIPT_LOAD_FAILED')));
      return;
    }

    const script = document.createElement('script');
    script.id = MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = async () => {
      if (window.__skuasGoogleMapsAuthFailed) {
        reject(createGoogleMapsError('Google Maps authentication failed', 'GOOGLE_MAPS_AUTH_FAILED'));
        return;
      }
      const ok = await waitForPlacesReady();
      if (!ok) {
        reject(createGoogleMapsError('Google Places API not enabled or failed to initialize', 'GOOGLE_MAPS_INIT_FAILED'));
        return;
      }
      Promise.resolve()
        .then(() => {
          initFirebaseAppCheck();
          return attachMapsAppCheckTokenProvider();
        })
        .finally(() => resolve(window.google));
    };
    script.onerror = () => reject(createGoogleMapsError('Failed to load Google Maps script', 'GOOGLE_MAPS_SCRIPT_LOAD_FAILED'));
    document.head.appendChild(script);
  });

  try {
    return await scriptPromise;
  } catch (error) {
    scriptLoadError = error;
    scriptPromise = null;
    throw error;
  }
};

export const attachPlacesAutocomplete = async ({
  input,
  onSelected,
  onError,
  onRequireSelection
}) => {
  if (!input) return () => {};

  try {
    await loadGooglePlacesScript();
    if (!window.google?.maps?.places) throw new Error('Google Places API not enabled');

    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: 'in' },
      fields: [
        'place_id',
        'name',
        'formatted_address',
        'geometry',
        'formatted_phone_number',
        'international_phone_number',
        'website',
        'types',
        'address_components'
      ]
    });

    let lastSelection = '';

    const emitSelected = (place) => {
      const details = placeToDetails(place);
      if (!details.place_id && !details.formatted_address && !details.name) return;
      lastSelection = String(input.value || '').trim();
      onSelected?.(details);
    };

    const placeListener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place || (!place.place_id && !place.geometry)) {
        onRequireSelection?.('Please select address/company from suggestions');
        return;
      }
      emitSelected(place);
    });

    const resolveTextFallback = () => new Promise((resolve) => {
      const query = String(input.value || '').trim();
      if (!query) {
        resolve(null);
        return;
      }
      const service = new window.google.maps.places.PlacesService(document.createElement('div'));
      service.findPlaceFromQuery(
        {
          query,
          fields: [
            'place_id',
            'name',
            'formatted_address',
            'geometry',
            'formatted_phone_number',
            'international_phone_number',
            'website',
            'types',
            'address_components'
          ]
        },
        (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && Array.isArray(results) && results[0]) {
            resolve(results[0]);
            return;
          }
          resolve(null);
        }
      );
    });

    const onKeyDown = async (event) => {
      if (event.key !== 'Enter') return;
      const activeSuggestion = document.querySelector('.pac-item-selected');
      if (activeSuggestion) return;
      event.preventDefault();
      const query = String(input.value || '').trim();
      if (!query) return;
      if (query === lastSelection) return;
      const place = await resolveTextFallback();
      if (place) {
        emitSelected(place);
        return;
      }
      onRequireSelection?.('Please select address/company from suggestions');
    };

    input.addEventListener('keydown', onKeyDown);

    return () => {
      input.removeEventListener('keydown', onKeyDown);
      if (placeListener?.remove) placeListener.remove();
    };
  } catch (error) {
    console.error('Google Places initialization failed:', error);
    onError?.(error);
    return () => {};
  }
};

export {
  GOOGLE_MAPS_AUTH_FAILURE_EVENT,
  getApiKey as getGoogleMapsApiKey,
  hasGoogleMapsApiKey,
  stripAutoFilledIndiaSuffix
};
