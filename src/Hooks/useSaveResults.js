import { useDataMutation, useDataQuery } from '@dhis2/app-runtime';
import { useState, useCallback } from 'react';

const BATCH_SIZE = 10;
const PROGRAM_ID = 'VYD4079wSUr';
const PROGRAM_STAGE_ID = 'gHp5I7XORP9';

// Data Elements
const DATA_ELEMENTS = {
  PLACE: 'akoE76HDkwg',
  DISTANCE: 'l1nBaEurXfW',
  DURATION: 'fiyyHPNZvsG',
  AMENITY_TYPE: 'akoE76HDkwg',
  PRIORITY: 'QYT4MnvOOVi',
  POLYLINE: 'HHQ2t2S2b0y',
  TRAVEL_MODE: 'ZxecTk3l2zj'
};

const EXISTING_EVENTS_QUERY = {
  existingEvents: {
    resource: 'events',
    params: {
      program: PROGRAM_ID,
      programStage: PROGRAM_STAGE_ID,
      fields: 'event,orgUnit,program,programStage,dataValues[dataElement,value]',
      paging: false
    }
  }
};

const CREATE_EVENTS_MUTATION = {
  resource: 'tracker',
  type: 'create',
  data: ({ events }) => ({ events }),
  params: {
    skipNotifications: true,
    importStrategy: 'CREATE_AND_UPDATE',
    atomicMode: 'OBJECT'
  }
};

const JOB_STATUS_QUERY = {
  jobStatus: {
    resource: 'system/tasks',
    id: ({ jobId }) => jobId
  }
};

const JOB_REPORT_QUERY = {
  jobReport: {
    resource: 'tracker/jobs',
    id: ({ jobId }) => jobId,
    params: {
      fields: 'id,created,lastUpdated,status,message,jobType,progress,imported,updated,deleted,ignored'
    }
  }
};

export const useSaveResults = () => {
  const [progress, setProgress] = useState({
    total: 0,
    processed: 0,
    successes: 0,
    failures: 0
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const { refetch: fetchExistingEvents } = useDataQuery(EXISTING_EVENTS_QUERY, { 
    lazy: true,
    onError: (error) => {
      console.error('[EVENT FETCH ERROR]', error);
      setError('Failed to fetch existing events');
    }
  });

  const [mutate] = useDataMutation(CREATE_EVENTS_MUTATION);
  const { refetch: fetchJobStatus } = useDataQuery(JOB_STATUS_QUERY, { lazy: true });
  const { refetch: fetchJobReport } = useDataQuery(JOB_REPORT_QUERY, { lazy: true });

  const log = (message, data = null, type = 'info') => {
    const timestamp = new Date().toISOString();
    const styles = {
      info: 'color: blue;',
      success: 'color: green;',
      error: 'color: red;',
      warning: 'color: orange;',
      debug: 'color: gray;'
    };
    
    console.log(`%c[${timestamp}] ${message}`, styles[type]);
    if (data) {
      console.log(`%c[${timestamp}] Data:`, styles.debug, data);
    }
  };

  const checkForExistingEvents = async (schoolIds) => {
    try {
      if (!schoolIds?.length) {
        log('No school IDs provided for event check', null, 'warning');
        return {};
      }
      
      log(`Checking existing events for ${schoolIds.length} schools`, schoolIds);
      
      const { existingEvents } = await fetchExistingEvents({
        variables: {
          orgUnit: schoolIds.join(',')
        }
      });
      
      log('Existing events API response', existingEvents);
      
      const eventsArray = existingEvents?.events || [];
      const existingMap = {};
      
      eventsArray.forEach(event => {
        const orgUnit = event.orgUnit;
        if (orgUnit && event.program === PROGRAM_ID && event.programStage === PROGRAM_STAGE_ID) {
          existingMap[orgUnit] = { 
            event: event.event,
            fullEvent: event 
          };
          log(`Found existing event for orgUnit ${orgUnit}`, event);
        }
      });
      
      log(`Found ${Object.keys(existingMap).length} existing events`);
      return existingMap;
    } catch (error) {
      log('Event check failed', error, 'error');
      setError('Failed to check existing events');
      setSaving(false);
      return {};
    }
  };

  const checkJobStatus = async (jobId) => {
    try {
      log(`Checking job status for job ${jobId}`);
      const { jobStatus } = await fetchJobStatus({ variables: { jobId } });
      log(`Job ${jobId} status: ${jobStatus?.data?.status}`, jobStatus);
      return jobStatus?.data?.status;
    } catch (error) {
      log(`Failed to check job status for ${jobId}`, error, 'error');
      return 'UNKNOWN';
    }
  };

  const getJobReport = async (jobId) => {
    try {
      log(`Fetching job report for ${jobId}`);
      const { jobReport } = await fetchJobReport({ variables: { jobId } });
      log(`Job ${jobId} report`, jobReport);
      return jobReport;
    } catch (error) {
      log(`Failed to get job report for ${jobId}`, error, 'error');
      return null;
    }
  };

  const createEventPayload = (result, selectedAmenity, existingEvent) => {
    try {
      if (!result.schoolId) {
        throw new Error('Missing schoolId');
      }

      const today = new Date().toISOString().split('T')[0];
      
      const basePayload = {
        program: PROGRAM_ID,
        programStage: PROGRAM_STAGE_ID,
        orgUnit: result.schoolId,
        occurredAt: today,
        status: 'COMPLETED',
        dataValues: [
          { dataElement: DATA_ELEMENTS.PLACE, value: String(result.place || '') },
          { dataElement: DATA_ELEMENTS.DISTANCE, value: Number(result.distance || 0).toFixed(1) },
          { dataElement: DATA_ELEMENTS.DURATION, value: Math.round(Number(result.duration || 0) / 60) },
          { dataElement: DATA_ELEMENTS.AMENITY_TYPE, value: String(selectedAmenity?.label || '') },
          { dataElement: DATA_ELEMENTS.PRIORITY, value: calculatePriority(result.distance) },
          { dataElement: DATA_ELEMENTS.POLYLINE, value: result.overviewPolyline || 'N/A' },
          { 
            dataElement: DATA_ELEMENTS.TRAVEL_MODE, 
            value: ['walking', 'driving', 'cycling', 'public_transport'].includes(result.travelMode) 
              ? result.travelMode 
              : 'walking' 
          }
        ].filter(dv => dv.value !== undefined && dv.value !== null)
      };

      if (existingEvent?.event) {
        log(`Updating existing event ${existingEvent.event} for orgUnit ${result.schoolId}`);
        return { ...basePayload, event: existingEvent.event };
      }

      log(`Creating new event for orgUnit ${result.schoolId}`);
      return basePayload;
    } catch (error) {
      log('Error creating event payload', { error, result }, 'error');
      throw error;
    }
  };

  const saveBatch = async (batch, selectedAmenity, existingEventsMap) => {
  try {
    log(`Processing batch of ${batch.length} events`);
    
    const events = batch.map(result => {
      try {
        return createEventPayload(result, selectedAmenity, existingEventsMap[result.schoolId]);
      } catch (error) {
        log(`Failed to create payload for school ${result.schoolId}`, error, 'error');
        return null;
      }
    }).filter(Boolean);

    log(`Prepared ${events.length} valid events for saving`, events);

    if (events.length === 0) {
      log('No valid events to save in this batch', null, 'warning');
      return { status: 'SKIPPED', imported: 0, updated: 0, ignored: batch.length };
    }

    log('Sending events to server', events);
    const response = await mutate({ events });
    log('Server response received', response);
    
    if (response?.response?.jobId) {
      const jobId = response.response.jobId;
      log(`Tracker job created with ID: ${jobId}`);
      
      let jobStatus;
      let attempts = 0;
      const maxAttempts = 30;
      const delay = 1000;
      
      do {
        await new Promise(resolve => setTimeout(resolve, delay));
        const statusResponse = await fetchJobStatus({ variables: { jobId } });
        jobStatus = statusResponse?.jobStatus?.data?.status;
        attempts++;
        log(`Job status check ${attempts}/${maxAttempts}: ${jobStatus}`);
        
        if (jobStatus === 'ERROR' || jobStatus === 'FAILED') {
          const report = await getJobReport(jobId);
          log('Job failed - full report:', report, 'error');
          throw new Error(`Job failed: ${report?.message || 'Unknown error'}`);
        }
        
      } while (jobStatus === 'RUNNING' && attempts < maxAttempts);
      
      if (jobStatus !== 'COMPLETED') {
        throw new Error(`Job did not complete within ${maxAttempts} seconds`);
      }

      log(`Job ${jobId} completed successfully`);
      const report = await getJobReport(jobId);
      log('Job completion report', report);
      
      if (!report?.response?.stats?.created && !report?.response?.stats?.updated) {
        throw new Error('No events were created or updated despite job completion');
      }

      return {
        status: 'SUCCESS',
        imported: report?.response?.stats?.created || 0,
        updated: report?.response?.stats?.updated || 0,
        ignored: report?.response?.stats?.ignored || 0
      };
    }

    // Fallback for direct API responses (non-tracker)
    return {
      status: 'SUCCESS',
      imported: response?.response?.stats?.created || 0,
      updated: response?.response?.stats?.updated || 0,
      ignored: response?.response?.stats?.ignored || 0
    };
  } catch (error) {
    log('Batch save failed', error, 'error');
    return {
      status: 'ERROR',
      imported: 0,
      updated: 0,
      ignored: batch.length,
      error: error.message
    };
  }
};

  const saveBulk = useCallback(async (results, selectedAmenity) => {
    if (!results?.length) {
      log('No results to save', null, 'warning');
      setError('No results to save');
      return { failures: [] };
    }

    setSaving(true);
    setError(null);
    setProgress({
      total: results.length,
      processed: 0,
      successes: 0,
      failures: 0
    });

    log(`Starting bulk save for ${results.length} results`, results);

    try {
      const schoolIds = results.map(r => r.schoolId);
      const existingEventsMap = await checkForExistingEvents(schoolIds);
      const failures = [];

      for (let i = 0; i < results.length; i += BATCH_SIZE) {
        const batch = results.slice(i, i + BATCH_SIZE);
        log(`Processing batch ${i/BATCH_SIZE + 1} of ${Math.ceil(results.length/BATCH_SIZE)}`);
        
        const batchResult = await saveBatch(batch, selectedAmenity, existingEventsMap);

        setProgress(prev => ({
          ...prev,
          processed: prev.processed + batch.length,
          successes: prev.successes + (batchResult.imported + batchResult.updated),
          failures: prev.failures + batchResult.ignored
        }));

        log(`Batch ${i/BATCH_SIZE + 1} results`, batchResult);

        if (batchResult.status === 'ERROR') {
          failures.push({
            batchIndex: i / BATCH_SIZE,
            error: batchResult.error,
            events: batch.map(b => b.schoolId)
          });
          log(`Batch ${i/BATCH_SIZE + 1} failed`, batchResult.error, 'error');
        }
      }

      log(`Bulk save completed with ${failures.length} failures`, failures);
      return { failures };
    } catch (error) {
      log('Bulk save failed', error, 'error');
      setError(error.message);
      return { failures: [{ error: error.message }] };
    } finally {
      setSaving(false);
      log('Save process completed');
    }
  }, []);

  return { 
    saveBulk, 
    saving, 
    error, 
    progress,
    cancel: () => {
      log('Save process cancelled by user');
      setSaving(false);
    } 
  };
};

function calculatePriority(distance) {
  return distance > 10 ? 'High' : distance > 5 ? 'Medium' : 'Low';
}