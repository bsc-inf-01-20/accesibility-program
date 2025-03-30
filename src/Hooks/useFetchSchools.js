import { useState, useCallback, useEffect } from "react";
import { useDataQuery } from "@dhis2/app-runtime";

// Defined outside the hook
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

const ALL_SCHOOLS_QUERY = {
  schools: {
    resource: "organisationUnits",
    params: {
      fields: "id,displayName,level,geometry,parent[id,displayName]",
      filter: "level:eq:5",
      pageSize: 10000
    }
  }
};

export const useFetchSchools = () => {
  const [allUnits, setAllUnits] = useState([]);
  const [allSchools, setAllSchools] = useState([]);
  const [selectedLevels, setSelectedLevels] = useState({});
  const [filteredSchools, setFilteredSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const MINISTRY_ID = "U7ahfMlCl7k";

  const { refetch: refetchOrgUnits } = useDataQuery(ORG_UNITS_QUERY, {
    lazy: true,
    onComplete: (data) => {
      if (data?.orgUnits?.organisationUnits) {
        setAllUnits(prev => [
          ...prev.filter(u => !data.orgUnits.organisationUnits.some(newU => newU.id === u.id)),
          ...data.orgUnits.organisationUnits
        ]);
      }
    },
    onError: (error) => {
      setError(error.message || "Failed to load org units");
    }
  });

  const { refetch: refetchAllSchools } = useDataQuery(ALL_SCHOOLS_QUERY, {
    lazy: true,
    onComplete: (data) => {
      const schools = data?.schools?.organisationUnits || [];
      setAllSchools(schools);
      setAllUnits(prev => [...prev, ...schools]);
    },
    onError: (error) => {
      setError(error.message || "Failed to load schools");
    }
  });

  useEffect(() => {
    if (!selectedLevels[1]) {
      setSelectedLevels({ 1: MINISTRY_ID });
      fetchOrgUnits(2, MINISTRY_ID);
    }
    refetchAllSchools();
  }, []);

  useEffect(() => {
    if (allSchools.length > 0 && Object.keys(selectedLevels).length > 0) {
      const deepestLevel = Math.max(...Object.keys(selectedLevels).map(Number));
      const rootId = selectedLevels[deepestLevel];
      
      const filtered = allSchools.filter(school => {
        if (deepestLevel === 5) return school.id === rootId;
        
        let current = allUnits.find(u => u.id === school.id);
        while (current?.parent?.id) {
          if (current.parent.id === rootId) return true;
          current = allUnits.find(u => u.id === current.parent.id);
        }
        return false;
      });
      
      setFilteredSchools(filtered);
    }
  }, [selectedLevels, allSchools, allUnits]);

  const fetchOrgUnits = useCallback(async (level, parentId = null) => {
    setLoading(true);
    setError(null);
    try {
      await refetchOrgUnits({ level, parentId });
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [refetchOrgUnits]);

  const handleSelectLevel = useCallback(async (level, orgUnitId) => {
    const newLevels = { ...selectedLevels, [level]: orgUnitId };
    
    for (let l = level + 1; l <= 5; l++) delete newLevels[l];
    
    setSelectedLevels(newLevels);
    
    if (level < 5) await fetchOrgUnits(level + 1, orgUnitId);
  }, [selectedLevels, fetchOrgUnits]);

  return {
    selectedLevels,
    allUnits,
    selectedSchools: filteredSchools,
    loading,
    error,
    handleSelectLevel,
    fetchOrgUnits
  };
};