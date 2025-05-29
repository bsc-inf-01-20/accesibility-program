import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  ButtonStrip,
  NoticeBox,
  Modal,
  ModalTitle,
  ModalContent,
  ModalActions,
  CircularLoader,
} from "@dhis2/ui";
import { useFetchSchools } from "../Hooks/useFetchSchools";
import { useGooglePlacesApi } from "../Hooks/useGooglePlacesApi";
import { useGoogleRouting } from "../Hooks/useGoogleRouting";
import { useSaveResults } from "../Hooks/useSaveResults";
import { AMENITY_TYPES } from "../utils/constants";
import { AmenitySelector } from "../components/AmenitySelector/AmenitySelector";
import { ProgressTracker } from "../components/ProgressTracker/ProgressTracker";
import { ResultsTable } from "../components/ResultsTable/ResultsTable";
import { SchoolSelector } from "../components/SchoolSelector/SchoolSelector";
import { LeafletMapViewer } from "../components/MapViewer/LeafletMapViewer";
import { TravelModeSelector } from "../components/TravelModeSelector/TravelModeSelector";
import "./ClosestPlaceFinder.css";

const PROCESSING_BATCH_SIZE = 5; // Schools per processing batch
const SAVING_BATCH_SIZE = 50; // Events per save batch

export const ClosestPlaceFinder = () => {
  // School selection
  const {
    selectedLevels,
    selectedLevelNames,
    allUnits,
    selectedSchools,
    loading: schoolsLoading,
    error: schoolsError,
    handleSelectLevel,
    fetchOrgUnits,
    setSelectedSchools,
  } = useFetchSchools();

  // Data processing hooks
  const {
    processSchool,
    loading: placesLoading,
    error: placesError,
  } = useGooglePlacesApi();

  const {
    findClosestPlace,
    loading: routingLoading,
    error: routingError,
  } = useGoogleRouting();

  // Save results hook (updated for bulk saving)
  const {
    saveBulk,
    saving,
    error: saveError,
    progress: saveProgress,
  } = useSaveResults();

  // State management
  const [allResults, setAllResults] = useState([]);
  const [batchResults, setBatchResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState(AMENITY_TYPES.MARKET);
  const [invalidSchools, setInvalidSchools] = useState([]);
  const [noResultsSchools, setNoResultsSchools] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [selectedTravelMode, setSelectedTravelMode] = useState("walking");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancellationMessage, setCancellationMessage] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const cancelRequested = useRef(false);

  // Notice visibility control
  const [visibleNotices, setVisibleNotices] = useState({
    schoolsError: true,
    placesError: true,
    routingError: true,
    invalidSchools: true,
    noResultsSchools: true,
    cancellationMessage: true,
    completionMessage: true,
    saveError: true,
    saveSuccess: true,
  });

  // Processing progress
  const [processingProgress, setProcessingProgress] = useState({
    processed: 0,
    total: 0,
    isComplete: false,
  });

  // Clear notice handler
  const clearNotice = (noticeType) => {
    setVisibleNotices((prev) => ({
      ...prev,
      [noticeType]: false,
    }));

    if (noticeType === "invalidSchools") {
      setInvalidSchools([]);
    } else if (noticeType === "noResultsSchools") {
      setNoResultsSchools([]);
    }
  };

  // Check if processing was cancelled
  const checkCancelled = () => {
    if (cancelRequested.current) {
      throw new Error("Processing cancelled");
    }
  };

  // Process a single school
  const processSchoolBatch = async (school, amenityType) => {
    checkCancelled();

    try {
      const foundPlaces = await processSchool(school, amenityType);
      checkCancelled();

      const validPlaces =
        foundPlaces?.filter((p) => p?.location?.lat && p?.location?.lng) || [];

      if (validPlaces.length === 0) {
        setNoResultsSchools((prev) => [...prev, school.name]);
        return null;
      }

      const closest = await findClosestPlace(
        school,
        validPlaces,
        amenityType,
        selectedTravelMode
      );
      checkCancelled();

      return closest
        ? {
            ...closest,
            school: school.name,
            schoolId: school.id,
            batchId: currentBatchIndex,
            rawData: {
              ...school,
              orgUnit: school.orgUnit || "UNKNOWN",
            },
            levelHierarchy: selectedLevelNames, 
            travelMode: selectedTravelMode,
          }
        : null;
    } catch (err) {
      if (err.message !== "Processing cancelled") {
        console.error(`Error processing ${school.displayName}:`, err);
      }
      return null;
    }
  };

  // Main processing function
  const handleFetchData = async () => {
    if (isProcessing) {
      cancelRequested.current = true;
      setIsProcessing(false);
      setCancellationMessage("Processing cancelled by user");
      return;
    }

    if (schoolsLoading) return;
    if (schoolsLoading) return;

    // Reset states
    cancelRequested.current = false;
    setIsProcessing(true);
    setCancellationMessage(null);
    setNoResultsSchools([]);
    setInvalidSchools([]);
    setSaveSuccess(false);
    setSaveSuccess(false);

    // Filter valid schools
    const validSchools = selectedSchools.filter((school) => {
      const coords = school?.geometry?.coordinates;
      const isValid =
        coords?.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
      if (!isValid) setInvalidSchools((prev) => [...prev, school.displayName]);
      return isValid;
    });

    setAllResults([]);
    setBatchResults([]);
    setSelectedResult(null);
    setCurrentBatchIndex(0);
    setProcessingProgress({
      processed: 0,
      total: validSchools.length,
      isComplete: false,
    });

    try {
      for (let i = 0; i < validSchools.length; i += PROCESSING_BATCH_SIZE) {
        checkCancelled();

        const batch = validSchools.slice(i, i + PROCESSING_BATCH_SIZE);
        setCurrentBatchIndex(i);

        const results = await Promise.all(
          batch.map((school) => processSchoolBatch(school, selectedAmenity))
        );
        checkCancelled();

        const validResults = results.filter(Boolean);
        setBatchResults(validResults);
        setAllResults((prev) => [...prev, ...validResults]);
        setProcessingProgress((prev) => ({
          ...prev,
          processed: i + batch.length,
          isComplete: i + batch.length >= validSchools.length,
        }));

        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (err) {
      if (err.message !== "Processing cancelled") {
        console.error("Batch processing error:", err);
      }
    } finally {
      setIsProcessing(false);
      cancelRequested.current = false;
    }
  };

  // Save results handler
  const handleSave = async () => {
    try {
      const { failures } = await saveBulk(allResults, selectedAmenity);

      if (failures.length > 0) {
        setVisibleNotices((prev) => ({ ...prev, saveError: true }));
        setVisibleNotices((prev) => ({ ...prev, saveError: true }));
      } else {
        setSaveSuccess(true);
        setVisibleNotices((prev) => ({
          ...prev,
          saveSuccess: true,
          completionMessage: true,
        }));
      }
    } catch (err) {
      setSaveError(err.message);
      setVisibleNotices((prev) => ({ ...prev, saveError: true }));
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "School",
      "Place",
      "Distance (km)",
      "Time",
      "Travel Mode",
    ].join(",");
    const rows = allResults
      .map(
        (r) =>
          `"${r.school}","${r.place}",${r.distance},"${r.time}","${r.travelMode}"`
      )
      .join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedAmenity.label}_results.csv`;
    link.click();
  };

  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    isComplete: false,
  });

  // Cleanup effect
  useEffect(() => {
    return () => {
      cancelRequested.current = true;
      setIsProcessing(false);
    };
  }, []);

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
            setSelectedSchools={setSelectedSchools}
          />

          {selectedSchools.length > 0 && (
            <div className="selection-count">
              {selectedSchools.length} schools selected
            </div>
          )}

          <AmenitySelector
            selectedType={selectedAmenity}
            onChange={setSelectedAmenity}
            options={Object.values(AMENITY_TYPES)}
          />
        </div>

        <TravelModeSelector
          selectedMode={selectedTravelMode}
          onChange={setSelectedTravelMode}
          disabled={isProcessing}
        />

        <div className="action-section">
          <ButtonStrip>
            <Button onClick={handleFetchData} disabled={schoolsLoading} primary>
              {isProcessing ? (
                <span className="loading-content">
                  <CircularLoader small className="loading-icon" />
                  <span>Cancel Processing</span>
                </span>
              ) : schoolsLoading ? (
                "Loading Schools..."
              ) : (
                "Find Closest Amenities"
              )}
            </Button>

            <Button
              onClick={() => setShowRouteSelector(true)}
              disabled={
                !processingProgress.isComplete || allResults.length === 0
              }
              secondary
            >
              View Routes
            </Button>

            <Button
              onClick={handleSave}
              disabled={
                !processingProgress.isComplete ||
                saving ||
                allResults.length === 0
              }
              secondary
              icon={saving ? <CircularLoader small /> : null}
            >
              {saving
                ? `Saving (${saveProgress.processed}/${saveProgress.total})`
                : "Save Results"}
            </Button>

            <Button
              onClick={handleExportCSV}
              disabled={
                !processingProgress.isComplete || allResults.length === 0
              }
              secondary
            >
              Export to CSV
            </Button>
          </ButtonStrip>

          <div className="notice-container">
            {/* Error Notices */}
            {schoolsError && visibleNotices.schoolsError && (
              <NoticeBox
                error
                title="Error"
                onClose={() => clearNotice("schoolsError")}
              >
                {schoolsError}
              </NoticeBox>
            )}

            {placesError && visibleNotices.placesError && (
              <NoticeBox
                error
                title="Error"
                onClose={() => clearNotice("placesError")}
              >
                {placesError}
              </NoticeBox>
            )}

            {routingError && visibleNotices.routingError && (
              <NoticeBox
                error
                title="Error"
                onClose={() => clearNotice("routingError")}
              >
                {routingError}
              </NoticeBox>
            )}

            {saveError && visibleNotices.saveError && (
              <NoticeBox
                error
                title="Save Error"
                onClose={() => clearNotice("saveError")}
              >
                {saveError}
              </NoticeBox>
            )}

            {/* Warning Notices */}
            {invalidSchools.length > 0 && visibleNotices.invalidSchools && (
              <NoticeBox
                warning
                title="Notice"
                onClose={() => clearNotice("invalidSchools")}
              >
                {invalidSchools.length} schools skipped due to invalid
                coordinates
              </NoticeBox>
            )}

            {noResultsSchools.length > 0 && visibleNotices.noResultsSchools && (
              <NoticeBox
                warning
                title="Notice"
                onClose={() => clearNotice("noResultsSchools")}
              >
                No {selectedAmenity.label} found near:{" "}
                {noResultsSchools.join(", ")}
              </NoticeBox>
            )}

            {cancellationMessage && visibleNotices.cancellationMessage && (
              <NoticeBox
                warning
                title="Notice"
                onClose={() => clearNotice("cancellationMessage")}
              >
                {cancellationMessage}
              </NoticeBox>
            )}

            {/* Success Notices */}
            {processingProgress.isComplete &&
              visibleNotices.completionMessage && (
                <NoticeBox
                  success
                  title="Processing Complete"
                  onClose={() => clearNotice("completionMessage")}
                >
                  Processed {processingProgress.processed} schools, found{" "}
                  {allResults.length} results
                </NoticeBox>
              )}

            {saveSuccess && visibleNotices.saveSuccess && (
              <NoticeBox
                success
                title="Save Complete"
                onClose={() => clearNotice("saveSuccess")}
              >
                Successfully saved {allResults.length} results
              </NoticeBox>
            )}
            {saveSuccess && visibleNotices.saveSuccess && (
              <NoticeBox
                success
                title="Success"
                onClose={() => clearNotice("saveSuccess")}
                showCloseButton
              >
                Results saved successfully!
              </NoticeBox>
            )}
            {saveError && visibleNotices.saveError && (
              <NoticeBox
                error
                title="Error"
                onClose={() => clearNotice("saveError")}
                showCloseButton
              >
                {saveError}
              </NoticeBox>
            )}
          </div>
        </div>

        {/* Progress Tracking */}
        {processingProgress.total > 0 && (
          <div
            className={`progress-section ${isProcessing ? "is-processing" : ""}`}
          >
            <div className="progress-header">
              <h3>{isProcessing ? "Processing..." : "Completed"}</h3>
              <div className="progress-metrics">
                <div>
                  Processed: {processingProgress.processed}/
                  {processingProgress.total}
                </div>
                <div className="batch-progress">
                  Batch{" "}
                  {Math.floor(currentBatchIndex / PROCESSING_BATCH_SIZE) + 1}/
                  {Math.ceil(selectedSchools.length / PROCESSING_BATCH_SIZE)}
                </div>
              </div>
            </div>
            <ProgressTracker
              processed={processingProgress.processed}
              total={processingProgress.total}
            />
          </div>
        )}
      </div>

      {/* Route Selection Modal */}
      {showRouteSelector && allResults.length > 0 && (
        <Modal open onClose={() => setShowRouteSelector(false)} large>
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
                  <strong>{result.school}</strong> to{" "}
                  <strong>{result.place}</strong>
                  <div className="route-meta">
                    <span>Distance: {result.distance} km</span>
                    <span>Time: {result.time}</span>
                    <span>Mode: {result.travelMode}</span>
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

      {/* Map Viewer */}
      {selectedResult && (
        <>
          <div
            className={`map-overlay ${selectedResult ? "active" : ""}`}
            onClick={() => setSelectedResult(null)}
          />
          <LeafletMapViewer
            result={selectedResult}
            onClose={() => setSelectedResult(null)}
          />
        </>
      )}

      {/* Results Table */}
      <ResultsTable
        places={allResults} // Changed from batchResults to allResults
        loading={isProcessing}
        selectedAmenity={selectedAmenity}
      />
    </div>
  );
};

export default ClosestPlaceFinder;
