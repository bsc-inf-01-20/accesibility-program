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

import { useFetchTeachers } from "../Hooks/useFetchTeachers/useFetchTeachers";
import { useGoogleRouting } from "../Hooks/useGoogleRouting/useGoogleRouting";
import { SchoolSelector } from "../components/SchoolSelector/SchoolSelector";
import { TravelModeSelector } from "../components/TravelModeSelector/TravelModeSelector";
import { ProgressTracker } from "../components/ProgressTracker/ProgressTracker";
import { ResultsTable } from "../components/ResultsTable/ResultsTable";
import "./StudentDistanceCalculator.css";
import { useSaveTeacherRoutesMongo } from "../Hooks/useSaveTeacherRoutesMongo/useSaveTeacherRoutesMongo";
import { useFetchSchools } from "../Hooks/useFetchSchools/useFetchSchools";

const PROCESSING_BATCH_SIZE = 5;
const SAVING_BATCH_SIZE = 50;

/**
 * Overview
 * 
 * This page is part of the School Transportation Analytics system. It enables administrators to calculate
 * distances and travel times between teachers' residences and their assigned schools using Google Maps API.
 * The component processes data in batches for efficiency and saves results to MongoDB.
 *
 * Key Features:
 * - Fetches organizational units and schools from DHIS2 hierarchy
 * - Retrieves teacher lists with geographic coordinates
 * - Calculates routes using Google Directions API (walking/driving modes)
 * - Processes teachers in configurable batches (default: 5 teachers/batch)
 * - Saves results to MongoDB in optimized batches (default: 50 records/batch)
 * - Tracks processing progress with visual indicators
 * - Handles errors and invalid data gracefully
 * - Provides detailed results visualization
 *
 * Core Workflow:
 * 1. School selection via DHIS2 org unit hierarchy
 * 2. Teacher data fetching
 * 3. Batch distance calculation
 * 4. Results validation
 * 5. Data persistence
 * 6. User feedback
 *
 * Custom Hooks Used:
 * - `useFetchSchools` - Manages DHIS2 org unit selection
 * - `useFetchTeachers` - Handles teacher data retrieval
 * - `useGoogleRouting` - Processes distance calculations
 * - `useSaveTeacherRoutesMongo` - Manages MongoDB persistence
 *
 * State Management:
 * - Tracks processing progress (processed/total)
 * - Maintains calculation results
 * - Manages error states
 * - Handles cancellation
 *
 * Technologies:
 * - React (JSX)
 * - DHIS2 UI Components
 * - Google Maps Directions API
 * - MongoDB (via backend API)
 * - DHIS2 Web API
 *
 * @component
 * @category Transportation
 * @subcategory Analytics
 */
export const TeacherDistanceCalculator = () => {
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

  const {
    teachers,
    loading: teachersLoading,
    error: teachersError,
    fetchTeachers,
  } = useFetchTeachers();

  const {
    findClosestPlace,
    loading: routingLoading,
    error: routingError,
  } = useGoogleRouting();

  const {
    saveBulkTeacherRoutes,
    saving,
    error: saveError,
    progress: saveProgress,
  } = useSaveTeacherRoutesMongo();

  const [allResults, setAllResults] = useState([]);
  const [batchResults, setBatchResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [invalidTeachers, setInvalidTeachers] = useState([]);
  const [noResultsTeachers, setNoResultsTeachers] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [selectedTravelMode, setSelectedTravelMode] = useState("walking");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancellationMessage, setCancellationMessage] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const cancelRequested = useRef(false);

  const [visibleNotices, setVisibleNotices] = useState({
    schoolsError: true,
    teachersError: true,
    routingError: true,
    invalidTeachers: true,
    noResultsTeachers: true,
    cancellationMessage: true,
    completionMessage: true,
    saveError: true,
    saveSuccess: true,
  });

  const [processingProgress, setProcessingProgress] = useState({
    processed: 0,
    total: 0,
    isComplete: false,
  });

  const lastFetchedSchools = useRef(null);

  useEffect(() => {
    if (selectedLevels[5] && selectedSchools.length > 0) {
      const schoolsKey = selectedSchools.map((s) => s.id).join(",");
      if (schoolsKey !== lastFetchedSchools.current) {
        fetchTeachers(selectedSchools);
        lastFetchedSchools.current = schoolsKey;
      }
    }
  }, [selectedSchools, selectedLevels, fetchTeachers]);

  const clearNotice = (noticeType) => {
    setVisibleNotices((prev) => ({ ...prev, [noticeType]: false }));
    if (noticeType === "invalidTeachers") setInvalidTeachers([]);
    else if (noticeType === "noResultsTeachers") setNoResultsTeachers([]);
  };

  const checkCancelled = () => {
    if (cancelRequested.current) throw new Error("Processing cancelled");
  };

  const calculateTeacherDistance = async (teacher, school) => {
    checkCancelled();

    try {
      if (!teacher.coordinates || !school.coordinates) {
        console.warn("Invalid coordinates:", {
          teacher: teacher.displayName,
          teacherCoords: teacher.coordinates,
          school: school.name,
          schoolCoords: school.coordinates,
        });
        setInvalidTeachers((prev) => [...prev, teacher.displayName]);
        return null;
      }

      const place = await findClosestPlace(
        {
          name: teacher.name,
          id: teacher.id,
          geometry: {
            coordinates: [teacher.coordinates[1], teacher.coordinates[0]],
          },
        },
        [
          {
            id: school.id,
            name: school.name,
            location: {
              lat: school.coordinates[1],
              lng: school.coordinates[0],
            },
          },
        ],
        selectedTravelMode
      );

      checkCancelled();

      if (!place) return null;

      return {
        ...place,
        teacher: teacher.displayName,
        teacherId: teacher.id,
        school: school.name,
        schoolId: school.id,
        batchId: currentBatchIndex,
        rawData: { ...teacher, orgUnit: school.orgUnit || "UNKNOWN" },
        levelHierarchy: selectedLevelNames,
        travelMode: selectedTravelMode,
      };
    } catch (err) {
      if (err.message !== "Processing cancelled") {
        console.error(`Error processing ${teacher.displayName}:`, err);
      }
      return null;
    }
  };

  const handleCalculateDistances = async () => {
    if (isProcessing) {
      cancelRequested.current = true;
      setIsProcessing(false);
      setCancellationMessage("Processing cancelled by user");
      return;
    }

    if (
      schoolsLoading ||
      teachersLoading ||
      !selectedLevels[5] ||
      teachers.length === 0
    ) {
      return;
    }

    cancelRequested.current = false;
    setIsProcessing(true);
    setCancellationMessage(null);
    setNoResultsTeachers([]);
    setInvalidTeachers([]);
    setSaveSuccess(false);

    const validTeachers = teachers.filter((teacher) => {
      const coords = teacher.coordinates;
      const isValid =
        coords && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);
      if (!isValid && teacher.displayName) {
        setInvalidTeachers((prev) => [...prev, teacher.displayName]);
      }
      return isValid;
    });

    setAllResults([]);
    setBatchResults([]);
    setCurrentBatchIndex(0);
    setProcessingProgress({
      processed: 0,
      total: validTeachers.length * selectedSchools.length,
      isComplete: false,
    });

    try {
      for (const school of selectedSchools) {
        for (let i = 0; i < validTeachers.length; i += PROCESSING_BATCH_SIZE) {
          checkCancelled();
          const batch = validTeachers.slice(i, i + PROCESSING_BATCH_SIZE);
          setCurrentBatchIndex(i);

          const results = await Promise.all(
            batch.map((teacher) => calculateTeacherDistance(teacher, school))
          );
          checkCancelled();

          const validResults = results.filter((r) => r !== null);
          setBatchResults(validResults);
          setAllResults((prev) => [...prev, ...validResults]);
          setProcessingProgress((prev) => ({
            ...prev,
            processed: prev.processed + batch.length,
            isComplete: i + batch.length >= validTeachers.length,
          }));

          await new Promise((resolve) => setTimeout(resolve, 300));
        }
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

  const handleSave = async () => {
    try {
      if (allResults.length === 0) {
        console.warn("No results to save");
        setVisibleNotices((prev) => ({ ...prev, saveError: true }));
        return;
      }

      const routesToSave = allResults.map((result) => {
        if (!result.schoolCoords || !result.location) {
          console.error("Missing coordinates in result:", result);
          throw new Error(
            `Missing coordinates for teacher ${result.teacherId}`
          );
        }

        const teacherCoords = Array.isArray(result.schoolCoords)
          ? result.schoolCoords
          : [0, 0];

        const schoolCoords = [result.location.lng, result.location.lat];

        const durationInSeconds =
          typeof result.duration === "number"
            ? result.duration
            : parseInt(result.duration) || 0;

        return {
          teacherId: result.teacherId,
          teacherName: result.teacher,
          schoolId: result.schoolId,
          schoolName: result.school || "Unknown School",
          travelMode: result.travelMode,
          distance: parseFloat(result.distance.toFixed(3)),
          duration: durationInSeconds,
          coordinates: {
            teacher: teacherCoords,
            school: schoolCoords,
          },
          polyline: result.overviewPolyline || null,
          academicYear:
            result.academicYear ||
            `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          division: result.levelHierarchy[2] || "Unknown",
          district: result.levelHierarchy[3] || "Unknown",
          zone: result.levelHierarchy[4] || "Unknown",
          rawData: {
            teacher: result.teacher,
            school: result.school,
            timestamp: new Date().toISOString(),
          },
        };
      });

      const { success, failures } = await saveBulkTeacherRoutes(routesToSave);

      if ((failures?.length ?? 0) > 0) {
        console.error("Partial save failures:", failures);
        setVisibleNotices((prev) => ({ ...prev, saveError: true }));
      } else {
        console.log("Successfully saved all documents");
        setSaveSuccess(true);
        setVisibleNotices((prev) => ({
          ...prev,
          saveSuccess: true,
          completionMessage: true,
        }));
      }
    } catch (err) {
      console.error("Save operation failed:", err);
      setVisibleNotices((prev) => ({ ...prev, saveError: true }));
    }
  };

  useEffect(() => {
    return () => {
      cancelRequested.current = true;
      setIsProcessing(false);
    };
  }, []);

  return (
    <div className="student-distance-calculator">
      <h1 className="app-header">Teacher Distance Calculator</h1>
      <div className="control-panel">
        <div className="selection-section">
          <SchoolSelector
            selectedLevels={selectedLevels}
            allUnits={allUnits}
            loading={schoolsLoading}
            error={schoolsError?.message || schoolsError}
            handleSelectLevel={handleSelectLevel}
            fetchOrgUnits={fetchOrgUnits}
            setSelectedSchools={setSelectedSchools}
          />
          {selectedSchools.length > 0 && (
            <div className="selection-count">
              {selectedSchools.length} schools selected
            </div>
          )}
          {selectedLevels[5]
            ? teachers.length > 0 && (
                <div className="selection-count">
                  {teachers.length} teachers found
                </div>
              )
            : selectedSchools.length > 0 && (
                <div className="selection-count notice">
                  Select a school at level 5 to fetch teachers
                </div>
              )}
        </div>

        <TravelModeSelector
          selectedMode={selectedTravelMode}
          onChange={setSelectedTravelMode}
        />

        <div className="action-section">
          <ButtonStrip>
            <Button
              onClick={handleCalculateDistances}
              disabled={
                schoolsLoading ||
                teachersLoading ||
                !selectedLevels[5] ||
                teachers.length === 0
              }
              primary
            >
              {isProcessing ? (
                <span className="loading-content">
                  <CircularLoader small className="loading-icon" />
                  <span>Cancel Processing</span>
                </span>
              ) : (
                "Calculate Distances"
              )}
            </Button>

            <Button
              onClick={handleSave}
              disabled={
                !processingProgress.isComplete ||
                saving ||
                allResults.length === 0
              }
              secondary
              icon={saving ? <CircularLoader small /> : undefined}
            >
              {saving
                ? `Saving (${saveProgress.processed}/${saveProgress.total})`
                : "Save Results"}
            </Button>
          </ButtonStrip>

          <div className="notice-container">
            {schoolsError && visibleNotices.schoolsError && (
              <NoticeBox error title="Error">
                {String(schoolsError)}
              </NoticeBox>
            )}

            {teachersError && visibleNotices.teachersError && (
              <NoticeBox error title="Error">
                {String(teachersError)}
              </NoticeBox>
            )}

            {routingError && visibleNotices.routingError && (
              <NoticeBox error title="Error">
                {String(routingError)}
              </NoticeBox>
            )}

            {invalidTeachers.length > 0 && visibleNotices.invalidTeachers && (
              <NoticeBox warning title="Notice">
                {invalidTeachers.length} teachers had invalid coordinates and
                were skipped.
              </NoticeBox>
            )}

            {cancellationMessage && visibleNotices.cancellationMessage && (
              <NoticeBox warning title="Processing Cancelled">
                {cancellationMessage}
              </NoticeBox>
            )}

            {processingProgress.isComplete &&
              visibleNotices.completionMessage && (
                <NoticeBox title="Processing Complete">
                  Processed {processingProgress.processed} teachers, found
                  {allResults.length} results
                </NoticeBox>
              )}

            {saveError && visibleNotices.saveError && (
              <NoticeBox error title="Save Error">
                {String(saveError)}
              </NoticeBox>
            )}

            {saveSuccess && visibleNotices.saveSuccess && (
              <NoticeBox title="Success">Results saved successfully!</NoticeBox>
            )}
          </div>
        </div>

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
              </div>
            </div>
            <ProgressTracker
              processed={processingProgress.processed}
              total={processingProgress.total}
            />
          </div>
        )}
      </div>
      <ResultsTable
        places={allResults.map((result) => ({
          id: result.teacherId,
          school: result.teacher,
          destination: result.school, // Changed to 'destination' to match component
          distance: result.distance,
          time: result.time,
          travelMode: result.travelMode,
          rawData: result.rawData,
        }))}
        loading={isProcessing}
        headers={{
          schoolHeader: "Teacher Name",
          placeHeader: "Assigned School",
          distanceHeader: "Distance (km)",
          timeHeader: "Travel Time",
          modeHeader: "Transport Mode",
        }}
      />
    </div>
  );
};

export default TeacherDistanceCalculator;
