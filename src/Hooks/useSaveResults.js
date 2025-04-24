import { useDataMutation } from '@dhis2/app-runtime';
import { useState } from 'react';

const CREATE_EVENTS_MUTATION = {
  resource: 'tracker',
  type: 'create',
  data: ({ events }) => ({ events }),
  params: {
    skipNotifications: true,
    importStrategy: 'CREATE_AND_UPDATE',
    atomicMode: 'OBJECT',
    async: false
  },
  options: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }
};

export const useSaveResults = () => {
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mutate] = useDataMutation(CREATE_EVENTS_MUTATION);

  const save = async (results, selectedAmenity) => {
    setSaving(true);
    setError(null);

    try {
      const events = results.map(result => ({
        event: `${result.rawData.orgUnit}-${result.school}`, // Stable ID added here
        program: 'ejitA2KBITf',
        programStage: 'pRS3b1be636',
        orgUnit: result.rawData.orgUnit,
        occurredAt: new Date().toISOString().split('T')[0],
        status: 'COMPLETED',
        dataValues: [
          { dataElement: 'AqOtFClPCQZ', value: String(result.school) },
          { dataElement: 'NrXEKgCUl0t', value: String(result.place || '') },
          { dataElement: 'Uq054liD617', value: Number(result.distance || 0).toFixed(1) },
          { dataElement: 'Idha4EUfeer', value: Math.round(Number(result.time || 0)) },
          { dataElement: 'GEVgvLyVThn', value: String(selectedAmenity?.label || '') }
        ].filter(dv => dv.value !== undefined && dv.value !== null)
      }));

      const response = await mutate({ events });

      if (response?.response?.status === 'WARNING') {
        const failed = response.response.importSummaries.filter(s => s.status !== 'SUCCESS');
        if (failed.length > 0) {
          throw new Error(`${failed.length} events failed to save`);
        }
      }

      return { 
        success: true,
        savedCount: events.length,
        response
      };
    } catch (err) {
      let errorMsg = 'Save failed';
      
      if (err.message.includes('Conflict')) {
        errorMsg = 'Data conflict detected (duplicate events?)';
      } else if (err.response?.status === 409) {
        errorMsg = 'Server detected conflicting data. Try updating existing records.';
      } else {
        errorMsg = err.message || errorMsg;
      }
      
      setError(errorMsg);
      return { 
        success: false, 
        message: errorMsg,
        error: err 
      };
    } finally {
      setSaving(false);
    }
  };

  return { save, saving, error };
};























































// import { useDataMutation } from '@dhis2/app-runtime';
// import { useState } from 'react';

// const CREATE_EVENTS_MUTATION = {
//   resource: 'tracker',
//   type: 'create',
//   data: ({ events }) => ({ events }),
//   params: {
//     skipNotifications: true,
//     importStrategy: 'CREATE_AND_UPDATE',
//     atomicMode: 'OBJECT',
//     async : false
//   },
//   options: {
//     headers: {
//       'Content-Type': 'application/json',
//       'Accept': 'application/json'
//     }
//   }
// };

// export const useSaveResults = () => {
//   const [error, setError] = useState(null);
//   const [saving, setSaving] = useState(false);
//   const [mutate] = useDataMutation(CREATE_EVENTS_MUTATION);

//   const save = async (results, selectedAmenity) => {
//     setSaving(true);
//     setError(null);

//     try {
//       // Generate unique event IDs to prevent conflicts
//       const events = results.map(result => ({
//         //event: result.rawData.orgUnit + '-' + Date.now(), // Unique event ID
//         program: 'ejitA2KBITf',
//         programStage: 'pRS3b1be636',
//         orgUnit: result.rawData.orgUnit,
//         occurredAt: new Date().toISOString().split('T')[0],
//         status: 'COMPLETED',
//         dataValues: [
//           { dataElement: 'AqOtFClPCQZ', value: String(result.school) },
//           { dataElement: 'NrXEKgCUl0t', value: String(result.place || '') },
//           { dataElement: 'Uq054liD617', value: Number(result.distance || 0).toFixed(1) },
//           { dataElement: 'Idha4EUfeer', value: Math.round(Number(result.time || 0)) },
//           { dataElement: 'GEVgvLyVThn', value: String(selectedAmenity?.label || '') }
//         ].filter(dv => dv.value !== undefined && dv.value !== null)
//       }));

//       const response = await mutate({ events });

//       // partial failures

//       if (response?.response?.status === 'WARNING') {
//         const failed = response.response.importSummaries.filter(s => s.status !== 'SUCCESS');
//         if (failed.length > 0) {
//           throw new Error(`${failed.length} events failed to save`);
//         }
//       }

//       return { 
//         success: true,
//         savedCount: events.length,
//         response
//       };
//     } catch (err) {
//       let errorMsg = 'Save failed';
      
//       if (err.message.includes('Conflict')) {
//         errorMsg = 'Data conflict detected (duplicate events?)';
//       } else if (err.response?.status === 409) {
//         errorMsg = 'Server detected conflicting data. Try updating existing records.';
//       } else {
//         errorMsg = err.message || errorMsg;
//       }
      
//       setError(errorMsg);
//       return { 
//         success: false, 
//         message: errorMsg,
//         error: err 
//       };
//     } finally {
//       setSaving(false);
//     }
//   };

//   return { save, saving, error };
// };