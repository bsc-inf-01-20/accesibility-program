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
    allUnits = [],
    loading: schoolsLoading,
    error: schoolsError,
    handleSelectLevel,
    fetchOrgUnits
  } = useFetchSchools();
  
  const { processSchool, loading, error, setLoading } = useOverpassApi();
  const [places, setPlaces] = useState([]);
  const [progress, setProgress] = useState({ processed: 0, total: 1 });
  const [currentBatch, setCurrentBatch] = useState([]);
  const [selectedAmenity, setSelectedAmenity] = useState(AMENITY_TYPES.MARKET);
  const [selectedSchools, setSelectedSchools] = useState([]);

  const deepestSelectedLevel = useMemo(() => {
    const levels = Object.keys(selectedLevels).map(Number);
    return levels.length ? Math.max(...levels) : 0;
  }, [selectedLevels]);

  useEffect(() => {
    const getHierarchyPath = (school) => {
      const path = [];
      let current = allUnits.find(u => u.id === school.id);
      while (current?.parent?.id) {
        path.push(current.parent.id);
        current = allUnits.find(u => u.id === current.parent.id);
      }
      return path;
    };

    const levels = Object.keys(selectedLevels).map(Number);
    const deepestLevel = levels.length ? Math.max(...levels) : 1;
    const rootId = selectedLevels[deepestLevel] || "U7ahfMlCl7k";

    const schools = (allUnits || [])
      .filter(unit => 
        unit.level === 5 &&
        unit.geometry?.type === "Point" &&
        getHierarchyPath(unit).includes(rootId)
      );

    setSelectedSchools(schools);
    setProgress(prev => ({ ...prev, total: schools.length }));
  }, [allUnits, selectedLevels]);

  const handleFetchData = async () => {
    if (loading) return;

    setLoading(true);
    setPlaces([]);
    setProgress({ processed: 0, total: selectedSchools.length });

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
          ...prev,
          processed: Math.min(prev.total, i + dynamicBatchSize)
        }));

        const processingTime = Date.now() - startTime;
        if (processingTime < 1000 && dynamicBatchSize < 10) {
          dynamicBatchSize = Math.min(dynamicBatchSize + 1, 10);
        } else if (processingTime > 3000 && dynamicBatchSize > 2) {
          dynamicBatchSize = Math.max(dynamicBatchSize - 1, 2);
        }

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
              disabled={loading || schoolsLoading || deepestSelectedLevel < 2}
              primary
            >
              {loading ? 'Processing...' : 'Find Closest Amenities'}
            </Button>
          </ButtonStrip>

          {schoolsError && <NoticeBox error title="Error">{schoolsError}</NoticeBox>}
          {error && <NoticeBox error title="Error">{error}</NoticeBox>}
        </div>

        <ProgressTracker 
          processed={progress.processed} 
          total={progress.total} 
          label={`Schools processed: ${progress.processed}/${progress.total}`}
        />

        {currentBatch.length > 0 && (
          <BatchStatus 
            currentBatch={currentBatch} 
            title="Currently processing:"
          />
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