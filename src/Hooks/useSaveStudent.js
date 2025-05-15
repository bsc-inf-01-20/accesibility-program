import { useDataMutation, useDataQuery } from "@dhis2/app-runtime";
import { useState } from "react";

// Metadata IDs (replace with yours)
const TRACKED_ENTITY_TYPE = "Qw2D5mSAvZ7";
const PROGRAM_ID = "rNqCDmQ05XZ";
const PROGRAM_STAGE_ID = "xEVaRv9iknw";

const ATTRIBUTES = {
  FIRST_NAME: "gz8w04YBSS0",
  SURNAME: "ZIDlK6BaAU2",
  BIRTH_DATE: "EPYqXuM0M2u",
  GENDER: "X0vzx18XWqu",
  RESIDENCE: "nSwZkncLE3V",
  COORDINATES: "dSbsnHRkmOI",
};

// Query to check for existing students (prevents duplicates)
const EXISTING_STUDENT_QUERY = {
  existingStudent: {
    resource: "trackedEntityInstances",
    params: ({ firstName, lastName, birthDate, orgUnit }) => ({
      program: PROGRAM_ID,
      ou: orgUnit,
      filter: [
        `${ATTRIBUTES.FIRST_NAME}:eq:${firstName}`,
        `${ATTRIBUTES.SURNAME}:eq:${lastName}`,
        `${ATTRIBUTES.BIRTH_DATE}:eq:${birthDate}`,
      ],
      fields: "trackedEntityInstance",
      paging: false,
    }),
  },
};

export const useSaveStudent = () => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const { refetch: fetchExistingStudent } = useDataQuery(EXISTING_STUDENT_QUERY, {
    lazy: true,
  });

  const [mutate] = useDataMutation(
    {
      resource: "tracker",
      type: "create",
      data: ({ student }) => ({
        trackedEntityInstances: [
          {
            trackedEntityType: TRACKED_ENTITY_TYPE,
            orgUnit: student.schoolId,
            attributes: [
              { attribute: ATTRIBUTES.FIRST_NAME, value: student.firstName },
              { attribute: ATTRIBUTES.SURNAME, value: student.lastName },
              { attribute: ATTRIBUTES.BIRTH_DATE, value: student.birthDate },
              { attribute: ATTRIBUTES.GENDER, value: student.gender },
              { attribute: ATTRIBUTES.RESIDENCE, value: student.residence },
              { 
                attribute: ATTRIBUTES.COORDINATES, 
                value: student.coordinates?.join(",") || "" 
              },
            ],
            enrollments: [
              {
                program: PROGRAM_ID,
                orgUnit: student.schoolId,
                programStage: PROGRAM_STAGE_ID,
                enrollmentDate: new Date().toISOString().split("T")[0],
              },
            ],
          },
        ],
      }),
      params: {
        skipNotifications: true,
        importStrategy: "CREATE_AND_UPDATE", // Updates if student exists
      },
    },
    {
      onComplete: () => setSuccess(true),
      onError: (error) => setError(error.message),
    }
  );

  const saveStudent = async (studentData) => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // 1. Check for existing student
      const { existingStudent } = await fetchExistingStudent({
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        birthDate: studentData.birthDate,
        orgUnit: studentData.schoolId,
      });

      const isDuplicate = existingStudent?.trackedEntityInstances?.length > 0;

      if (isDuplicate) {
        console.warn("Student already exists:", existingStudent);
        // Option 1: Skip saving
        // return { success: false, message: "Student already registered" };

        // Option 2: Proceed to update (handled by importStrategy: "CREATE_AND_UPDATE")
      }

      // 2. Save student
      await mutate({ student: studentData });
      return { success: true };
    } catch (error) {
      console.error("Save failed:", error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setSaving(false);
    }
  };

  return { saveStudent, saving, error, success, reset: () => setSuccess(false) };
};