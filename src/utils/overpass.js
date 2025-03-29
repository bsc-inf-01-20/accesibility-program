import { SEARCH_RADIUS, OVERPASS_INSTANCES } from "./constants";
import { getCacheKey, cleanupCache, placeCache } from "./cache";

export const fetchNearbyAmenities = async (
  lat, lon, amenityType, instanceIndex = 0,
  retryCount = 0, radius = SEARCH_RADIUS
) => {
  console.group(`Fetching ${amenityType.label} near ${lat},${lon}`);
  console.log(`Radius: ${radius}m, Instance: ${OVERPASS_INSTANCES[instanceIndex % OVERPASS_INSTANCES.length]}`);
  
  cleanupCache();
  const cacheKey = getCacheKey(lat, lon, radius, amenityType.key);
  
  if (placeCache.has(cacheKey)) {
    console.log('Cache hit - returning cached results');
    console.groupEnd();
    return placeCache.get(cacheKey).data;
  }

  const overpassQuery = `
    [out:json][timeout:30];
    node[${amenityType.queryTag}](around:${radius},${lat},${lon});
    out body;
  `;

  const selectedInstance = OVERPASS_INSTANCES[instanceIndex % OVERPASS_INSTANCES.length];
  console.log('Overpass query:', overpassQuery);

  try {
    const response = await fetch(`${selectedInstance}?data=${encodeURIComponent(overpassQuery)}`, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    console.log('Raw Overpass response:', data);

    const amenities = data.elements.map(element => ({
      name: element.tags?.name || `Unnamed ${amenityType.label}`,
      lat: element.lat,
      lon: element.lon,
      id: element.id,
      tags: element.tags
    }));

    console.log(`Found ${amenities.length} amenities:`);
    amenities.forEach(amenity => {
      console.log(`- ${amenity.name} (${amenity.lat},${amenity.lon})`);
    });

    placeCache.set(cacheKey, { data: amenities, timestamp: Date.now() });
    console.groupEnd();
    return amenities;
  } catch (err) {
    console.error(`Attempt ${retryCount + 1} failed:`, err.message);
    if (retryCount < 3) {
      const nextInstanceIndex = (instanceIndex + 1) % OVERPASS_INSTANCES.length;
      console.groupEnd();
      return fetchNearbyAmenities(lat, lon, amenityType, nextInstanceIndex, retryCount + 1, radius);
    }
    console.error('All Overpass instances failed for query');
    console.groupEnd();
    return [];
  }
};