import { OSRM_URL } from "./constants";

export const findClosestPlace = async (school, places, amenityType) => {
  console.group(`[OSRM] School: ${school.displayName}`);
  const [startLon, startLat] = school.geometry.coordinates;
  
  try {
    if (!places.length) return null;
    
    // Construct coordinates string
    const destinations = places.map(p => `${p.lon},${p.lat}`).join(';');
    const coordinates = `${startLon},${startLat};${destinations}`;
    
    // Use the table service
    const osrmQuery = `${OSRM_URL}/table/v1/walking/${coordinates}?sources=0&annotations=distance`;
    
    console.log('OSRM Query:', osrmQuery);

    const response = await fetch(osrmQuery);
    const data = await response.json();
    
    if (data.code !== 'Ok') throw new Error('Invalid OSRM response');
    if (!data.distances?.[0]) throw new Error('No distances found');

    // Process distances
    const distancesFromSource = data.distances[0].slice(1); // Skip self-distance
    const distances = places.map((place, i) => ({
      place,
      distance: distancesFromSource[i] / 1000 // Convert to km
    }));

    const validDistances = distances.filter(d => d.distance && isFinite(d.distance));
    if (!validDistances.length) return null;

    const closest = validDistances.reduce((min, curr) => 
      curr.distance < min.distance ? curr : min
    );

    return {
      school: school.displayName,
      place: closest.place.name,
      distance: closest.distance.toFixed(2),
      rawData: {
        schoolCoords: [startLon, startLat],
        placeCoords: [closest.place.lon, closest.place.lat]
      }
    };
  } catch (err) {
    console.error('OSRM Error:', err);
    return null;
  } finally {
    console.groupEnd();
  }
};