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
    NoticeBox
} from '@dhis2/ui';
import useFetchSchools from './Hooks/useFetchSchools';

const OVERPASS_INSTANCES = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter'
];

const OSRM_URL = 'http://localhost:5000/route/v1/walking';
const INITIAL_BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;
const PARALLEL_REQUESTS = 2;
const CACHE_TTL_MS = 3600000; // 1 hour cache
const SEARCH_RADIUS = 10000; // 10km search radius for markets

const placeCache = new Map();
const getCacheKey = (lat, lon, radius, type) => 
    `${lat.toFixed(4)}_${lon.toFixed(4)}_${radius}_${type}`;

const cleanupCache = () => {
    const now = Date.now();
    for (const [key, { timestamp }] of placeCache.entries()) {
        if (now - timestamp > CACHE_TTL_MS) {
            placeCache.delete(key);
        }
    }
};

const fetchNearbyMarkets = async (lat, lon, instanceIndex = 0, retryCount = 0) => {
    cleanupCache();
    const cacheKey = getCacheKey(lat, lon, SEARCH_RADIUS, 'market');
    
    if (placeCache.has(cacheKey)) {
        return placeCache.get(cacheKey).data;
    }

    const overpassQuery = `
        [out:json][timeout:30];
        node["amenity"="marketplace"](around:${SEARCH_RADIUS},${lat},${lon});
        out body;
    `;

    const selectedInstance = OVERPASS_INSTANCES[instanceIndex % OVERPASS_INSTANCES.length];

    try {
        const response = await fetch(`${selectedInstance}?data=${encodeURIComponent(overpassQuery)}`, {
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const markets = data.elements.map(element => ({
            name: element.tags?.name || 'Unnamed Market',
            lat: element.lat,
            lon: element.lon
        }));

        placeCache.set(cacheKey, {
            data: markets,
            timestamp: Date.now()
        });

        return markets;
    } catch (err) {
        console.error(`Attempt ${retryCount + 1} failed on ${selectedInstance}:`, err.message);

        if (retryCount < 3) {
            const nextInstanceIndex = (instanceIndex + 1) % OVERPASS_INSTANCES.length;
            return fetchNearbyMarkets(lat, lon, nextInstanceIndex, retryCount + 1);
        }

        console.error('All Overpass instances failed for query');
        return [];
    }
};

const findClosestPlace = async (school, places) => {
    if (!places || places.length === 0) {
        console.log(`No markets found near ${school.displayName}`);
        return null;
    }

    try {
        const startLon = school.geometry.coordinates[0];
        const startLat = school.geometry.coordinates[1];
        const destinations = places.map(p => `${p.lon},${p.lat}`).join(';');
        
        const osrmQuery = `${OSRM_URL}/${startLon},${startLat};${destinations}?overview=false`;
        console.log('Making OSRM request:', osrmQuery);

        const response = await fetch(osrmQuery, {
            signal: AbortSignal.timeout(15000),
            headers: {
                'Accept': 'application/json'
            }
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
            distance: leg.distance / 1000, // Convert to km
        }));

        distances.sort((a, b) => a.distance - b.distance);
        
        return {
            school: school.displayName,
            place: distances[0].place,
            distance: distances[0].distance.toFixed(2),
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
    const [activeInstance, setActiveInstance] = useState(OVERPASS_INSTANCES[0]);

    const processBatch = useCallback(async (batch, batchIndex) => {
        const instanceIndex = batchIndex % OVERPASS_INSTANCES.length;
        setActiveInstance(OVERPASS_INSTANCES[instanceIndex]);
        
        const batchResults = [];

        for (const school of batch) {
            try {
                const markets = await fetchNearbyMarkets(
                    school.geometry.coordinates[1],
                    school.geometry.coordinates[0],
                    instanceIndex
                );

                if (markets.length > 0) {
                    const closest = await findClosestPlace(school, markets);
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
    }, []);

    const handleFetchData = async () => {
        if (loading || !schools.length) return;

        // Verify OSRM connection
        try {
            console.log('Testing OSRM connection...');
            const testResponse = await fetch(
                `${OSRM_URL}/34.0,-13.5;34.1,-13.5?overview=false`,
                { signal: AbortSignal.timeout(5000) }
            );
            
            if (!testResponse.ok) {
                throw new Error(`OSRM responded with status ${testResponse.status}`);
            }
            
            const testData = await testResponse.json();
            if (testData.code !== 'Ok') {
                throw new Error('OSRM returned non-OK status');
            }
            console.log('OSRM connection verified');
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
        <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
                School Proximity Analyzer
            </h1>
            
            <div style={{ 
                backgroundColor: 'white', 
                padding: '16px', 
                borderRadius: '4px', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)', 
                marginBottom: '24px'
            }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    marginBottom: '16px'
                }}>
                    <ButtonStrip>
                        <Button 
                            onClick={handleFetchData}
                            disabled={loading || schoolsLoading}
                            icon={loading ? <CircularLoader small /> : null}
                        >
                            {loading ? (
                                `Processing (${progress.processed}/${progress.total})`
                            ) : 'Start Processing'}
                        </Button>
                    </ButtonStrip>

                    <div style={{ 
                        fontSize: '14px', 
                        color: '#6E7A8A'
                    }}>
                        Active Overpass Instance: <span style={{ 
                            fontFamily: 'monospace',
                            color: '#1A72BB'
                        }}>{new URL(activeInstance).hostname}</span>
                    </div>
                </div>

                {error && (
                    <NoticeBox error title="Error" style={{ marginBottom: '16px' }}>
                        {error}
                    </NoticeBox>
                )}

                <div style={{ marginBottom: '16px' }}>
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '14px', 
                        color: '#6E7A8A',
                        marginBottom: '4px'
                    }}>
                        <span>Progress</span>
                        <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: '#e8edf2',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${progressPercent}%`,
                            height: '100%',
                            backgroundColor: '#1A72BB',
                            transition: 'width 300ms ease'
                        }} />
                    </div>
                </div>

                {currentBatch.length > 0 && (
                    <NoticeBox info title="Current Batch" style={{ marginBottom: '16px' }}>
                        <ul style={{ 
                            listStyleType: 'none', 
                            padding: 0,
                            margin: 0
                        }}>
                            {currentBatch.map((school, i) => (
                                <li key={i} style={{ 
                                    fontSize: '14px',
                                    color: '#1A72BB',
                                    marginBottom: '4px'
                                }}>
                                    {school}
                                </li>
                            ))}
                        </ul>
                    </NoticeBox>
                )}
            </div>

            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>School Name</TableCell>
                        <TableCell>Closest Market</TableCell>
                        <TableCell>Distance (km)</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {places.length > 0 ? (
                        places.map((place) => (
                            <TableRow key={place.id}>
                                <TableCell>{place.school}</TableCell>
                                <TableCell>{place.place}</TableCell>
                                <TableCell>{place.distance}</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan="3" style={{ textAlign: 'center' }}>
                                {loading ? (
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center'
                                    }}>
                                        <CircularLoader small />
                                        <span style={{ marginLeft: '8px' }}>Processing data...</span>
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