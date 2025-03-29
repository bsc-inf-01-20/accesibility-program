import { OSRM_URL } from "./constants";

export const findClosestPlace = async (school, places, amenityType) => {
  console.group(`Processing school: ${school.displayName}`);
  console.log('School coordinates:', school.geometry.coordinates);
  console.log('Places found:', places);

  if (!school || !school.geometry || !school.geometry.coordinates) {
    console.error('Invalid school data:', school);
    console.groupEnd();
    return null;
  }

  if (!places || !Array.isArray(places) || places.length === 0) {
    console.log(`No ${amenityType?.label?.toLowerCase() || 'amenities'} found`);
    console.groupEnd();
    return null;
  }

  try {
    const [startLon, startLat] = school.geometry.coordinates;
    
    console.log('All candidate places:');
    places.forEach((p, i) => {
      console.log(`#${i}: ${p.name || 'Unnamed'} @ ${p.lat},${p.lon}`);
    });

    const destinations = places
      .filter(p => p?.lon !== undefined && p?.lat !== undefined)
      .map(p => `${p.lon},${p.lat}`)
      .join(';');

    if (!destinations) {
      console.error('No valid destinations found', places);
      console.groupEnd();
      return null;
    }

    const osrmQuery = `${OSRM_URL}/${startLon},${startLat};${destinations}?overview=false`;
    console.log('OSRM Query:', osrmQuery);

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
        console.groupEnd();
        return null;
      }

      const data = await response.json();
      console.log('Full OSRM response:', data);

      if (data.code !== 'Ok' || !data.routes?.[0]?.legs) {
        console.warn('Invalid OSRM response structure:', data);
        console.groupEnd();
        return null;
      }

      const distances = data.routes[0].legs.map((leg, index) => ({
        place: places[index]?.name || `Unnamed ${amenityType?.label || 'Location'}`,
        distance: leg.distance / 1000,
        coordinates: `${places[index]?.lat},${places[index]?.lon}`,
        duration: leg.duration / 60,
        index: index
      }));

      console.log('All distances calculated:');
      distances.forEach(d => {
        console.log(`Place ${d.index}: ${d.place} - ${d.distance.toFixed(2)} km`);
      });

      distances.sort((a, b) => a.distance - b.distance);
      const closest = distances[0];
      
      console.log('Closest place selected:', closest);
      
      const result = {
        school: school.displayName,
        place: closest?.place,
        distance: closest?.distance.toFixed(2),
        amenityType: amenityType?.label,
        id: `${school.displayName}-${Date.now()}`,
        rawData: {
          schoolCoords: school.geometry.coordinates,
          placeCoords: closest ? [places[closest.index].lon, places[closest.index].lat] : null,
          allDistances: distances
        }
      };

      console.log('Final result:', result);
      console.groupEnd();
      return result;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error(`Error processing ${school.displayName}:`, err);
    console.groupEnd();
    return null;
  }
};