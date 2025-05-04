import React, { useState, useMemo } from 'react';
import { 
  Button,
  InputField,
  SingleSelectField,
  SingleSelectOption,
  NoticeBox,
  CircularLoader
} from '@dhis2/ui';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup,
  useMapEvents 
} from 'react-leaflet';
import { useFetchSchools } from '../Hooks/useFetchSchools';
import { useStudentData } from '../Hooks/useStudentData';
import { useSaveStudent } from '../Hooks/useSaveStudent';
import HeatmapLayer from '../components/Maps/HeatmapLayer';
import './SEMISRegistration.css';

export const SEMISRegistration = () => {
  const {
    selectedSchools,
    loading: schoolsLoading,
    error: schoolsError,
    setSelectedSchools
  } = useFetchSchools();

  const [activeSchool, setActiveSchool] = useState(null);
  const [schoolSearchTerm, setSchoolSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: '',
    residence: '',
    coordinates: null
  });
  const [locationSearch, setLocationSearch] = useState('');
  const [map, setMap] = useState(null);

  const { students, loading: studentsLoading, error: studentsError, refreshStudents } = useStudentData(activeSchool?.id);
  const { saveStudent, saving, error: saveError } = useSaveStudent();

  const filteredSchools = useMemo(() => {
    if (!schoolSearchTerm) return selectedSchools;
    return selectedSchools.filter(school => 
      school.name.toLowerCase().includes(schoolSearchTerm.toLowerCase())
    );
  }, [selectedSchools, schoolSearchTerm]);

  const handleLocationSearch = async () => {
    if (!locationSearch || !map) return;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch)}`
      );
      const data = await response.json();
      
      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        map.flyTo([lat, lon], 15);
        
        setFormData(prev => ({
          ...prev,
          residence: display_name,
          coordinates: [parseFloat(lat), parseFloat(lon)]
        }));
      }
    } catch (err) {
      console.error('Location search failed:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeSchool) return;
    
    try {
      await saveStudent({ 
        ...formData,
        schoolId: activeSchool.id 
      });
      
      setFormData({
        firstName: '',
        lastName: '',
        gender: '',
        birthDate: '',
        residence: '',
        coordinates: null
      });
      setLocationSearch('');
      refreshStudents();
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  const LocationPicker = ({ onSelect }) => {
    const map = useMapEvents({
      async click(e) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lon}`
          );
          const data = await response.json();
          onSelect([e.latlng.lat, e.latlng.lng], data.display_name);
        } catch (err) {
          onSelect([e.latlng.lat, e.latlng.lng]);
        }
      }
    });
    return null;
  };

  return (
    <div className="semis-container">
      <h1 className="semis-header">Student Registration System</h1>
      
      <div className="school-selection-section">
        <h3 className="section-title">Select School</h3>
        {schoolsLoading ? (
          <CircularLoader small />
        ) : (
          <div className="school-selection-container">
            <div className="school-search-box">
              <InputField
                label="Search schools"
                placeholder="Type school name..."
                value={schoolSearchTerm}
                onChange={({ value }) => setSchoolSearchTerm(value)}
                className="search-input"
              />
            </div>
            <div className="school-dropdown-wrapper">
              <SingleSelectField
                selected={activeSchool?.id}
                onChange={({ selected }) => {
                  const school = selectedSchools.find(s => s.id === selected);
                  setActiveSchool(school);
                  if (map && school?.geometry?.coordinates) {
                    map.flyTo([
                      school.geometry.coordinates[1],
                      school.geometry.coordinates[0]
                    ], 13);
                  }
                }}
                loading={schoolsLoading}
                className="school-dropdown"
              >
                {filteredSchools.length > 0 ? (
                  filteredSchools.map(school => (
                    <SingleSelectOption 
                      key={school.id} 
                      value={school.id} 
                      label={school.name} 
                    />
                  ))
                ) : (
                  <SingleSelectOption 
                    value={null} 
                    label="No matching schools found" 
                    disabled
                  />
                )}
              </SingleSelectField>
            </div>
          </div>
        )}
        {schoolsError && <NoticeBox error className="error-notice">{schoolsError}</NoticeBox>}
      </div>
      
      {activeSchool ? (
        <div className="registration-content">
          <div className="registration-form-section">
            <form onSubmit={handleSubmit} className="registration-form">
              <div className="form-row">
                <InputField
                  label="First Name"
                  value={formData.firstName}
                  onChange={({ value }) => setFormData({ ...formData, firstName: value })}
                  required
                  className="form-input"
                />
              </div>
              
              <div className="form-row">
                <InputField
                  label="Last Name"
                  value={formData.lastName}
                  onChange={({ value }) => setFormData({ ...formData, lastName: value })}
                  required
                  className="form-input"
                />
              </div>
              
              <div className="form-row">
                <SingleSelectField
                  label="Gender"
                  selected={formData.gender}
                  onChange={({ selected }) => setFormData({ ...formData, gender: selected })}
                  className="form-input"
                >
                  <SingleSelectOption value="male" label="Male"/>
                  <SingleSelectOption value="female" label="Female"/>
                  <SingleSelectOption value="other" label="Other"/>
                </SingleSelectField>
              </div>
              
              <div className="form-row">
                <InputField
                  label="Date of Birth"
                  type="date"
                  value={formData.birthDate}
                  onChange={({ value }) => setFormData({ ...formData, birthDate: value })}
                  required
                  className="form-input"
                />
              </div>
              
              <div className="form-row location-search-row">
                <div className="location-search-input">
                  <InputField
                    label="Place of Residence"
                    value={locationSearch}
                    onChange={({ value }) => setLocationSearch(value)}
                    placeholder="Enter location to search on map"
                    required
                    className="form-input"
                  />
                </div>
                <Button 
                  onClick={handleLocationSearch}
                  disabled={!locationSearch}
                  className="location-search-button"
                >
                  Search & Set Location
                </Button>
              </div>
              
              <div className="form-actions">
                <Button 
                  type="submit" 
                  primary 
                  icon={saving ? <CircularLoader small /> : null}
                  disabled={!formData.coordinates || saving}
                  className="submit-button"
                >
                  {saving ? 'Registering...' : 'Register Student'}
                </Button>
              </div>
            </form>
          </div>
          
          <div className="map-visualization">
            <MapContainer 
              center={activeSchool.geometry?.coordinates 
                ? [
                    activeSchool.geometry.coordinates[1],
                    activeSchool.geometry.coordinates[0]
                  ]
                : [0, 0]} 
              zoom={13}
              className="map-container"
              whenCreated={setMap}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {activeSchool.geometry?.coordinates && (
                <Marker position={[
                  activeSchool.geometry.coordinates[1],
                  activeSchool.geometry.coordinates[0]
                ]}>
                  <Popup>{activeSchool.name}</Popup>
                </Marker>
              )}
              
              <LocationPicker 
                onSelect={(coords, name) => {
                  setFormData(prev => ({
                    ...prev,
                    residence: name || `Location at ${coords.join(', ')}`,
                    coordinates: coords
                  }));
                }}
              />
              
              <HeatmapLayer students={students} />
            </MapContainer>
          </div>
        </div>
      ) : (
        <NoticeBox title="No school selected" className="notice-box">
          Please select a school to begin registration
        </NoticeBox>
      )}
      
      {saveError && <NoticeBox error className="error-notice">{saveError}</NoticeBox>}
      {studentsError && <NoticeBox error className="error-notice">{studentsError}</NoticeBox>}
    </div>
  );
};

export default SEMISRegistration;