import { useState, useCallback } from 'react';
import axios from 'axios';

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

  /**
   * Find the closest place from a school to multiple places
   * @param {Object} school - School object with geometry.coordinates
   * @param {Array} places - Array of places with location data
   * @param {Object|string} amenityType - Type of amenity being searched
   * @returns {Promise<Object|null>} Closest place with route details
   */
  const findClosestPlace = useCallback(async (school, places, amenityType) => {
    // Validate school coordinates
    if (!school?.geometry?.coordinates || school.geometry.coordinates.length !== 2) {
      console.warn(`Invalid school coordinates for ${school?.displayName || 'unknown school'}`);
      return null;
    }
  
    const [schoolLng, schoolLat] = school.geometry.coordinates;
    
    // Validate places array
    if (!places || !Array.isArray(places) || places.length === 0) {
      console.warn(`No places provided for ${school.displayName}`);
      return null;
    }
  
    // Filter out places with invalid coordinates
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
  
    // Track progress
    setProgress(prev => ({
      ...prev,
      current: 0,
      total: validPlaces.length,
      percentage: 0
    }));
  
    try {
      // Process all places in parallel with progress updates
      const results = await Promise.all(
        validPlaces.map(async (place, index) => {
          try {
            const response = await axios.get('http://localhost:5000/api/directions', {
              params: {
                origin: `${schoolLat},${schoolLng}`,
                destination: `${place.location.lat},${place.location.lng}`,
                mode: 'walking'
              },
              timeout: 10000 // 10 second timeout
            });
  
            // Update progress
            setProgress(prev => ({
              ...prev,
              current: index + 1,
              percentage: Math.floor(((index + 1) / validPlaces.length) * 100)
            }));
  
            // Validate response structure
            if (response.data.status !== 'OK' || !response.data.routes?.[0]?.legs?.[0]) {
              console.warn('Invalid route structure', {
                school: school.displayName,
                place: place.name,
                response: response.data
              });
              return null;
            }
  
            const route = response.data.routes[0];
            const leg = route.legs[0];
  
            // Verify we have the required polyline data for Leaflet
            if (!route.overview_polyline?.points) {
              console.warn('Missing overview polyline', {
                school: school.displayName,
                place: place.name
              });
              return null;
            }
  
            // Format step instructions for display
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
              distance: (leg.distance?.value || 0) / 1000, // in km
              duration: leg.duration?.value || 0, // in seconds
              time: formatDuration(leg.duration?.value || 0),
              location: place.location,
              overviewPolyline: route.overview_polyline.points, // Critical for Leaflet
              steps,
              bounds: { // Pre-calculated bounds for Leaflet
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
      );
  
      // Filter out null results and find closest place
      const validResults = results.filter(Boolean);
      if (validResults.length === 0) {
        console.warn(`No valid routes found for ${school.displayName}`);
        return null;
      }
  
      // Find the closest place by distance
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

  /**
   * Batch process multiple schools
   * @param {Array} schools - Array of school objects
   * @param {Array} allPlaces - Array of places for all schools
   * @param {Object|string} amenityType - Type of amenity
   * @returns {Promise<Array>} Array of closest places
   */
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
            p.schoolId === school.id || 
            p.schoolName === school.displayName
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