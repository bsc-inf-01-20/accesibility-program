import { useDataMutation, useDataQuery } from "@dhis2/app-runtime";
import { useState, useCallback } from "react";
import { useSaveToMongo } from "./useSaveToMongo";

const BATCH_SIZE = 10;
const PROGRAM_ID = "VYD4079wSUr";
const PROGRAM_STAGE_ID = "gHp5I7XORP9";

const DATA_ELEMENTS = {
  PLACE: "YYDH7JgRN2w",
  DISTANCE: "l1nBaEurXfW",
  DURATION: "fiyyHPNZvsG",
  AMENITY_TYPE: "akoE76HDkwg",
  PRIORITY: "QYT4MnvOOVi",
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

export const useSaveResults = () => {
  const [progress, setProgress] = useState({
    total: 0,
    processed: 0,
    successes: 0,
    failures: 0,
    mongoSuccesses: 0,
    mongoFailures: 0
  });
  
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const { saveBulk: saveToMongo } = useSaveToMongo();

  const { refetch: fetchExistingEvents } = useDataQuery(EXISTING_EVENTS_QUERY, { 
    lazy: true,
    onError: (error) => {
      console.error('[EVENT FETCH ERROR]', error);
      setError('Failed to fetch existing events');
    }
  });

  const [mutate] = useDataMutation(CREATE_EVENTS_MUTATION);
  const { refetch: fetchJobStatus } = useDataQuery(JOB_STATUS_QUERY, { lazy: true });

  const log = (message, data = null, type = "info") => {
    const timestamp = new Date().toISOString();
    const styles = {
      info: "color: blue;",
      success: "color: green;",
      error: "color: red;",
      warning: "color: orange;",
      debug: "color: gray;"
    };
    
    console.log(`%c[${timestamp}] ${message}`, styles[type]);
    if (data) console.log(`%c[${timestamp}] Data:`, styles.debug, data);
  };

  const checkForExistingEvents = async (schoolIds, selectedAmenity, travelMode) => {
    log("Checking for existing DHIS2 events", {
      schoolIds,
      selectedAmenity: selectedAmenity.label,
      travelMode
    });

    const existingMap = {};

    for (const orgUnit of schoolIds) {
      try {
        const { existingEvents } = await fetchExistingEvents({
          variables: {
            orgUnits: [orgUnit],
            amenityType: selectedAmenity.label,
            travelMode: travelMode
          }
        });

        const eventsArray = existingEvents?.events || [];
        let mostRecentEvent = null;
        let mostRecentDate = null;

        eventsArray.forEach((event) => {
          const dataValues = {};
          event.dataValues?.forEach((dv) => {
            dataValues[dv.dataElement] = dv.value;
          });

          if (
            dataValues[DATA_ELEMENTS.AMENITY_TYPE] === selectedAmenity.label &&
            dataValues[DATA_ELEMENTS.TRAVEL_MODE] === travelMode
          ) {
            const eventDate = event.eventDate || event.created;
            if (!mostRecentDate || new Date(eventDate) > new Date(mostRecentDate)) {
              mostRecentEvent = event;
              mostRecentDate = eventDate;
            }
          }
        });

        if (mostRecentEvent) {
          existingMap[orgUnit] = {
            event: mostRecentEvent.event,
            fullEvent: mostRecentEvent
          };
          log(`Found existing event for ${orgUnit}`, mostRecentEvent);
        }
      } catch (error) {
        log(`Failed to check events for ${orgUnit}`, error, "warning");
        continue;
      }
    }

    return existingMap;
  };

  const checkJobStatus = async (jobId) => {
    try {
      log(`Checking DHIS2 job status for ${jobId}`);
      const { jobStatus } = await fetchJobStatus({ variables: { jobId } });
      const status = jobStatus?.data?.status;
      log(`Job ${jobId} status: ${status}`);
      return status;
    } catch (error) {
      log(`Failed to check job status for ${jobId}`, error, "error");
      return "UNKNOWN";
    }
  };

  const createEventPayload = (result, selectedAmenity, existingEvent) => {
    try {
      if (!result.schoolId) throw new Error("Missing schoolId");
      
      const requiredFields = {
        distance: result.distance,
        duration: result.duration,
        place: result.place
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
            value: Math.round(Number(result.duration) / 60),
          },
          {
            dataElement: DATA_ELEMENTS.PRIORITY,
            value: calculatePriority(result.distance),
          },
          {
            dataElement: DATA_ELEMENTS.AMENITY_TYPE,
            value: selectedAmenity.label,
          },
          {
            dataElement: DATA_ELEMENTS.TRAVEL_MODE,
            value: result.travelMode || "walking",
          },
        ].filter(dv => dv.value !== undefined && dv.value !== null)
      };

      if (existingEvent?.event) {
        log(`Updating existing event ${existingEvent.event}`);
        return { ...payload, event: existingEvent.event };
      }

      log(`Creating new event for ${result.schoolId}`);
      return payload;
    } catch (error) {
      log("Error creating event payload", { error, result }, "error");
      throw error;
    }
  };

  const saveBatch = async (batch, selectedAmenity, existingEventsMap) => {
    try {
      log(`Processing DHIS2 batch of ${batch.length} events`);

      const events = batch.map(result => {
        try {
          return createEventPayload(result, selectedAmenity, existingEventsMap[result.schoolId]);
        } catch (error) {
          log(`Failed to create payload for ${result.schoolId}`, error, "error");
          return null;
        }
      }).filter(Boolean);

      if (events.length === 0) {
        log("No valid DHIS2 events in batch", null, "warning");
        return {
          status: "SKIPPED",
          imported: 0,
          updated: 0,
          ignored: batch.length
        };
      }

      log(`Sending ${events.length} events to DHIS2`);
      const response = await mutate({ events });
      log("DHIS2 response received", response);

      if (response?.response?.jobId) {
        const jobId = response.response.jobId;
        log(`Tracking DHIS2 job ${jobId}`);
        
        let jobStatus;
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          jobStatus = await checkJobStatus(jobId);
          attempts++;
          
          if (jobStatus === "COMPLETED") break;
          if (jobStatus === "ERROR" || jobStatus === "FAILED") {
            throw new Error('DHIS2 job failed');
          }
        }

        if (jobStatus !== "COMPLETED") {
          throw new Error('DHIS2 job timeout');
        }

        // Simplified success response without report checking
        return {
          status: "SUCCESS",
          imported: events.length, // Assume all imported since job completed
          updated: 0, // Can't determine without report
          ignored: 0  // Can't determine without report
        };
      }

      // Fallback for direct API responses
      return {
        status: "SUCCESS",
        imported: events.length,
        updated: 0,
        ignored: 0
      };
    } catch (error) {
      log("DHIS2 batch save failed", error, "error");
      return {
        status: "ERROR",
        imported: 0,
        updated: 0,
        ignored: batch.length,
        error: error.message
      };
    }
  };

  const saveBulk = useCallback(async (results, selectedAmenity) => {
    if (!results?.length || !selectedAmenity?.label) {
      const errorMsg = !results?.length ? "No results to save" : "Please select an amenity type";
      log(errorMsg, null, "warning");
      setError(errorMsg);
      return { failures: [] };
    }

    const travelMode = results[0]?.travelMode || "walking";
    log(`Starting bulk save for ${results.length} results`, {
      amenity: selectedAmenity.label,
      travelMode
    });

    setSaving(true);
    setError(null);
    setProgress({
      total: results.length,
      processed: 0,
      successes: 0,
      failures: 0,
      mongoSuccesses: 0,
      mongoFailures: 0
    });

    try {
      // Start MongoDB save (non-blocking)
      const mongoPromise = saveToMongo(results)
        .then(({ success }) => {
          log(`MongoDB save ${success ? "succeeded" : "failed"}`);
          setProgress(prev => ({
            ...prev,
            mongoSuccesses: success ? results.length : 0,
            mongoFailures: success ? 0 : results.length
          }));
        })
        .catch(error => {
          log("MongoDB save failed", error, "error");
          setProgress(prev => ({ ...prev, mongoFailures: results.length }));
        });

      // Process DHIS2 save
      const schoolIds = results.map(r => r.schoolId);
      const existingEventsMap = await checkForExistingEvents(schoolIds, selectedAmenity, travelMode);
      const failures = [];

      for (let i = 0; i < results.length; i += BATCH_SIZE) {
        const batch = results.slice(i, i + BATCH_SIZE);
        log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(results.length / BATCH_SIZE)}`);

        const batchResult = await saveBatch(batch, selectedAmenity, existingEventsMap);

        setProgress(prev => ({
          ...prev,
          processed: prev.processed + batch.length,
          successes: prev.successes + batchResult.imported, // Only using imported count now
          failures: prev.failures + batchResult.ignored
        }));

        if (batchResult.status === "ERROR") {
          failures.push({
            batchIndex: i / BATCH_SIZE,
            error: batchResult.error,
            events: batch.map(b => b.schoolId)
          });
        }
      }

      await mongoPromise;
      log("Bulk save completed", {
        successes: progress.successes,
        failures: progress.failures,
        mongoSuccesses: progress.mongoSuccesses
      });
      
      return { failures };
    } catch (error) {
      log("Bulk save failed", error, "error");
      setError(error.message);
      return { failures: [{ error: error.message }] };
    } finally {
      setSaving(false);
    }
  }, []);

  return { 
    saveBulk, 
    saving, 
    error, 
    progress,
    cancel: () => {
      log("Save process cancelled");
      setSaving(false);
    }
  };
};

function calculatePriority(distance) {
  return distance > 10 ? "High" : distance > 5 ? "Medium" : "Low";
}