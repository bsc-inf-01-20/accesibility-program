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

  // Helper to calculate priority based on distance
  const calculatePriority = (distance) => {
    return distance > 10 ? 'High' : 
           distance > 5 ? 'Medium' : 'Low';
  };

  const save = async (results, selectedAmenity) => {
    setSaving(true);
    setError(null);

    try {
      const events = results.map(result => ({
        event: `${result.rawData.orgUnit}-${result.school}`, // Stable ID remains
        program: 'ejitA2KBITf',
        programStage: 'pRS3b1be636',
        orgUnit: result.rawData.orgUnit,
        occurredAt: new Date().toISOString().split('T')[0],
        status: 'COMPLETED',
        dataValues: [
          // Removed: School Name data element (AqOtFClPCQZ)
          
          // Existing data elements
          { dataElement: 'NrXEKgCUl0t', value: String(result.place || '') },
          { dataElement: 'Uq054liD617', value: Number(result.distance || 0).toFixed(1) },
          { dataElement: 'Idha4EUfeer', value: Math.round(Number(result.time || 0)) },
          { dataElement: 'GEVgvLyVThn', value: String(selectedAmenity?.label || '') },
          
          // New data elements added:
          { 
            dataElement: 'EzfwKtH6Di8',  // Priority
            value: calculatePriority(result.distance) 
          },
          { 
            dataElement: 'ieQN2HvTJM7',   // Route Polyline
            value: result.overviewPolyline || 'N/A' 
          }
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
//     async: false
//   }
// };

// export const useSaveResults = () => {
//   const [error, setError] = useState(null);
//   const [saving, setSaving] = useState(false);
//   const [mutate] = useDataMutation(CREATE_EVENTS_MUTATION);

//   // Helper function to clean and validate values
//   const cleanValue = (value, type = 'string') => {
//     if (value === null || value === undefined) return null;
    
//     switch (type) {
//       case 'number':
//         return parseFloat(value) || 0;
//       case 'integer':
//         return parseInt(value) || 0;
//       case 'boolean':
//         return Boolean(value);
//       default:
//         return String(value).substring(0, 50000); // Limit string length
//     }
//   };

//   const save = async (selectedSchools, results, selectedAmenity) => {
//     setSaving(true);
//     setError(null);

//     try {
//       // Validate inputs
//       if (!selectedSchools?.length) {
//         throw new Error('No schools selected - please select at least one organization unit');
//       }

//       if (!results?.length) {
//         throw new Error('No results to save - please run analysis first');
//       }

//       // Prepare events with cleaned data
//       const events = results.map(result => {
//         const school = selectedSchools.find(s => s.id === result.schoolId);
//         if (!school) return null;

//         // Calculate priority based on distance (now as simple text)
//         const priority = result.distance > 10 ? 'High' : 
//                         result.distance > 5 ? 'Medium' : 'Low';

//         return {
//           program: 'ejitA2KBITf',
//           programStage: 'pRS3b1be636',
//           orgUnit: school.id,
//           occurredAt: new Date().toISOString().split('T')[0], // Changed from occurredAt to eventDate
//           status: 'COMPLETED',
//           dataValues: [
//             {
//               dataElement: 'NrXEKgCUl0t',
//               value: cleanValue(result.place)
//             },
//             {
//               dataElement: 'Uq054liD617',
//               value: cleanValue(result.distance, 'number').toFixed(2) // Ensure 2 decimal places
//             },
//             {
//               dataElement: 'Idha4EUfeer',
//               value: cleanValue(result.time, 'integer')
//             },
//             {
//               dataElement: 'GEVgvLyVThn',
//               value: cleanValue(selectedAmenity?.label) // Directly save the label text
//             },
//             {
//               dataElement: 'EzfwKtH6Di8',
//               value: priority // Simple text priority
//             },
//             {
//               dataElement: 'ieQN2HvTJM7',
//               value: cleanValue(result.overviewPolyline) || 'N/A'
//             }
//           ].filter(dv => dv.value !== null) // Remove null values
//         };
//       }).filter(Boolean); // Remove null events

//       if (events.length === 0) {
//         throw new Error('No matching results found for the selected organization units');
//       }

//       // Save to DHIS2
//       const response = await mutate({ events });

//       return {
//         success: true,
//         savedCount: events.length,
//         response
//       };

//     } catch (err) {
//       console.error('Save failed:', err);
//       setError(err.message);
//       return {
//         success: false,
//         error: err.message
//       };
//     } finally {
//       setSaving(false);
//     }
//   };

//   return { save, saving, error };
// };
















































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