import { OSRM_URL } from "./constants";

export const findClosestPlace = async (school, places, amenityType) => {
  const [lon, lat] = school.geometry.coordinates;
  console.log(`\n=== Processing School: ${school.displayName} @ ${lon},${lat} ===`);

  if (!places.length) {
    console.log('No amenities found for this school');
    return null;
  }

  try {
    // Prepare coordinates for OSRM table request
    const destinations = places.map(p => `${p.lon},${p.lat}`).join(';');
    const osrmQuery = `${OSRM_URL}/table/v1/walking/${lon},${lat};${destinations}?sources=0&annotations=distance`;

    const response = await fetch(osrmQuery);
    const data = await response.json();

    if (data.code !== 'Ok') throw new Error('Invalid OSRM response');
    if (!data.distances?.[0]) throw new Error('No distances found');

    // Process all distances
    const distances = places.map((place, i) => {
      const distance = data.distances[0][i+1] / 1000; // Skip first (self) and convert to km
      console.log(`Market: ${place.name} @ ${place.lon},${place.lat} → ${distance.toFixed(2)} km`);
      return { place, distance };
    });

    // Filter out invalid distances and find closest
    const validDistances = distances.filter(d => d.distance && isFinite(d.distance));
    if (!validDistances.length) return null;

    const closest = validDistances.reduce((min, curr) => 
      curr.distance < min.distance ? curr : min
    );

    console.log(`\n>> CLOSEST ${amenityType.label.toUpperCase()}: ${closest.place.name} @ ${closest.distance.toFixed(2)} km <<`);

    return {
      school: school.displayName,
      place: closest.place.name,
      distance: closest.distance.toFixed(2),
      rawData: {
        schoolCoords: [lon, lat],
        placeCoords: [closest.place.lon, closest.place.lat]
      }
    };

  } catch (err) {
    console.error(`Processing failed: ${err.message}`);
    return null;
  }
};