import { useState } from "react";
import axios from "axios";

export const useSaveTeacherRoutesMongo = () => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    lastSaved: null,
  });

  const prepareTeacherRouteDocument = (result) => {
    // 1. Validate required fields
    if (!result?.teacherId || !result?.schoolId) {
      console.error('Missing required IDs:', {
        teacherId: result?.teacherId,
        schoolId: result?.schoolId
      });
      return null;
    }

    // 2. Process coordinates with validation
    const coordinates = {
      teacher: Array.isArray(result.coordinates?.teacher) && 
               result.coordinates.teacher.length === 2 ?
        result.coordinates.teacher.map(Number) :
        [0, 0],
      
      school: Array.isArray(result.coordinates?.school) && 
              result.coordinates.school.length === 2 ?
        result.coordinates.school.map(Number) :
        [35.30682563131544, -15.393456712733258] // Default fallback coordinates
    };

    // 3. Prepare the document with type safety
    const document = {
      // Required fields from schema
      teacherId: String(result.teacherId),
      teacherName: String(result.teacherName || 'Unknown Teacher'),
      schoolId: String(result.schoolId),
      schoolName: String(result.schoolName || 'Unknown School'),
      travelMode: String(result.travelMode || 'walking'),
      distance: parseFloat(Number(result.distance || 0).toFixed(3)),
      duration: Math.max(0, parseInt(result.duration || 0)),
      coordinates,
      academicYear: String(
        result.academicYear || 
        `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`
      ),
      division: String(result.division || "Unknown"),
      district: String(result.district || "Unknown"),
      zone: String(result.zone || "Unknown"),
      
      // Teacher-specific fields
      teacherCode: String(result.teacherCode || ''),
      specialization: String(result.specialization || ''),
      
      // Optional fields
      polyline: result.polyline ? String(result.polyline) : null,
    };

    // 4. Validation logging (for debugging)
    if (process.env.NODE_ENV === 'development') {
      console.log('Processed teacher route document:', {
        input: {
          teacherId: result.teacherId,
          schoolId: result.schoolId,
          coordinates: result.coordinates
        },
        output: {
          teacherId: document.teacherId,
          schoolId: document.schoolId,
          coordinates: document.coordinates,
          distance: document.distance,
          duration: document.duration
        }
      });
    }

    return document;
  };

  const saveBulkTeacherRoutes = async (results) => {
    if (!results || !Array.isArray(results) || results.length === 0) {
      setError("No teacher routes provided for saving");
      return { success: false, error: "No results provided" };
    }

    setSaving(true);
    setError(null);
    setProgress({ processed: 0, total: results.length, lastSaved: null });

    try {
      const BATCH_SIZE = 50;
      const successfulSaves = [];
      const failedSaves = [];

      for (let i = 0; i < results.length; i += BATCH_SIZE) {
        const batch = results.slice(i, i + BATCH_SIZE);

        const documents = batch
          .map((result) => {
            try {
              return prepareTeacherRouteDocument(result);
            } catch (error) {
              failedSaves.push({
                teacherId: result.teacherId,
                schoolId: result.schoolId,
                error: error.message,
              });
              return null;
            }
          })
          .filter(Boolean);

        if (documents.length > 0) {
          try {
            const response = await axios.post(
              "https://server-nu-peach.vercel.app/api/teacher-routes/bulk", // Updated endpoint
              documents,
              {
                headers: { "Content-Type": "application/json" },
                timeout: 30000,
              }
            );

            successfulSaves.push(...(response.data?.savedRoutes || []));
            setProgress({
              processed: i + documents.length,
              total: results.length,
              lastSaved: new Date().toISOString(),
            });
          } catch (error) {
            failedSaves.push(
              ...documents.map((doc) => ({
                teacherId: doc.teacherId,
                schoolId: doc.schoolId,
                error: error.response?.data?.message || error.message,
              }))
            );
          }
        }
      }

      return {
        success: failedSaves.length === 0,
        savedCount: successfulSaves.length,
        failedCount: failedSaves.length,
        failures: failedSaves,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      setError(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setSaving(false);
    }
  };

  return {
    saveBulkTeacherRoutes,
    saving,
    error,
    progress,
    resetState: () => {
      setSaving(false);
      setError(null);
      setProgress({ processed: 0, total: 0, lastSaved: null });
    },
  };
};