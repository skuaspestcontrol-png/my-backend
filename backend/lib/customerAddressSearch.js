// Customer-only address lookup. Never send customer searches to public Nominatim.
const indiaResult = (place) => (place?.address_components || []).some((part) =>
  part.types?.includes('country') && String(part.short_name || '').toUpperCase() === 'IN');

const searchCustomerAddress = async ({ address, lat, lng, apiKey, fetchImpl = fetch }) => {
  const coordinatesProvided = lat !== undefined || lng !== undefined;
  if (coordinatesProvided && (lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '' ||
      !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) ||
      Number(lat) < -90 || Number(lat) > 90 || Number(lng) < -180 || Number(lng) > 180)) {
    return { status: 400, code: 'INVALID_COORDINATES', error: 'Please provide a valid latitude and longitude.' };
  }
  if (!apiKey) return { status: 503, error: 'Address search is not configured. Please enter the address manually.', code: 'MAPS_KEY_MISSING' };
  const signal = AbortSignal.timeout(15000);
  const request = async (url, options = {}) => {
    const response = await fetchImpl(url, { ...options, signal });
    const data = await response.json();
    return { ok: response.ok, data };
  };
  const unavailable = { status: 503, code: 'MAPS_UNAVAILABLE', error: 'Address search is unavailable. Please enter the address manually or try again later.' };
  try {
    if (coordinatesProvided) {
      const params = new URLSearchParams({ latlng: `${Number(lat)},${Number(lng)}`, language: 'en', key: apiKey });
      const reverse = await request(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
      if (!reverse.ok || !['OK', 'ZERO_RESULTS'].includes(reverse.data.status)) return unavailable;
      const results = (reverse.data.results || []).filter(indiaResult).filter((place) => place.formatted_address &&
        Number.isFinite(place.geometry?.location?.lat) && Number.isFinite(place.geometry?.location?.lng));
      return { status: 200, provider: 'google', results, result: results[0] || null };
    }
    const params = new URLSearchParams({ query: address, region: 'in', language: 'en', location: '28.6139,77.2090', radius: '50000', key: apiKey });
    const legacy = await request(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
    let results;
    if (legacy.ok && ['OK', 'ZERO_RESULTS'].includes(legacy.data.status)) {
      results = (await Promise.all((legacy.data.results || []).slice(0, 5).map(async (candidate) => {
        if (!candidate.place_id) return null;
        const detailParams = new URLSearchParams({ place_id: candidate.place_id, fields: 'place_id,name,formatted_address,address_components,geometry,types,formatted_phone_number,international_phone_number,website', language: 'en', key: apiKey });
        const details = await request(`https://maps.googleapis.com/maps/api/place/details/json?${detailParams}`);
        if (!details.ok || details.data.status !== 'OK') throw new Error('Details unavailable');
        return indiaResult(details.data.result) ? details.data.result : null;
      }))).filter(Boolean);
    } else {
      // Existing projects may permit Places New but not the Legacy service.
      const modern = await request('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.types,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri' },
        body: JSON.stringify({ textQuery: address, languageCode: 'en', regionCode: 'IN', maxResultCount: 5,
          locationBias: { circle: { center: { latitude: 28.6139, longitude: 77.2090 }, radius: 50000 } } })
      });
      if (!modern.ok || modern.data.error) return unavailable;
      results = (modern.data.places || []).map((place) => ({
        place_id: place.id, name: place.displayName?.text || '', formatted_address: place.formattedAddress || '',
        formatted_phone_number: place.nationalPhoneNumber || '', international_phone_number: place.internationalPhoneNumber || '', website: place.websiteUri || '',
        address_components: (place.addressComponents || []).map((part) => ({ long_name: part.longText, short_name: part.shortText, types: part.types })),
        geometry: { location: { lat: place.location?.latitude, lng: place.location?.longitude } }, types: place.types || []
      })).filter(indiaResult);
    }
    results = results.filter((place) => place.formatted_address &&
      Number.isFinite(place.geometry?.location?.lat) && Number.isFinite(place.geometry?.location?.lng));
    return { status: 200, provider: 'google', results, result: results[0] || null };
  } catch {
    // Do not return provider messages or URLs, which may contain credentials.
    return unavailable;
  }
};

module.exports = { searchCustomerAddress };
