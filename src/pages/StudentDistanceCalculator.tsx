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
import { useSaveResults } from "../Hooks/useSaveResults";
import { SchoolSelector } from "../components/SchoolSelector/SchoolSelector";
import { TravelModeSelector } from "../components/TravelModeSelector/TravelModeSelector";
import { ProgressTracker } from "../components/ProgressTracker/ProgressTracker";
import { ResultsTable } from "../components/ResultsTable/ResultsTable";
import "./StudentDistanceCalculator.css";

interface Result {
  student: string;
  studentId: string;
  school: string;
  schoolId: string;
  distance: number;
  time: number;
  travelMode: string;
  batchId: number;
  rawData: any;
  levelHierarchy: string[];
}

interface Student {
  id: string;
  displayName: string;
  name: string;
  coordinates?: [number, number]; // Optional tuple of numbers
  [key: string]: any; // Allow other properties
}

interface School {
  id: string;
  name: string;
  coordinates?: [number, number];
  orgUnit?: string;
  [key: string]: any;
}

type NoticeType =
  | "schoolsError"
  | "studentsError"
  | "routingError"
  | "invalidStudents"
  | "noResultsStudents"
  | "cancellationMessage"
  | "completionMessage"
  | "saveError"
  | "saveSuccess";

const PROCESSING_BATCH_SIZE = 5;
const SAVING_BATCH_SIZE = 50;

export const StudentDistanceCalculator = () => {
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
    students,
    loading: studentsLoading,
    error: studentsError,
    fetchStudents,
  } = useFetchStudents();

  const {
    findClosestPlace,
    loading: routingLoading,
    error: routingError,
  } = useGoogleRouting();

  const {
    saveBulk,
    saving,
    error: saveError,
    progress: saveProgress,
  } = useSaveResults();

  const [allResults, setAllResults] = useState<Result[]>([]);
  const [batchResults, setBatchResults] = useState<Result[]>([]);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [invalidStudents, setInvalidStudents] = useState<string[]>([]);
  const [noResultsStudents, setNoResultsStudents] = useState<string[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [selectedTravelMode, setSelectedTravelMode] = useState("walking");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancellationMessage, setCancellationMessage] = useState<string | null>(
    null
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const cancelRequested = useRef(false);

  const [visibleNotices, setVisibleNotices] = useState({
    schoolsError: true,
    studentsError: true,
    routingError: true,
    invalidStudents: true,
    noResultsStudents: true,
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

  const lastFetchedSchools = useRef<string | null>(null);

  useEffect(() => {
    if (selectedLevels[5] && selectedSchools.length > 0) {
      const schoolsKey = selectedSchools.map((s: School) => s.id).join(",");
      if (schoolsKey !== lastFetchedSchools.current) {
        fetchStudents(selectedSchools);
        lastFetchedSchools.current = schoolsKey;
      }
    }
  }, [selectedSchools, selectedLevels, fetchStudents]);

  const clearNotice = (noticeType: NoticeType) => {
    setVisibleNotices((prev) => ({ ...prev, [noticeType]: false }));

    // Use a type guard for the specific notice types that need additional clearing
    if (noticeType === "invalidStudents") {
      setInvalidStudents([]);
    } else if (noticeType === "noResultsStudents") {
      setNoResultsStudents([]);
    }
  };

  const checkCancelled = () => {
    if (cancelRequested.current) throw new Error("Processing cancelled");
  };

  const calculateStudentDistance = async (
    student: Student,
    school: School
  ): Promise<Result | null> => {
    checkCancelled();

    try {
      if (!student.coordinates || !school.coordinates) {
        console.warn("Invalid coordinates:", {
          student: student.displayName,
          studentCoords: student.coordinates,
          school: school.name,
          schoolCoords: school.coordinates,
        });
        setInvalidStudents((prev) => [...prev, student.displayName]);
        return null;
      }

      const place = await findClosestPlace(
        {
          name: student.name,
          id: student.id,
          geometry: {
            coordinates: [student.coordinates[1], student.coordinates[0]],
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
        student: student.displayName,
        studentId: student.id,
        school: school.name,
        schoolId: school.id,
        batchId: currentBatchIndex,
        rawData: { ...student, orgUnit: school.orgUnit || "UNKNOWN" },
        levelHierarchy: selectedLevelNames,
        travelMode: selectedTravelMode,
      };
    } catch (err) {
      if (err.message !== "Processing cancelled") {
        console.error(`Error processing ${student.displayName}:`, err);
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
      studentsLoading ||
      !selectedLevels[5] ||
      students.length === 0
    )
      return;

    cancelRequested.current = false;
    setIsProcessing(true);
    setCancellationMessage(null);
    setNoResultsStudents([]);
    setInvalidStudents([]);
    setSaveSuccess(false);

    const validStudents = students.filter((student: Student) => {
      const coords = student.coordinates;
      const isValid =
        coords && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1]);

      if (!isValid && student.displayName) {
        setInvalidStudents((prev) => [...prev, student.displayName]);
      }
      return isValid;
    });

    setAllResults([]);
    setBatchResults([]);
    setCurrentBatchIndex(0);
    setProcessingProgress({
      processed: 0,
      total: validStudents.length * selectedSchools.length,
      isComplete: false,
    });

    try {
      for (const school of selectedSchools) {
        for (let i = 0; i < validStudents.length; i += PROCESSING_BATCH_SIZE) {
          checkCancelled();
          const batch = validStudents.slice(i, i + PROCESSING_BATCH_SIZE);
          setCurrentBatchIndex(i);

          const results = await Promise.all(
            batch.map((student) => calculateStudentDistance(student, school))
          );
          checkCancelled();

          const validResults = results.filter((r): r is Result => r !== null);
          setBatchResults(validResults);
          setAllResults((prev) => [...prev, ...validResults]);
          setProcessingProgress((prev) => ({
            ...prev,
            processed: prev.processed + batch.length,
            isComplete: i + batch.length >= validStudents.length,
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
      const { failures } = await saveBulk(allResults, "student_distances");

      if (failures.length > 0) {
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
      <h1 className="app-header">Student Distance Calculator</h1>
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
            ? students.length > 0 && (
                <div className="selection-count">
                  {students.length} students found
                </div>
              )
            : selectedSchools.length > 0 && (
                <div className="selection-count notice">
                  Select a school at level 5 to fetch students
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
                studentsLoading ||
                !selectedLevels[5] ||
                students.length === 0
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

            {studentsError && visibleNotices.studentsError && (
              <NoticeBox error title="Error">
                {String(studentsError)}
              </NoticeBox>
            )}

            {routingError && visibleNotices.routingError && (
              <NoticeBox error title="Error">
                {String(routingError)}
              </NoticeBox>
            )}

            {invalidStudents.length > 0 && visibleNotices.invalidStudents && (
              <NoticeBox warning title="Notice">
                {invalidStudents.length} students had invalid coordinates and
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
                  Processed {processingProgress.processed} students, found{" "}
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
          id: result.studentId,
          school: result.student,
          place: result.school,
          distance: result.distance,
          time: result.time,
          travelMode: result.travelMode,
          rawData: result.rawData,
        }))}
        loading={isProcessing}
        selectedAmenity={{ label: "School" }}
      />
    </div>
  );
};

export default StudentDistanceCalculator;
