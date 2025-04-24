import React, { useState } from 'react';
import { 
  Button, 
  ButtonStrip, 
  NoticeBox, 
  Modal, 
  ModalTitle, 
  ModalContent, 
  ModalActions,
  Tooltip,
  CircularLoader,
  IconCross16
} from '@dhis2/ui';
import { IconQuestion16 as Help } from '@dhis2/ui-icons';
import { useFetchSchools } from '../Hooks/useFetchSchools';
import { useGooglePlacesApi } from '../Hooks/useGooglePlacesApi';
import { useGoogleRouting } from '../Hooks/useGoogleRouting';
import { useSaveResults } from '../Hooks/useSaveResults';
import { generateCSV } from '../utils/exportUtils';
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

  // Save results hook
  const { save, saving, error: saveError } = useSaveResults();

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
  const [overpassLoading, setOverpassLoading] = useState(false);
  
  // Notification states
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showError, setShowError] = useState(true);
  const [showInvalidSchools, setShowInvalidSchools] = useState(true);
  const [showNoResults, setShowNoResults] = useState(true);
  const [showCompletion, setShowCompletion] = useState(true);

  // Batch processing config
  const BATCH_SIZE = 3;
  
  // Progress tracking
  const [progress, setProgress] = useState({ 
    processed: 0, 
    total: 0,
    isComplete: false 
  });

  // Combine errors from all sources
  const combinedError = schoolsError || placesError || routingError;

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
        batchId: currentBatchIndex,
        rawData: {
          orgUnit: school.id,
          schoolCoords: school.geometry.coordinates,
          placeCoords: closest.location ? [closest.location.lng, closest.location.lat] : null
        }
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
    setShowInvalidSchools(true);

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
    setShowCompletion(false);

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
    }
  };

  const handleSave = async () => {
    setSaveSuccess(null);
    setShowSaveSuccess(false);
    const saveResult = await save(allResults, selectedAmenity);
    if (saveResult.success) {
      setSaveSuccess({
        count: saveResult.savedCount,
        time: new Date().toLocaleTimeString()
      });
      setShowSaveSuccess(true);
    }
  };

  const handleExportCSV = () => {
    if (!allResults.length) return;
    
    const csvContent = generateCSV(allResults, selectedAmenity);
    const filename = `school_proximity_${selectedAmenity.value}_${new Date().toISOString().slice(0,10)}.csv`;
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              disabled={placesLoading || schoolsLoading || !filteredSchools.length}
              primary
              icon={overpassLoading ? <CircularLoader small /> : null}
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

            <Button
              onClick={handleSave}
              disabled={!progress.isComplete || saving || allResults.length === 0}
              secondary
              icon={saving ? <CircularLoader small /> : null}
            >
              {saving ? 'Saving...' : 'Save Results'}
            </Button>

            <Button
              onClick={handleExportCSV}
              disabled={!progress.isComplete || allResults.length === 0}
              secondary
            >
              Export to CSV
            </Button>
          </ButtonStrip>

          {/* Notifications */}
          <div className="notice-container">
            {showSaveSuccess && saveSuccess && (
              <NoticeBox 
                success 
                title="Save Successful" 
                onHidden={() => setShowSaveSuccess(false)}
                actions={[{
                  label: 'Dismiss',
                  onClick: () => setShowSaveSuccess(false),
                  icon: <IconCross16 />
                }]}
              >
                Saved {saveSuccess.count} {selectedAmenity.label} results at {saveSuccess.time}
              </NoticeBox>
            )}

            {showError && (combinedError || saveError) && (
              <NoticeBox 
                error 
                title="Error" 
                onHidden={() => setShowError(false)}
                actions={[{
                  label: 'Dismiss',
                  onClick: () => setShowError(false),
                  icon: <IconCross16 />
                }]}
              >
                <div className="error-message">
                  {combinedError?.message || saveError}
                  {combinedError?.details && (
                    <pre className="error-details">
                      {JSON.stringify(combinedError.details, null, 2)}
                    </pre>
                  )}
                </div>
              </NoticeBox>
            )}

            {showInvalidSchools && invalidSchools.length > 0 && (
              <NoticeBox 
                warning 
                title="Notice"
                onHidden={() => setShowInvalidSchools(false)}
                actions={[{
                  label: 'Dismiss',
                  onClick: () => setShowInvalidSchools(false),
                  icon: <IconCross16 />
                }]}
              >
                {invalidSchools.length} schools skipped due to invalid coordinates
              </NoticeBox>
            )}

            {showNoResults && noResultsSchools.length > 0 && (
              <NoticeBox 
                warning 
                title="Notice"
                onHidden={() => setShowNoResults(false)}
                actions={[{
                  label: 'Dismiss',
                  onClick: () => setShowNoResults(false),
                  icon: <IconCross16 />
                }]}
              >
                No {selectedAmenity.label} found near: {noResultsSchools.join(', ')}
              </NoticeBox>
            )}

            {showCompletion && progress.isComplete && (
              <NoticeBox 
                success 
                title="Complete"
                onHidden={() => setShowCompletion(false)}
                actions={[{
                  label: 'Dismiss',
                  onClick: () => setShowCompletion(false),
                  icon: <IconCross16 />
                }]}
              >
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