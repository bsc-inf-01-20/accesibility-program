import React, { useState, useEffect, useRef } from 'react';
import { 
  Button, 
  ButtonStrip, 
  NoticeBox, 
  CircularLoader,
  Help,
  IconWarning24,
  IconCheckmark24,
  Tooltip
} from '@dhis2/ui';
import { useFetchSchools } from '../Hooks/useFetchSchools';
import { useOverpassApi } from '../Hooks/useOverpassApi';
import { useMapboxRouting } from '../Hooks/useMapboxRouting';
import { useSaveResults } from '../Hooks/useSaveResults';
import { AMENITY_TYPES, INITIAL_BATCH_SIZE, BATCH_DELAY_MS } from '../utils/constants';
import { AmenitySelector } from '../components/AmenitySelector/AmenitySelector';
import { ProgressTracker } from '../components/ProgressTracker/ProgressTracker';
import { ResultsTable } from '../components/ResultsTable/ResultsTable';
import { SchoolSelector } from '../components/SchoolSelector/SchoolSelector';
import { MapViewer } from '../components/MapViewer/MapViewer';
import { ExportButton } from '../components/ExportButton/ExportButton';
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
  const { save, loading: saving, error: saveError } = useSaveResults();

  // State management
  const [places, setPlaces] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [showAllResultsMap, setShowAllResultsMap] = useState(false);
  const [progress, setProgress] = useState({ 
    processed: 0, 
    total: 0,
    remaining: 0,
    isComplete: false 
  });
  const [currentBatch, setCurrentBatch] = useState([]);
  const [selectedAmenity, setSelectedAmenity] = useState(AMENITY_TYPES.MARKET);
  const [invalidSchools, setInvalidSchools] = useState([]);
  const [processingSpeed, setProcessingSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [notification, setNotification] = useState({ 
    show: false, 
    message: '', 
    type: '',
    icon: null
  });
  
  // Refs for timing
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  // Combine errors from all sources
  const combinedError = schoolsError || overpassError || mapboxError || saveError;

  // Format time display
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate processing speed
  useEffect(() => {
    if (progress.processed > 0 && elapsedTime > 0) {
      setProcessingSpeed(progress.processed / elapsedTime);
    }
  }, [progress.processed, elapsedTime]);

  // Timer effect
  useEffect(() => {
    if (overpassLoading) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime((Date.now() - startTimeRef.current) / 1000);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [overpassLoading]);

  const handleFetchData = async () => {
    if (overpassLoading || filteredSchools.length === 0) return;

    // Filter schools with valid coordinates
    const validSchools = filteredSchools.filter(school => 
      school?.geometry?.coordinates?.length === 2
    );
    const invalid = filteredSchools.filter(school => !validSchools.includes(school));
    setInvalidSchools(invalid);

    // Reset state for new processing
    setPlaces([]);
    setAllResults([]);
    setShowAllResultsMap(false);
    setProgress({ 
      processed: 0, 
      total: validSchools.length,
      remaining: validSchools.length,
      isComplete: false
    });

    try {
      let dynamicBatchSize = INITIAL_BATCH_SIZE;
      let accumulatedResults = [];

      for (let i = 0; i < validSchools.length; i += dynamicBatchSize) {
        const batch = validSchools.slice(i, i + dynamicBatchSize);
        setCurrentBatch(batch.map(s => s.displayName));

        const startBatchTime = Date.now();
        
        // Step 1: Fetch amenities for all schools in batch
        const amenitiesResults = await Promise.all(
          batch.map(school => processSchool(school, selectedAmenity))
        );
        
        // Step 2: Find closest place for each school using Mapbox
        const results = await Promise.all(
          batch.map(async (school, index) => {
            const amenities = amenitiesResults[index];
            if (!amenities?.length) {
              console.log(`No amenities found for ${school.displayName}`);
              return null;
            }
            
            const result = await findClosestPlace(school, amenities, selectedAmenity);
            if (result && result.rawData) {
              result.rawData.orgUnit = school.id;
            }
            return result;
          })
        );

        // Process results
        const validResults = results.filter(Boolean);
        accumulatedResults = [...accumulatedResults, ...validResults];
        setPlaces(accumulatedResults);
        setAllResults(accumulatedResults);
        
        // Update progress
        const newProcessed = Math.min(i + dynamicBatchSize, validSchools.length);
        setProgress(prev => ({
          ...prev,
          processed: newProcessed,
          remaining: validSchools.length - newProcessed,
          isComplete: newProcessed >= validSchools.length
        }));

        // Adjust batch size dynamically
        const batchTime = (Date.now() - startBatchTime) / 1000;
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

  const handleSaveResults = async () => {
    setNotification({ show: false, message: '', type: '', icon: null });

    if (!places.length) {
      setNotification({
        show: true,
        message: 'No results to save',
        type: 'warning',
        icon: <IconWarning24 />
      });
      return;
    }

    try {
      const { success, message } = await save(places, selectedAmenity);
      
      setNotification({
        show: true,
        message: message || (success ? 'Results saved successfully to School Proximity Survey' : 'Failed to save results'),
        type: success ? 'success' : 'error',
        icon: success ? <IconCheckmark24 /> : <IconWarning24 />,
        duration: 5000
      });

      if (success) {
        // Optional post-save actions
      }
    } catch (err) {
      setNotification({
        show: true,
        message: err.message || 'An error occurred while saving',
        type: 'error',
        icon: <IconWarning24 />
      });
    }
  };

  // Calculate map center for all results
  const calculateCenter = (coordsArray) => {
    if (!coordsArray.length) return [0, 0];
    const lats = coordsArray.map(c => c[1]);
    const lons = coordsArray.map(c => c[0]);
    return [
      (Math.min(...lons) + Math.max(...lons)) / 2,
      (Math.min(...lats) + Math.max(...lats)) / 2
    ];
  };

  return (
    <div className="closest-place-finder">
      <h1 className="app-header">
        School Proximity Analyzer
        <Tooltip content="Find closest amenities to schools">
          <Help className="header-help" />
        </Tooltip>
      </h1>
      
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
          <ButtonStrip className="action-buttons">
            <Button 
              onClick={handleFetchData}
              disabled={overpassLoading || schoolsLoading || !filteredSchools.length}
              primary
              icon={overpassLoading ? <CircularLoader small /> : null}
            >
              {overpassLoading ? 'Processing...' : 'Find Closest Amenities'}
            </Button>
            
            <Button
              onClick={() => setShowAllResultsMap(!showAllResultsMap)}
              disabled={!progress.isComplete || !allResults.length}
              secondary
            >
              {showAllResultsMap ? 'Hide Map' : 'View All Results Map'}
            </Button>
            
            <ExportButton 
              results={places} 
              amenityType={selectedAmenity}
              disabled={!progress.isComplete || places.length === 0}
            />
            
            <Button
              onClick={handleSaveResults}
              disabled={!progress.isComplete || places.length === 0 || saving}
              primary
              icon={saving ? <CircularLoader small /> : null}
            >
              {saving ? (
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <CircularLoader small />
                  <span style={{ marginLeft: 8 }}>Saving...</span>
                </span>
              ) : 'Save to DHIS2'}
            </Button>
          </ButtonStrip>

          {/* Error display */}
          {combinedError && !notification.show && (
            <NoticeBox error title="Error" className="notice-item">
              <div className="error-message">
                {combinedError.message}
                {combinedError.details && (
                  <pre className="error-details">
                    {JSON.stringify(combinedError.details, null, 2)}
                  </pre>
                )}
              </div>
            </NoticeBox>
          )}

          {/* Notifications */}
          {notification.show && (
            <NoticeBox 
              title={notification.type === 'success' ? 'Success' : 'Error'}
              className="notice-item"
              {...(notification.type === 'success' ? { 
                success: true,
                icon: notification.icon
              } : { 
                error: true,
                icon: notification.icon
              })}
              onHidden={() => setNotification({ show: false })}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {notification.icon}
                <span style={{ marginLeft: 8 }}>{notification.message}</span>
              </div>
            </NoticeBox>
          )}
        </div>

        {/* Progress tracking */}
        {(progress.total > 0) && (
          <div className={`progress-section ${overpassLoading ? 'is-processing' : ''}`}>
            <div className="progress-header">
              <h3>
                {overpassLoading ? (
                  <>
                    Processing... <CircularLoader small />
                  </>
                ) : 'Completed'}
              </h3>
              <div className="progress-metrics">
                <div>Processed: {progress.processed}/{progress.total}</div>
                <div>Speed: {processingSpeed.toFixed(1)} schools/sec</div>
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
              <div>Elapsed: {formatTime(elapsedTime)}</div>
              <div>Remaining: {formatTime(progress.remaining / processingSpeed)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Results display */}
      {showAllResultsMap && allResults.length > 0 && (
        <div className="all-results-map-container">
          <MapViewer 
            result={{
              school: "All Schools",
              place: "All Amenities",
              rawData: {
                schoolCoords: calculateCenter(allResults.map(r => r.rawData.schoolCoords)),
                placeCoords: calculateCenter(allResults.map(r => r.rawData.placeCoords))
              }
            }}
            allResults={allResults}
            onClose={() => setShowAllResultsMap(false)}
          />
        </div>
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