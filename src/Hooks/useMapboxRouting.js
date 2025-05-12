import { useState } from 'react';
import axios from 'axios';
import { MAPBOX_ACCESS_TOKEN } from '../utils/constants';

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

    const [schoolLng, schoolLat] = school.geometry.coordinates;
    console.log(`\n=== Processing School: ${school.displayName} @ ${schoolLng},${schoolLat} ===`);

    if (!places || places.length === 0) {
      console.warn(`No ${amenityType?.label || amenityType} places found for ${school.displayName}`);
      return null;
    }

    try {
      const results = await Promise.all(
        places.map(async (place) => {
          const placeLat = place.location?.lat;
          const placeLng = place.location?.lng;

          if (placeLat == null || placeLng == null) {
            console.warn('Skipping place with missing coordinates:', place.name);
            return null;
          }

          try {
            const response = await axios.get(
              `https://api.mapbox.com/directions/v5/mapbox/walking/${schoolLng},${schoolLat};${placeLng},${placeLat}`,
              {
                params: {
                  access_token: MAPBOX_ACCESS_TOKEN,
                  geometries: 'geojson',
                  overview: 'full',
                },
              }
            );

            const route = response.data.routes?.[0];
            if (!route) {
              console.warn(`No valid route for ${place.name}`);
              return null;
            }

            return {
              school: school.displayName,
              place: place.name,
              distance: route.distance / 1000,
              duration: route.duration,
              time: formatDuration(route.duration),
              route: route.geometry,
              routeInstructions: route.legs?.[0]?.steps || [],
              rawData: {
                schoolCoords: [schoolLng, schoolLat],
                placeCoords: [placeLng, placeLat],
                distanceMeters: route.distance,
                durationSeconds: route.duration,
              },
            };
          } catch (err) {
            console.error(`Failed to get route for ${place.name}`, err);
            return null;
          }
        })
      );

      const validResults = results.filter(Boolean);
      if (!validResults.length) return null;

      const closest = validResults.reduce((min, curr) =>
        curr.distance < min.distance ? curr : min
      );

      return closest;
    } catch (err) {
      console.error('Routing error:', err);
      setError(`Error processing ${school.displayName}: ${err.message}`);
      return null;
    }
  };

  return { findClosestPlace, error };
};
