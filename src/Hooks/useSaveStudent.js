import { useDataMutation } from '@dhis2/app-runtime';

const METADATA_IDS = {
  trackedEntityType: 'Qw2D5mSAvZ7',
  program: 'rNqCDmQ05XZ',
  programStage: 'xEVaRv9iknw',
  attributes: {
    firstName: 'gz8w04YBSS0',
    lastName: 'ZIDlK6BaAU2',
    birthDate: 'EPYqXuM0M2u',
    gender: 'X0vzx18XWqu',
    residence: 'nSwZkncLE3V',
    coordinates: 'dSbsnHRkmOI'
  }
};

// mutation
const createStudentMutation = {
  resource: 'trackedEntityInstances',
  type: 'create',
  data: (studentData) => {
    const enrollmentDate = new Date().toISOString().split('T')[0];
    
    const coordinatesValue = Array.isArray(studentData.coordinates)
      ? studentData.coordinates.join(',')
      : studentData.coordinatesText || '';

    return {
      trackedEntityType: METADATA_IDS.trackedEntityType,
      orgUnit: studentData.schoolId,
      attributes: [
        studentData.firstName?.trim() && {
          attribute: METADATA_IDS.attributes.firstName,
          value: studentData.firstName.trim()
        },
        studentData.lastName?.trim() && {
          attribute: METADATA_IDS.attributes.lastName,
          value: studentData.lastName.trim()
        },
        studentData.gender && {
          attribute: METADATA_IDS.attributes.gender,
          value: studentData.gender
        },
        studentData.birthDate && {
          attribute: METADATA_IDS.attributes.birthDate,
          value: studentData.birthDate
        },
        studentData.residence?.trim() && {
          attribute: METADATA_IDS.attributes.residence,
          value: studentData.residence.trim()
        },
        coordinatesValue && {
          attribute: METADATA_IDS.attributes.coordinates,
          value: coordinatesValue
        }
      ].filter(Boolean),
      enrollments: [{
        program: METADATA_IDS.program,
        enrollmentDate,
        orgUnit: studentData.schoolId,
        events: [{
          program: METADATA_IDS.program,
          programStage: METADATA_IDS.programStage,
          eventDate: enrollmentDate,
          orgUnit: studentData.schoolId,
          status: 'COMPLETED',
          dataValues: []
        }]
      }]
    };
  }
};

export const useSaveStudent = () => {
  const [mutate, { loading, error, data, reset }] = useDataMutation(createStudentMutation);

  const saveStudent = async (studentData) => {
    try {
      const response = await mutate(studentData);
      const importSummary = response?.response?.importSummaries?.[0] || 
                          response?.importSummaries?.[0];

      if (importSummary?.status === 'ERROR') {
        const errorDetails = importSummary.conflicts?.map(c => 
          `${c.object}: ${c.value}`
        ).join('\n');
        throw new Error(`Registration failed:\n${errorDetails}`);
      }

      return {
        success: !!importSummary?.reference,
        teiId: importSummary?.reference || null,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        teiId: null,
        error: error.message || 'Registration failed'
      };
    }
  };

  return {
    saveStudent,
    saving: loading,
    error,
    success: !!data,
    reset,
    createdStudentId: data?.response?.importSummaries?.[0]?.reference || 
                    data?.importSummaries?.[0]?.reference || 
                    null
  };
};