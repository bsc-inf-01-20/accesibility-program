import React, { useState, useEffect } from 'react';
import { Button, ButtonStrip, NoticeBox } from '@dhis2/ui';
import { useFetchSchools } from '../hooks/useFetchSchools';
import { useOverpassApi } from '../Hooks/useOverpassApi';
import { AMENITY_TYPES, INITIAL_BATCH_SIZE, BATCH_DELAY_MS } from '../utils/constants';
import { AmenitySelector } from '../components/AmenitySelector/AmenitySelector';
import { ProgressTracker } from '../components/ProgressTracker/ProgressTracker';
import { ResultsTable } from '../components/ResultsTable/ResultsTable';
import { BatchStatus } from '../components/BatchStatus/BatchStatus';
import './ClosestPlaceFinder.css';

export const ClosestPlaceFinder = () => {
  const { schools, fetchNextPage, loading: schoolsLoading, hasMore } = useFetchSchools();
  const { processSchool, loading, error, setLoading } = useOverpassApi();
  const [places, setPlaces] = useState([]);
  const [progress, setProgress] = useState({ processed: 0, total: 1 });
  const [currentBatch, setCurrentBatch] = useState([]);
  const [selectedAmenity, setSelectedAmenity] = useState(AMENITY_TYPES.MARKET);

  const handleFetchData = async () => {
    if (loading || !schools.length) return;

    setLoading(true);
    setPlaces([]);
    setProgress({ processed: 0, total: schools.length });

    try {
      let batchIndex = 0;
      let dynamicBatchSize = INITIAL_BATCH_SIZE;

      for (let i = 0; i < schools.length; i += dynamicBatchSize) {
        const batch = schools.slice(i, i + dynamicBatchSize);
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

        if (i + dynamicBatchSize < schools.length) {
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

  useEffect(() => {
    if (!schoolsLoading && schools.length === 0 && hasMore) {
      fetchNextPage();
    }
  }, [schoolsLoading, schools, hasMore, fetchNextPage]);

  return (
    <div className="closest-place-finder">
      <h1 className="app-header">School Proximity Analyzer</h1>
      
      <div className="control-panel">
        <div className="controls-row">
          <div className="select-container">
            <AmenitySelector 
              selectedType={selectedAmenity}
              onChange={setSelectedAmenity}
              options={Object.values(AMENITY_TYPES)}
            />
          </div>

          <ButtonStrip>
            <Button 
              onClick={handleFetchData}
              disabled={loading || schoolsLoading}
            >
              {loading ? 'Processing...' : 'Start Processing'}
            </Button>
          </ButtonStrip>
        </div>

        {error && <NoticeBox error title="Error">{error}</NoticeBox>}

        <ProgressTracker processed={progress.processed} total={progress.total} />

        {currentBatch.length > 0 && <BatchStatus currentBatch={currentBatch} />}
      </div>

      <ResultsTable 
        places={places} 
        loading={loading} 
        selectedAmenity={selectedAmenity} 
      />
    </div>
  );
};

export default ClosestPlaceFinder;