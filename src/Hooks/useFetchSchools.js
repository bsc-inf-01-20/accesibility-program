import { useState, useCallback, useEffect } from "react";
import { useDataQuery } from "@dhis2/app-runtime";

const ORG_UNITS_QUERY = {
  orgUnits: {
    resource: "organisationUnits",
    params: ({ level, parentId }) => ({
      fields: "id,displayName,level,parent[id,displayName]",
      filter: [
        `level:eq:${level}`,
        parentId ? `parent.id:eq:${parentId}` : undefined
      ].filter(Boolean),
      pageSize: 1000,
      totalPages: true
    }),
  },
};

export const useFetchSchools = () => {
  const [allUnits, setAllUnits] = useState([]);
  const [selectedLevels, setSelectedLevels] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const MINISTRY_ID = "U7ahfMlCl7k";

  const { refetch } = useDataQuery(ORG_UNITS_QUERY, {
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
      setError(error.message || "Failed to load data");
    }
  });

  useEffect(() => {
    if (!selectedLevels[1]) {
      setSelectedLevels({ 1: MINISTRY_ID });
      fetchOrgUnits(2, MINISTRY_ID);
    }
  }, []);

  const fetchOrgUnits = useCallback(async (level, parentId = null) => {
    setLoading(true);
    setError(null);
    try {
      await refetch({ level, parentId });
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [refetch]);

  const handleSelectLevel = useCallback(async (level, orgUnitId) => {
    const newLevels = { ...selectedLevels, [level]: orgUnitId };
    
    // Clear lower levels
    for (let l = level + 1; l <= 5; l++) delete newLevels[l];
    
    setSelectedLevels(newLevels);
    
    // Fetch next level
    if (level < 5) await fetchOrgUnits(level + 1, orgUnitId);
  }, [selectedLevels, fetchOrgUnits]);

  return {
    selectedLevels,
    allUnits: allUnits || [], // Ensure array output
    loading,
    error,
    handleSelectLevel,
    fetchOrgUnits
  };
};