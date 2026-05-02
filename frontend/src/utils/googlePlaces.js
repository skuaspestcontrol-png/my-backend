const MAPS_SCRIPT_ID = 'google-maps-places-script';

const getApiKey = () => String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

const normalizeComponent = (components = [], ...types) => {
  for (const type of types) {
    const match = components.find((entry) => Array.isArray(entry?.types) && entry.types.includes(type));
    if (match?.long_name) return match.long_name;
  }
  return '';
};

const placeToDetails = (place = {}) => {
  const location = place.geometry?.location;
  const lat = typeof location?.lat === 'function' ? location.lat() : Number(location?.lat || 0);
  const lng = typeof location?.lng === 'function' ? location.lng() : Number(location?.lng || 0);
  const components = Array.isArray(place.address_components) ? place.address_components : [];

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
    areaName: normalizeComponent(
      components,
      'sublocality_level_1',
      'sublocality_level_2',
      'sublocality',
      'neighborhood',
      'premise',
      'route'
    ),
    city: normalizeComponent(
      components,
      'locality',
      'postal_town',
      'administrative_area_level_3',
      'administrative_area_level_2'
    ),
    state: normalizeComponent(components, 'administrative_area_level_1'),
    pincode: normalizeComponent(components, 'postal_code')
  };
};

let scriptPromise = null;

export const loadGooglePlacesScript = async () => {
  if (window.google?.maps?.places) return window.google;
  if (scriptPromise) return scriptPromise;

  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Google Maps API key not configured');

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(MAPS_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script')));
      return;
    }

    const script = document.createElement('script');
    script.id = MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google?.maps?.places) {
        reject(new Error('Google Places API not enabled or failed to initialize'));
        return;
      }
      resolve(window.google);
    };
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });

  return scriptPromise;
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

