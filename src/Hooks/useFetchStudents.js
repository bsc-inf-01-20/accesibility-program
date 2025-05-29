import { useState, useEffect } from "react";
import { useDataQuery } from "@dhis2/app-runtime";

const STUDENTS_QUERY = {
  students: {
    resource: "trackedEntityInstances",
    params: ({ orgUnitIds, program }) => ({
      fields: "trackedEntityInstance,attributes[attribute,value],enrollments[orgUnit],geometry",
      ou: orgUnitIds.join(";"),
      program,
      pageSize: 10000,
      paging: false
    })
  }
};

export const useFetchStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [programId, setProgramId] = useState(null);

  const { 
    refetch: fetchStudentsQuery,
    loading: queryLoading,
    error: queryError
  } = useDataQuery(STUDENTS_QUERY, {
    lazy: true,
    onComplete: (data) => {
      const teis = data?.students?.trackedEntityInstances || [];
      const formattedStudents = teis.map(student => {
        const attributes = student.attributes.reduce((acc, attr) => {
          acc[attr.attribute] = attr.value;
          return acc;
        }, {});

        return {
          id: student.trackedEntityInstance,
          displayName: attributes['name'] || 'Unknown Student',
          geometry: student.geometry,
          orgUnit: student.enrollments?.[0]?.orgUnit,
          attributes
        };
      });
      setStudents(formattedStudents);
    },
    onError: (error) => {
      setError(error.message || "Failed to load students");
    }
  });

  const fetchStudents = async (selectedSchools, program = programId) => {
    if (!selectedSchools || selectedSchools.length === 0) {
      setStudents([]);
      return;
    }

    if (!program) {
      setError("Program ID is required to fetch students");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const orgUnitIds = selectedSchools.map(school => school.id);
      await fetchStudentsQuery({ orgUnitIds, program });
    } catch (err) {
      console.error("Error loading students:", err);
      setError(err.message || "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  return {
    students,
    loading: loading || queryLoading,
    error: error || queryError,
    fetchStudents,
    setProgramId,
    programId
  };
};