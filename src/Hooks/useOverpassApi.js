import { useState } from 'react';
import { fetchNearbyAmenities } from '../utils/overpass';
import { EXTENDED_RADIUS_1, EXTENDED_RADIUS_2 } from '../utils/constants';

export const useOverpassApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const processSchool = async (school, amenityType) => {
    if (!school?.geometry?.coordinates) {
      console.error('School missing coordinates:', school.displayName);
      return null;
    }

    try {
      const [lon, lat] = school.geometry.coordinates;
      console.log(`Processing school: ${school.displayName} @ ${lon},${lat}`);

      let amenities = await fetchNearbyAmenities(lat, lon, amenityType);
      if (!amenities.length) {
        amenities = await fetchNearbyAmenities(lat, lon, amenityType, 0, 0, EXTENDED_RADIUS_1);
      }
      if (!amenities.length) {
        amenities = await fetchNearbyAmenities(lat, lon, amenityType, 0, 0, EXTENDED_RADIUS_2);
      }

      // Return just the amenities, not the closest place
      return amenities.length ? amenities : null;
    } catch (err) {
      console.error('Process error:', err);
      setError(err.message);
      return null;
    }
  };

  return { 
    processSchool, 
    loading, 
    error, 
    setLoading 
  };
};