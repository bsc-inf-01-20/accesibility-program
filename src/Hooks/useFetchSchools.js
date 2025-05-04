import { useState, useEffect, useCallback } from "react";
import { useDataQuery } from "@dhis2/app-runtime";

const ORG_UNITS_QUERY = {
  orgUnits: {
    resource: "organisationUnits",
    params: ({ level, parentId }) => ({
      fields: "id,displayName,level,geometry,parent[id,displayName]",
      filter: [
        `level:eq:${level}`,
        parentId ? `parent.id:eq:${parentId}` : undefined
      ].filter(Boolean),
      pageSize: 1000
    }),
  }
};

const SCHOOLS_QUERY = {
  schools: {
    resource: "organisationUnits",
    params: ({ parentId }) => ({
      fields: "id,displayName,level,geometry,parent[id,displayName]",
      filter: [
        "level:eq:5",
        parentId ? `path:like:${parentId}` : undefined
      ].filter(Boolean),
      pageSize: 10000,
      paging: false
    })
  }
};

export const useFetchSchools = () => {
  const [allUnits, setAllUnits] = useState([]);
  const [selectedLevels, setSelectedLevels] = useState({});
  const [filteredSchools, setFilteredSchools] = useState([]);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const MINISTRY_ID = "U7ahfMlCl7k";

  const { 
    refetch: refetchOrgUnits,
    loading: orgUnitsLoading,
    error: orgUnitsError
  } = useDataQuery(ORG_UNITS_QUERY, {
    lazy: true,
    onComplete: (data) => {
      const orgUnits = data.orgUnits.organisationUnits;
      setAllUnits(prev => [
        ...prev.filter(u => !orgUnits.some(newU => newU.id === u.id)),
        ...orgUnits
      ]);
    },
    onError: (error) => {
      setError(error.message || "Failed to load org units");
    }
  });

  const { 
    refetch: fetchSchools,
    loading: schoolsLoading,
    error: schoolsError
  } = useDataQuery(SCHOOLS_QUERY, {
    lazy: true,
    onComplete: (data) => {
      const schools = data?.schools?.organisationUnits || [];
      setFilteredSchools(schools);
      // Auto-select all schools when they load
      setSelectedSchools(schools.map(school => ({
        id: school.id,
        name: school.displayName,
        geometry: school.geometry
      })));
    },
    onError: (error) => {
      setError(error.message || "Failed to load schools");
    }
  });

  useEffect(() => {
    if (!selectedLevels[1]) {
      setSelectedLevels({ 1: MINISTRY_ID });
      refetchOrgUnits({ level: 2, parentId: MINISTRY_ID });
    }
  }, []);

  useEffect(() => {
    const loadSchoolsForSelection = async () => {
      const levels = Object.keys(selectedLevels).map(Number);
      if (levels.length === 0) return;

      const deepestLevel = Math.max(...levels);
      const rootId = selectedLevels[deepestLevel];
      
      if (!rootId) return;

      setLoading(true);
      try {
        await fetchSchools({ parentId: rootId });
      } catch (err) {
        console.error("Error loading schools:", err);
        setError(err.message || "Failed to load schools");
      } finally {
        setLoading(false);
      }
    };

    loadSchoolsForSelection();
  }, [selectedLevels]);

  const fetchOrgUnits = useCallback(async (level, parentId = null) => {
    setLoading(true);
    try {
      await refetchOrgUnits({ level, parentId });
    } catch (err) {
      console.error("Error loading org units:", err);
      setError(err.message || "Failed to load org units");
    } finally {
      setLoading(false);
    }
  }, [refetchOrgUnits]);

  const handleSelectLevel = useCallback(async (level, orgUnitId) => {
    const newLevels = { ...selectedLevels };
    
    // Update selected level
    newLevels[level] = orgUnitId;
    
    // Clear higher levels
    for (let l = level + 1; l <= 5; l++) {
      delete newLevels[l];
    }
    
    setSelectedLevels(newLevels);
    
    // Fetch next level org units
    if (level < 5) {
      await fetchOrgUnits(level + 1, orgUnitId);
    }
  }, [selectedLevels, fetchOrgUnits]);

  return {
    selectedLevels,
    allUnits,
    selectedSchools,
    filteredSchools,
    loading: loading || orgUnitsLoading || schoolsLoading,
    error: error || orgUnitsError || schoolsError,
    handleSelectLevel,
    fetchOrgUnits,
    setSelectedSchools
  };
};