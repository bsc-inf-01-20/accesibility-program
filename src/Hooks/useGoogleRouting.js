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
    console.log('[Routing] Received school:', school); 
    console.log('[Routing] Starting search with mode:', travelMode, 'for school:', school.name);
    
    if (!school?.geometry?.coordinates || school.geometry.coordinates.length !== 2) {
      console.warn(`Invalid school coordinates for ${school?.name || 'unknown school'}`);
      return null;
    }
  
    const [schoolLng, schoolLat] = school.geometry.coordinates;
    const validPlaces = places.filter(place => place?.location?.lat && place?.location?.lng);
  
    if (validPlaces.length === 0) {
      console.warn(`No valid places found for ${school.name}`);
      return null;
    }

    console.log('[Routing] School coordinates verified:', {
      coordinates: school.geometry.coordinates,
      formatted: { lat: schoolLat, lng: schoolLng }
    });
  
    setProgress({ current: 0, total: validPlaces.length, percentage: 0 });
  
    const limit = pLimit(3);
    try {
      const results = await Promise.all(
        validPlaces.map((place, index) =>
          limit(async () => {
            try {
              console.log(`[Routing] Requesting directions (${travelMode}) from ${school.name} to ${place.name}`);
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
  
              if (!response.data || 
                  response.data.status !== 'OK' || 
                  !response.data.routes?.[0]?.legs?.[0] ||
                  !response.data.routes[0].overview_polyline?.points) {
                console.warn('Invalid route structure', {
                  school: school.name,
                  place: place.name,
                  response: response.data
                });
                return null;
              }
  
              const route = response.data.routes[0];
              const leg = route.legs[0];

              const result = {
                // School information
                school: school.name,
                schoolId: school.id,
                schoolCoords: school.geometry.coordinates, // [lng, lat] array
                schoolLocation: { lat: schoolLat, lng: schoolLng }, // {lat, lng} object
                schoolGeometry: school.geometry, // Original geometry object
                
                // Place information
                place: place.name,
                placeId: place.id,
                location: place.location,
                amenityType: amenityType?.label || amenityType,
                
                // Route information
                distance: (leg.distance?.value || 0) / 1000,
                duration: leg.duration?.value || 0,
                time: formatDuration(leg.duration?.value || 0),
                overviewPolyline: route.overview_polyline.points,
                steps: leg.steps.map(step => ({
                  instructions: step.html_instructions?.replace(/<[^>]*>?/gm, '') || 'Continue',
                  distance: step.distance?.text || '0 m',
                  duration: step.duration?.text || '0 mins'
                })),
                
                // Travel mode information
                travelMode,
                requestedTravelMode: travelMode,
                isDriving: travelMode === 'driving',
                bounds: route.bounds,
                responseSource: 'google'
              };

              console.log('[Routing] Generated result:', {
                school: result.school,
                place: result.place,
                schoolLocation: result.schoolLocation,
                placeLocation: result.location,
                travelMode: result.travelMode
              });

              return result;
            } catch (err) {
              console.error(`Failed to process ${place.name} for ${school.name}`, {
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
        console.warn(`No valid routes found for ${school.name}`);
        return null;
      }

      console.log('[Routing] Valid results:', validResults.map(r => ({
        school: r.school,
        place: r.place,
        schoolLocation: r.schoolLocation,
        placeLocation: r.location,
        travelMode: r.travelMode
      })));
  
      const closest = validResults.reduce((min, current) => {
        return current.distance < min.distance ? current : min;
      });

      console.log('[Routing] Selected closest route:', {
        school: closest.school,
        place: closest.place,
        distance: closest.distance,
        schoolLocation: closest.schoolLocation,
        placeLocation: closest.location
      });

      return closest;
    } catch (err) {
      console.error(`Routing error for ${school.name}`, {
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
          console.log(`[Batch] Processing school ${index + 1}/${schools.length}: ${school.name}`);
          const schoolPlaces = allPlaces.filter(p =>
            p.schoolId === school.id || p.schoolName === school.name
          );

          const closest = await findClosestPlace(school, schoolPlaces, amenityType, travelMode);
          if (closest) {
            results.push(closest);
          }

          setProgress({
            current: index + 1,
            total: schools.length,
            percentage: Math.floor(((index + 1) / schools.length) * 100)
          });

        } catch (err) {
          console.error(`Error processing ${school.name}:`, {
            error: err.message,
            travelMode
          });
        }
      }

      console.log('[Batch] Final results:', results.map(r => ({
        school: r.school,
        place: r.place,
        schoolLocation: r.schoolLocation,
        placeLocation: r.location
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