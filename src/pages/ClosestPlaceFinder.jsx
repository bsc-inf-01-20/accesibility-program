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
  const [invalidSchools, setInvalidSchools] = useState([]);

  const deepestSelectedLevel = useMemo(() => {
    const levels = Object.keys(selectedLevels).map(Number);
    return levels.length ? Math.max(...levels) : 0;
  }, [selectedLevels]);

  const handleFetchData = async () => {
    if (loading || selectedSchools.length === 0) {
      return;
    }

    const validSchools = selectedSchools.filter(school => {
      return school?.geometry?.coordinates && 
             Array.isArray(school.geometry.coordinates) && 
             school.geometry.coordinates.length === 2;
    });

    const invalid = selectedSchools.filter(school => !validSchools.includes(school));
    setInvalidSchools(invalid);

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
        setCurrentBatch(batch.map(s => s.displayName));

        const results = (await Promise.all(
          batch.map(school => processSchool(school, selectedAmenity))
        )).filter(Boolean);

        setPlaces(prev => [...prev, ...results]);
        setProgress(prev => ({
          processed: Math.min(i + dynamicBatchSize, validSchools.length),
          total: validSchools.length,
          remaining: Math.max(validSchools.length - (i + dynamicBatchSize), 0)
        }));

        dynamicBatchSize = dynamicBatchSize < 10 ? dynamicBatchSize + 1 : 2;

        if (i + dynamicBatchSize < validSchools.length) {
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
          <div className="form-row">
            <SchoolSelector 
              selectedLevels={selectedLevels}
              allUnits={allUnits}
              loading={schoolsLoading}
              error={schoolsError}
              handleSelectLevel={handleSelectLevel}
              fetchOrgUnits={fetchOrgUnits}
            />
          </div>
          
          <div className="form-row">
            <AmenitySelector 
              selectedType={selectedAmenity}
              onChange={setSelectedAmenity}
              options={Object.values(AMENITY_TYPES)}
            />
          </div>
        </div>

        <div className="action-section">
          <div className="button-row">
            <ButtonStrip>
              <Button 
                onClick={handleFetchData}
                disabled={loading || schoolsLoading || deepestSelectedLevel < 2 || selectedSchools.length === 0}
                primary
              >
                {loading ? 'Processing...' : 'Find Closest Amenities'}
              </Button>
            </ButtonStrip>
          </div>

          <div className="notice-container">
            {schoolsError && (
              <NoticeBox error title="Error" className="notice-item">
                {schoolsError}
              </NoticeBox>
            )}
            {error && (
              <NoticeBox error title="Error" className="notice-item">
                {error}
              </NoticeBox>
            )}
            {invalidSchools.length > 0 && (
              <NoticeBox warning title="Notice" className="notice-item">
                {invalidSchools.length} schools skipped due to missing coordinates
              </NoticeBox>
            )}
            {actionTriggered && selectedSchools.length === 0 && (
              <NoticeBox warning title="Notice" className="notice-item">
                {deepestSelectedLevel === 5 ? 
                  'Selected school not found or missing location data' :
                  `No schools found under ${allUnits.find(u => u.id === selectedLevels[deepestSelectedLevel])?.displayName || 'selected area'}`
                }
              </NoticeBox>
            )}
          </div>
        </div>

        {progress.total > 0 && (
          <div className="progress-section">
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
          </div>
        )}
      </div>

      <div className="results-section">
        <ResultsTable 
          places={places} 
          loading={loading} 
          selectedAmenity={selectedAmenity} 
          schoolCount={selectedSchools.length}
        />
      </div>
    </div>
  );
};

export default ClosestPlaceFinder;