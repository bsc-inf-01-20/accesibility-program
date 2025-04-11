import { OSRM_URL } from "./constants";

export const findClosestPlace = async (school, places, amenityType) => {
  // Check for valid geometry and coordinates before proceeding
  if (
    !school?.geometry?.coordinates ||
    !Array.isArray(school.geometry.coordinates) ||
    school.geometry.coordinates.length !== 2
  ) {
    console.warn(`⚠️ Skipping invalid school geometry: ${school?.displayName}`);
    return null;
  }

  const [lon, lat] = school.geometry.coordinates;
  console.log(`\n=== Processing School: ${school.displayName} @ ${lon},${lat} ===`);

  if (!places.length) {
    console.log("No amenities found for this school");
    return null;
  }

  try {
    // Construct destination coordinates string for OSRM route API
    const results = await Promise.all(
      places.map(async (place) => {
        const routeQuery = `${OSRM_URL}/route/v1/walking/${lon},${lat};${place.lon},${place.lat}?overview=full&geometries=geojson`;

        const routeResponse = await fetch(routeQuery);
        const routeData = await routeResponse.json();

        if (routeData.code !== "Ok") {
          console.error(`❌ Failed to get walking route for ${place.name}`);
          return null;
        }

        const route = routeData.routes[0];
        const duration = route.duration / 60; // Duration in minutes
        const distance = route.distance / 1000; // Distance in kilometers

        return {
          place,
          distance,
          duration,
          routeGeometry: route.geometry, // GeoJSON line geometry
          routeInstructions: route.legs[0].steps, // Turn-by-turn instructions
        };
      })
    );

    // Filter out any null results (in case a route request failed)
    const validResults = results.filter((result) => result !== null);

    // Pick the result with the shortest route distance
    const closest = validResults.reduce((min, curr) =>
      curr.distance < min.distance ? curr : min
    );

    // Return the closest result with the full route data
    return {
      school: school.displayName,
      place: closest.place.name,
      distance: closest.distance.toFixed(2),
      time: `${Math.round(closest.duration)} mins`,
      route: closest.routeGeometry, // GeoJSON line geometry
      routeInstructions: closest.routeInstructions, // Turn-by-turn instructions
      rawData: {
        schoolCoords: [lon, lat],
        placeCoords: [closest.place.lon, closest.place.lat],
        distanceMeters: closest.distance * 1000,
        durationSeconds: closest.duration * 60,
      },
    };
  } catch (err) {
    console.error(`❌ Processing failed for ${school.displayName || "unknown school"}: ${err.message}`);
    return null;
  }
};
