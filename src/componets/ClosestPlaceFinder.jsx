import React, { useState, useEffect } from "react";
import useFetchSchools from "./Hooks/useFetchSchools";

const OVERPASS_URL = "http://overpass-api.de/api/interpreter";
const OSRM_URL = "http://localhost:5000/route/v1/walking";

// Function to fetch places from Overpass API with retries
const fetchPlaces = async (lat, lon, radius, type, retries = 3) => {
    const queries = {
        market: `node["amenity"="marketplace"](around:${radius},${lat},${lon});`,
        hospital: `node["amenity"="hospital"](around:${radius},${lat},${lon});`,
        clinic: `node["amenity"="clinic"](around:${radius},${lat},${lon});`,
    };
    if (!queries[type]) return [];

    const overpassQuery = `[out:json][timeout:30];(${queries[type]});out body;`;

    while (retries > 0) {
        try {
            const response = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(overpassQuery)}`);
            const data = await response.json();
            return data.elements.map((p) => ({
                name: p.tags?.name || "Unknown",
                lat: p.lat,
                lon: p.lon,
            }));
        } catch (err) {
            console.error("Error fetching places, retrying...", err);
            retries -= 1;
            if (retries === 0) {
                console.error("Failed to fetch places after retries.");
                return [];
            }
        }
    }
};

// Function to find the closest place using OSRM
const findClosestPlace = async (school, places) => {
    if (places.length === 0) return null;

    const placeCoords = places.map((p) => `${p.lon},${p.lat}`).join(";");
    const osrmQuery = `${OSRM_URL}/${school.geometry.coordinates[0]},${school.geometry.coordinates[1]};${placeCoords}?overview=false`;

    try {
        const response = await fetch(osrmQuery);
        const data = await response.json();
        if (!data.routes || !data.routes[0]?.legs) {
            console.warn(`No valid routes found for ${school.displayName}`);
            return null;
        }

        const distances = data.routes[0].legs.map((leg, index) => ({
            place: places[index].name,
            distance: leg.distance / 1000, // Convert to kilometers
        }));

        distances.sort((a, b) => a.distance - b.distance); // Sort by shortest distance
        return { school: school.displayName, place: distances[0].place, distance: distances[0].distance };
    } catch (err) {
        console.error("Error calculating routes:", err);
        return null;
    }
};

// Main React Component
const ClosestPlaceFinder = () => {
    const { schools, fetchNextPage, loading: schoolsLoading, hasMore, error: schoolsError } = useFetchSchools();
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleFetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            const processedSchools = new Set(); // Track processed schools
            let allPlacesData = []; // Store all closest places
            let progress = true; // Detect work being done

            while (progress && (hasMore || schools.length > processedSchools.size)) {
                progress = false; // Reset progress at the start of the loop

                // Filter unprocessed schools with valid geometry
                const unprocessedSchools = schools.filter(
                    (school) => !processedSchools.has(school.id) && school.geometry?.coordinates
                );
                console.log("Processing batch:", unprocessedSchools);
                console.log("Processed schools count:", processedSchools.size);
                console.log("Has more pages:", hasMore);

                if (unprocessedSchools.length === 0) {
                    if (hasMore) {
                        console.log("Fetching next page...");
                        await fetchNextPage();
                        continue; // Retry with new data
                    } else {
                        break; // Exit loop
                    }
                }

                // Process the next batch of schools
                const batchSize = 10;
                const batch = unprocessedSchools.slice(0, batchSize);
                const batchPlaces = [];

                for (const school of batch) {
                    try {
                        const nearbyPlaces = await fetchPlaces(
                            school.geometry.coordinates[1], // Latitude
                            school.geometry.coordinates[0], // Longitude
                            20000, // Radius
                            "market" // Type of place
                        );
                        if (nearbyPlaces.length > 0) {
                            const closest = await findClosestPlace(school, nearbyPlaces);
                            if (closest) {
                                batchPlaces.push(closest);
                                progress = true; // Mark progress as made
                            }
                        } else {
                            console.warn(`No places found near ${school.displayName}`);
                        }
                    } catch (err) {
                        console.error(`Error processing school ${school.displayName}:`, err);
                    } finally {
                        processedSchools.add(school.id); // Always mark school as processed
                    }
                }

                allPlacesData = [...allPlacesData, ...batchPlaces]; // Add results to all places
                setPlaces(allPlacesData); // Update state incrementally
            }
        } catch (err) {
            setError("Failed to fetch data.");
            console.error("An error occurred:", err);
        }

        setLoading(false); // Stop the loading indicator
    };

    useEffect(() => {
        if (!schoolsLoading && schools.length === 0 && hasMore) {
            fetchNextPage();
        }
    }, [schoolsLoading, schools, hasMore, fetchNextPage]);

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Closest Places to Schools</h2>

            <button
                onClick={handleFetchData}
                disabled={loading || schoolsLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
            >
                {loading ? "Fetching..." : "Find Closest Places"}
            </button>

            {error && <p className="text-red-500 mt-2">{error}</p>}
            {schoolsError && <p className="text-red-500 mt-2">{schoolsError.message}</p>}

            <table className="min-w-full table-auto border-collapse mt-4">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-2 border">School</th>
                        <th className="p-2 border">Closest Place</th>
                        <th className="p-2 border">Distance (km)</th>
                    </tr>
                </thead>
                <tbody>
                    {places.map((place, index) => (
                        <tr key={index} className="border-b">
                            <td className="p-2">{place.school}</td>
                            <td className="p-2">{place.place}</td>
                            <td className="p-2">{place.distance.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ClosestPlaceFinder;