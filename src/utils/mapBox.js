const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoiZmFyZ28yMTkiLCJhIjoiY205Y25xajJxMHJlbzJpc2M4bjhhdm9hZCJ9.xhoZP4Gr0_3yo6N9EBnD_w";

export const findClosestPlace = async (school, places, amenityType) => {
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
    const results = await Promise.all(
      places.map(async (place) => {
        const routeQuery = `https://api.mapbox.com/directions/v5/mapbox/walking/${lon},${lat};${place.lon},${place.lat}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=geojson&overview=full`;

        const response = await fetch(routeQuery);
        const data = await response.json();

        if (data.code !== "Ok") {
          console.error(`❌ Failed to get route for ${place.name}`);
          return null;
        }

        const route = data.routes[0];
        const duration = route.duration / 60; // minutes
        const distance = route.distance / 1000; // kilometers

        return {
          place,
          distance,
          duration,
          routeGeometry: route.geometry,
          routeInstructions: route.legs[0].steps,
        };
      })
    );

    const validResults = results.filter(Boolean);

    if (!validResults.length) {
      console.warn(`⚠️ No valid walking routes found for ${school.displayName}`);
      return null;
    }

    const closest = validResults.reduce((min, curr) =>
      curr.distance < min.distance ? curr : min
    );

    return {
      school: school.displayName,
      place: closest.place.name,
      distance: closest.distance.toFixed(2),
      time: `${Math.round(closest.duration)} mins`,
      route: closest.routeGeometry,
      routeInstructions: closest.routeInstructions,
      rawData: {
        schoolCoords: [lon, lat],
        placeCoords: [closest.place.lon, closest.place.lat],
        distanceMeters: closest.distance * 1000,
        durationSeconds: closest.duration * 60,
      },
    };
  } catch (err) {
    console.error(`❌ Error processing ${school.displayName}:`, err);
    return null;
  }
};
