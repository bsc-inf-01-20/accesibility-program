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
import { useFetchStudents } from "../Hooks/useFetchStudents";
import { useGoogleRouting } from "../Hooks/useGoogleRouting";
import { ProgressTracker } from "../components/ProgressTracker/ProgressTracker";
import { ResultsTable } from "../components/ResultsTable/ResultsTable";
import { SchoolSelector } from "../components/SchoolSelector/SchoolSelector";
import { LeafletMapViewer } from "../components/MapViewer/LeafletMapViewer";
import { TravelModeSelector } from "../components/TravelModeSelector/TravelModeSelector";
import "./ClosestPlaceFinder.css";

const PROCESSING_BATCH_SIZE = 5; // Students per processing batch

export const StudentDistanceCalculator = () => {
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

  // Student data
  const {
    students,
    loading: studentsLoading,
    error: studentsError,
    fetchStudents,
  } = useFetchStudents();

  // Routing hook
  const {
    calculateDistance,
    loading: routingLoading,
    error: routingError,
  } = useGoogleRouting();

  // State management
  const [allResults, setAllResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [invalidStudents, setInvalidStudents] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [selectedTravelMode, setSelectedTravelMode] = useState("walking");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancellationMessage, setCancellationMessage] = useState(null);
  const cancelRequested = useRef(false);

  // Notice visibility control
  const [visibleNotices, setVisibleNotices] = useState({
    schoolsError: true,
    studentsError: true,
    routingError: true,
    invalidStudents: true,
    cancellationMessage: true,
    completionMessage: true,
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

    if (noticeType === "invalidStudents") {
      setInvalidStudents([]);
    }
  };

  // Check if processing was cancelled
  const checkCancelled = () => {
    if (cancelRequested.current) {
      throw new Error("Processing cancelled");
    }
  };

  // Process a single student-school pair
  const processStudentDistance = async (student, school) => {
    checkCancelled();

    try {
      const studentCoords = student?.geometry?.coordinates;
      const schoolCoords = school?.geometry?.coordinates;

      if (!studentCoords || !schoolCoords) {
        return null;
      }

      const result = await calculateDistance(
        studentCoords,
        schoolCoords,
        selectedTravelMode
      );
      checkCancelled();

      return result
        ? {
            ...result,
            studentId: student.id,
            studentName: student.displayName,
            schoolId: school.id,
            schoolName: school.displayName,
            batchId: currentBatchIndex,
            travelMode: selectedTravelMode,
          }
        : null;
    } catch (err) {
      if (err.message !== "Processing cancelled") {
        console.error(`Error processing ${student.displayName}:`, err);
      }
      return null;
    }
  };

  // Main processing function
  const handleCalculateDistances = async () => {
    if (isProcessing) {
      cancelRequested.current = true;
      setIsProcessing(false);
      setCancellationMessage("Processing cancelled by user");
      return;
    }

    if (schoolsLoading || studentsLoading || selectedSchools.length === 0) return;

    // Reset states
    cancelRequested.current = false;
    setIsProcessing(true);
    setCancellationMessage(null);
    setInvalidStudents([]);

    // Filter valid students
    const validStudents = students.filter((student) => {
      const coords = student?.geometry?.coordinates;
      const isValid = coords?.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
      if (!isValid) setInvalidStudents((prev) => [...prev, student.displayName]);
      return isValid;
    });

    setAllResults([]);
    setSelectedResult(null);
    setCurrentBatchIndex(0);
    setProcessingProgress({
      processed: 0,
      total: validStudents.length * selectedSchools.length,
      isComplete: false,
    });

    try {
      // Process each student against each selected school
      for (let i = 0; i < validStudents.length; i += PROCESSING_BATCH_SIZE) {
        checkCancelled();

        const studentBatch = validStudents.slice(i, i + PROCESSING_BATCH_SIZE);
        setCurrentBatchIndex(i);

        const batchResults = [];
        
        for (const student of studentBatch) {
          for (const school of selectedSchools) {
            const result = await processStudentDistance(student, school);
            if (result) {
              batchResults.push(result);
            }
          }
        }

        checkCancelled();

        setAllResults((prev) => [...prev, ...batchResults]);
        setProcessingProgress((prev) => ({
          ...prev,
          processed: i * selectedSchools.length + batchResults.length,
          isComplete: i + studentBatch.length >= validStudents.length,
        }));

        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 300);
          if (cancelRequested.current) {
            clearTimeout(timeout);
            resolve();
          }
        });
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

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Student",
      "School",
      "Distance (km)",
      "Time",
      "Travel Mode",
    ].join(",");
    const rows = allResults
      .map(
        (r) =>
          `"${r.studentName}","${r.schoolName}",${r.distance},"${r.time}","${r.travelMode}"`
      )
      .join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `student_school_distances.csv`;
    link.click();
  };

  // Fetch students when schools are selected
  useEffect(() => {
    if (selectedSchools.length > 0) {
      fetchStudents(selectedSchools);
    }
  }, [selectedSchools]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      cancelRequested.current = true;
      setIsProcessing(false);
    };
  }, []);

  return (
    <div className="student-distance-calculator">
      <h1 className="app-header">Student Distance Calculator</h1>

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
              {selectedSchools.length} schools selected, {students.length} students loaded
            </div>
          )}
        </div>

        <TravelModeSelector
          selectedMode={selectedTravelMode}
          onChange={setSelectedTravelMode}
          disabled={isProcessing}
        />

        <div className="action-section">
          <ButtonStrip>
            <Button 
              onClick={handleCalculateDistances} 
              disabled={schoolsLoading || studentsLoading || selectedSchools.length === 0} 
              primary
            >
              {isProcessing ? (
                <span className="loading-content">
                  <CircularLoader small className="loading-icon" />
                  <span>Cancel Processing</span>
                </span>
              ) : schoolsLoading ? (
                "Loading Schools..."
              ) : studentsLoading ? (
                "Loading Students..."
              ) : (
                "Calculate Distances"
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

            {studentsError && visibleNotices.studentsError && (
              <NoticeBox
                error
                title="Error"
                onClose={() => clearNotice("studentsError")}
              >
                {studentsError}
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

            {/* Warning Notices */}
            {invalidStudents.length > 0 && visibleNotices.invalidStudents && (
              <NoticeBox
                warning
                title="Notice"
                onClose={() => clearNotice("invalidStudents")}
              >
                {invalidStudents.length} students skipped due to invalid coordinates
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
                  Calculated distances for {processingProgress.processed} student-school pairs
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
                  {Math.ceil(students.length / PROCESSING_BATCH_SIZE)}
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
                  key={`${result.studentId}-${result.schoolId}-${index}`}
                  className="route-option"
                  onClick={() => {
                    setSelectedResult(result);
                    setShowRouteSelector(false);
                  }}
                >
                  <strong>{result.studentName}</strong> to{" "}
                  <strong>{result.schoolName}</strong>
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
        results={allResults}
        loading={isProcessing}
        type="student-school"
      />
    </div>
  );
};

export default StudentDistanceCalculator;