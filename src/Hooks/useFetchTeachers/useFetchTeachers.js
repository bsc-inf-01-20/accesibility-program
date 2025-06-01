import { useState } from "react";
import { useDataQuery } from "@dhis2/app-runtime";

const TEACHERS_QUERY = {
  teachers: {
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

export const useFetchTeachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [programId, setProgramId] = useState("pF9sY7Yo8SE"); // Default to your teacher program ID

  const { 
    refetch: fetchTeachersQuery,
    loading: queryLoading,
    error: queryError,
    data: queryData
  } = useDataQuery(TEACHERS_QUERY, {
    lazy: true,
    onComplete: (data) => {
      const teis = data?.teachers?.trackedEntityInstances || [];
      const formattedTeachers = teis.map(teacher => {
        // Extract attributes into key-value pairs
        const attributes = teacher.attributes.reduce((acc, attr) => {
          acc[attr.attribute] = attr.value;
          return acc;
        }, {});

        // Get coordinates from either geometry or coordinates attribute
        let coordinates = null;
        if (teacher.geometry) {
          coordinates = teacher.geometry.coordinates || 
                       (teacher.geometry.split(';').map(Number));
        } else if (attributes['ovh2M3P8yWB']) { // coordinates attribute
          coordinates = attributes['ovh2M3P8yWB'].split(',').map(Number);
        }

        return {
          id: teacher.trackedEntityInstance,
          firstName: attributes['gz8w04YBSS0'] || '', // firstName attribute
          lastName: attributes['ZIDlK6BaAU2'] || '', // lastName attribute
          displayName: `${attributes['gz8w04YBSS0'] || ''} ${attributes['ZIDlK6BaAU2'] || ''}`.trim() || 'Unknown Teacher',
          teacherId: attributes['PMAZ1znG6ip'] || '', // teacher ID attribute
          specialization: attributes['K0m2461IQ4U'] || '', // specialization attribute
          gender: attributes['X0vzx18XWqu'], // gender attribute
          birthDate: attributes['EPYqXuM0M2u'], // birthDate attribute
          residence: attributes['yDIz9hHTfhj'], // residence attribute
          coordinates: coordinates,
          geometry: teacher.geometry,
          orgUnit: teacher.enrollments?.[0]?.orgUnit,
          schoolId: teacher.enrollments?.[0]?.orgUnit,
          attributes,
          createdAt: teacher.created,
          updatedAt: teacher.lastUpdated
        };
      });
      setTeachers(formattedTeachers);
    },
    onError: (error) => {
      setError(error.message || "Failed to load teachers");
    }
  });

  const fetchTeachers = async (selectedSchools, program = programId) => {
    if (!selectedSchools || selectedSchools.length === 0) {
      setTeachers([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const orgUnitIds = selectedSchools.map(school => school.id);
      await fetchTeachersQuery({ orgUnitIds, program });
    } catch (err) {
      console.error("Error loading teachers:", err);
      setError(err.message || "Failed to load teachers");
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh a single teacher after update
  const refreshTeacher = (updatedTeacher) => {
    setTeachers(prev => prev.map(teacher => 
      teacher.id === updatedTeacher.id ? updatedTeacher : teacher
    ));
  };

  // Function to add a newly created teacher
  const addNewTeacher = (newTeacher) => {
    setTeachers(prev => [newTeacher, ...prev]);
  };

  return {
    teachers,
    loading: loading || queryLoading,
    error: error || queryError,
    fetchTeachers,
    setProgramId,
    programId,
    refreshTeacher,
    addNewTeacher,
    queryData
  };
};