import { useState } from 'react';
import axios from 'axios';

export const useSaveToMongo = () => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });

  const transformForMongo = (result) => {
    // Validate required fields
    const requiredFields = {
      schoolId: result.schoolId,
      placeId: result.placeId,  // Changed from place to placeId
      distance: result.distance
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value) throw new Error(`Missing required field: ${field}`);
      if (field === 'distance' && typeof value !== 'number') {
        throw new Error('Distance must be a number');
      }
    }

    // Convert coordinates to proper format
    const schoolCoords = Array.isArray(result.schoolCoords)
      ? { lat: result.schoolCoords[1], lng: result.schoolCoords[0] }
      : result.schoolCoords || { lat: 0, lng: 0 };

    return {
      schoolId: result.schoolId,
      schoolName: result.school || `School ${result.schoolId.slice(0, 5)}...`,
      placeId: result.placeId,  // Using placeId instead of place
      place: result.place || 'Unknown Place',  // Keep as secondary field if needed
      travelMode: result.travelMode || 'walking',
      amenityType: result.amenityType || 'unknown',
      distance: result.distance,
      duration: result.duration || 0,
      schoolCoords,
      placeCoords: result.location 
        ? { lat: result.location.lat, lng: result.location.lng }
        : { lat: 0, lng: 0 },
      location: result.location || { lat: 0, lng: 0 },
      overviewPolyline: result.overviewPolyline || '',
      createdAt: new Date()
    };
  };

  const saveBulk = async (results) => {
    setSaving(true);
    setError(null);
    setProgress({ processed: 0, total: results.length });

    try {
      // Transform and validate
      const transformed = results.map(result => {
        try {
          return transformForMongo(result);
        } catch (error) {
          console.error('Invalid route:', { error, result });
          return null;
        }
      }).filter(Boolean);

      if (transformed.length === 0) {
        throw new Error('No valid routes to save - check required fields');
      }

      // Process in chunks
      const chunkSize = 20;
      const savedRoutes = [];

      for (let i = 0; i < transformed.length; i += chunkSize) {
        const chunk = transformed.slice(i, i + chunkSize);
        console.log('Sending chunk:', chunk);

        const response = await axios.post(
          'https://server-nu-peach.vercel.app/api/routes/bulk',
          chunk,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        // Handle response
        if (response.data?.routes) {
          savedRoutes.push(...response.data.routes);
        } else if (Array.isArray(response.data)) {
          savedRoutes.push(...response.data);
        } else if (response.data) {
          savedRoutes.push(response.data);
        }

        setProgress({ processed: i + chunk.length, total: transformed.length });
      }

      return {
        success: true,
        savedCount: savedRoutes.length,
        savedRoutes
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || 
                     error.message || 
                     'Failed to save routes';
      
      setError(errorMsg);
      return {
        success: false,
        error: errorMsg,
        failures: error.response?.data?.failures || []
      };
    } finally {
      setSaving(false);
    }
  };

  return { 
    saveBulk, 
    saving, 
    error, 
    progress,
    resetError: () => setError(null) 
  };
};