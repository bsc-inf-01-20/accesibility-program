import { useState } from 'react';
import { fetchNearbyAmenities } from '../utils/overpass';
import { findClosestPlace } from '../utils/osrm';
import { SEARCH_RADIUS, EXTENDED_RADIUS_1, EXTENDED_RADIUS_2 } from '../utils/constants';

export const useOverpassApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const processSchool = async (school, amenityType) => {
    try {
      let amenities = await fetchNearbyAmenities(
        school.geometry.coordinates[1],
        school.geometry.coordinates[0],
        amenityType
      );

      if (amenities.length === 0) {
        amenities = await fetchNearbyAmenities(
          school.geometry.coordinates[1],
          school.geometry.coordinates[0],
          amenityType,
          0, 0, EXTENDED_RADIUS_1
        );
      }

      if (amenities.length === 0) {
        amenities = await fetchNearbyAmenities(
          school.geometry.coordinates[1],
          school.geometry.coordinates[0],
          amenityType,
          0, 0, EXTENDED_RADIUS_2
        );
      }

      if (amenities.length > 0) {
        return await findClosestPlace(school, amenities, amenityType);
      }
      return null;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  return { processSchool, loading, error, setLoading };
};