import { useState } from 'react';

const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoiZmFyZ28yMTkiLCJhIjoiY205Y25xajJxMHJlbzJpc2M4bjhhdm9hZCJ9.xhoZP4Gr0_3yo6N9EBnD_w";

const formatDuration = (seconds) => {
  const totalMinutes = Math.round(seconds / 60);
  
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${totalMinutes} mins`;
};

export const useMapboxRouting = () => {
  const [error, setError] = useState(null);

  const findClosestPlace = async (school, places, amenityType) => {
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

    if (!places || !places.length) {
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
            console.error(`Failed to get route for ${place.name}`);
            return null;
          }

          const route = data.routes[0];
          const distance = route.distance / 1000; // kilometers
          const duration = route.duration; // seconds

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
        return null;
      }

      const closest = validResults.reduce((min, curr) =>
        curr.distance < min.distance ? curr : min
      );

      return {
        school: school.displayName,
        place: closest.place.name,
        distance: closest.distance.toFixed(2),
        time: formatDuration(closest.duration),
        route: closest.routeGeometry,
        routeInstructions: closest.routeInstructions,
        rawData: {
          schoolCoords: [lon, lat],
          placeCoords: [closest.place.lon, closest.place.lat],
          distanceMeters: closest.distance * 1000,
          durationSeconds: closest.duration,
        },
      };
    } catch (err) {
      console.error(`Error processing ${school.displayName}:`, err);
      setError(`Error processing ${school.displayName}: ${err.message}`);
      return null;
    }
  };

  return { findClosestPlace, error };
};