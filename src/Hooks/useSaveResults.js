import { useDataMutation, useDataQuery } from "@dhis2/app-runtime";
import { useState, useCallback } from "react";

const BATCH_SIZE = 10;
const PROGRAM_ID = "VYD4079wSUr";
const PROGRAM_STAGE_ID = "gHp5I7XORP9";

// Data Elements
const DATA_ELEMENTS = {
  PLACE: "YYDH7JgRN2w",
  DISTANCE: "l1nBaEurXfW",
  DURATION: "fiyyHPNZvsG",
  AMENITY_TYPE: "akoE76HDkwg",
  PRIORITY: "QYT4MnvOOVi",
  POLYLINE: "HHQ2t2S2b0y",
  TRAVEL_MODE: "oEmCUEadook",
};

const EXISTING_EVENTS_QUERY = {
  existingEvents: {
    resource: "events",
    params: ({ variables }) => {
      const { orgUnits, amenityType, travelMode } = variables;

      if (!orgUnits?.length || !amenityType || !travelMode) {
        throw new Error(
          "Missing required filters (orgUnits, amenityType, or travelMode)"
        );
      }

      return {
        program: PROGRAM_ID,
        programStage: PROGRAM_STAGE_ID,
        orgUnit: orgUnits.join(","),
        filter: [
          `${DATA_ELEMENTS.AMENITY_TYPE}:eq:${amenityType}`,
          `${DATA_ELEMENTS.TRAVEL_MODE}:eq:${travelMode}`,
        ],
        fields: "event,orgUnit,dataValues[dataElement,value]",
        paging: false,
      };
    },
  },
};

const CREATE_EVENTS_MUTATION = {
  resource: "tracker",
  type: "create",
  data: ({ events }) => ({ events }),
  params: {
    skipNotifications: true,
    importStrategy: "CREATE_AND_UPDATE",
    atomicMode: "OBJECT",
  },
};

const JOB_STATUS_QUERY = {
  jobStatus: {
    resource: "system/tasks",
    id: ({ jobId }) => jobId,
  },
};

const JOB_REPORT_QUERY = {
  jobReport: {
    resource: "tracker/jobs",
    id: ({ jobId }) => jobId,
    params: {
      fields:
        "id,created,lastUpdated,status,message,jobType,progress,imported,updated,deleted,ignored",
    },
  },
};

export const useSaveResults = () => {
  const [progress, setProgress] = useState({
    total: 0,
    processed: 0,
    successes: 0,
    failures: 0,
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const { refetch: fetchExistingEvents } = useDataQuery(EXISTING_EVENTS_QUERY, {
    lazy: true,
    onError: (error) => {
      console.error("[EVENT FETCH ERROR]", error);
      setError("Failed to fetch existing events");
    },
  });

  const [mutate] = useDataMutation(CREATE_EVENTS_MUTATION);
  const { refetch: fetchJobStatus } = useDataQuery(JOB_STATUS_QUERY, {
    lazy: true,
  });
  const { refetch: fetchJobReport } = useDataQuery(JOB_REPORT_QUERY, {
    lazy: true,
  });

  const log = (message, data = null, type = "info") => {
    const timestamp = new Date().toISOString();
    const styles = {
      info: "color: blue;",
      success: "color: green;",
      error: "color: red;",
      warning: "color: orange;",
      debug: "color: gray;",
    };

    console.log(`%c[${timestamp}] ${message}`, styles[type]);
    if (data) {
      console.log(`%c[${timestamp}] Data:`, styles.debug, data);
    }
  };

  const checkForExistingEvents = async (
    schoolIds,
    selectedAmenity,
    travelMode
  ) => {
    log("Checking for existing events", {
      schoolIds,
      selectedAmenity,
      travelMode,
    });

    const existingMap = {};

    // Process each org unit individually
    for (const orgUnit of schoolIds) {
      try {
        const { existingEvents } = await fetchExistingEvents({
          variables: {
            orgUnits: [orgUnit],
            amenityType: selectedAmenity.label,
            travelMode: travelMode,
          },
        });

        const eventsArray = existingEvents?.events || [];

        // Find the most recent matching event
        let mostRecentEvent = null;
        let mostRecentDate = null;

        eventsArray.forEach((event) => {
          const dataValues = {};
          event.dataValues?.forEach((dv) => {
            dataValues[dv.dataElement] = dv.value;
          });

          // Verify this is the exact combination we want
          if (
            dataValues[DATA_ELEMENTS.AMENITY_TYPE] === selectedAmenity.label &&
            dataValues[DATA_ELEMENTS.TRAVEL_MODE] === travelMode
          ) {
            const eventDate = event.eventDate || event.created;
            if (
              !mostRecentDate ||
              new Date(eventDate) > new Date(mostRecentDate)
            ) {
              mostRecentEvent = event;
              mostRecentDate = eventDate;
            }
          }
        });

        if (mostRecentEvent) {
          existingMap[orgUnit] = {
            event: mostRecentEvent.event,
            fullEvent: mostRecentEvent,
          };
          log(`Found matching event for orgUnit ${orgUnit}`, mostRecentEvent);
        }
      } catch (error) {
        log(`Failed to check events for orgUnit ${orgUnit}`, error, "warning");
        continue;
      }
    }

    return existingMap;
  };

  const checkJobStatus = async (jobId) => {
    try {
      log(`Checking job status for job ${jobId}`);
      const { jobStatus } = await fetchJobStatus({ variables: { jobId } });
      log(`Job ${jobId} status: ${jobStatus?.data?.status}`, jobStatus);
      return jobStatus?.data?.status;
    } catch (error) {
      log(`Failed to check job status for ${jobId}`, error, "error");
      return "UNKNOWN";
    }
  };

  const getJobReport = async (jobId) => {
    try {
      log(`Fetching job report for ${jobId}`);
      const { jobReport } = await fetchJobReport({ variables: { jobId } });
      log(`Job ${jobId} report`, jobReport);
      return jobReport;
    } catch (error) {
      log(`Failed to get job report for ${jobId}`, error, "error");
      return null;
    }
  };

  const createEventPayload = (result, selectedAmenity, existingEvent) => {
    try {
      if (!result.schoolId) {
        throw new Error("Missing schoolId");
      }

      // Validate all required fields exist (excluding polyline)
      const requiredFields = {
        distance: result.distance,
        duration: result.duration,
        place: result.place,
      };

      for (const [field, value] of Object.entries(requiredFields)) {
        if (value === undefined || value === null || value === "") {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      const today = new Date().toISOString().split("T")[0];

      const payload = {
        program: PROGRAM_ID,
        orgUnit: result.schoolId,
        occurredAt: today,
        status: "COMPLETED",
        dataValues: [
          // Mandatory elements
          {
            dataElement: DATA_ELEMENTS.PLACE,
            value: String(result.place),
          },
          {
            dataElement: DATA_ELEMENTS.DISTANCE,
            value: Number(result.distance).toFixed(1),
          },
          {
            dataElement: DATA_ELEMENTS.DURATION,
            value: Math.round(Number(result.duration) / 60), // Convert to minutes
          },
          {
            dataElement: DATA_ELEMENTS.PRIORITY,
            value: calculatePriority(result.distance),
          },
          // Identifying elements
          {
            dataElement: DATA_ELEMENTS.AMENITY_TYPE,
            value: selectedAmenity.label,
          },
          {
            dataElement: DATA_ELEMENTS.TRAVEL_MODE,
            value: result.travelMode || "walking",
          },
        ].filter((dv) => dv.value !== undefined && dv.value !== null),
      };

      if (existingEvent?.event) {
        log(
          `Updating existing event ${existingEvent.event} for orgUnit ${result.schoolId}`
        );
        return { ...payload, event: existingEvent.event };
      }

      log(`Creating new event for orgUnit ${result.schoolId}`);
      return payload;
    } catch (error) {
      log("Error creating event payload", { error, result }, "error");
      throw error;
    }
  };
  const saveBatch = async (batch, selectedAmenity, existingEventsMap) => {
    try {
      log(`Processing batch of ${batch.length} events`);

      const events = batch
        .map((result) => {
          try {
            return createEventPayload(
              result,
              selectedAmenity,
              existingEventsMap[result.schoolId]
            );
          } catch (error) {
            log(
              `Failed to create payload for school ${result.schoolId}`,
              error,
              "error"
            );
            return null;
          }
        })
        .filter(Boolean);

      log(`Prepared ${events.length} valid events for saving`, events);

      if (events.length === 0) {
        log("No valid events to save in this batch", null, "warning");
        return {
          status: "SKIPPED",
          imported: 0,
          updated: 0,
          ignored: batch.length,
        };
      }

      log("Sending events to server", events);
      const response = await mutate({ events });
      log("Server response received", response);

      if (response?.response?.jobId) {
        const jobId = response.response.jobId;
        log(`Tracker job created with ID: ${jobId}`);

        let jobStatus;
        let attempts = 0;
        const maxAttempts = 30;
        const delay = 1000;

        do {
          await new Promise((resolve) => setTimeout(resolve, delay));
          const statusResponse = await fetchJobStatus({ variables: { jobId } });
          jobStatus = statusResponse?.jobStatus?.data?.status;
          attempts++;
          log(`Job status check ${attempts}/${maxAttempts}: ${jobStatus}`);

          if (jobStatus === "ERROR" || jobStatus === "FAILED") {
            const report = await getJobReport(jobId);
            log("Job failed - full report:", report, "error");
            throw new Error(
              `Job failed: ${report?.message || "Unknown error"}`
            );
          }
        } while (jobStatus === "RUNNING" && attempts < maxAttempts);

        if (jobStatus !== "COMPLETED") {
          throw new Error(`Job did not complete within ${maxAttempts} seconds`);
        }

        log(`Job ${jobId} completed successfully`);
        const report = await getJobReport(jobId);
        log("Job completion report", report);

        if (
          !report?.response?.stats?.created &&
          !report?.response?.stats?.updated
        ) {
          throw new Error(
            "No events were created or updated despite job completion"
          );
        }

        return {
          status: "SUCCESS",
          imported: report?.response?.stats?.created, // || 0,
          updated: report?.response?.stats?.updated, // || 0,
          ignored: report?.response?.stats?.ignored, // || 0
        };
      }

      // Fallback for direct API responses (non-tracker)
      return {
        status: "SUCCESS",
        imported: response?.response?.stats?.created, // || 0,
        updated: response?.response?.stats?.updated, // || 0,
        ignored: response?.response?.stats?.ignored,
      };
    } catch (error) {
      log("Batch save failed", error, "error");
      return {
        status: "ERROR",
        imported: 0,
        updated: 0,
        ignored: batch.length,
        error: error.message,
      };
    }
  };

  const saveBulk = useCallback(async (results, selectedAmenity) => {
    if (!results?.length) {
      log("No results to save", null, "warning");
      setError("No results to save");
      return { failures: [] };
    }

    if (!selectedAmenity?.label) {
      log("No amenity type selected", null, "warning");
      setError("Please select an amenity type");
      return { failures: [] };
    }

    // Get travelMode from first result (with fallback to 'walking')
    const travelMode = results[0]?.travelMode || "walking";

    // Validate travelMode
    const validTravelModes = [
      "walking",
      "driving",
      "cycling",
      "public_transport",
    ];
    if (!validTravelModes.includes(travelMode)) {
      log(
        `Invalid travel mode: ${travelMode}. Defaulting to 'walking'`,
        null,
        "warning"
      );
      travelMode = "walking";
    }

    setSaving(true);
    setError(null);
    setProgress({
      total: results.length,
      processed: 0,
      successes: 0,
      failures: 0,
    });

    log(
      `Starting bulk save for ${results.length} results with amenity "${selectedAmenity.label}" and travel mode "${travelMode}"`
    );

    try {
      const schoolIds = results.map((r) => r.schoolId);
      const existingEventsMap = await checkForExistingEvents(
        schoolIds,
        selectedAmenity,
        travelMode
      );
      const failures = [];

      for (let i = 0; i < results.length; i += BATCH_SIZE) {
        const batch = results.slice(i, i + BATCH_SIZE);
        log(
          `Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(results.length / BATCH_SIZE)}`
        );

        const batchResult = await saveBatch(
          batch,
          selectedAmenity,
          existingEventsMap
        );

        setProgress((prev) => ({
          ...prev,
          processed: prev.processed + batch.length,
          successes:
            prev.successes + (batchResult.imported + batchResult.updated),
          failures: prev.failures + batchResult.ignored,
        }));

        if (batchResult.status === "ERROR") {
          failures.push({
            batchIndex: i / BATCH_SIZE,
            error: batchResult.error,
            events: batch.map((b) => b.schoolId),
          });
        }
      }

      return { failures };
    } catch (error) {
      log("Bulk save failed", error, "error");
      setError(error.message);
      return { failures: [{ error: error.message }] };
    } finally {
      setSaving(false);
      log("Save process completed");
    }
  }, []);

  return {
    saveBulk,
    saving,
    error,
    progress,
    cancel: () => {
      log("Save process cancelled by user");
      setSaving(false);
    },
  };
};

function calculatePriority(distance) {
  return distance > 10 ? "High" : distance > 5 ? "Medium" : "Low";
} 