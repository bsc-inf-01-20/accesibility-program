import React, { useState, useEffect, useMemo } from 'react';
import { Button, ButtonStrip, NoticeBox } from '@dhis2/ui';
import { useFetchSchools } from '../Hooks/useFetchSchools';
import { useOverpassApi } from '../Hooks/useOverpassApi';
import { AMENITY_TYPES, INITIAL_BATCH_SIZE, BATCH_DELAY_MS } from '../utils/constants';
import { AmenitySelector } from '../components/AmenitySelector/AmenitySelector';
import { ProgressTracker } from '../components/ProgressTracker/ProgressTracker';
import { ResultsTable } from '../components/ResultsTable/ResultsTable';
import { BatchStatus } from '../components/BatchStatus/BatchStatus';
import { SchoolSelector } from '../components/SchoolSelector/SchoolSelector';
import './ClosestPlaceFinder.css';

export const ClosestPlaceFinder = () => {
  console.log('Rendering ClosestPlaceFinder');
  const { 
    selectedLevels,
    allUnits,
    selectedSchools,
    loading: schoolsLoading,
    error: schoolsError,
    handleSelectLevel,
    fetchOrgUnits
  } = useFetchSchools();
  
  const { processSchool, loading, error, setLoading } = useOverpassApi();
  const [places, setPlaces] = useState([]);
  const [progress, setProgress] = useState({ 
    processed: 0, 
    total: 0,
    remaining: 0 
  });
  const [currentBatch, setCurrentBatch] = useState([]);
  const [selectedAmenity, setSelectedAmenity] = useState(AMENITY_TYPES.MARKET);
  const [actionTriggered, setActionTriggered] = useState(false);
  const [invalidSchools, setInvalidSchools] = useState([]);

  const deepestSelectedLevel = useMemo(() => {
    const levels = Object.keys(selectedLevels).map(Number);
    return levels.length ? Math.max(...levels) : 0;
  }, [selectedLevels]);

  const handleFetchData = async () => {
    console.group('[handleFetchData] Starting processing');
    if (loading || selectedSchools.length === 0) {
      console.log('Skipping - already loading or no schools selected');
      console.groupEnd();
      return;
    }

    console.log(`Processing ${selectedSchools.length} schools`);
    console.log('Selected amenity:', selectedAmenity.label);

    // Filter out schools without valid coordinates
    const validSchools = selectedSchools.filter(school => {
      const hasCoords = school?.geometry?.coordinates && 
                       Array.isArray(school.geometry.coordinates) && 
                       school.geometry.coordinates.length === 2;
      if (!hasCoords) {
        console.warn(`School ${school.displayName} has invalid coordinates:`, school.geometry);
      }
      return hasCoords;
    });

    const invalid = selectedSchools.filter(school => !validSchools.includes(school));
    setInvalidSchools(invalid);

    if (invalid.length > 0) {
      console.warn(`Skipping ${invalid.length} schools with missing/invalid coordinates`);
      invalid.forEach(school => {
        console.log(`- ${school.displayName}:`, school.geometry);
      });
    }

    setActionTriggered(true);
    setLoading(true);
    setPlaces([]);
    setProgress({ 
      processed: 0, 
      total: validSchools.length,
      remaining: validSchools.length
    });

    try {
      let dynamicBatchSize = INITIAL_BATCH_SIZE;

      for (let i = 0; i < validSchools.length; i += dynamicBatchSize) {
        const batch = validSchools.slice(i, i + dynamicBatchSize);
        console.log(`Processing batch ${i/dynamicBatchSize + 1}:`, batch.map(s => s.displayName));
        setCurrentBatch(batch.map(s => s.displayName));

        const startTime = Date.now();
        const results = (await Promise.all(
          batch.map(school => {
            console.log(`Processing school: ${school.displayName} at ${school.geometry.coordinates}`);
            return processSchool(school, selectedAmenity);
          })
        )).filter(Boolean);

        console.log(`Batch results:`, results);
        setPlaces(prev => [...prev, ...results]);
        setProgress(prev => ({
          processed: Math.min(i + dynamicBatchSize, validSchools.length),
          total: validSchools.length,
          remaining: Math.max(validSchools.length - (i + dynamicBatchSize), 0)
        }));

        const processingTime = Date.now() - startTime;
        console.log(`Batch processed in ${processingTime}ms`);
        
        dynamicBatchSize = processingTime < 1000 ? 
          Math.min(dynamicBatchSize + 1, 10) : 
          Math.max(dynamicBatchSize - 1, 2);

        if (i + dynamicBatchSize < validSchools.length) {
          console.log(`Waiting ${BATCH_DELAY_MS}ms before next batch`);
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
    } catch (err) {
      console.error('Processing error:', err);
    } finally {
      console.log('Finished processing all schools');
      setLoading(false);
      setCurrentBatch([]);
    }
    console.groupEnd();
  };

  console.log('Current state:', {
    selectedSchoolsCount: selectedSchools.length,
    placesCount: places.length,
    loading,
    progress
  });

  return (
    <div className="closest-place-finder">
      <h1 className="app-header">School Proximity Analyzer</h1>
      
      <div className="control-panel">
        <div className="selection-section">
          <SchoolSelector 
            selectedLevels={selectedLevels}
            allUnits={allUnits}
            loading={schoolsLoading}
            error={schoolsError}
            handleSelectLevel={handleSelectLevel}
            fetchOrgUnits={fetchOrgUnits}
          />
          
          <div className="select-container">
            <AmenitySelector 
              selectedType={selectedAmenity}
              onChange={setSelectedAmenity}
              options={Object.values(AMENITY_TYPES)}
            />
          </div>
        </div>

        <div className="action-section">
          <ButtonStrip>
            <Button 
              onClick={handleFetchData}
              disabled={loading || schoolsLoading || deepestSelectedLevel < 2 || selectedSchools.length === 0}
              primary
            >
              {loading ? 'Processing...' : 'Find Closest Amenities'}
            </Button>
          </ButtonStrip>

          {schoolsError && <NoticeBox error title="Error">{schoolsError}</NoticeBox>}
          {error && <NoticeBox error title="Error">{error}</NoticeBox>}
          {invalidSchools.length > 0 && (
            <NoticeBox warning title="Notice">
              {invalidSchools.length} schools skipped due to missing coordinates
            </NoticeBox>
          )}
          {actionTriggered && selectedSchools.length === 0 && (
            <NoticeBox warning title="Notice">
              {deepestSelectedLevel === 5 ? 
                'Selected school not found or missing location data' :
                `No schools found under ${allUnits.find(u => u.id === selectedLevels[deepestSelectedLevel])?.displayName || 'selected area'}`
              }
            </NoticeBox>
          )}
        </div>

        {progress.total > 0 && (
          <>
            <ProgressTracker 
              processed={progress.processed} 
              total={progress.total} 
              label={`Processed: ${progress.processed}/${progress.total} (${progress.remaining} remaining)`}
            />
            {currentBatch.length > 0 && (
              <BatchStatus 
                currentBatch={currentBatch} 
                title={`Currently processing ${currentBatch.length} schools...`}
              />
            )}
          </>
        )}
      </div>

      <ResultsTable 
        places={places} 
        loading={loading} 
        selectedAmenity={selectedAmenity} 
        schoolCount={selectedSchools.length}
      />
    </div>
  );
};

export default ClosestPlaceFinder;