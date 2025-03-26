import React, { useState, useEffect, useCallback } from 'react';
import { 
  Button,
  ButtonStrip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularLoader,
  NoticeBox,
  SingleSelect,
  SingleSelectOption
} from '@dhis2/ui';
import useFetchSchools from './Hooks/useFetchSchools';
import './ClosestPlaceFinder.css';

const OVERPASS_INSTANCES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

const OSRM_URL = 'http://localhost:5000/route/v1/walking';
const INITIAL_BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;
const CACHE_TTL_MS = 3600000;
const SEARCH_RADIUS = 10000;
const EXTENDED_RADIUS_1 = 30000;
const EXTENDED_RADIUS_2 = 40000;

const AMENITY_TYPES = {
  MARKET: { key: 'market', label: 'Market', queryTag: 'amenity=marketplace' },
  CLINIC: { key: 'clinic', label: 'Clinic', queryTag: 'amenity=clinic' },
  HOSPITAL: { key: 'hospital', label: 'Hospital', queryTag: 'amenity=hospital' }
};

const placeCache = new Map();
const getCacheKey = (lat, lon, radius, type) => 
  `${lat.toFixed(4)}_${lon.toFixed(4)}_${radius}_${type}`;

const cleanupCache = () => {
  const now = Date.now();
  for (const [key, { timestamp }] of placeCache.entries()) {
    if (now - timestamp > CACHE_TTL_MS) placeCache.delete(key);
  }
};

const fetchNearbyAmenities = async (lat, lon, amenityType, instanceIndex = 0, retryCount = 0, radius = SEARCH_RADIUS) => {
  cleanupCache();
  const cacheKey = getCacheKey(lat, lon, radius, amenityType.key);
  
  if (placeCache.has(cacheKey)) return placeCache.get(cacheKey).data;

  const overpassQuery = `
    [out:json][timeout:30];
    node[${amenityType.queryTag}](around:${radius},${lat},${lon});
    out body;
  `;

  const selectedInstance = OVERPASS_INSTANCES[instanceIndex % OVERPASS_INSTANCES.length];

  try {
    const response = await fetch(`${selectedInstance}?data=${encodeURIComponent(overpassQuery)}`, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const amenities = data.elements.map(element => ({
      name: element.tags?.name || `Unnamed ${amenityType.label}`,
      lat: element.lat,
      lon: element.lon
    }));

    placeCache.set(cacheKey, { data: amenities, timestamp: Date.now() });
    return amenities;
  } catch (err) {
    console.error(`Attempt ${retryCount + 1} failed on ${selectedInstance}:`, err.message);
    if (retryCount < 3) {
      const nextInstanceIndex = (instanceIndex + 1) % OVERPASS_INSTANCES.length;
      return fetchNearbyAmenities(lat, lon, amenityType, nextInstanceIndex, retryCount + 1, radius);
    }
    console.error('All Overpass instances failed for query');
    return [];
  }
};

const findClosestPlace = async (school, places, amenityType) => {
  if (!places || places.length === 0) {
    console.log(`No ${amenityType.label.toLowerCase()}s found near ${school.displayName}`);
    return null;
  }

  try {
    const startLon = school.geometry.coordinates[0];
    const startLat = school.geometry.coordinates[1];
    const destinations = places.map(p => `${p.lon},${p.lat}`).join(';');
    
    const osrmQuery = `${OSRM_URL}/${startLon},${startLat};${destinations}?overview=false`;
    const response = await fetch(osrmQuery, {
      signal: AbortSignal.timeout(15000),
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OSRM error response:', errorText);
      return null;
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.[0]?.legs) {
      console.warn('Invalid OSRM response structure');
      return null;
    }

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
  } catch (err) {
    console.error(`Error processing ${school.displayName}:`, err);
    return null;
  }
};

const ClosestPlaceFinder = () => {
  const { schools, fetchNextPage, loading: schoolsLoading, hasMore, error: schoolsError } = useFetchSchools();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ processed: 0, total: 1 });
  const [currentBatch, setCurrentBatch] = useState([]);
  const [selectedAmenity, setSelectedAmenity] = useState(AMENITY_TYPES.MARKET);

  const processBatch = useCallback(async (batch, batchIndex) => {
    const instanceIndex = batchIndex % OVERPASS_INSTANCES.length;
    const batchResults = [];

    for (const school of batch) {
      try {
        let amenities = await fetchNearbyAmenities(
          school.geometry.coordinates[1],
          school.geometry.coordinates[0],
          selectedAmenity,
          instanceIndex
        );

        if (amenities.length === 0) {
          amenities = await fetchNearbyAmenities(
            school.geometry.coordinates[1],
            school.geometry.coordinates[0],
            selectedAmenity,
            instanceIndex,
            0,
            EXTENDED_RADIUS_1
          );
        }

        if (amenities.length === 0) {
          amenities = await fetchNearbyAmenities(
            school.geometry.coordinates[1],
            school.geometry.coordinates[0],
            selectedAmenity,
            instanceIndex,
            0,
            EXTENDED_RADIUS_2
          );
        }

        if (amenities.length > 0) {
          const closest = await findClosestPlace(school, amenities, selectedAmenity);
          if (closest) {
            setPlaces(prev => [...prev, closest]);
            batchResults.push(closest);
          }
        }
      } catch (err) {
        console.error(`Error processing ${school.displayName}:`, err);
      } finally {
        setProgress(prev => ({
          ...prev,
          processed: Math.min(prev.total, prev.processed + 1)
        }));
      }
    }

    return batchResults;
  }, [selectedAmenity]);

  const handleFetchData = async () => {
    if (loading || !schools.length) return;

    try {
      const testResponse = await fetch(
        `${OSRM_URL}/34.0,-13.5;34.1,-13.5?overview=false`,
        { signal: AbortSignal.timeout(5000) }
      );
      
      if (!testResponse.ok) throw new Error(`OSRM responded with status ${testResponse.status}`);
      const testData = await testResponse.json();
      if (testData.code !== 'Ok') throw new Error('OSRM returned non-OK status');
    } catch (err) {
      setError(`Failed to connect to OSRM: ${err.message}`);
      return;
    }

    setLoading(true);
    setError(null);
    setPlaces([]);
    setProgress({ processed: 0, total: schools.length });

    try {
      let batchIndex = 0;
      let dynamicBatchSize = INITIAL_BATCH_SIZE;

      for (let i = 0; i < schools.length; i += dynamicBatchSize) {
        const batch = schools.slice(i, i + dynamicBatchSize);
        setCurrentBatch(batch.map(s => s.displayName));

        const startTime = Date.now();
        await processBatch(batch, batchIndex);
        const processingTime = Date.now() - startTime;

        batchIndex++;
        
        if (processingTime < 1000 && dynamicBatchSize < 10) {
          dynamicBatchSize = Math.min(dynamicBatchSize + 1, 10);
        } else if (processingTime > 3000 && dynamicBatchSize > 2) {
          dynamicBatchSize = Math.max(dynamicBatchSize - 1, 2);
        }

        if (i + dynamicBatchSize < schools.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
    } catch (error) {
      console.error('Processing error:', error);
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

  const progressPercent = Math.min(100, 
    (progress.processed / Math.max(1, progress.total)) * 100
  );

  return (
    <div className="closest-place-finder">
      <h1 className="app-header">School Proximity Analyzer</h1>
      
      <div className="control-panel">
        <div className="controls-row">
          <div className="select-container">
            <SingleSelect
              selected={selectedAmenity.key}
              onChange={({ selected }) => 
                setSelectedAmenity(
                  Object.values(AMENITY_TYPES).find(t => t.key === selected)
                )
              }
              label="Select amenity type"
            >
              {Object.values(AMENITY_TYPES).map(type => (
                <SingleSelectOption 
                  key={type.key} 
                  value={type.key} 
                  label={type.label} 
                />
              ))}
            </SingleSelect>
          </div>

          <ButtonStrip>
            <Button 
              onClick={handleFetchData}
              disabled={loading || schoolsLoading}
              icon={loading ? <CircularLoader small /> : null}
            >
              {loading ? `Processing (${progress.processed}/${progress.total})` : 'Start Processing'}
            </Button>
          </ButtonStrip>
        </div>

        {error && (
          <NoticeBox error title="Error">
            {error}
          </NoticeBox>
        )}

        <div className="progress-container">
          <div className="progress-header">
            <span>Progress</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="progress-bar-outer">
            <div 
              className="progress-bar-inner" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {currentBatch.length > 0 && (
          <NoticeBox info title="Current Batch">
            <ul className="current-batch-list">
              {currentBatch.map((school, i) => (
                <li key={i} className="current-batch-item">
                  {school}
                </li>
              ))}
            </ul>
          </NoticeBox>
        )}
      </div>

      <Table className="results-table">
        <TableHead>
          <TableRow>
            <TableCell className="table-header-cell">School Name</TableCell>
            <TableCell className="table-header-cell">Closest {selectedAmenity.label}</TableCell>
            <TableCell className="table-header-cell">Distance (km)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {places.length > 0 ? (
            places.map((place) => (
              <TableRow key={place.id}>
                <TableCell className="table-cell">{place.school}</TableCell>
                <TableCell className="table-cell">{place.place}</TableCell>
                <TableCell className="table-cell">{place.distance}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan="3" className="table-cell-centered">
                {loading ? (
                  <div className="loading-indicator">
                    <CircularLoader small />
                    <span className="loading-text">Processing data...</span>
                  </div>
                ) : 'No results yet. Click "Start Processing" to begin.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ClosestPlaceFinder;