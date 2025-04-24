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

  const findClosestPlace = useCallback(async (school, places, amenityType, travelMode = 'walking') => {
    console.log('[Routing] Starting search with mode:', travelMode, 'for school:', school.displayName);
    
    if (!school?.geometry?.coordinates || school.geometry.coordinates.length !== 2) {
      console.warn(`Invalid school coordinates for ${school?.displayName || 'unknown school'}`);
      return null;
    }
  
    const [schoolLng, schoolLat] = school.geometry.coordinates;
    const validPlaces = places.filter(place => place?.location?.lat && place?.location?.lng);
  
    if (validPlaces.length === 0) {
      console.warn(`No valid places found for ${school.displayName}`);
      return null;
    }
  
    setProgress({ current: 0, total: validPlaces.length, percentage: 0 });
  
    const limit = pLimit(3);
    try {
      const results = await Promise.all(
        validPlaces.map((place, index) =>
          limit(async () => {
            try {
              console.log(`[Routing] Requesting directions (${travelMode}) from ${school.displayName} to ${place.name}`);
              const response = await axios.get('http://localhost:5000/api/directions', {
                params: {
                  origin: `${schoolLat},${schoolLng}`,
                  destination: `${place.location.lat},${place.location.lng}`,
                  mode: travelMode
                },
                timeout: 20000
              });
  
              setProgress(prev => ({
                ...prev,
                current: prev.current + 1,
                percentage: Math.floor(((prev.current + 1) / validPlaces.length) * 100)
              }));
  
              // Enhanced response validation
              if (!response.data || 
                  response.data.status !== 'OK' || 
                  !response.data.routes?.[0]?.legs?.[0] ||
                  !response.data.routes[0].overview_polyline?.points) {
                console.warn('Invalid route structure', {
                  school: school.displayName,
                  place: place.name,
                  response: response.data
                });
                return null;
              }
  
              const route = response.data.routes[0];
              const leg = route.legs[0];

              const result = {
                school: school.displayName,
                schoolId: school.id,
                place: place.name,
                placeId: place.id,
                amenityType: amenityType?.label || amenityType,
                distance: (leg.distance?.value || 0) / 1000,
                duration: leg.duration?.value || 0,
                time: formatDuration(leg.duration?.value || 0),
                location: place.location,
                overviewPolyline: route.overview_polyline.points,
                steps: leg.steps.map(step => ({
                  instructions: step.html_instructions?.replace(/<[^>]*>?/gm, '') || 'Continue',
                  distance: step.distance?.text || '0 m',
                  duration: step.duration?.text || '0 mins'
                })),
                travelMode, // Explicitly included
                requestedTravelMode: travelMode, // For debugging
                isDriving: travelMode === 'driving',
                bounds: route.bounds,
                responseSource: 'google' // For tracking
              };

              console.log('[Routing] Generated result:', {
                summary: `${result.school} to ${result.place}`,
                mode: result.travelMode,
                distance: result.distance
              });

              return result;
            } catch (err) {
              console.error(`Failed to process ${place.name} for ${school.displayName}`, {
                error: err.message,
                coordinates: {
                  school: `${schoolLat},${schoolLng}`,
                  place: `${place.location.lat},${place.location.lng}`
                },
                travelMode
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

      console.log('[Routing] Valid results before reduction:', validResults.map(r => ({
        place: r.place,
        mode: r.travelMode,
        distance: r.distance
      })));
  
      const closest = validResults.reduce((min, current) => {
        const isCloser = current.distance < min.distance;
        console.log('[Routing] Comparing:', {
          current: { place: current.place, mode: current.travelMode, distance: current.distance },
          min: { place: min.place, mode: min.travelMode, distance: min.distance },
          isCloser
        });
        return isCloser ? current : min;
      });

      console.log('[Routing] Selected closest:', {
        place: closest.place,
        mode: closest.travelMode,
        distance: closest.distance
      });

      return closest;
    } catch (err) {
      console.error(`Routing error for ${school.displayName}`, {
        error: err.message,
        travelMode
      });
      return null;
    }
  }, []);

  const findClosestPlaces = useCallback(async (schools, allPlaces, amenityType, travelMode = 'walking') => {
    console.log('[Batch] Starting batch processing with mode:', travelMode);
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
          console.log(`[Batch] Processing school ${index + 1}/${schools.length}: ${school.displayName}`);
          const schoolPlaces = allPlaces.filter(p =>
            p.schoolId === school.id || p.schoolName === school.displayName
          );

          const closest = await findClosestPlace(school, schoolPlaces, amenityType, travelMode);
          if (closest) {
            console.log(`[Batch] Added result for ${school.displayName}`, {
              place: closest.place,
              mode: closest.travelMode
            });
            results.push(closest);
          }

          setProgress({
            current: index + 1,
            total: schools.length,
            percentage: Math.floor(((index + 1) / schools.length) * 100)
          });

        } catch (err) {
          console.error(`Error processing ${school.displayName}:`, {
            error: err.message,
            travelMode
          });
        }
      }

      console.log('[Batch] Final results:', results.map(r => ({
        school: r.school,
        place: r.place,
        mode: r.travelMode
      })));

      return results;

    } catch (err) {
      console.error('Batch processing error:', {
        error: err.message,
        travelMode
      });
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