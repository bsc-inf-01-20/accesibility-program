import React, { useState, useEffect } from 'react';
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
import { TravelModeSelector } from '../components/TravelModeSelector/TravelModeSelector';

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
  const [selectedTravelMode, setSelectedTravelMode] = useState('walking');
  
  // Batch processing config
  const BATCH_SIZE = 3;
  
  // Progress tracking
  const [progress, setProgress] = useState({ 
    processed: 0, 
    total: 0,
    isComplete: false 
  });

  // Combine errors from all sources
  const error = schoolsError || placesError || routingError;

  const processSchoolBatch = async (school, amenityType) => {
    try {
      const foundPlaces = await processSchool(school, amenityType);
      const validPlaces = foundPlaces?.filter(p => p?.location?.lat && p?.location?.lng) || [];
      
      if (validPlaces.length === 0) {
        setNoResultsSchools(prev => [...prev, school.displayName]);
        return null;
      }
  
      const closest = await findClosestPlace(
        school,
        validPlaces,
        amenityType,
        selectedTravelMode
      );
  
      console.log('Processed school result:', { // Debug log
        school: school.displayName,
        closest: closest ? { 
          ...closest, 
          hasTravelMode: !!closest.travelMode 
        } : null
      });
  
      if (!closest) return null;
  
      // Ensure all properties are preserved
      return {
        ...closest, // Spread ALL properties from the closest result first
        school: school.displayName,
        schoolId: school.id,
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
  
    // Handle invalid schools
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
  
    console.log('Starting search with travel mode:', selectedTravelMode); // Debug log
  
    try {
      // Process in batches
      for (let i = 0; i < validSchools.length; i += BATCH_SIZE) {
        const batch = validSchools.slice(i, i + BATCH_SIZE);
        setCurrentBatchIndex(i);
  
        console.log(`Processing batch ${i/BATCH_SIZE + 1} of ${Math.ceil(validSchools.length/BATCH_SIZE)}`); // Debug log
  
        const batchPromises = batch.map(school => {
          console.log(`Processing ${school.displayName} with mode:`, selectedTravelMode); // Debug log
          return processSchoolBatch(school, selectedAmenity);
        });
  
        const results = await Promise.all(batchPromises);
        
        // Enhanced debug logging
        console.log('Batch results:', {
          count: results.length,
          withTravelMode: results.filter(r => r?.travelMode).length,
          modes: results.map(r => r?.travelMode || 'missing'),
          sample: results.length > 0 ? {
            school: results[0]?.school,
            place: results[0]?.place,
            mode: results[0]?.travelMode,
            distance: results[0]?.distance
          } : null
        });
  
        const validResults = results.filter(Boolean);
        
        console.log('Valid results:', validResults.map(r => ({
          school: r.school,
          place: r.place,
          mode: r.travelMode,
          expectedMode: selectedTravelMode
        })));
  
        setBatchResults(prev => {
          const newResults = [...prev, ...validResults];
          console.log('Updating batchResults:', {
            totalResults: newResults.length,
            modes: newResults.map(r => r.travelMode)
          });
          return newResults;
        });
  
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
      console.error('Batch processing error:', {
        error: err.message,
        travelMode: selectedTravelMode,
        stack: err.stack
      });
      setError(`Processing failed: ${err.message}`);
    } finally {
      console.log('Batch processing completed', {
        totalResults: allResults.length,
        modes: allResults.map(r => r.travelMode)
      });
    }
  };
  console.log('ResultsTable data:', {
    batchResults: batchResults.map(r => ({
      school: r.school,
      place: r.place, 
      travelMode: r.travelMode, // Check if this exists and is correct
      hasTravelMode: !!r.travelMode // Will be true if travelMode exists
    })),
    selectedTravelMode // Should match what you selected in the UI
  });
  

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
        {/*travel mode */}
        <TravelModeSelector 
        selectedMode={selectedTravelMode}
        onChange={setSelectedTravelMode}
      />

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
        <>
          <div className={`map-overlay ${selectedResult ? 'active' : ''}`} 
              onClick={() => setSelectedResult(null)} />
          <LeafletMapViewer 
            result={selectedResult} 
            onClose={() => setSelectedResult(null)}
          />
        </>
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