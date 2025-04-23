import { useState, useCallback } from 'react';
import axios from 'axios';
import pLimit from 'p-limit';

const formatDuration = (seconds) => {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${totalMinutes} mins`;
};

export const useGoogleRouting = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0
  });

  const findClosestPlace = useCallback(async (school, places, amenityType) => {
    if (!school?.geometry?.coordinates || school.geometry.coordinates.length !== 2) {
      console.warn(`Invalid school coordinates for ${school?.displayName || 'unknown school'}`);
      return null;
    }

    const [schoolLng, schoolLat] = school.geometry.coordinates;

    const validPlaces = places.filter(place => {
      if (!place?.location?.lat || !place?.location?.lng) {
        console.warn(`Skipping place with invalid coordinates: ${place?.name || 'unknown place'}`);
        return false;
      }
      return true;
    });

    if (validPlaces.length === 0) {
      console.warn(`No valid places found for ${school.displayName}`);
      return null;
    }

    setProgress({
      current: 0,
      total: validPlaces.length,
      percentage: 0
    });

    const limit = pLimit(3); // Limit concurrency to 3 requests at a time

    try {
      const results = await Promise.all(
        validPlaces.map((place, index) =>
          limit(async () => {
            try {
              const response = await axios.get('http://localhost:5000/api/directions', {
                params: {
                  origin: `${schoolLat},${schoolLng}`,
                  destination: `${place.location.lat},${place.location.lng}`,
                  mode: 'walking'
                },
                timeout: 20000
              });

              setProgress(prev => {
                const current = prev.current + 1;
                return {
                  ...prev,
                  current,
                  percentage: Math.floor((current / validPlaces.length) * 100)
                };
              });

              if (response.data.status !== 'OK' || !response.data.routes?.[0]?.legs?.[0]) {
                console.warn('Invalid route structure', { school: school.displayName, place: place.name });
                return null;
              }

              const route = response.data.routes[0];
              const leg = route.legs[0];

              if (!route.overview_polyline?.points) {
                console.warn('Missing overview polyline', { school: school.displayName, place: place.name });
                return null;
              }

              const steps = leg.steps.map(step => ({
                instructions: step.html_instructions
                  ? step.html_instructions.replace(/<[^>]*>?/gm, '')
                  : 'Continue',
                distance: step.distance?.text || '0 m',
                duration: step.duration?.text || '0 mins',
                startLocation: step.start_location,
                endLocation: step.end_location
              }));

              return {
                school: school.displayName,
                schoolId: school.id,
                schoolLocation: { lat: schoolLat, lng: schoolLng },
                place: place.name,
                placeId: place.id,
                amenityType: amenityType?.label || amenityType,
                distance: (leg.distance?.value || 0) / 1000,
                duration: leg.duration?.value || 0,
                time: formatDuration(leg.duration?.value || 0),
                location: place.location,
                overviewPolyline: route.overview_polyline.points,
                steps,
                bounds: {
                  northeast: {
                    lat: route.bounds?.northeast?.lat || Math.max(schoolLat, place.location.lat) + 0.01,
                    lng: route.bounds?.northeast?.lng || Math.max(schoolLng, place.location.lng) + 0.01
                  },
                  southwest: {
                    lat: route.bounds?.southwest?.lat || Math.min(schoolLat, place.location.lat) - 0.01,
                    lng: route.bounds?.southwest?.lng || Math.min(schoolLng, place.location.lng) - 0.01
                  }
                }
              };
            } catch (err) {
              console.error(`Failed to process ${place.name} for ${school.displayName}`, {
                error: err.message,
                coordinates: {
                  school: `${schoolLat},${schoolLng}`,
                  place: `${place.location.lat},${place.location.lng}`
                }
              });
              return null;
            }
          })
        )
      );

      const validResults = results.filter(Boolean);
      if (validResults.length === 0) {
        console.warn(`No valid routes found for ${school.displayName}`);
        return null;
      }

      const closest = validResults.reduce((min, current) =>
        current.distance < min.distance ? current : min
      );

      console.log(`Found closest ${amenityType?.label || amenityType} for ${school.displayName}:`, {
        place: closest.place,
        distance: `${closest.distance.toFixed(2)} km`,
        duration: closest.time,
        polylineLength: closest.overviewPolyline.length
      });

      return closest;

    } catch (err) {
      console.error(`Routing error for ${school.displayName}`, {
        error: err.message,
        stack: err.stack,
        coordinates: `${schoolLat},${schoolLng}`,
        placeCount: validPlaces.length
      });
      setError(`Failed to calculate routes for ${school.displayName}: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const findClosestPlaces = useCallback(async (schools, allPlaces, amenityType) => {
    if (!schools?.length || !allPlaces?.length) {
      console.warn('Invalid input for batch processing');
      return [];
    }

    setLoading(true);
    setError(null);
    setProgress({
      current: 0,
      total: schools.length,
      percentage: 0
    });

    try {
      const results = [];

      for (const [index, school] of schools.entries()) {
        try {
          const schoolPlaces = allPlaces.filter(p =>
            p.schoolId === school.id || p.schoolName === school.displayName
          );

          const closest = await findClosestPlace(school, schoolPlaces, amenityType);
          if (closest) results.push(closest);

          setProgress({
            current: index + 1,
            total: schools.length,
            percentage: Math.floor(((index + 1) / schools.length) * 100)
          });

        } catch (err) {
          console.error(`Error processing ${school.displayName}:`, err);
        }
      }

      return results;

    } catch (err) {
      console.error('Batch processing error:', err);
      setError(`Batch processing failed: ${err.message}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [findClosestPlace]);

  const reset = useCallback(() => {
    setError(null);
    setProgress({
      current: 0,
      total: 0,
      percentage: 0
    });
  }, []);

  return {
    findClosestPlace,
    findClosestPlaces,
    loading,
    error,
    progress,
    reset
  };
};
