import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  const [processingSpeed, setProcessingSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  const deepestSelectedLevel = useMemo(() => {
    const levels = Object.keys(selectedLevels).map(Number);
    return levels.length ? Math.max(...levels) : 0;
  }, [selectedLevels]);

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (loading && progress.processed > 0 && elapsedTime > 0) {
      setProcessingSpeed(progress.processed / elapsedTime);
    } else if (!loading) {
      setProcessingSpeed(0);
    }
  }, [loading, progress.processed, elapsedTime]);

  useEffect(() => {
    if (loading) {
      startTimeRef.current = Date.now();
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime((Date.now() - startTimeRef.current) / 1000);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [loading]);

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

        const startBatchTime = Date.now();
        const results = (await Promise.all(
          batch.map(school => processSchool(school, selectedAmenity))
        )).filter(Boolean);

        setPlaces(prev => [...prev, ...results]);
        setProgress(prev => ({
          processed: Math.min(i + dynamicBatchSize, validSchools.length),
          total: validSchools.length,
          remaining: Math.max(validSchools.length - (i + dynamicBatchSize), 0)
        }));

        const batchTime = (Date.now() - startBatchTime) / 1000;
        dynamicBatchSize = batchTime < 1 ? 
          Math.min(dynamicBatchSize + 1, 10) : 
          Math.max(dynamicBatchSize - 1, 2);

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
                disabled={loading || schoolsLoading || selectedSchools.length === 0}
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
          <div className={`progress-section ${loading ? 'is-processing' : ''}`}>
            <div className="progress-header">
              <div className="progress-title">
                <h3>Processing Progress</h3>
                <div className="progress-percentage">
                  {Math.round((progress.processed/progress.total)*100)}%
                </div>
              </div>
              <div className="progress-metrics">
                <div className="metric">
                  <span className="metric-label">Processed:</span>
                  <span className="metric-value">{progress.processed}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Remaining:</span>
                  <span className="metric-value">{progress.remaining}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Speed:</span>
                  <span className="metric-value">
                    {processingSpeed > 0 ? `${processingSpeed.toFixed(1)} schools/sec` : 'Calculating...'}
                  </span>
                </div>
              </div>
            </div>

            <div className="progress-tracker-container">
              <ProgressTracker 
                processed={progress.processed} 
                total={progress.total} 
              />
            </div>

            {currentBatch.length > 0 && (
              <div className="batch-details">
                <h4>Current Batch ({currentBatch.length} schools)</h4>
                <div className="batch-schools">
                  {currentBatch.map((school, index) => (
                    <span key={index} className="batch-school">
                      {school}
                      {index < currentBatch.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="time-estimates">
              <div className="estimate">
                <span>Elapsed: </span>
                <strong>{formatTime(elapsedTime)}</strong>
              </div>
              <div className="estimate">
                <span>Estimated remaining: </span>
                <strong>
                  {processingSpeed > 0 ? formatTime(progress.remaining/processingSpeed) : 'Calculating...'}
                </strong>
              </div>
            </div>
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