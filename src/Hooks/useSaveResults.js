import { useDataMutation } from '@dhis2/app-runtime';
import { useState } from 'react';

// Replace these with your actual IDs from DHIS2
const PROGRAM_ID = 'JcnASDsV0ed'; // School Proximity Survey program
const STAGE_ID = 'pRS3b1be636'; // Program stage ID
const DATA_ELEMENTS = {
  SCHOOL: 'AqOtFClPCQZ',      // School Name *
  AMENITY: 'NrXEKgCUl0t',     // Closest Amenity
  DISTANCE: 'Uq054liD617',    // Distance (km)
  TIME: 'Idha4EUfeer',        // Travel Time
  TYPE: 'GEVgvLyVThn'         // Amenity Type
};

const eventMutation = {
  resource: 'events',
  type: 'create',
  data: ({ events }) => ({ events }),
  params: {
    skipNotifications: true
  }
};

export const useSaveResults = () => {
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [mutate, { loading }] = useDataMutation(eventMutation);

  const save = async (results, selectedAmenity) => {
    setError(null);
    
    if (!results?.length) {
      setError('No results to save');
      return { success: false, message: 'No results to save' };
    }

    const today = new Date().toISOString().split('T')[0]; // yyyy-mm-dd format
    const events = results.map(result => {
      // Validate required fields
      if (!result.school || !result.rawData?.orgUnit) {
        console.warn('Missing required fields for:', result);
        return null;
      }

      return {
        program: PROGRAM_ID,
        programStage: STAGE_ID,
        orgUnit: result.rawData.orgUnit,
        eventDate: today,
        status: 'COMPLETED',
        dataValues: [
          { dataElement: DATA_ELEMENTS.SCHOOL, value: result.school },
          { dataElement: DATA_ELEMENTS.AMENITY, value: result.place },
          { dataElement: DATA_ELEMENTS.DISTANCE, value: result.distance?.toString() },
          { dataElement: DATA_ELEMENTS.TIME, value: result.time?.toString() },
          { dataElement: DATA_ELEMENTS.TYPE, value: selectedAmenity?.label }
        ].filter(dv => dv.value !== undefined && dv.value !== '')
      };
    }).filter(event => event !== null);

    if (events.length === 0) {
      const message = 'No valid events to save after validation';
      setError(message);
      return { success: false, message };
    }

    try {
      console.debug('Saving events:', events);
      const res = await mutate({ events });
      setResponse(res);
      
      return {
        success: true,
        savedCount: events.length,
        message: `Successfully saved ${events.length} events to School Proximity Survey`,
        response: res
      };
    } catch (err) {
      let errorMsg = 'Failed to save events';
      
      if (err.message.includes('already exists')) {
        errorMsg = 'Some events already exist for today';
      } else if (err.response?.status === 409) {
        errorMsg = 'Duplicate events detected';
      } else {
        errorMsg = err.message || errorMsg;
      }

      console.error('Save failed:', err);
      setError(errorMsg);
      return {
        success: false,
        message: errorMsg,
        error: err
      };
    }
  };

  return { save, loading, error, response };
};














































































































































































//TRACKED ENTIRY WHICH IS PROMISSING TO SAVE

// import { useDataMutation } from '@dhis2/app-runtime'
// import { useState } from 'react'

// // ✅ Define the tracker mutation once (static)
// const trackedEntityMutation = {
//   resource: 'tracker',
//   type: 'create',
//   data: ({ payload }) => payload
// }

// export const useSaveResults = () => {
//   const [response, setResponse] = useState(null)
//   const [error, setError] = useState(null)

//   // ✅ Hook to perform the mutation
//   const [mutate, { loading }] = useDataMutation(trackedEntityMutation)

//   const save = async (results, selectedAmenity) => {
//     const payload = {
//       trackedEntities: results.map((r) => ({
//         trackedEntityType: 'hRa4Nal90l8', // ✅ Your Tracked Entity Type UID
//         orgUnit: r.rawData.orgUnit,      // ✅ Org Unit from the school result
//         attributes: [
//           { attribute: 'negzyGgDJld', value: r.school },      // School Name
//           { attribute: 'GDhr0OeUT9M', value: r.place },       // Closest Amenity
//           { attribute: 'TCJeJ0eRMki', value: r.distance },    // Distance (km)
//           { attribute: 'emlltmF9e2Y', value: r.time },        // Travel Time
//           { attribute: 'wm57x3rEKtY', value: selectedAmenity.label } // Amenity Type
//         ],

//         enrollments: [
//           {
//             program: 'JcnASDsV0ed',             // ✅ Your Tracker Program ID
//             programStage: 'pRS3b1be636',        // ✅ Your Program Stage ID
//             orgUnit: r.rawData.orgUnit,
//             enrollmentDate: new Date().toISOString(),
//             incidentDate: new Date().toISOString()
//           }
//         ]
//       }))
//     }

//     // ✅ Log the first event for debugging
//     console.log('🚀 Sending first Tracked Entity:', JSON.stringify(payload.trackedEntities[0], null, 2))

//     try {
//       const res = await mutate({ payload })
//       setResponse(res)
//       return res
//     } catch (err) {
//       setError(err.message)
//       console.error('❌ Save error:', err)
//       return null
//     }
//   }

//   return { save, loading, error, response }
// }














//TRACKED ENTIRY IMPLOVED FROM THE FIRST


// import { useDataMutation } from '@dhis2/app-runtime'
// import { useState } from 'react'

// // Static mutation to create tracked entities
// const trackedEntityMutation = {
//     resource: 'tracker',
//     type: 'create',
//     data: ({ payload }) => payload,
// }

// export const useSaveResults = () => {
//     const [response, setResponse] = useState(null)
//     const [error, setError] = useState(null)

//     const [mutate, { loading }] = useDataMutation(trackedEntityMutation)

//     const save = async (results, selectedAmenity) => {
//         const payload = {
//             trackedEntities: results.map((r) => ({
//                 trackedEntityType: 'hRa4Nal90l8',
//                 orgUnit: r.rawData.orgUnit,
//                 attributes: [
//                     { attribute: 'negzyGgDJld', value: r.school },
//                     { attribute: 'GDhr0OeUT9M', value: r.place },
//                     { attribute: 'TCJeJ0eRMki', value: r.distance },
//                     { attribute: 'emlltmF9e2Y', value: r.time },
//                     { attribute: 'wm57x3rEKtY', value: selectedAmenity.label }
//                 ],
//                 enrollments: [
//                     {
//                         program: 'JcnASDsV0ed',
//                         programStage: 'pRS3b1be636',
//                         orgUnit: r.rawData.orgUnit,
//                         enrollmentDate: new Date().toISOString(),
//                         incidentDate: new Date().toISOString()
//                     }
//                 ]
//             }))
//         }

//         console.log('🚀 Sending first Tracked Entity:', JSON.stringify(payload.trackedEntities[0], null, 2))

//         try {
//             const res = await mutate({ payload })
//             setResponse(res)

//             // Analyze response for success/failure feedback
//             const imported = res?.response?.importSummaries?.filter(i => i.status === 'SUCCESS')?.length || 0
//             const ignored = res?.response?.importSummaries?.filter(i => i.status !== 'SUCCESS')?.length || 0

//             return {
//                 success: imported > 0,
//                 message: `✅ ${imported} records saved, ⚠️ ${ignored} skipped due to duplication.`,
//                 details: res
//             }
//         } catch (err) {
//             console.error('❌ Save error:', err)
//             setError(err.message)
//             return {
//                 success: false,
//                 message: '❌ Failed to save results: ' + err.message
//             }
//         }
//     }

//     return { save, loading, error, response }
// }
