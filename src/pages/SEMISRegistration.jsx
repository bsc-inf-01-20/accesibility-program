import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, NoticeBox, Card } from '@dhis2/ui';
import { SchoolSelector } from '../components/SEMIS/SchoolSelector';
import { SchoolBanner } from '../components/SEMIS/SchoolBanner';
import { StudentForm } from '../components/SEMIS/StudentForm';
import { LocationMapModal } from '../components/SEMIS/LocationMapModal';
import { useFetchSchools } from '../Hooks/useFetchSchools';
import { useSaveStudent } from '../Hooks/useSaveStudent';
import './SEMISRegistration.css';

const usePersistedSchool = () => {
  const [school, setSchool] = useState(null);
  
  useEffect(() => {
    const saved = localStorage.getItem('selectedSchool');
    if (saved) {
      try {
        setSchool(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved school', e);
        localStorage.removeItem('selectedSchool');
      }
    }
  }, []);
  
  const persistSchool = (newSchool) => {
    try {
      localStorage.setItem('selectedSchool', JSON.stringify(newSchool));
      setSchool(newSchool);
    } catch (e) {
      console.error('Failed to persist school', e);
    }
  };
  
  return [school, persistSchool];
};

const SEMISRegistration = () => {
  const { selectedSchools = [], loading, error: fetchError } = useFetchSchools();
  const [selectedSchool, setSelectedSchool] = usePersistedSchool();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: '',
    residence: '',
    coordinates: null,
    coordinatesText: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState([-1.2921, 36.8219]);
  const [mapZoom, setMapZoom] = useState(13);
  const [submitError, setSubmitError] = useState(null);
  const [dateError, setDateError] = useState(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const [createdStudentId, setCreatedStudentId] = useState(null);
  
  const { 
    saveStudent, 
    saving, 
    error: saveError, 
    success, 
    reset, 
    createdStudentId: serverStudentId 
  } = useSaveStudent();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (serverStudentId) {
      setCreatedStudentId(serverStudentId);
    }
  }, [serverStudentId]);

  const displaySchools = useMemo(() => (
    selectedSchools.filter(school => 
      school?.name?.toLowerCase().includes(debouncedTerm.toLowerCase())
    )
  ), [selectedSchools, debouncedTerm]);

  const validateForm = useCallback(() => {
    const firstNameValid = formData.firstName?.trim()?.length >= 2;
    const lastNameValid = formData.lastName?.trim()?.length >= 2;
    const genderValid = !!formData.gender;
    const residenceValid = formData.residence?.trim()?.length >= 5;
    const coordinatesValid = !!formData.coordinates;
    const schoolValid = !!selectedSchool?.id;

    let dateValidation = { isValid: false, error: 'Date of birth is required' };
    if (formData.birthDate) {
      const date = new Date(formData.birthDate);
      const today = new Date();
      
      if (isNaN(date.getTime())) {
        dateValidation = { isValid: false, error: 'Invalid date format' };
      } else if (date > today) {
        dateValidation = { isValid: false, error: 'Birth date cannot be in the future' };
      } else {
        const ageInYears = (today - date) / (1000 * 60 * 60 * 24 * 365);
        dateValidation = {
          isValid: ageInYears >= 4,
          error: ageInYears < 4 ? 'Student must be at least 4 years old' : null
        };
      }
    }

    return {
      isValid: firstNameValid &&
              lastNameValid &&
              genderValid &&
              dateValidation.isValid &&
              residenceValid &&
              coordinatesValid &&
              schoolValid,
      dateError: dateValidation.error
    };
  }, [formData, selectedSchool]);

  useEffect(() => {
    const validation = validateForm();
    setIsFormValid(validation.isValid);
    setDateError(validation.dateError);
  }, [validateForm]);

  const handleSchoolSelect = (school) => {
    const validatedSchool = {
      id: school.id,
      displayName: school.name || school.displayName || 'Unnamed School',
      geometry: school.geometry || {
        type: "Point",
        coordinates: [-1.2921, 36.8219]
      }
    };
    setSelectedSchool(validatedSchool);
    setIsDropdownOpen(false);
    setSearchTerm('');
  };

  const handleMapButtonClick = () => {
    if (!selectedSchool) return;
    
    const schoolCoords = selectedSchool.geometry.coordinates;
    setMapCenter([schoolCoords[1], schoolCoords[0]]);
    setMapZoom(15);
    setMapModalOpen(true);
  };

  const handleLocationSelect = (locationData) => {
    setFormData(prev => ({
      ...prev,
      residence: locationData.displayName,
      coordinates: locationData.coordinates,
      coordinatesText: `${locationData.coordinates[0].toFixed(4)}, ${locationData.coordinates[1].toFixed(4)}`
    }));
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'birthDate') {
      setDateError(null);
    }
  };

  const handleDismissSuccess = () => {
    reset?.();
    setCreatedStudentId(null);
    setSubmitError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    
    if (!isFormValid) {
      setSubmitError('Please fill all required fields correctly');
      return;
    }

    const result = await saveStudent({ 
      ...formData,
      schoolId: selectedSchool.id,
      coordinatesText: formData.coordinates?.join(',')
    });

    if (!result.success) {
      setSubmitError(result.error);
    }
  };

  return (
    <div className="semis-container">
      <h1>Student Registration System</h1>

      {(submitError || saveError) && (
        <NoticeBox error title="Registration Error">
          {submitError || saveError}
        </NoticeBox>
      )}

      {success && (
        <NoticeBox 
          success 
          title="Registration Successful" 
          onHidden={handleDismissSuccess}
        >
          <div className="success-message">
            <p>Student registered successfully!</p>
            {createdStudentId && (
              <div className="student-id">
                <strong>Student ID:</strong> {createdStudentId}
              </div>
            )}
            <Button small onClick={handleDismissSuccess}>
              Dismiss
            </Button>
          </div>
        </NoticeBox>
      )}
      
      {!selectedSchool ? (
        <SchoolSelector
          schools={displaySchools}
          loading={loading}
          error={fetchError}
          searchTerm={searchTerm}
          isDropdownOpen={isDropdownOpen}
          onSearchChange={setSearchTerm}
          onDropdownToggle={setIsDropdownOpen}
          onSelectSchool={handleSchoolSelect}
        />
      ) : (
        <>
          <SchoolBanner 
            school={selectedSchool}
            onResetSchool={() => {
              setSelectedSchool(null);
              setSearchTerm('');
            }}
          />
          
          <StudentForm
            formData={formData}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            saving={saving}
            success={success}
            onMapButtonClick={handleMapButtonClick}
            isValid={isFormValid}
            dateError={dateError}
          />
        </>
      )}

      <LocationMapModal
        isOpen={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        center={mapCenter}
        zoom={mapZoom}
        selectedSchool={selectedSchool}
        currentLocation={formData.coordinates}
        onLocationSelect={handleLocationSelect}
      />
    </div>
  );
};

export default SEMISRegistration;