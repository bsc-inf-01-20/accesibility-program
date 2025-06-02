import { useState, useCallback } from "react";
import axios from "axios";

export const useSaveTeacherRoutesMongo = () => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    lastSaved: null,
    batchCount: 0
  });
  const [results, setResults] = useState(null);

 const prepareTeacherRouteDocument = useCallback((result) => {
  // Validate required IDs
  if (!result?.teacherId || !result?.schoolId) {
    throw new Error(`Missing required IDs for teacher ${result.teacherId}`);
  }

  // Check if coordinates are already properly formatted (new case)
  if (result.coordinates && result.coordinates.teacher && result.coordinates.school) {
    return {
      teacherId: result.teacherId,
      teacherName: result.teacher || result.teacherName || 'Unknown Teacher',
      schoolId: result.schoolId,
      schoolName: result.school || result.schoolName || 'Unknown School',
      travelMode: result.travelMode || 'walking',
      distance: result.distance || 0,
      duration: result.duration || 0,
      coordinates: {
        teacher: result.coordinates.teacher,
        school: result.coordinates.school
      },
      polyline: result.polyline || result.overviewPolyline || null,
      academicYear: result.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      division: result.division || result.levelHierarchy?.[2] || 'Unknown',
      district: result.district || result.levelHierarchy?.[3] || 'Unknown',
      zone: result.zone || result.levelHierarchy?.[4] || 'Unknown',
      rawData: result.rawData || {}
    };
  }

  // Original extraction logic for backward compatibility
  const extractCoordinates = (source) => {
    if (!source) return null;
    
    if (Array.isArray(source)) {
      return source.length === 2 ? source : null;
    }
    
    if (source.lat !== undefined && source.lng !== undefined) {
      return [source.lng, source.lat];
    }
    
    if (source.coordinates && Array.isArray(source.coordinates)) {
      return source.coordinates;
    }
    
    return null;
  };

  const teacherCoords = extractCoordinates(result.originCoords) || 
                       extractCoordinates(result.originLocation) ||
                       (result.rawData?.coordinates ? result.rawData.coordinates : null);

  const schoolCoords = extractCoordinates(result.location) ||
                      (result.rawData?.orgUnit?.coordinates ? result.rawData.orgUnit.coordinates : null);

  if (!teacherCoords || !schoolCoords) {
    throw new Error(`Missing coordinates for teacher ${result.teacherId}`);
  }

  return {
    teacherId: result.teacherId,
    teacherName: result.teacher || 'Unknown Teacher',
    schoolId: result.schoolId,
    schoolName: result.school || 'Unknown School',
    travelMode: result.travelMode || 'walking',
    distance: result.distance || 0,
    duration: result.duration || 0,
    coordinates: {
      teacher: teacherCoords,
      school: schoolCoords
    },
    polyline: result.overviewPolyline || null,
    academicYear: result.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    division: result.division || result.levelHierarchy?.[2] || 'Unknown',
    district: result.district || result.levelHierarchy?.[3] || 'Unknown',
    zone: result.zone || result.levelHierarchy?.[4] || 'Unknown',
    rawData: result.rawData || {}
  };
}, []);

 const saveBulkTeacherRoutes = useCallback(async (results) => {
  if (!results || results.length === 0) {
    setError("No valid results to save");
    return { success: false, error: "No results provided" };
  }

  setSaving(true);
  setError(null);
  setProgress({
    processed: 0,
    total: results.length,
    lastSaved: null,
    batchCount: 0
  });

  const BATCH_SIZE = 50;
  const successfulSaves = [];
  const failedSaves = [];

  try {
    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      const batch = results.slice(i, i + BATCH_SIZE);
      const documents = batch.map(result => {
        try {
          return prepareTeacherRouteDocument(result);
        } catch (error) {
          failedSaves.push({
            teacherId: result.teacherId,
            schoolId: result.schoolId,
            error: error.message,
            type: "validation"
          });
          return null;
        }
      }).filter(Boolean);

      if (documents.length > 0) {
        try {
          const response = await axios.post("https://server-nu-peach.vercel.app/api/teacher-routes/bulk", documents);
          successfulSaves.push(...response.data?.insertedIds || []);
        } catch (error) {
          failedSaves.push(...documents.map(doc => ({
            teacherId: doc.teacherId,
            schoolId: doc.schoolId,
            error: error.response?.data?.message || error.message,
            type: "api"
          })));
        }
      }

      setProgress({
        processed: Math.min(i + BATCH_SIZE, results.length),
        total: results.length,
        lastSaved: new Date().toISOString(),
        batchCount: Math.ceil(i / BATCH_SIZE) + 1
      });
    }

    return {
      success: failedSaves.length === 0,
      saved: successfulSaves.length,
      failed: failedSaves.length,
      failures: failedSaves
    };
  } catch (error) {
    setError(error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    setSaving(false);
  }
}, [prepareTeacherRouteDocument]);

  return {
    saveBulkTeacherRoutes,
    saving,
    error,
    progress,
    results,
    resetState: () => {
      setSaving(false);
      setError(null);
      setProgress({ processed: 0, total: 0, lastSaved: null, batchCount: 0 });
      setResults(null);
    },
  };
};