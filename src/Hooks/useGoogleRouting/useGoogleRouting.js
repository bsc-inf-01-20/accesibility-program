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

  const findClosestPlace = useCallback(async (...args) => {
    // Flexible parameter handling
    let origin, destinations, amenityType, travelMode;
    
    if (args.length === 4) {
      // Called with (origin, destinations, amenityType, travelMode)
      [origin, destinations, amenityType, travelMode] = args;
    } else if (args.length === 3 && typeof args[2] === 'string') {
      // Called with (origin, destinations, travelMode)
      [origin, destinations, travelMode] = args;
      amenityType = undefined;
    } else if (args.length === 3) {
      // Called with (origin, destinations, amenityType)
      [origin, destinations, amenityType] = args;
      travelMode = 'walking';
    } else if (args.length === 2) {
      // Called with (origin, destinations)
      [origin, destinations] = args;
      amenityType = undefined;
      travelMode = 'walking';
    } else {
      throw new Error('Invalid number of arguments');
    }

    console.log('[Routing] Parameters:', {
      origin: origin.name || origin.id,
      destinations: destinations.length,
      amenityType,
      travelMode
    });

    if (!origin?.geometry?.coordinates || origin.geometry.coordinates.length !== 2) {
      console.warn(`Invalid origin coordinates for ${origin?.name || 'unknown origin'}`);
      return null;
    }

    const [originLng, originLat] = origin.geometry.coordinates;
    const validDestinations = destinations.filter(dest => dest?.location?.lat && dest?.location?.lng);

    if (validDestinations.length === 0) {
      console.warn('No valid destinations found');
      return null;
    }

    console.log('[Routing] Origin coordinates verified:', {
      coordinates: origin.geometry.coordinates,
      formatted: { lat: originLat, lng: originLng }
    });

    setProgress({ current: 0, total: validDestinations.length, percentage: 0 });
    const limit = pLimit(3);

    try {
      const results = await Promise.all(
        validDestinations.map((destination) =>
          limit(async () => {
            try {
              console.log(`[Routing] Requesting directions (${travelMode}) from ${origin.name || origin.id} to ${destination.name || destination.id}`);
              
              const response = await axios.get('https://server-nu-peach.vercel.app/api/directions', {
                params: {
                  origin: `${originLat},${originLng}`,
                  destination: `${destination.location.lat},${destination.location.lng}`,
                  mode: travelMode
                },
                timeout: 20000
              });

              setProgress(prev => ({
                ...prev,
                current: prev.current + 1,
                percentage: Math.floor(((prev.current + 1) / validDestinations.length) * 100)
              }));

              if (!response.data || 
                  response.data.status !== 'OK' || 
                  !response.data.routes?.[0]?.legs?.[0] ||
                  !response.data.routes[0].overview_polyline?.points) {
                console.warn('Invalid route structure', {
                  origin: origin.name || origin.id,
                  destination: destination.name || destination.id,
                  response: response.data
                });
                return null;
              }

              const route = response.data.routes[0];
              const leg = route.legs[0];

              return {
                // Origin information
                origin: origin.name || origin.id,
                originId: origin.id,
                originCoords: origin.geometry.coordinates,
                originLocation: { lat: originLat, lng: originLng },
                
                // Destination information
                destination: destination.name || destination.id,
                destinationId: destination.id,
                location: destination.location,
                
                // Optional amenity type
                ...(amenityType && { amenityType: amenityType?.label || amenityType }),
                
                // Route information
                distance: (leg.distance?.value || 0) / 1000,
                duration: leg.duration?.value || 0,
                time: formatDuration(leg.duration?.value || 0),
                overviewPolyline: route.overview_polyline.points,
                steps: leg.steps?.map(step => ({
                  instructions: step.html_instructions?.replace(/<[^>]*>?/gm, '') || 'Continue',
                  distance: step.distance?.text || '0 m',
                  duration: step.duration?.text || '0 mins'
                })) || [],
                
                // Travel mode information
                travelMode,
                requestedTravelMode: travelMode,
                isDriving: travelMode === 'driving',
                bounds: route.bounds,
                responseSource: 'google'
              };
            } catch (err) {
              console.error(`Failed to process route`, {
                error: err.message,
                origin: origin.name || origin.id,
                destination: destination.name || destination.id,
                travelMode
              });
              return null;
            }
          })
        )
      );

      const validResults = results.filter(Boolean);
      if (validResults.length === 0) {
        console.warn('No valid routes found');
        return null;
      }

      // Find closest result
      const closest = validResults.reduce((min, current) => 
        current.distance < min.distance ? current : min
      );

      console.log('[Routing] Selected closest route:', {
        origin: closest.origin,
        destination: closest.destination,
        distance: closest.distance,
        duration: closest.duration,
        travelMode: closest.travelMode
      });

      return closest;
    } catch (err) {
      console.error('Routing error:', {
        error: err.message,
        origin: origin.name || origin.id,
        travelMode
      });
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Batch processing function remains similar but uses the flexible findClosestPlace
  const findClosestPlaces = useCallback(async (...args) => {
    let origins, allDestinations, amenityType, travelMode;
    
    if (args.length === 4) {
      [origins, allDestinations, amenityType, travelMode] = args;
    } else if (args.length === 3 && typeof args[2] === 'string') {
      [origins, allDestinations, travelMode] = args;
      amenityType = undefined;
    } else {
      throw new Error('Invalid arguments');
    }

    // ... rest of batch implementation
    // (similar to your existing findClosestPlaces but using the new parameter handling)
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