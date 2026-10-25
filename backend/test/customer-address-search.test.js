const test = require('node:test');
const assert = require('node:assert/strict');
const { searchCustomerAddress } = require('../lib/customerAddressSearch');
const response = (data, ok = true) => ({ ok, json: async () => data });
const place = (country = 'IN', city = 'Delhi') => ({ place_id: 'fixture', name: 'Fixture business', formatted_address: `Fixture street, ${city}`, address_components: [{ long_name: city, types: ['locality'] }, { short_name: country, types: ['country'] }], geometry: { location: { lat: 28.6, lng: 77.2 } } });
const queries = ['Okhla Phase 2 Delhi', 'Nehru Place New Delhi', 'Sector 17 Chandigarh', 'Andheri East Mumbai', 'SKUAS Pest Control', 'skuas', '123 Example Road, Jaipur, Rajasthan 302001'];
for (const query of queries) test(`mocked search preserves query and India address components: ${query}`, async () => {
  const calls = [];
  const expected = place('IN', query.includes('Mumbai') ? 'Mumbai' : query.includes('Chandigarh') ? 'Chandigarh' : 'Delhi');
  const result = await searchCustomerAddress({ address: query, apiKey: 'test-secret', fetchImpl: async (url) => {
    calls.push(url);
    return response(url.includes('/details/') ? { status: 'OK', result: expected } : { status: 'OK', results: [{ place_id: 'fixture' }] });
  } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.results, [expected]);
  assert.equal(new URL(calls[0]).searchParams.get('query'), query);
  assert.equal(new URL(calls[0]).searchParams.get('region'), 'in');
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => new URL(url).hostname === 'maps.googleapis.com'));
});
test('missing key makes no provider requests', async () => {
  const result = await searchCustomerAddress({ address: 'skuas', apiKey: '', fetchImpl: () => assert.fail('No request expected') });
  assert.equal(result.status, 503);
  assert.equal(result.code, 'MAPS_KEY_MISSING');
});
test('foreign and country-unverified results are excluded', async () => {
  for (const country of ['AQ', '']) {
    const result = await searchCustomerAddress({ address: 'skuas', apiKey: 'test', fetchImpl: async (url) => response(url.includes('/details/') ? { status: 'OK', result: place(country) } : { status: 'OK', results: [{ place_id: 'foreign' }] }) });
    assert.deepEqual(result.results, []);
    assert.equal(result.result, null);
  }
});
test('zero results is a successful empty response with no silent fallback', async () => {
  let count = 0;
  const result = await searchCustomerAddress({ address: 'skuas', apiKey: 'test', fetchImpl: async () => { count++; return response({ status: 'ZERO_RESULTS' }); } });
  assert.deepEqual(result.results, []);
  assert.equal(count, 1);
});
test('Places New compatibility retains only Indian results and Delhi bias', async () => {
  const result = await searchCustomerAddress({ address: 'skuas', apiKey: 'test', fetchImpl: async (url, options) => {
    if (url.includes('maps.googleapis.com')) return response({ status: 'REQUEST_DENIED' });
    assert.equal(new URL(url).hostname, 'places.googleapis.com');
    const body = JSON.parse(options.body);
    assert.equal(body.regionCode, 'IN');
    assert.equal(body.locationBias.circle.center.latitude, 28.6139);
    return response({ places: ['IN', 'AQ'].map((country) => ({ id: country, displayName: { text: 'Fixture' }, formattedAddress: 'Fixture address', addressComponents: [{ shortText: country, types: ['country'] }], location: { latitude: 28, longitude: 77 } })) });
  } });
  assert.equal(result.results.length, 1);
  assert.equal(result.result.place_id, 'IN');
});
test('HTTP, billing, permission, malformed and network failures are sanitized; no OSM fallback', async () => {
  for (const fetchImpl of [async () => response({ error: { message: 'test-secret billing disabled' } }, false), async () => { throw new Error('url?key=test-secret'); }, async () => ({ ok: true, json: async () => { throw new Error('bad JSON'); } })]) {
    const result = await searchCustomerAddress({ address: 'skuas', apiKey: 'test-secret', fetchImpl });
    assert.equal(result.status, 503);
    assert.ok(!JSON.stringify(result).includes('test-secret'));
  }
});

// Execute the real component handlers with controlled timers/state and mocked I/O.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const component = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/CustomerDashboard.jsx'), 'utf8');
const componentFunction = (name) => {
  const start = component.indexOf(`  const ${name} =`);
  assert.ok(start >= 0, name);
  const end = component.indexOf('\n  const ', start + 1);
  return component.slice(start, end);
};
const handlerHarness = (provider) => {
  let form = { mobileNumber: '9999999999', whatsappNumber: '8888888888', gstNumber: 'unchanged', companyName: 'Existing company', billingSearchAddress: '', shippingSearchAddress: '', shippingSameAsBilling: false };
  const state = { billing: {}, shipping: {} };
  const timers = new Map();
  let timerId = 0;
  const context = vm.createContext({
    addressSearchTimerRef: { current: {} }, addressSuggestionSeqRef: { current: { billing: 0, shipping: 0 } }, addressSearchRequestRef: { current: {} },
    window: { setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; } }, clearTimeout: (id) => timers.delete(id),
    setForm: (updater) => { form = updater(form); context.form = form; },
    setSectionAddressSearchState: (section, patch) => Object.assign(state[section], patch),
    applyCustomerCoordinates: () => false, isAllowedGoogleMapsUrl: () => false, isGoogleMapsShortLink: () => false,
    resolveCustomerAddressSearchInput: async () => false,
    resolveGoogleMapsPlaceText: provider, API_BASE_URL: '', form,
    addressSearchState: state, billingSearchInputRef: { current: {} }, shippingSearchInputRef: { current: {} },
    applyCustomerAddressSuggestion: (section, place) => { form[`${section}Street1`] = place.formattedAddress; }
  });
  const names = ['getCustomerAddressSearchError', 'cancelCustomerAddressSearch', 'handleCustomerSearchAddressChange', 'requestCustomerAddress', 'fetchCustomerLiveSearchSuggestions', 'searchCustomerGooglePlace'];
  vm.runInContext(names.map(componentFunction).join('\n') + '\nthis.handlers = { ' + names.join(',') + ' };', context);
  return { handlers: context.handlers, state, context, form: () => form, flush: async () => {
    const pending = [...timers.values()]; timers.clear(); pending.forEach((fn) => fn());
    await new Promise(setImmediate);
  } };
};
test('rapid typing debounces to one request; clearing invalidates a pending response', async () => {
  let calls = 0;
  let finish;
  const h = handlerHarness(() => { calls++; return new Promise((resolve) => { finish = resolve; }); });
  for (const value of ['s', 'sk', 'sku', 'skuas']) h.handlers.handleCustomerSearchAddressChange('billing', value);
  assert.equal(calls, 0);
  await h.flush();
  assert.equal(calls, 1);
  h.handlers.handleCustomerSearchAddressChange('billing', '');
  finish({ success: true, results: [{ formattedAddress: 'old address' }] });
  await h.flush();
  assert.equal(h.state.billing.showSuggestions, false);
  assert.equal(h.form().billingSearchAddress, '');
});
test('older responses never replace newer suggestions', async () => {
  const pending = {};
  const h = handlerHarness((query) => new Promise((resolve) => { pending[query] = resolve; }));
  h.handlers.handleCustomerSearchAddressChange('billing', 'Delhi'); await h.flush();
  h.handlers.handleCustomerSearchAddressChange('billing', 'Mumbai'); await h.flush();
  pending.Mumbai({ success: true, results: [{ formattedAddress: 'Mumbai' }] }); await h.flush();
  pending.Delhi({ success: true, results: [{ formattedAddress: 'Delhi' }] }); await h.flush();
  assert.equal(h.state.billing.suggestions[0].formattedAddress, 'Mumbai');
});
test('Search Only shares an in-flight typing request and populates once without saving', async () => {
  let calls = 0;
  let finish;
  const h = handlerHarness(() => { calls++; return new Promise((resolve) => { finish = resolve; }); });
  h.handlers.handleCustomerSearchAddressChange('billing', 'Delhi'); await h.flush();
  const search = h.handlers.searchCustomerGooglePlace('billing');
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  finish({ success: true, results: [{ formattedAddress: 'Selected Delhi address' }] });
  await search;
  assert.equal(h.form().billingStreet1, 'Selected Delhi address');
  assert.equal(h.state.billing.showSuggestions, false);
  assert.equal(h.state.billing.fetching, false);
  assert.equal(h.form().mobileNumber, '9999999999');
  assert.equal(h.form().gstNumber, 'unchanged');
});
test('manual address remains typed on provider failure and no automatic population occurs', async () => {
  const h = handlerHarness(async () => ({ success: false, message: 'Unavailable' }));
  h.handlers.handleCustomerSearchAddressChange('billing', '123 Example Road, Jaipur 302001'); await h.flush();
  assert.equal(h.form().billingSearchAddress, '123 Example Road, Jaipur 302001');
  assert.equal(h.form().billingStreet1, undefined);
  assert.match(h.state.billing.error, /manually/);
});
test('real selection fills address fields, honors billing copy, and preserves unrelated information', () => {
  let form = { companyName: 'Existing company', mobileNumber: '9999999999', whatsappNumber: '8888888888', gstNumber: 'unchanged', billingPhone: '55555', shippingSameAsBilling: true };
  let places = fs.readFileSync(path.join(__dirname, '../../frontend/src/utils/googlePlaces.js'), 'utf8')
    .replace(/^import .*;$/gm, '').replace(/export \{[\s\S]*?\};/g, '').replace(/export const /g, 'const ').replace(/import\.meta\.env/g, '({})');
  const context = vm.createContext({ setForm: (fn) => { form = fn(form); } });
  const names = ['copyBillingToShipping', 'extractCustomerAddressFields', 'getCustomerPlaceLatLng', 'buildCustomerAddressPatch', 'applyCustomerAddressPatch', 'applyCustomerAddressSuggestion'];
  vm.runInContext(places + '\nconst toSixDigitPincode = (value) => String(value || "").replace(/\\D+/g, "").slice(0, 6);\n' + names.map(componentFunction).join('\n') + '\nthis.apply = applyCustomerAddressSuggestion;', context);
  const selected = { id: 'fixture', displayName: { text: 'Fixture business' }, formattedAddress: '123 Example Road, Okhla, New Delhi, Delhi 110020, India', location: { lat: 28.54, lng: 77.27 }, addressComponents: [
    { longText: 'New Delhi', types: ['locality'] }, { longText: 'Delhi', types: ['administrative_area_level_1'] }, { longText: '110020', types: ['postal_code'] }, { longText: 'India', shortText: 'IN', types: ['country'] }
  ] };
  context.apply('billing', selected, 'Fixture business');
  assert.equal(form.billingCity, 'New Delhi');
  assert.equal(form.billingState, 'Delhi');
  assert.equal(form.billingPincode, '110020');
  assert.equal(form.billingLatitude, '28.54');
  assert.equal(form.shippingStreet1, form.billingStreet1);
  assert.equal(form.shippingCity, form.billingCity);
  assert.equal(form.companyName, 'Existing company');
  assert.equal(form.mobileNumber, '9999999999');
  assert.equal(form.whatsappNumber, '8888888888');
  assert.equal(form.gstNumber, 'unchanged');
  form.shippingSameAsBilling = false;
  context.apply('shipping', { ...selected, addressComponents: [{ longText: 'Mumbai', types: ['locality'] }] }, 'Mumbai');
  assert.equal(form.shippingCity, 'Mumbai');
  assert.equal(form.billingCity, 'New Delhi');
});
