import { OVERPASS_INSTANCES, SEARCH_RADIUS } from "./constants";
import { getCacheKey, cleanupCache, placeCache } from "./cache";

export const fetchNearbyAmenities = async ( lat, lon, amenityType, instaceIndex = 0,
    retryCount = 0, radius=SEARCH_RADIUS )=> {
    cleanupCache();
    const cacheKey = getCacheKey(lat, lon, radius, amenityType.key);
    
    if (placeCache.has(cacheKey)) return placeCache.get(cacheKey).data;
  
    const overpassQuery = `
      [out:json][timeout:30];
      node[${amenityType.queryTag}](around:${radius},${lat},${lon});
      out body;
    `;

    const selectedInstance = OVERPASS_INSTANCES[instaceIndex % OVERPASS_INSTANCES.length];

    try {
        const response = await fetch(`${selectedInstance}?data=${encodeURIComponent(overpassQuery)}`, {
            signal: AbortSignal.timeout(15000)
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json();
          const amenities = data.elements.map(element => ({
            name: element.tags?.name || `Unnamed ${amenityType.label}`,
            lat: element.lat,
            lon: element.lon
          }));
      
          placeCache.set(cacheKey, { data: amenities, timestamp: Date.now() });
          return amenities;  
    } catch (err) {
        console.error(`Attempt ${retryCount + 1} failed on ${selectedInstance}:`, err.message);
        if (retryCount < 3) {
            const nextInstanceIndex = (instanceIndex + 1) % OVERPASS_INSTANCES.length;
            return fetchNearbyAmenities(lat, lon, amenityType, nextInstanceIndex, retryCount + 1, radius);

        }
        console.error('All Overpass instances failed for query');
        return [];
        
    }
}
