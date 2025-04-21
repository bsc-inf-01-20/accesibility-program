import React, { useState, useEffect, useRef } from 'react';
import { Button, ButtonStrip, NoticeBox, Modal, ModalTitle, ModalContent, ModalActions } from '@dhis2/ui';
import { useFetchSchools } from '../Hooks/useFetchSchools';
import { useOverpassApi } from '../Hooks/useOverpassApi';
import { useMapboxRouting } from '../Hooks/useMapboxRouting';
import { AMENITY_TYPES, INITIAL_BATCH_SIZE, BATCH_DELAY_MS } from '../utils/constants';
import { AmenitySelector } from '../components/AmenitySelector/AmenitySelector';
import { ProgressTracker } from '../components/ProgressTracker/ProgressTracker';
import { ResultsTable } from '../components/ResultsTable/ResultsTable';
import { SchoolSelector } from '../components/SchoolSelector/SchoolSelector';
import { MapViewer } from '../components/MapViewer/MapViewer';
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
  const { processSchool, loading: overpassLoading, error: overpassError } = useOverpassApi();
  const { findClosestPlace, error: mapboxError } = useMapboxRouting();

  // State management
  const [places, setPlaces] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [currentBatch, setCurrentBatch] = useState([]);
  const [selectedAmenity, setSelectedAmenity] = useState(AMENITY_TYPES.MARKET);
  const [actionTriggered, setActionTriggered] = useState(false);
  const [invalidSchools, setInvalidSchools] = useState([]);
  
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
  const error = schoolsError || overpassError || mapboxError;

  // Format time display
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Metrics calculation effect
  useEffect(() => {
    if (overpassLoading && !metricsRef.current.startTime) {
      // Initialize metrics when processing starts
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

      // Set up interval for metrics updates
      metricsIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsedSeconds = (now - metricsRef.current.startTime) / 1000;
        
        // Calculate speed (schools per second)
        const processedDelta = progress.processed - metricsRef.current.lastProcessed;
        const timeDelta = (now - metricsRef.current.lastUpdate) / 1000;
        const currentSpeed = timeDelta > 0 ? processedDelta / timeDelta : 0;

        // Calculate remaining time
        const remainingSchools = progress.total - progress.processed;
        const remainingTime = currentSpeed > 0 ? remainingSchools / currentSpeed : 0;

        // Update metrics with smoothed values
        setMetrics(prev => ({
          speed: currentSpeed > 0 ? (prev.speed * 0.7 + currentSpeed * 0.3) : currentSpeed,
          elapsed: elapsedSeconds,
          remaining: remainingTime > 0 ? remainingTime : 0,
          initialized: true
        }));

        // Update refs for next calculation
        metricsRef.current = {
          ...metricsRef.current,
          lastUpdate: now,
          lastProcessed: progress.processed
        };
      }, 1000);
    } else if (!overpassLoading && metricsIntervalRef.current) {
      // Clean up when processing stops
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
  }, [overpassLoading, progress.processed, progress.total]);

  const handleFetchData = async () => {
    if (overpassLoading || filteredSchools.length === 0) return;

    // Filter schools with valid coordinates
    const validSchools = filteredSchools.filter(school => 
      school?.geometry?.coordinates?.length === 2
    );
    const invalid = filteredSchools.filter(school => !validSchools.includes(school));
    setInvalidSchools(invalid);

    // Reset state for new processing
    setActionTriggered(true);
    setPlaces([]);
    setAllResults([]);
    setSelectedResult(null);
    setShowRouteSelector(false);
    setProgress({ 
      processed: 0, 
      total: validSchools.length,
      isComplete: false
    });

    try {
      let dynamicBatchSize = INITIAL_BATCH_SIZE;
      let accumulatedResults = [];

      for (let i = 0; i < validSchools.length; i += dynamicBatchSize) {
        const batch = validSchools.slice(i, i + dynamicBatchSize);
        setCurrentBatch(batch.map(s => s.displayName));

        const batchStartTime = Date.now();
        
        // Process batch
        const amenitiesResults = await Promise.all(
          batch.map(school => processSchool(school, selectedAmenity))
        );
        
        const results = await Promise.all(
          batch.map(async (school, index) => {
            const amenities = amenitiesResults[index];
            if (!amenities?.length) return null;
            return await findClosestPlace(school, amenities, selectedAmenity);
          })
        );

        // Update results
        const validResults = results.filter(Boolean);
        accumulatedResults = [...accumulatedResults, ...validResults];
        setPlaces(accumulatedResults);
        setAllResults(accumulatedResults);
        
        // Update progress
        const newProcessed = Math.min(i + dynamicBatchSize, validSchools.length);
        setProgress(prev => ({
          ...prev,
          processed: newProcessed,
          isComplete: newProcessed >= validSchools.length
        }));

        // Adjust batch size dynamically
        const batchTime = (Date.now() - batchStartTime) / 1000;
        dynamicBatchSize = batchTime < 1 
          ? Math.min(dynamicBatchSize + 1, 10) 
          : Math.max(dynamicBatchSize - 1, 2);

        // Add delay between batches if not complete
        if (newProcessed < validSchools.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
    } catch (err) {
      console.error('Processing error:', err);
    } finally {
      setCurrentBatch([]);
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
              disabled={overpassLoading || schoolsLoading || !filteredSchools.length}
              primary
            >
              {overpassLoading ? 'Processing...' : 'Find Closest Amenities'}
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
                {invalidSchools.length} schools skipped due to missing coordinates
              </NoticeBox>
            )}
            {progress.isComplete && (
              <NoticeBox success title="Complete">
                Processed {progress.processed} schools
              </NoticeBox>
            )}
          </div>
        </div>

        {/* Progress tracking */}
        {(progress.total > 0) && (
          <div className={`progress-section ${overpassLoading ? 'is-processing' : ''}`}>
            <div className="progress-header">
              <h3>{overpassLoading ? 'Processing...' : 'Completed'}</h3>
              <div className="progress-metrics">
                <div>Processed: {progress.processed}/{progress.total}</div>
                <div>
                  Speed: {metrics.initialized ? 
                    (metrics.speed > 0 ? metrics.speed.toFixed(1) + ' schools/sec' : 'Starting...') 
                    : '--'}
                </div>
              </div>
            </div>
            
            <ProgressTracker 
              processed={progress.processed} 
              total={progress.total} 
            />

            {currentBatch.length > 0 && (
              <div className="batch-details">
                <h4>Current Batch</h4>
                <div>{currentBatch.join(', ')}</div>
              </div>
            )}

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
                  key={`${result.school}-${result.place}`}
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

      {/* Single Route Map Viewer */}
      {selectedResult && (
        <MapViewer 
          result={selectedResult} 
          onClose={() => setSelectedResult(null)}
        />
      )}

      <ResultsTable 
        places={places} 
        loading={overpassLoading}
        selectedAmenity={selectedAmenity}
      />
    </div>
  );
};

export default ClosestPlaceFinder;