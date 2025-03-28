import { OSRM_URL } from "./constants";

export const findClosestPlace = async (school, places, amenityType) => {
    if (!places || places.length === 0) return null;
    
    try {
        const startLon = school.geometry.coordinates[0];
        const startLat = school.geometry.coordinates[1];
        const destinations = places.map(p => `${startLon};${destinations}?overview=false`, 
            {signal: AbortSignal.timeout(15000), headers: {'Accept': 'application/json'}}
        );
        if(!response.ok) return null;

        const data = await response.json();
        if (data.code !== 'Ok' || !data.routes?.[0]?.legs) return null;

        const distances = data.routes[0].legs.map((leg, index) => ({
            place: places[index].name,
            distance: leg.distance / 1000,
          }));
          distances.sort((a, b) => a.distance - b.distance);
          return {
            school: school.displayName,
            place: distances[0].place,
            distance: distances[0].distance.toFixed(2),
            amenityType: amenityType.label,
            id: `${school.displayName}-${Date.now()}`
          };
    } catch (error) {
        console.error(`Error processing ${school.displayName}:`, err);
    return null;
    }
}