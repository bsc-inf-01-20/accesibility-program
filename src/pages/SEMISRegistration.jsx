import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, NoticeBox, Card } from '@dhis2/ui';
import { SchoolSelector } from '../components/SEMIS/SchoolSelector';
import { SchoolBanner } from '../components/SEMIS/SchoolBanner';
import { StudentForm } from '../components/SEMIS/StudentForm';
import { LocationMapModal } from '../components/SEMIS/LocationMapModal';
import { useFetchSchools } from '../Hooks/useFetchSchools/useFetchSchools';
import { useSaveStudent } from '../Hooks/useSaveStudent/useSaveStudent';
import { useSaveTeacher } from '../Hooks/useSaveTeacher/useSaveTeacher';
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
/**
 * overview
 *
 * This page is part of the School Accessibility project. It allows users to register either
 * a student or a teacher under a selected school. It supports dynamic form rendering based on role selection,
 * input validation (including date-based logic), and saving the data to both MongoDB and the DHIS2 instance.
 *
 * Key features:
 * - Fetches schools from DHIS2 and allows selection.
 * - Renders dynamic registration form based on selected role (student or teacher).
 * - Validates inputs, including date of birth checks for students.
 * - Automatically captures location coordinates from selected school or defaults.
 * - Persists selected school in local storage.
 * - Saves form data via custom hooks to MongoDB and DHIS2.
 * - Displays success and error feedback via DHIS2 UI components.
 * - Includes a map modal to show the location of the selected school.
 *
 * Custom hooks used:
 * - `usePersistedSchool` – Manages selected school with localStorage support.
 * - `useSaveStudent` – Handles student data submission to backend.
 * - `useSaveTeacher` – Handles teacher data submission to backend.
 * - `useFetchSchools` – Fetches school data from DHIS2 API.
 *
 * Technologies:
 * - React (JSX)
 * - DHIS2 UI Library
 * - MongoDB (via backend API)
 * - DHIS2 instance (for data integration)
 *
 * @component
 */

const SEMISRegistration = () => {
  const { selectedSchools = [], loading, error: fetchError } = useFetchSchools();
  const [selectedSchool, setSelectedSchool] = usePersistedSchool();
  const [selectedRole, setSelectedRole] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: '',
    residence: '',
    coordinates: null,
    coordinatesText: '',
    specialization: ''
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
  const [createdEntityId, setCreatedEntityId] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const { saveStudent, saving: savingStudent, error: studentError, success: studentSuccess, reset: resetStudent } = useSaveStudent();
  const { saveTeacher, saving: savingTeacher, error: teacherError, success: teacherSuccess, reset: resetTeacher } = useSaveTeacher();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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
    const roleValid = !!selectedRole;
    const specializationValid = selectedRole !== 'teacher' || formData.specialization?.trim()?.length >= 3;

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
      isValid: roleValid &&
              firstNameValid &&
              lastNameValid &&
              genderValid &&
              dateValidation.isValid &&
              residenceValid &&
              coordinatesValid &&
              schoolValid &&
              specializationValid,
      dateError: dateValidation.error
    };
  }, [formData, selectedSchool, selectedRole]);

  useEffect(() => {
    const validation = validateForm();
    setIsFormValid(validation.isValid);
    setDateError(validation.dateError);
  }, [validateForm]);

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      gender: '',
      birthDate: '',
      residence: '',
      coordinates: null,
      coordinatesText: '',
      specialization: ''
    });
    setSubmitError(null);
    setDateError(null);
    setIsFormValid(false);
  };

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
    setShowSuccess(false);
    resetForm();
    if (selectedRole === 'student') {
      resetStudent();
    } else {
      resetTeacher();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    
    if (!isFormValid) {
      setSubmitError('Please fill all required fields correctly');
      return;
    }

    const payload = { 
      ...formData,
      schoolId: selectedSchool.id,
      coordinatesText: formData.coordinates?.join(',')
    };

    let result;
    if (selectedRole === 'student') {
      result = await saveStudent(payload);
    } else {
      result = await saveTeacher(payload);
    }

    if (result?.success) {
      setCreatedEntityId(result.teiId);
      setShowSuccess(true);
    } else {
      setSubmitError(result?.error || 'Registration failed');
    }
  };

  const success = studentSuccess || teacherSuccess;
  const saving = savingStudent || savingTeacher;
  const error = studentError || teacherError || submitError;

  return (
    <div className="semis-container">
      <h1>School Registration System</h1>

      {error && (
        <NoticeBox error title="Registration Error">
          {error}
        </NoticeBox>
      )}

      {showSuccess && (
        <NoticeBox 
          success 
          title="Registration Successful" 
          onHidden={handleDismissSuccess}
        >
          <div className="success-message">
            <p>{selectedRole === 'student' ? 'Student' : 'Teacher'} registered successfully!</p>
            {createdEntityId && (
              <div className="student-id">
                <strong>{selectedRole === 'student' ? 'Student' : 'Teacher'} ID:</strong> {createdEntityId}
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
      ) : !selectedRole ? (
        <div className="role-selection-container">
          <h2 className="role-selection-title">Register New</h2>
          <div className="role-options">
            <div 
              className={`role-card ${selectedRole === 'student' ? 'selected' : ''}`}
              onClick={() => setSelectedRole('student')}
            >
              <div className="role-icon">👨‍🎓</div>
              <h3 className="role-name">Student</h3>
              <p className="role-description">
                Register a new student with personal details, contact information and enrollment data
              </p>
            </div>
            <div 
              className={`role-card ${selectedRole === 'teacher' ? 'selected' : ''}`}
              onClick={() => setSelectedRole('teacher')}
            >
              <div className="role-icon">👩‍🏫</div>
              <h3 className="role-name">Teacher</h3>
              <p className="role-description">
                Register a new teacher with professional details, qualifications and assignment information
              </p>
            </div>
          </div>
          <div className="back-to-school">
            <Button onClick={() => setSelectedSchool(null)}>
              Back to School Selection
            </Button>
          </div>
        </div>
      ) : (
        <>
          <SchoolBanner 
            school={selectedSchool}
            onResetSchool={() => {
              setSelectedSchool(null);
              setSelectedRole(null);
              setSearchTerm('');
              resetForm();
            }}
          />
          
          <div className="role-indicator">
            Registering: <strong>{selectedRole === 'student' ? 'Student' : 'Teacher'}</strong>
            <Button small onClick={() => {
              setSelectedRole(null);
              resetForm();
            }}>
              Change
            </Button>
          </div>

          <StudentForm
            formData={formData}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            saving={saving}
            onMapButtonClick={handleMapButtonClick}
            isValid={isFormValid}
            dateError={dateError}
            isTeacher={selectedRole === 'teacher'}
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