import React, { useState, useEffect, useRef } from 'react';
import { Button, ButtonStrip, NoticeBox, Modal, ModalTitle, ModalContent, ModalActions } from '@dhis2/ui';
import { useFetchSchools } from '../Hooks/useFetchSchools';
import { useGooglePlacesApi } from '../Hooks/useGooglePlacesApi';
import { useGoogleRouting } from '../Hooks/useGoogleRouting';
import { AMENITY_TYPES } from '../utils/constants';
import { AmenitySelector } from '../components/AmenitySelector/AmenitySelector';
import { ProgressTracker } from '../components/ProgressTracker/ProgressTracker';
import { ResultsTable } from '../components/ResultsTable/ResultsTable';
import { SchoolSelector } from '../components/SchoolSelector/SchoolSelector';
import { LeafletMapViewer } from '../components/MapViewer/LeafletMapViewer';
import './ClosestPlaceFinder.css';

export const ClosestPlaceFinder = () => {
  // School selection hooks
  const { 
    selectedLevels,
    allUnits,
    selectedSchools: filteredSchools,
    loading: schoolsLoading,
    error: schoolsError,
    handleSelectLevel,
    fetchOrgUnits
  } = useFetchSchools();
  
  // Data processing hooks
  const { 
    processSchool, 
    loading: placesLoading, 
    error: placesError 
  } = useGooglePlacesApi();
  
  const { 
    findClosestPlace,
    loading: routingLoading,
    error: routingError,
    progress: routingProgress
  } = useGoogleRouting();

  // State management
  const [places, setPlaces] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [batchResults, setBatchResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState(AMENITY_TYPES.MARKET);
  const [actionTriggered, setActionTriggered] = useState(false);
  const [invalidSchools, setInvalidSchools] = useState([]);
  const [noResultsSchools, setNoResultsSchools] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  
  // Batch processing config
  const BATCH_SIZE = 3;
  
  // Progress tracking
  const [progress, setProgress] = useState({ 
    processed: 0, 
    total: 0,
    isComplete: false 
  });
  
  // Metrics tracking
  const [metrics, setMetrics] = useState({
    speed: 0,
    elapsed: 0,
    remaining: 0,
    initialized: false
  });

  // Refs
  const metricsRef = useRef({
    startTime: null,
    lastUpdate: null,
    lastProcessed: 0
  });
  const metricsIntervalRef = useRef(null);

  // Combine errors from all sources
  const error = schoolsError || placesError || routingError;

  // Format time display
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Metrics calculation effect
  useEffect(() => {
    if (placesLoading && !metricsRef.current.startTime) {
      metricsRef.current = {
        startTime: Date.now(),
        lastUpdate: Date.now(),
        lastProcessed: progress.processed
      };
      
      setMetrics({
        speed: 0,
        elapsed: 0,
        remaining: 0,
        initialized: true
      });

      metricsIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsedSeconds = (now - metricsRef.current.startTime) / 1000;
        
        const processedDelta = progress.processed - metricsRef.current.lastProcessed;
        const timeDelta = (now - metricsRef.current.lastUpdate) / 1000;
        const currentSpeed = timeDelta > 0 ? processedDelta / timeDelta : 0;

        const remainingSchools = progress.total - progress.processed;
        const remainingTime = currentSpeed > 0 ? remainingSchools / currentSpeed : 0;

        setMetrics(prev => ({
          speed: currentSpeed > 0 ? (prev.speed * 0.7 + currentSpeed * 0.3) : currentSpeed,
          elapsed: elapsedSeconds,
          remaining: remainingTime > 0 ? remainingTime : 0,
          initialized: true
        }));

        metricsRef.current = {
          ...metricsRef.current,
          lastUpdate: now,
          lastProcessed: progress.processed
        };
      }, 1000);
    } else if (!placesLoading && metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
      metricsIntervalRef.current = null;
      metricsRef.current = {
        startTime: null,
        lastUpdate: null,
        lastProcessed: 0
      };
    }

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
    };
  }, [placesLoading, progress.processed, progress.total]);

  const processSchoolBatch = async (school, amenityType) => {
    try {
      // 1. Find nearby places
      const foundPlaces = await processSchool(school, amenityType);
      const validPlaces = foundPlaces?.filter(p => p?.location?.lat && p?.location?.lng) || [];
      
      if (validPlaces.length === 0) {
        setNoResultsSchools(prev => [...prev, school.displayName]);
        return null;
      }

      // 2. Find closest place
      const closest = await findClosestPlace(
        {
          ...school,
          geometry: {
            coordinates: school.geometry.coordinates
          }
        },
        validPlaces,
        amenityType
      );

      if (!closest) return null;

      return {
        school: school.displayName,
        schoolId: school.id,
        place: closest.place,
        distance: closest.distance,
        duration: closest.duration,
        time: closest.time,
        overviewPolyline: closest.overviewPolyline,
        steps: closest.steps,
        location: closest.location,
        schoolLocation: closest.schoolLocation,
        bounds: closest.bounds,
        batchId: currentBatchIndex
      };

    } catch (err) {
      console.error(`Error processing ${school.displayName}:`, err);
      return null;
    }
  };

  const handleFetchData = async () => {
    const isLoading = schoolsLoading || placesLoading || routingLoading;
    if (isLoading || filteredSchools.length === 0) return;

    // Filter schools with valid coordinates
    const validSchools = filteredSchools.filter(school => {
      const coords = school?.geometry?.coordinates;
      const hasValidCoords = coords?.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
      if (!hasValidCoords) {
        console.warn(`Invalid coordinates for ${school.displayName}:`, coords);
      }
      return hasValidCoords;
    });

    const invalid = filteredSchools.filter(school => !validSchools.includes(school));
    setInvalidSchools(invalid);

    // Reset state
    setActionTriggered(true);
    setPlaces([]);
    setAllResults([]);
    setBatchResults([]);
    setSelectedResult(null);
    setNoResultsSchools([]);
    setCurrentBatchIndex(0);
    setProgress({ 
      processed: 0, 
      total: validSchools.length,
      isComplete: false
    });

    try {
      // Process in batches
      for (let i = 0; i < validSchools.length; i += BATCH_SIZE) {
        const batch = validSchools.slice(i, i + BATCH_SIZE);
        setCurrentBatchIndex(i);
        
        const batchPromises = batch.map(school => 
          processSchoolBatch(school, selectedAmenity)
        );

        const results = await Promise.all(batchPromises);
        const validResults = results.filter(Boolean);
        
        setBatchResults(prev => [...prev, ...validResults]);
        setPlaces(prev => [...prev, ...validResults]);
        setAllResults(prev => [...prev, ...validResults]);
        setProgress(prev => ({
          ...prev,
          processed: i + batch.length,
          isComplete: i + batch.length >= validSchools.length
        }));
        
        // Small delay between batches for better UX
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (err) {
      console.error('Batch processing error:', err);
      setError(`Processing failed: ${err.message}`);
    }
  };

  return (
    <div className="closest-place-finder">
      <h1 className="app-header">School Proximity Analyzer</h1>
      
      <div className="control-panel">
        {/* School and amenity selection */}
        <div className="selection-section">
          <SchoolSelector 
            selectedLevels={selectedLevels}
            allUnits={allUnits}
            loading={schoolsLoading}
            error={schoolsError}
            handleSelectLevel={handleSelectLevel}
            fetchOrgUnits={fetchOrgUnits}
          />
          
          {filteredSchools.length > 0 && (
            <div className="selection-count">
              {filteredSchools.length} schools selected
            </div>
          )}
          
          <AmenitySelector 
            selectedType={selectedAmenity}
            onChange={setSelectedAmenity}
            options={Object.values(AMENITY_TYPES)}
          />
        </div>

        {/* Action buttons */}
        <div className="action-section">
          <ButtonStrip>
            <Button 
              onClick={handleFetchData}
              disabled={placesLoading || schoolsLoading || !filteredSchools.length}
              primary
            >
              {placesLoading ? 'Processing...' : 'Find Closest Amenities'}
            </Button>
            <Button
              onClick={() => setShowRouteSelector(true)}
              disabled={!progress.isComplete || !allResults.length}
              secondary
            >
              View Routes
            </Button>
          </ButtonStrip>

          {/* Notifications */}
          <div className="notice-container">
            {error && <NoticeBox error title="Error">{error}</NoticeBox>}
            {invalidSchools.length > 0 && (
              <NoticeBox warning title="Notice">
                {invalidSchools.length} schools skipped due to invalid coordinates
              </NoticeBox>
            )}
            {noResultsSchools.length > 0 && (
              <NoticeBox warning title="Notice">
                No {selectedAmenity.label} found near: {noResultsSchools.join(', ')}
              </NoticeBox>
            )}
            {progress.isComplete && (
              <NoticeBox success title="Complete">
                Processed {progress.processed} schools, found {allResults.length} results for {selectedAmenity.label}
              </NoticeBox>
            )}
          </div>
        </div>

        {/* Progress tracking */}
        {(progress.total > 0) && (
          <div className={`progress-section ${placesLoading ? 'is-processing' : ''}`}>
            <div className="progress-header">
              <h3>{placesLoading ? 'Processing...' : 'Completed'}</h3>
              <div className="progress-metrics">
                <div>Processed: {progress.processed}/{progress.total}</div>
                <div>
                  Speed: {metrics.initialized ? 
                    (metrics.speed > 0 ? metrics.speed.toFixed(1) + ' schools/sec' : 'Starting...') 
                    : '--'}
                </div>
                <div className="batch-progress">
                  Batch {Math.floor(currentBatchIndex/BATCH_SIZE) + 1}/
                  {Math.ceil(filteredSchools.length/BATCH_SIZE)}
                </div>
              </div>
            </div>
            
            <ProgressTracker 
              processed={progress.processed} 
              total={progress.total} 
            />

            <div className="time-estimates">
              <div>Elapsed: {metrics.initialized ? formatTime(metrics.elapsed) : '--:--'}</div>
              <div>Remaining: {metrics.initialized && metrics.speed > 0 ? 
                formatTime(metrics.remaining) : '--:--'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Route Selector Modal */}
      {showRouteSelector && allResults.length > 0 && (
        <Modal
          open
          onClose={() => setShowRouteSelector(false)}
          large
        >
          <ModalTitle>Select a Route to View</ModalTitle>
          <ModalContent>
            <div className="route-selector-container">
              {allResults.map((result, index) => (
                <div 
                  key={`${result.school}-${result.place}-${index}`}
                  className="route-option"
                  onClick={() => {
                    setSelectedResult(result);
                    setShowRouteSelector(false);
                  }}
                >
                  <strong>{result.school}</strong> to <strong>{result.place}</strong>
                  <div className="route-meta">
                    <span>Distance: {result.distance} km</span>
                    <span>Time: {result.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </ModalContent>
          <ModalActions>
            <Button onClick={() => setShowRouteSelector(false)}>Cancel</Button>
          </ModalActions>
        </Modal>
      )}

      {/* Single Route Map Viewer with Leaflet */}
      {selectedResult && (
        <LeafletMapViewer 
          result={selectedResult} 
          onClose={() => setSelectedResult(null)}
        />
      )}

      {/* Results Table - Showing incremental batches */}
      <ResultsTable 
        places={batchResults} 
        loading={placesLoading}
        selectedAmenity={selectedAmenity}
      />
    </div>
  );
};

export default ClosestPlaceFinder;