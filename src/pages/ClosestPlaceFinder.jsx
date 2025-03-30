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

  const deepestSelectedLevel = useMemo(() => {
    const levels = Object.keys(selectedLevels).map(Number);
    return levels.length ? Math.max(...levels) : 0;
  }, [selectedLevels]);

  const handleFetchData = async () => {
    if (loading || selectedSchools.length === 0) return;

    setActionTriggered(true);
    setLoading(true);
    setPlaces([]);
    setProgress({ 
      processed: 0, 
      total: selectedSchools.length,
      remaining: selectedSchools.length
    });

    try {
      let dynamicBatchSize = INITIAL_BATCH_SIZE;

      for (let i = 0; i < selectedSchools.length; i += dynamicBatchSize) {
        const batch = selectedSchools.slice(i, i + dynamicBatchSize);
        setCurrentBatch(batch.map(s => s.displayName));

        const startTime = Date.now();
        const results = await Promise.all(
          batch.map(school => processSchool(school, selectedAmenity))
        );
        
        setPlaces(prev => [...prev, ...results.filter(Boolean)]);
        setProgress(prev => ({
          processed: i + dynamicBatchSize,
          total: prev.total,
          remaining: prev.total - (i + dynamicBatchSize)
        }));

        const processingTime = Date.now() - startTime;
        dynamicBatchSize = processingTime < 1000 ? 
          Math.min(dynamicBatchSize + 1, 10) : 
          Math.max(dynamicBatchSize - 1, 2);

        if (i + dynamicBatchSize < selectedSchools.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
    } catch (err) {
      console.error('Processing error:', err);
    } finally {
      setLoading(false);
      setCurrentBatch([]);
    }
  };

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