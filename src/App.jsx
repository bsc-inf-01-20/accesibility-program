import React, { useState, useEffect, useCallback } from 'react';
import useFetchSchools from './Hooks/useFetchSchools';

// List of available Overpass API endpoints
const OVERPASS_INSTANCES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

const OSRM_URL = 'http://localhost:5000/route/v1/walking';
const BATCH_SIZE = 5; // Reduced for better rate limiting
const BATCH_DELAY_MS = 1000; // Delay between batches

// Cache implementation
const placeCache = new Map();
const getCacheKey = (lat, lon, radius, type) => 
  `${lat.toFixed(4)}_${lon.toFixed(4)}_${radius}_${type}`;

const fetchPlaces = async (lat, lon, radius, type, instanceIndex = 0, retryCount = 0) => {
  const cacheKey = getCacheKey(lat, lon, radius, type);
  if (placeCache.has(cacheKey)) return placeCache.get(cacheKey);

  const queries = {
    market: `node["amenity"="marketplace"](around:${radius},${lat},${lon});`,
    hospital: `node["amenity"="hospital"](around:${radius},${lat},${lon});`,
    clinic: `node["amenity"="clinic"](around:${radius},${lat},${lon});`,
  };

  if (!queries[type]) return [];

  const overpassQuery = `[out:json][timeout:30];(${queries[type]});out body;`;
  const selectedInstance = OVERPASS_INSTANCES[instanceIndex % OVERPASS_INSTANCES.length];

  try {
    const response = await fetch(`${selectedInstance}?data=${encodeURIComponent(overpassQuery)}`, {
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error('Invalid content type');
    }

    const data = await response.json();
    const results = data.elements.map((p) => ({
      name: p.tags?.name || 'Unknown',
      lat: p.lat,
      lon: p.lon,
    }));

    placeCache.set(cacheKey, results);
    return results;
  } catch (err) {
    console.error(`Attempt ${retryCount + 1} failed on ${selectedInstance}:`, err.message);

    // Try next instance or retry
    if (retryCount < 3) {
      const nextInstanceIndex = (instanceIndex + 1) % OVERPASS_INSTANCES.length;
      return fetchPlaces(lat, lon, radius, type, nextInstanceIndex, retryCount + 1);
    }

    console.error('All instances failed for query:', overpassQuery);
    return [];
  }
};

const findClosestPlace = async (school, places) => {
  if (!places.length) return null;

  try {
    const placeCoords = places.map((p) => `${p.lon},${p.lat}`).join(';');
    const osrmQuery = `${OSRM_URL}/${school.geometry.coordinates[0]},${school.geometry.coordinates[1]};${placeCoords}?overview=false`;

    const response = await fetch(osrmQuery, { signal: AbortSignal.timeout(15000) });
    const data = await response.json();

    if (!data.routes?.[0]?.legs) {
      console.warn(`No valid routes for ${school.displayName}`);
      return null;
    }

    const distances = data.routes[0].legs.map((leg, index) => ({
      place: places[index].name,
      distance: leg.distance / 1000, // Convert to km
    }));

    distances.sort((a, b) => a.distance - b.distance);
    return {
      school: school.displayName,
      place: distances[0].place,
      distance: distances[0].distance,
    };
  } catch (err) {
    console.error(`OSRM error for ${school.displayName}:`, err);
    return null;
  }
};

const ClosestPlaceFinder = () => {
  const { schools, fetchNextPage, loading: schoolsLoading, hasMore, error: schoolsError } = useFetchSchools();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [currentBatch, setCurrentBatch] = useState([]);
  const [activeInstance, setActiveInstance] = useState(OVERPASS_INSTANCES[0]);

  const processBatch = useCallback(async (batch, batchIndex) => {
    const instanceIndex = batchIndex % OVERPASS_INSTANCES.length;
    setActiveInstance(OVERPASS_INSTANCES[instanceIndex]);

    const batchResults = [];
    for (const school of batch) {
      try {
        const nearbyPlaces = await fetchPlaces(
          school.geometry.coordinates[1],
          school.geometry.coordinates[0],
          20000,
          'market',
          instanceIndex
        );

        if (nearbyPlaces.length > 0) {
          const closest = await findClosestPlace(school, nearbyPlaces);
          if (closest) batchResults.push(closest);
        }
      } catch (error) {
        console.error(`Error processing ${school.displayName}:`, error);
      } finally {
        setProgress(prev => ({ ...prev, processed: prev.processed + 1 }));
      }
    }
    return batchResults;
  }, []);

  const handleFetchData = async () => {
    if (loading || !schools.length) return;

    setLoading(true);
    setError(null);
    setPlaces([]);
    setProgress({ processed: 0, total: schools.length });

    try {
      let batchIndex = 0;
      for (let i = 0; i < schools.length; i += BATCH_SIZE) {
        const batch = schools.slice(i, i + BATCH_SIZE);
        setCurrentBatch(batch.map(s => s.displayName));

        const batchResults = await processBatch(batch, batchIndex);
        setPlaces(prev => [...prev, ...batchResults]);
        batchIndex++;

        if (i + BATCH_SIZE < schools.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
    } catch (error) {
      setError('Processing failed: ' + error.message);
    } finally {
      setLoading(false);
      setCurrentBatch([]);
    }
  };

  useEffect(() => {
    if (!schoolsLoading && schools.length === 0 && hasMore) {
      fetchNextPage();
    }
  }, [schoolsLoading, schools, hasMore, fetchNextPage]);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">School Proximity Analyzer</h1>
      
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleFetchData}
            disabled={loading || schoolsLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing ({progress.processed}/{progress.total})
              </span>
            ) : 'Start Processing'}
          </button>

          <div className="text-sm text-gray-600">
            Active Overpass Instance: <span className="font-mono text-blue-600">{new URL(activeInstance).hostname}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{Math.round((progress.processed / progress.total) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${(progress.processed / progress.total) * 100}%` }}
            ></div>
          </div>
        </div>

        {currentBatch.length > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <h3 className="text-sm font-medium text-blue-800">Current Batch</h3>
            <ul className="mt-2 space-y-1">
              {currentBatch.map((school, i) => (
                <li key={i} className="text-sm text-blue-700">{school}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">School</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Closest Place</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distance (km)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {places.length > 0 ? (
                places.map((place, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{place.school}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{place.place}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{place.distance.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="px-6 py-4 text-center text-sm text-gray-500">
                    {loading ? 'Processing data...' : 'No results yet. Click "Start Processing" to begin.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClosestPlaceFinder;