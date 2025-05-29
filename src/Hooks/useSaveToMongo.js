import { useState } from "react";
import axios from "axios";

export const useSaveToMongo = () => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    lastSaved: null,
  });

  // Transform results for MongoDB with filter-ready hierarchy
 const prepareDocument = (result) => {
  // Required field validation
  if (!result.schoolId) throw new Error("Missing schoolId");
  if (!result.placeId) throw new Error("Missing placeId");
  if (typeof result.distance !== "number") throw new Error("Invalid distance");

  // Extract hierarchy names
  const hierarchy = {
    division: result.levelHierarchy?.[2] || "Unknown Division",
    district: result.levelHierarchy?.[3] || "Unknown District",
    zone: result.levelHierarchy?.[4] || "Unknown Zone",
  };

  // Prepare coordinates - match backend structure
  const schoolCoords = Array.isArray(result.schoolCoords)
    ? { lat: result.schoolCoords[1], lng: result.schoolCoords[0] }
    : result.schoolCoords || { lat: 0, lng: 0 };

  return {
    // Core identification
    schoolId: result.schoolId,
    schoolName: result.school,
    place: result.place || "Unknown Place", // Changed from placeName to place
    placeId: result.placeId,

    // Metrics
    distance: parseFloat(result.distance.toFixed(3)),
    duration: result.duration || 0,
    travelMode: result.travelMode || "walking",
    amenityType: result.amenityType || "unknown",

    // Geo data - match backend field names
    schoolCoords: schoolCoords, // Directly in root (not in locations)
    location: result.location || { lat: 0, lng: 0 }, // For amenity location
    overviewPolyline: result.overviewPolyline || "", // Not polyline

    // Hierarchy filters
    division: hierarchy.division,
    district: hierarchy.district,
    zone: hierarchy.zone,

    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

  const saveBulk = async (results) => {
    if (!results || !Array.isArray(results) || results.length === 0) {
      setError("No results provided for saving");
      return { success: false, error: "No results provided" };
    }

    setSaving(true);
    setError(null);
    setProgress({ processed: 0, total: results.length, lastSaved: null });

    try {
      // Process in batches of 50 for better performance
      const BATCH_SIZE = 50;
      const successfulSaves = [];
      const failedSaves = [];

      for (let i = 0; i < results.length; i += BATCH_SIZE) {
        const batch = results.slice(i, i + BATCH_SIZE);

        const documents = batch
          .map((result) => {
            try {
              return prepareDocument(result);
            } catch (error) {
              console.error(
                "Document preparation failed:",
                error.message,
                result
              );
              failedSaves.push({
                schoolId: result.schoolId,
                error: error.message,
                rawData: result,
              });
              return null;
            }
          })
          .filter(Boolean);

        if (documents.length > 0) {
          console.log("Sending batch to MongoDB:", documents); 
          try {
            const response = await axios.post(
              "https://server-nu-peach.vercel.app/api/routes/bulk",
              documents,
              {
                headers: { "Content-Type": "application/json" },
                timeout: 30000,
              }
            );

            successfulSaves.push(...(response.data?.insertedIds || []));
            setProgress((prev) => ({
              ...prev,
              processed: i + documents.length,
              lastSaved: new Date().toISOString(),
            }));
          } catch (error) {
            failedSaves.push(
              ...documents.map((doc) => ({
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
        failedSaves,
        lastBatchSaved: progress.lastSaved,
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
    saveBulk,
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
