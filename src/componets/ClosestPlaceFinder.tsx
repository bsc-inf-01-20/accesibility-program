// import React, { useState } from "react";
// import { useSchools } from "../Hooks/useSchools";
// // Import the custom hook

// const OVERPASS_URL = "http://overpass-api.de/api/interpreter";
// const OSRM_URL = "http://router.project-osrm.org/route/v1/walking";

// interface Place {
//   name: string;
//   lat: number;
//   lon: number;
// }

// interface ClosestPlace {
//   school: string;
//   place: string;
//   distance: number;
// }

// // Function to fetch places from Overpass API
// const fetchPlaces = async (lat: number, lon: number, radius: number, type: string): Promise<Place[]> => {
//   const queries: { [key: string]: string } = {
//     market: `node["amenity"="marketplace"](around:${radius},${lat},${lon});`,
//     hospital: `node["amenity"="hospital"](around:${radius},${lat},${lon});`,
//     clinic: `node["amenity"="clinic"](around:${radius},${lat},${lon});`,
//   };
//   if (!queries[type]) return [];

//   const overpassQuery = `[out:json][timeout:30];(${queries[type]});out body;`;
//   const response = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(overpassQuery)}`);
//   const data = await response.json();

//   return data.elements.map((p: any) => ({
//     name: p.tags?.name || "Unknown",
//     lat: p.lat,
//     lon: p.lon,
//   }));
// };

// // Function to find the closest place using OSRM
// const findClosestPlace = async (school: any, places: Place[]): Promise<ClosestPlace | null> => {
//   if (places.length === 0) return null;

//   const placeCoords = places.map((p) => `${p.lon},${p.lat}`).join(";");
//   const osrmQuery = `${OSRM_URL}/${school.lon},${school.lat};${placeCoords}?overview=false`;

//   const response = await fetch(osrmQuery);
//   const data = await response.json();

//   const distances = data.routes[0].legs.map((leg: any, index: number) => ({
//     place: places[index].name,
//     distance: leg.distance / 1000, // Convert to km
//   }));

//   distances.sort((a, b) => a.distance - b.distance);
//   return { school: school.name, place: distances[0].place, distance: distances[0].distance };
// };

// // Main React Component
// const ClosestPlaceFinder = () => {
//   const { schools, loading: schoolsLoading, error: schoolsError } = useSchools(); // Use the custom hook
//   const [places, setPlaces] = useState<ClosestPlace[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const handleFetchData = async () => {
//     if (schoolsLoading || schoolsError) return; // Avoid fetching if schools are still loading or there is an error

//     setLoading(true);
//     setError(null);

//     try {
//       if (schools.length === 0) {
//         setError("No schools found.");
//         setLoading(false);
//         return;
//       }

//       const placesData: ClosestPlace[] = [];
//       for (const school of schools.slice(0, 10)) {
//         if (school.lat === null || school.lon === null) continue; // Skip schools with missing coordinates
      
//         const nearbyPlaces = await fetchPlaces(school.lat, school.lon, 10000, "market");
//         const closest = await findClosestPlace(school, nearbyPlaces);
//         if (closest) placesData.push(closest);
//       }
      

//       setPlaces(placesData);
//     } catch (err) {
//       setError("Failed to fetch data.");
//       console.error(err);
//     }

//     setLoading(false);
//   };

//   return (
//     <div className="p-4">
//       <h2 className="text-xl font-bold mb-4">Closest Places to Schools</h2>

//       <button
//         onClick={handleFetchData}
//         disabled={loading || schoolsLoading}
//         className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
//       >
//         {loading ? "Fetching..." : "Find Closest Places"}
//       </button>

//       {error && <p className="text-red-500 mt-2">{error}</p>}
//       {schoolsError && <p className="text-red-500 mt-2">{schoolsError.message}</p>}

//       <table className="min-w-full table-auto border-collapse mt-4">
//         <thead>
//           <tr className="bg-gray-100">
//             <th className="p-2 border">School</th>
//             <th className="p-2 border">Closest Place</th>
//             <th className="p-2 border">Distance (km)</th>
//           </tr>
//         </thead>
//         <tbody>
//           {places.map((place, index) => (
//             <tr key={index} className="border-b">
//               <td className="p-2">{place.school}</td>
//               <td className="p-2">{place.place}</td>
//               <td className="p-2">{place.distance.toFixed(2)}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// };

// export default ClosestPlaceFinder;
