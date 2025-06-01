import { useState } from "react";
import axios from "axios";
import { AMENITY_TYPES } from "../../utils/constants";

export const useGooglePlacesApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const processSchool = async (school, amenityType) => {
    if (!school?.geometry?.coordinates) {
      console.error('Missing coordinates for school:', school?.name);
      return null;
    }
  
    const [lng, lat] = school.geometry.coordinates;
    
    try {
      setLoading(true);
      setError(null);

      // SPECIAL HANDLING FOR MARKETS
      if (amenityType === 'market') {
        return await fetchMalawiMarkets(lat, lng);
      }

      // Standard handling for other amenity types
      const apiEndpoint = "https://server-nu-peach.vercel.app/api/places/search";
      const amenityConfig = AMENITY_TYPES[amenityType] || amenityType;
      
      const searchParams = {
        lat,
        lng,
        radius: 5000,
        ...(amenityConfig.keyword ? { query: amenityConfig.keyword } : { type: amenityConfig.queryTag })
      };

      const response = await axios.get(apiEndpoint, { params: searchParams });
      return processApiResponse(response, school.name);
  
    } catch (err) {
      console.error('Places API Error:', err);
      setError(`Failed to fetch places: ${err.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Special function for Malawi markets
  const fetchMalawiMarkets = async (lat, lng) => {
    try {
      const response = await axios.get("https://server-nu-peach.vercel.app/api/places/malawi-markets", {
        params: { lat, lng, radius: 5000 }
      });
      return processApiResponse(response, "markets");
    } catch (err) {
      throw new Error(`Market search failed: ${err.message}`);
    }
  };

  // Shared response processing
  const processApiResponse = (response, context) => {
    if (response.data.status !== "OK") {
      throw new Error(response.data.error_message || "API returned non-OK status");
    }

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

    console.log(`Found ${places.length} valid places for ${context}`);
    return places;
  };

  return {
    processSchool,
    loading,
    error,
    clearError: () => setError(null)
    
  };
};