import React, { useState, useEffect, useRef } from 'react';
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
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useFetchSchools } from '../Hooks/useFetchSchools';
import { useSaveStudent } from '../Hooks/useSaveStudent';
import './SEMISRegistration.css';

// Fix Leaflet icons
const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const SchoolIcon = L.icon({
  iconUrl: 'https://cdn0.iconfinder.com/data/icons/small-n-flat/24/678111-map-marker-512.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
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

const LocationPicker = ({ onLocationSelect, center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 15);
    }
  }, [center, zoom, map]);

  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
      map.flyTo(e.latlng, 15);
    }
  });
  
  return null;
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
    coordinates: null,
    coordinatesText: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState([-1.2921, 36.8219]);
  const [mapZoom, setMapZoom] = useState(13);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const { saveStudent, saving } = useSaveStudent();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const displaySchools = selectedSchools.filter(school => 
    school?.name?.toLowerCase()?.includes(debouncedTerm.toLowerCase())
  );

  const validateForm = () => {
    return (
      formData.firstName.trim() !== '' &&
      formData.lastName.trim() !== '' &&
      formData.gender.trim() !== '' &&
      formData.birthDate.trim() !== '' &&
      formData.residence.trim() !== '' &&
      formData.coordinates !== null &&
      selectedSchool !== null
    );
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
  };

  const handleLocationSearch = async (searchText) => {
    if (!searchText) {
      setSearchResults([]);
      return;
    }
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText)}`
      );
      const data = await response.json();
      setSearchResults(data.slice(0, 5));
    } catch (err) {
      console.error('Location search failed:', err);
      setSearchResults([]);
    }
  };

  const handleResidenceChange = (value) => {
    setFormData(prev => ({
      ...prev,
      residence: value
    }));
    handleLocationSearch(value);
    setShowResults(true);
  };

  const selectSearchResult = (result) => {
    const { lat, lon, display_name } = result;
    setFormData(prev => ({
      ...prev,
      residence: display_name,
      coordinates: [parseFloat(lat), parseFloat(lon)],
      coordinatesText: `${lat}, ${lon}`
    }));
    setShowResults(false);
  };

  const handleMapButtonClick = () => {
    if (!selectedSchool) return;
    
    const schoolCoords = selectedSchool.geometry.coordinates;
    setMapCenter([schoolCoords[1], schoolCoords[0]]);
    setMapZoom(15);
    setMapModalOpen(true);
  };

  const handleMapClick = async (latlng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`
      );
      const data = await response.json();
      
      setFormData(prev => ({
        ...prev,
        residence: data.display_name || `Location at ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`,
        coordinates: [latlng.lat, latlng.lng],
        coordinatesText: `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`
      }));
      
    } catch (err) {
      setFormData(prev => ({
        ...prev,
        residence: `Location at ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`,
        coordinates: [latlng.lat, latlng.lng],
        coordinatesText: `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSchool || !formData.coordinates) return;
    
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
        coordinates: null,
        coordinatesText: ''
      });
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  return (
    <div className="semis-container">
      <h1>Student Registration System</h1>
      
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
                }}
                className="change-school-button"
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
                  onChange={({ value }) => setFormData({...formData, firstName: value})}
                  required
                  className="uniform-input"
                />
              </Card>

              <Card className="form-card">
                <InputField
                  label="Last Name"
                  value={formData.lastName}
                  onChange={({ value }) => setFormData({...formData, lastName: value})}
                  required
                  className="uniform-input"
                />
              </Card>

              <Card className="form-card">
                <div className="select-wrapper">
                  <label htmlFor="gender-select" className="select-label required-field">Gender</label>
                  <select
                    id="gender-select"
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    required
                    className="uniform-input"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </Card>

              <Card className="form-card">
                <InputField
                  label="Date of Birth"
                  type="date"
                  value={formData.birthDate}
                  onChange={({ value }) => setFormData({...formData, birthDate: value})}
                  required
                  className="uniform-input"
                />
              </Card>

              <Card className="location-card">
                <div className="location-fields">
                  <div className="residence-field-container">
                    <InputField
                      label="Place of Residence"
                      value={formData.residence}
                      onChange={({ value }) => handleResidenceChange(value)}
                      placeholder="Type to search locations"
                      required
                      className="uniform-input"
                    />
                    {showResults && searchResults.length > 0 && (
                      <div className="search-results-dropdown">
                        <Menu>
                          {searchResults.map((result, index) => (
                            <MenuItem
                              key={index}
                              label={result.display_name}
                              onClick={() => selectSearchResult(result)}
                            />
                          ))}
                        </Menu>
                      </div>
                    )}
                  </div>
                  <InputField
                    label="Coordinates"
                    value={formData.coordinatesText || ''}
                    readOnly
                    placeholder="Will update automatically"
                    className="uniform-input coordinates-field"
                  />
                  <Button 
                    onClick={handleMapButtonClick}
                    primary
                    className="map-button"
                  >
                    {formData.coordinates ? 'Update on Map' : 'Select on Map'}
                  </Button>
                </div>
              </Card>

              <Button 
                type="submit" 
                primary 
                loading={saving}
                disabled={!validateForm() || saving}
                className="submit-button"
              >
                {saving ? 'Registering...' : 'Register Student'}
              </Button>
            </form>
          </div>
        </>
      )}

      {mapModalOpen && (
        <Modal
          large
          open={mapModalOpen}
          onClose={() => setMapModalOpen(false)}
        >
          <ModalTitle>Select Student Location</ModalTitle>
          <ModalContent>
            <div className="map-modal-container">
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: '60vh', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {selectedSchool?.geometry?.coordinates && (
                  <Marker 
                    position={[
                      selectedSchool.geometry.coordinates[1],
                      selectedSchool.geometry.coordinates[0]
                    ]}
                    icon={SchoolIcon}
                  >
                    <Popup>
                      <strong>School Location</strong><br/>
                      {selectedSchool.displayName}
                    </Popup>
                  </Marker>
                )}
                {formData.coordinates && (
                  <Marker position={formData.coordinates}>
                    <Popup>
                      <strong>Student Location</strong><br/>
                      {formData.residence || "Selected Location"}
                    </Popup>
                  </Marker>
                )}
                <LocationPicker 
                  onLocationSelect={handleMapClick} 
                  center={mapCenter}
                  zoom={mapZoom}
                />
              </MapContainer>
            </div>
          </ModalContent>
          <ModalActions>
            <Button onClick={() => setMapModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              primary 
              onClick={() => setMapModalOpen(false)}
            >
              Confirm Location
            </Button>
          </ModalActions>
        </Modal>
      )}
    </div>
  );
};

export default SEMISRegistration;