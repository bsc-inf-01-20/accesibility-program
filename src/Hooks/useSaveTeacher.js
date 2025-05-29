import { useDataMutation } from '@dhis2/app-runtime';

const TEACHER_METADATA_IDS = {
  trackedEntityType: 'nEenWmSyUEp', // Example TEI type for teachers
  program: 'ur1Edk5Oe2n',           // Teacher-specific program
  programStage: 'A03MvHH8gjD',      // Teacher enrollment stage
  attributes: {
    firstName: 'sB1IHYu2xQT',
    lastName: 'ENRjVGxVL6l',
    teacherId: 'WZbXY0S00ll',
    specialization: 'lZGmxYbs97q',
    birthDate: 'qZP31qpCYVn',
    gender: 'FZzQbW8AWVd',
    residence: 'Xhdn49gUd52',
    coordinates: 'rSP9C21u4y1'
  }
};

const createTeacherMutation = {
  resource: 'trackedEntityInstances',
  type: 'create',
  data: (teacherData) => {
    const enrollmentDate = new Date().toISOString().split('T')[0];
    
    const coordinatesValue = Array.isArray(teacherData.coordinates)
      ? teacherData.coordinates.join(',')
      : teacherData.coordinatesText || '';

    return {
      trackedEntityType: TEACHER_METADATA_IDS.trackedEntityType,
      orgUnit: teacherData.schoolId,
      attributes: [
        teacherData.firstName?.trim() && {
          attribute: TEACHER_METADATA_IDS.attributes.firstName,
          value: teacherData.firstName.trim()
        },
        teacherData.lastName?.trim() && {
          attribute: TEACHER_METADATA_IDS.attributes.lastName,
          value: teacherData.lastName.trim()
        },
        teacherData.teacherId?.trim() && {
          attribute: TEACHER_METADATA_IDS.attributes.teacherId,
          value: teacherData.teacherId.trim()
        },
        teacherData.specialization?.trim() && {
          attribute: TEACHER_METADATA_IDS.attributes.specialization,
          value: teacherData.specialization.trim()
        },
        teacherData.gender && {
          attribute: TEACHER_METADATA_IDS.attributes.gender,
          value: teacherData.gender
        },
        teacherData.birthDate && {
          attribute: TEACHER_METADATA_IDS.attributes.birthDate,
          value: teacherData.birthDate
        },
        teacherData.residence?.trim() && {
          attribute: TEACHER_METADATA_IDS.attributes.residence,
          value: teacherData.residence.trim()
        },
        coordinatesValue && {
          attribute: TEACHER_METADATA_IDS.attributes.coordinates,
          value: coordinatesValue
        }
      ].filter(Boolean),
      enrollments: [{
        program: TEACHER_METADATA_IDS.program,
        enrollmentDate,
        orgUnit: teacherData.schoolId,
        events: [{
          program: TEACHER_METADATA_IDS.program,
          programStage: TEACHER_METADATA_IDS.programStage,
          eventDate: enrollmentDate,
          orgUnit: teacherData.schoolId,
          status: 'COMPLETED',
          dataValues: []
        }]
      }]
    };
  }
};

export const useSaveTeacher = () => {
  const [mutate, { loading, error, data, reset }] = useDataMutation(createTeacherMutation);

  const saveTeacher = async (teacherData) => {
    try {
      const response = await mutate(teacherData);
      const importSummary = response?.response?.importSummaries?.[0] || 
                          response?.importSummaries?.[0];

      if (importSummary?.status === 'ERROR') {
        const errorDetails = importSummary.conflicts?.map(c => 
          `${c.object}: ${c.value}`
        ).join('\n');
        throw new Error(`Teacher registration failed:\n${errorDetails}`);
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
        error: error.message || 'Teacher registration failed'
      };
    }
  };

  return {
    saveTeacher,
    saving: loading,
    error,
    success: !!data,
    reset,
    createdTeacherId: data?.response?.importSummaries?.[0]?.reference || 
                    data?.importSummaries?.[0]?.reference || 
                    null
  };
};