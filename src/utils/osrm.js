import { OSRM_URL } from "./constants";

export const findClosestPlace = async (school, places, amenityType) => {
  // Validate inputs
  if (!school || !school.geometry || !school.geometry.coordinates) {
    console.error('Invalid school data:', school);
    return null;
  }

  if (!places || !Array.isArray(places) || places.length === 0) {
    console.log(`No ${amenityType?.label?.toLowerCase() || 'amenities'} found near ${school.displayName}`);
    return null;
  }

  try {
    const [startLon, startLat] = school.geometry.coordinates;
    
    // Safely map places to destinations
    const destinations = places
      .filter(p => p?.lon !== undefined && p?.lat !== undefined)
      .map(p => `${p.lon},${p.lat}`)
      .join(';');

    if (!destinations) {
      console.error('No valid destinations found', places);
      return null;
    }

    const osrmQuery = `${OSRM_URL}/${startLon},${startLat};${destinations}?overview=false`;
    console.log('Making OSRM request:', osrmQuery);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(osrmQuery, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OSRM error response:', errorText);
        return null;
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes?.[0]?.legs) {
        console.warn('Invalid OSRM response structure:', data);
        return null;
      }

      // Match legs with places
      const distances = data.routes[0].legs.map((leg, index) => {
        const place = places[index] || {};
        return {
          place: place.name || `Unnamed ${amenityType?.label || 'Location'}`,
          distance: leg.distance / 1000, // Convert to km
        };
      });

      distances.sort((a, b) => a.distance - b.distance);
      
      return {
        school: school.displayName || 'Unknown School',
        place: distances[0]?.place || 'Unknown Place',
        distance: distances[0]?.distance?.toFixed(2) || '0.00',
        amenityType: amenityType?.label || 'Amenity',
        id: `${school.displayName}-${Date.now()}`
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error(`Error processing ${school.displayName || 'school'}:`, err);
    return null;
  }
};