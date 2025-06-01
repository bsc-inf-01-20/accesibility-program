import { useState, useEffect } from "react";
import { useDataQuery } from "@dhis2/app-runtime";

const STUDENTS_QUERY = {
  students: {
    resource: "trackedEntityInstances",
    params: ({ orgUnitIds, program }) => ({
      fields: [
        "trackedEntityInstance",
        "attributes[attribute,value]",
        "enrollments[orgUnit]",
        "geometry",
        "created",
        "lastUpdated"
      ].join(","),
      ou: orgUnitIds.join(";"),
      program,
      pageSize: 10000,
      paging: false,
      totalPages: true
    })
  }
};

export const useFetchStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [programId, setProgramId] = useState("HN5Uxu8Tqtp"); // Default to your program ID

  const { 
    refetch: fetchStudentsQuery,
    loading: queryLoading,
    error: queryError,
    data: queryData
  } = useDataQuery(STUDENTS_QUERY, {
    lazy: true,
    onComplete: (data) => {
      const teis = data?.students?.trackedEntityInstances || [];
      const formattedStudents = teis.map(student => {
        // Extract attributes into key-value pairs
        const attributes = student.attributes.reduce((acc, attr) => {
          acc[attr.attribute] = attr.value;
          return acc;
        }, {});

        // Get coordinates from either geometry or coordinates attribute
        let coordinates = null;
        if (student.geometry) {
          coordinates = student.geometry.coordinates || 
                       (student.geometry.split(';').map(Number));
        } else if (attributes['ovh2M3P8yWB']) { // coordinates attribute
          coordinates = attributes['ovh2M3P8yWB'].split(',').map(Number);
        }

        return {
          id: student.trackedEntityInstance,
          firstName: attributes['gz8w04YBSS0'] || '', // firstName attribute
          lastName: attributes['ZIDlK6BaAU2'] || '', // lastName attribute
          displayName: `${attributes['gz8w04YBSS0'] || ''} ${attributes['ZIDlK6BaAU2'] || ''}`.trim() || 'Unknown Student',
          gender: attributes['X0vzx18XWqu'], // gender attribute
          birthDate: attributes['EPYqXuM0M2u'], // birthDate attribute
          residence: attributes['yDIz9hHTfhj'], // residence attribute
          coordinates: coordinates,
          geometry: student.geometry,
          orgUnit: student.enrollments?.[0]?.orgUnit,
          schoolId: student.enrollments?.[0]?.orgUnit, // Alias for orgUnit
          attributes,
          createdAt: student.created,
          updatedAt: student.lastUpdated
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

  // Function to refresh a single student after update
  const refreshStudent = (updatedStudent) => {
    setStudents(prev => prev.map(student => 
      student.id === updatedStudent.id ? updatedStudent : student
    ));
  };

  // Function to add a newly created student
  const addNewStudent = (newStudent) => {
    setStudents(prev => [newStudent, ...prev]);
  };

  return {
    students,
    loading: loading || queryLoading,
    error: error || queryError,
    fetchStudents,
    setProgramId,
    programId,
    refreshStudent,
    addNewStudent,
    queryData // Raw query data for debugging
  };
};