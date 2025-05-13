import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Button,
  InputField,
  NoticeBox,
  CircularLoader,
  Menu,
  MenuItem,
  Card,
  Modal,
  ModalTitle,
  ModalContent,
  ModalActions
} from '@dhis2/ui';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useFetchSchools } from '../Hooks/useFetchSchools';
import { useSaveStudent } from '../Hooks/useSaveStudent';
import './SEMISRegistration.css';

const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const usePersistedSchool = () => {
  const [school, setSchool] = useState(null);
  useEffect(() => {
    const saved = localStorage.getItem('selectedSchool');
    if (saved) setSchool(JSON.parse(saved));
  }, []);
  const persistSchool = (newSchool) => {
    localStorage.setItem('selectedSchool', JSON.stringify(newSchool));
    setSchool(newSchool);
  };
  return [school, persistSchool];
};

const SchoolLocation = ({ school }) => {
  const map = useMap();
  
  useEffect(() => {
    if (school?.geometry?.coordinates) {
      map.flyTo(
        [school.geometry.coordinates[1], school.geometry.coordinates[0]], 
        15
      );
    }
  }, [school, map]);

  if (!school?.geometry?.coordinates) return null;

  return (
    <Marker position={[school.geometry.coordinates[1], school.geometry.coordinates[0]]}>
      <Popup>{school.displayName}</Popup>
    </Marker>
  );
};

const StudentLocation = ({ location }) => {
  if (!location) return null;
  return (
    <Marker position={location}>
      <Popup>Student's Location</Popup>
    </Marker>
  );
};

const SEMISRegistration = () => {
  const { 
    selectedSchools = [], 
    loading, 
    error 
  } = useFetchSchools();

  const [selectedSchool, setSelectedSchool] = usePersistedSchool();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    birthDate: '',
    residence: '',
    coordinates: '',
    coordinatesDisplay: ''
  });
  const [errors, setErrors] = useState({});
  const [locationSearch, setLocationSearch] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationResults, setLocationResults] = useState([]);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const { saveStudent, saving, error: saveError } = useSaveStudent();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const displaySchools = useMemo(() => {
    return selectedSchools.filter(school => 
      school?.name?.toLowerCase()?.includes(debouncedTerm.toLowerCase())
    );
  }, [selectedSchools, debouncedTerm]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.gender.trim()) newErrors.gender = 'Gender is required';
    if (!formData.birthDate) newErrors.birthDate = 'Date of birth is required';
    if (!formData.residence) newErrors.residence = 'Please select a location';
    if (!formData.coordinates) newErrors.coordinates = 'Location coordinates are required';
    if (!selectedSchool) newErrors.school = 'Please select a school';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
    setIsOpen(false);
    setErrors(prev => ({ ...prev, school: undefined }));
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrors(prev => ({
        ...prev,
        residence: 'Geolocation is not supported by your browser'
      }));
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = [position.coords.latitude, position.coords.longitude];
        setFormData(prev => ({
          ...prev,
          residence: 'Current Location',
          coordinates: coords.join(', '),
          coordinatesDisplay: coords.map(c => c.toFixed(6)).join(', ')
        }));
        setLocationLoading(false);
        setErrors(prev => ({ ...prev, residence: undefined }));
      },
      (error) => {
        setLocationLoading(false);
        setErrors(prev => ({
          ...prev,
          residence: `Unable to get your location: ${error.message}`
        }));
      }
    );
  };

  const searchMalawiLocations = async (query) => {
    if (!query.trim()) {
      setLocationResults([]);
      return;
    }

    setLocationLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=mw&limit=5`
      );
      const data = await response.json();
      setLocationResults(data);
    } catch (err) {
      console.error('Location search failed:', err);
      setErrors(prev => ({
        ...prev,
        residence: 'Failed to search locations. Please try again.'
      }));
    } finally {
      setLocationLoading(false);
    }
  };

  const handleLocationSelect = (location) => {
    const { lat, lon, display_name } = location;
    const coords = [parseFloat(lat), parseFloat(lon)];
    setFormData(prev => ({
      ...prev,
      residence: display_name,
      coordinates: coords.join(', '),
      coordinatesDisplay: coords.map(c => c.toFixed(6)).join(', ')
    }));
    setShowLocationResults(false);
    setErrors(prev => ({ ...prev, residence: undefined }));
  };

  const handleMapClick = async (e) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`
      );
      const data = await response.json();
      const coords = [e.latlng.lat, e.latlng.lng];
      setFormData(prev => ({
        ...prev,
        residence: data.display_name || `Location at ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`,
        coordinates: coords.join(', '),
        coordinatesDisplay: coords.map(c => c.toFixed(6)).join(', ')
      }));
      setErrors(prev => ({ ...prev, residence: undefined }));
    } catch (err) {
      const coords = [e.latlng.lat, e.latlng.lng];
      setFormData(prev => ({
        ...prev,
        residence: `Location at ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`,
        coordinates: coords.join(', '),
        coordinatesDisplay: coords.map(c => c.toFixed(6)).join(', ')
      }));
      setErrors(prev => ({ ...prev, residence: undefined }));
    }
  };

  const handleManualMapSearch = () => {
    setMapModalOpen(true);
  };

  const handleMapConfirm = () => {
    setMapModalOpen(false);
  };

  const handleMapCancel = () => {
    setMapModalOpen(false);
  };

  const handleClearLocation = () => {
    setFormData(prev => ({
      ...prev,
      residence: '',
      coordinates: '',
      coordinatesDisplay: ''
    }));
    setLocationSearch('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    try {
      await saveStudent({ 
        ...formData,
        schoolId: selectedSchool.id 
      });
      
      setFormData({
        firstName: '',
        lastName: '',
        gender: '',
        birthDate: '',
        residence: '',
        coordinates: '',
        coordinatesDisplay: ''
      });
      setLocationSearch('');
      setErrors({});
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  return (
    <div className="semis-container">
      <h1>Student Registration System</h1>
      
      {saveError && (
        <NoticeBox error title="Registration Error" className="error-notice">
          {saveError.message || 'Failed to register student. Please try again.'}
        </NoticeBox>
      )}
      
      {!selectedSchool ? (
        <Card className="selection-card">
          <div className="school-selection-container" ref={containerRef}>
            <div className="search-input-container">
              <InputField
                label="Search and select your school"
                placeholder="Type school name..."
                value={searchTerm}
                onChange={({ value }) => {
                  setSearchTerm(value);
                  setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                className="uniform-input"
                error={!!errors.school}
                validationText={errors.school}
              />
              <Button 
                className="dropdown-toggle"
                onClick={() => setIsOpen(!isOpen)}
                primary
              >
                {isOpen ? '▲' : '▼'}
              </Button>
            </div>
            
            {isOpen && (
              <div className="school-dropdown">
                {loading ? (
                  <div style={{ padding: '16px', textAlign: 'center' }}>
                    <CircularLoader small />
                    <p>Loading schools...</p>
                  </div>
                ) : error ? (
                  <NoticeBox error title="Loading Error">
                    {error.message || 'Failed to load schools'}
                  </NoticeBox>
                ) : displaySchools.length > 0 ? (
                  <Menu>
                    {displaySchools.map(school => (
                      <MenuItem
                        key={school.id}
                        label={school.name || school.displayName}
                        onClick={() => handleSchoolSelect(school)}
                      />
                    ))}
                  </Menu>
                ) : (
                  <NoticeBox>
                    No schools match "{searchTerm}"
                  </NoticeBox>
                )}
              </div>
            )}
          </div>
        </Card>
      ) : (
        <>
          <div className="school-banner">
            <div className="school-banner-content">
              <div className="school-info">
                <span className="school-label">Selected School:</span>
                <span className="school-name">{selectedSchool.displayName}</span>
              </div>
              <Button 
                onClick={() => {
                  setSelectedSchool(null);
                  setSearchTerm('');
                  setErrors(prev => ({ ...prev, school: undefined }));
                }}
                secondary
              >
                Change School
              </Button>
            </div>
          </div>
          
          <div className="registration-form">
            <form onSubmit={handleSubmit}>
              <Card className="form-card">
                <InputField
                  label="First Name"
                  value={formData.firstName}
                  onChange={({ value }) => {
                    setFormData({...formData, firstName: value});
                    setErrors(prev => ({ ...prev, firstName: undefined }));
                  }}
                  required
                  className="uniform-input"
                  error={!!errors.firstName}
                  validationText={errors.firstName}
                />
              </Card>

              <Card className="form-card">
                <InputField
                  label="Last Name"
                  value={formData.lastName}
                  onChange={({ value }) => {
                    setFormData({...formData, lastName: value});
                    setErrors(prev => ({ ...prev, lastName: undefined }));
                  }}
                  required
                  className="uniform-input"
                  error={!!errors.lastName}
                  validationText={errors.lastName}
                />
              </Card>

              <Card className="form-card">
                <InputField
                  label="Gender"
                  value={formData.gender}
                  onChange={({ value }) => {
                    setFormData({...formData, gender: value});
                    setErrors(prev => ({ ...prev, gender: undefined }));
                  }}
                  placeholder="Male/Female/Other"
                  required
                  className="uniform-input"
                  error={!!errors.gender}
                  validationText={errors.gender}
                />
              </Card>

              <Card className="form-card">
                <InputField
                  label="Date of Birth"
                  type="date"
                  value={formData.birthDate}
                  onChange={({ value }) => {
                    setFormData({...formData, birthDate: value});
                    setErrors(prev => ({ ...prev, birthDate: undefined }));
                  }}
                  required
                  className="uniform-input"
                  error={!!errors.birthDate}
                  validationText={errors.birthDate}
                />
              </Card>

              <Card className="location-card">
                <div className="location-search-container">
                  <div className="location-search">
                    <InputField
                      label="Place of Residence"
                      value={formData.residence}
                      onChange={({ value }) => {
                        setFormData(prev => ({ ...prev, residence: value }));
                        setLocationSearch(value);
                        searchMalawiLocations(value);
                        setShowLocationResults(true);
                        setErrors(prev => ({ ...prev, residence: undefined }));
                      }}
                      placeholder="Search for a location in Malawi"
                      required
                      className="uniform-input"
                      error={!!errors.residence}
                      validationText={errors.residence}
                    />
                    <Button 
                      onClick={handleManualMapSearch}
                      primary
                      className="map-button"
                    >
                      Select on Map
                    </Button>
                  </div>
                  
                  {showLocationResults && locationSearch && (
                    <div className="location-results">
                      {locationLoading ? (
                        <div className="location-loading">
                          <CircularLoader small />
                          <span>Searching locations...</span>
                        </div>
                      ) : locationResults.length > 0 ? (
                        <Menu>
                          {locationResults.map((location, index) => (
                            <MenuItem
                              key={index}
                              label={location.display_name}
                              onClick={() => handleLocationSelect(location)}
                            />
                          ))}
                        </Menu>
                      ) : (
                        <NoticeBox>
                          No locations found in Malawi matching "{locationSearch}"
                        </NoticeBox>
                      )}
                    </div>
                  )}
                </div>

                <InputField
                  label="Coordinates"
                  value={formData.coordinatesDisplay}
                  readOnly
                  className="uniform-input"
                  error={!!errors.coordinates}
                  validationText={errors.coordinates}
                />

                <div className="location-buttons">
                  <Button 
                    onClick={handleCurrentLocation}
                    secondary
                    className="current-location-button"
                    loading={locationLoading}
                  >
                    Use Current Location
                  </Button>
                  {formData.residence && (
                    <Button 
                      onClick={handleClearLocation}
                      secondary
                      className="clear-location-button"
                    >
                      Clear Location
                    </Button>
                  )}
                </div>
              </Card>

              <Modal open={mapModalOpen} onClose={handleMapCancel} large>
                <ModalTitle>Select Student's Location on Map</ModalTitle>
                <ModalContent>
                  <div className="modal-map-container">
                    <MapContainer
                      center={formData.coordinates ? 
                        formData.coordinates.split(',').map(Number) : 
                        [-13.2543, 34.3015]}
                      zoom={formData.coordinates ? 13 : 7}
                      style={{ height: '500px', width: '100%' }}
                      onClick={handleMapClick}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      <SchoolLocation school={selectedSchool} />
                      {formData.coordinates && (
                        <StudentLocation location={formData.coordinates.split(',').map(Number)} />
                      )}
                    </MapContainer>
                  </div>
                  <div className="selected-location">
                    {formData.residence && (
                      <p><strong>Selected Location:</strong> {formData.residence}</p>
                    )}
                    {formData.coordinatesDisplay && (
                      <p><strong>Coordinates:</strong> {formData.coordinatesDisplay}</p>
                    )}
                  </div>
                </ModalContent>
                <ModalActions>
                  <Button onClick={handleMapCancel} secondary>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleMapConfirm} 
                    primary 
                    disabled={!formData.coordinates}
                  >
                    Confirm Location
                  </Button>
                </ModalActions>
              </Modal>

              <Button 
                type="submit" 
                primary 
                loading={saving}
                disabled={saving}
                className="submit-button"
              >
                {saving ? 'Registering...' : 'Register Student'}
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default SEMISRegistration;