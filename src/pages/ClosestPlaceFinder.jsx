import React, { useState, useEffect, useRef } from 'react';
import { Button, ButtonStrip, NoticeBox } from '@dhis2/ui';
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
import { ExportButton } from '../components/ExportButton/ExportButton'
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
  const { save, loading: saving, error: saveError, response: saveResponse } = useSaveResults();
  const { processSchool, loading: overpassLoading, error: overpassError } = useOverpassApi();
  const { findClosestPlace, error: mapboxError } = useMapboxRouting();

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
  const [actionTriggered, setActionTriggered] = useState(false);
  const [invalidSchools, setInvalidSchools] = useState([]);
  const [processingSpeed, setProcessingSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [notification, setNotification] = useState({ 
    show: false, 
    message: '', 
    type: '' 
  });
  
  // Refs for timing
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  // Combine errors from all sources
  const error = schoolsError || overpassError || mapboxError;

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
    setActionTriggered(true);
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
            console.log(`Processing ${school.displayName} with ${amenities.length} amenities`);
            
            const result = await findClosestPlace(school, amenities, selectedAmenity);
            if (result && result.rawData) {
              result.rawData.orgUnit = school.id; // ✅ Attach the orgUnit for DHIS2
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
    const result = await save(places, selectedAmenity);
    if (result) {
      setNotification({ show: true, message: 'Saved successfully!', type: 'success' });
    } else {
      setNotification({ show: true, message: 'Failed to save.', type: 'error' });
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

  // Render UI
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
        {/* Action buttons */}
<div className="action-section">
  <ButtonStrip className="action-buttons">
    <Button 
      onClick={handleFetchData}
      disabled={overpassLoading || schoolsLoading || !filteredSchools.length}
      primary
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
    >
      {saving ? 'Saving...' : 'Save to DHIS2'}
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
    {notification.show && (
      <NoticeBox 
        title={notification.type === 'success' ? 'Success' : 'Error'}
        {...(notification.type === 'success' ? { success: true } : { error: true })}
        onHidden={() => setNotification({ show: false })}
      >
        {notification.message}
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