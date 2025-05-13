import { useState } from 'react';
import { useDataMutation } from '@dhis2/app-runtime';

const mutation = {
  resource: 'tracker',
  type: 'create',
  data: ({ student }) => ({
    events: [{
      program: 'fQ1OejfABCD',
      programStage: 'pS1aBCdEFG',
      orgUnit: student.schoolId,
      occurredAt: new Date().toISOString(),
      status: 'COMPLETED',
      dataValues: [
        { dataElement: 'aBcD1234', value: student.firstName },
        { dataElement: 'eFgH5678', value: student.lastName },
        { dataElement: 'iJkL9012', value: student.gender },
        { dataElement: 'mNoP3456', value: student.birthDate },
        { dataElement: 'qRsT7890', value: student.residence },
        { dataElement: 'uVwX1234', value: JSON.stringify(student.coordinates) }
      ]
    }]
  })
};

export const useSaveStudent = () => {
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mutate] = useDataMutation(mutation);

  const saveStudent = async (studentData) => {
    setSaving(true);
    setError(null);
    
    try {
      await mutate({ student: studentData });
    } catch (err) {
      setError(err.message || 'Failed to save student');
      throw err;
    } finally {
      setSaving(false);
    }
    
  };

  return { saveStudent, saving, error };
};