import { useState } from "react";
import axios from "axios";
import { AMENITY_TYPES } from "../utils/constants";

export const useGooglePlacesApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const processSchool = async (school, amenityType) => {
    if (!school?.geometry?.coordinates) {
      console.error('Missing coordinates for school:', school?.displayName);
      return null;
    }
  
    const [lng, lat] = school.geometry.coordinates;
    
    try {
      setLoading(true);
      setError(null);
  
      const apiEndpoint = "http://localhost:5000/api/places/search";
      const amenityConfig = AMENITY_TYPES[amenityType] || amenityType;
      
      const searchParams = {
        lat,
        lng,
        radius: 5000,
        ...(amenityConfig.keyword ? { query: amenityConfig.keyword } : { type: amenityConfig.queryTag })
      };
  
      const response = await axios.get(apiEndpoint, { params: searchParams });
      
      if (response.data.status !== "OK") {
        throw new Error(response.data.error_message || "API returned non-OK status");
      }
  
      // Process places with proper validation
      const places = (response.data.results || []).map(place => {
        if (!place.location || !place.location.lat || !place.location.lng) {
          console.warn('Place missing location data:', place.name);
          return null;
        }
  
        return {
          id: place.id,
          name: place.name,
          location: place.location,
          address: place.address,
          types: place.types,
          rating: place.rating,
          user_ratings_total: place.user_ratings_total
        };
      }).filter(Boolean);
  
      console.log(`Found ${places.length} valid places for ${school.displayName}`);
      return places;
  
    } catch (err) {
      console.error('Places API Error:', err);
      setError(`Failed to fetch places: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    processSchool,
    loading,
    error,
    clearError: () => setError(null)
  };
};