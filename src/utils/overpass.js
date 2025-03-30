import { OVERPASS_INSTANCES, SEARCH_RADIUS } from "./constants";

export const fetchNearbyAmenities = async (
  lat, lon, amenityType, instanceIndex = 0,
  retryCount = 0, radius = SEARCH_RADIUS
) => {
  console.group(`[Overpass TEST] School at ${lon},${lat} searching for ${amenityType.label}`);
  
  try {
    const overpassQuery = `
      [out:json][timeout:30];
      node[${amenityType.queryTag}](around:${radius},${lat},${lon});
      out body;
    `.trim();

    const selectedInstance = OVERPASS_INSTANCES[instanceIndex % OVERPASS_INSTANCES.length];
    const response = await fetch(`${selectedInstance}?data=${encodeURIComponent(overpassQuery)}`, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const amenities = data.elements
      .filter(element => element.lat && element.lon)
      .map(element => ({
        name: element.tags?.name || `Unnamed ${amenityType.label}`,
        lat: element.lat,
        lon: element.lon,
        id: element.id
      }));

    // Log raw Overpass results
    console.log('Found amenities:');
    amenities.forEach(amenity => {
      console.log(`- ${amenity.name} @ ${amenity.lon},${amenity.lat}`);
    });

    console.groupEnd();
    return amenities;
  } catch (err) {
    console.error('Overpass error:', err);
    console.groupEnd();
    if (retryCount < 3) {
      return fetchNearbyAmenities(lat, lon, amenityType, instanceIndex + 1, retryCount + 1, radius);
    }
    throw err;
  }
};