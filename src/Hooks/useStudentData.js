import { useState, useEffect } from 'react';
import { useDataQuery } from '@dhis2/app-runtime';

export const useStudentData = (orgUnitId) => {
  const [refreshCount, setRefreshCount] = useState(0);
  const { loading, error, data, refetch } = useDataQuery({
    students: {
      resource: 'tracker/events',
      params: {
        program: 'fQ1OejfABCD',
        orgUnit: orgUnitId,
        fields: 'event,dataValues[dataElement,value]',
        skipPaging: true
      }
    }
  }, {
    lazy: true,
    onComplete: () => setRefreshCount(prev => prev + 1)
  });

  useEffect(() => {
    if (orgUnitId) {
      refetch();
    }
  }, [orgUnitId, refetch]);

  const refreshStudents = () => {
    refetch();
  };

  return {
    students: data?.students?.events || [],
    loading,
    error: error?.message,
    refreshStudents,
    refreshCount
  };
};