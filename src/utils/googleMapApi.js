// utils/googleMaps.js

import { GOOGLE_API_KEY, SEARCH_RADIUS } from './constants';

// useGoogleMapsApi.js

export const fetchGooglePlaces = async (lat, lon, amenityType, radius = SEARCH_RADIUS) => {
  try {
    const params = new URLSearchParams({
      lat,
      lng: lon,
      type: amenityType.queryTag,
      radius
    });

    const response = await fetch(`http://localhost:5000/api/places?${params}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status !== 'OK') {
      throw new Error(data.error_message || `API Error: ${data.status}`);
    }

    return data.results.map(place => ({
      id: place.place_id,
      name: place.name,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      address: place.vicinity,
      rating: place.rating,
      openNow: place.opening_hours?.open_now,
      photo: place.photos?.[0]?.photo_reference
    }));
  } catch (err) {
    console.error('Failed to fetch places:', err);
    throw err; // Re-throw to let calling code handle it
  }
};