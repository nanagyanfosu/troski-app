import config from '../config';

const GOOGLE_PLACES_API_KEY = config?.GOOGLE_PLACES_API_KEY || '';
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

export async function autocompletePlaces(input, sessionToken, components = 'country:gh') {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('Places autocomplete skipped: no API key available');
    return { predictions: [] };
  }
  if (!input) return { predictions: [] };
  const params = new URLSearchParams({
    input,
    key: GOOGLE_PLACES_API_KEY,
    sessiontoken: sessionToken || '',
    components,
    // You can tune types=address or types=geocode if needed
  });
  const url = `${AUTOCOMPLETE_URL}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Places autocomplete failed');
  const data = await res.json();
  return data;
}

export async function getPlaceDetails(placeId, sessionToken) {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('Place details skipped: no API key available');
    return null;
  }
  if (!placeId) return null;
  const params = new URLSearchParams({
    place_id: placeId,
    key: GOOGLE_PLACES_API_KEY,
    sessiontoken: sessionToken || '',
    fields: 'formatted_address,geometry,name'
  });
  const url = `${DETAILS_URL}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Place details failed');
  const data = await res.json();
  return data;
}
