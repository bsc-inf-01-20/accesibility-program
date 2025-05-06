import React, { useState, useEffect, useRef } from 'react';
import { 
  Button,
  InputField,
  NoticeBox,
  CircularLoader,
  Menu,
  MenuItem,
  Card
} from '@dhis2/ui';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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
    coordinates: null
  });
  const [locationSearch, setLocationSearch] = useState('');
  const [showMap, setShowMap] = useState(false);
  const { saveStudent, saving } = useSaveStudent();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const displaySchools = selectedSchools.filter(school => 
    school?.name?.toLowerCase()?.includes(debouncedTerm.toLowerCase())
  );

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

  const handleLocationSearch = async () => {
    if (!locationSearch) return;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch)}`
      );
      const data = await response.json();
      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setFormData(prev => ({
          ...prev,
          residence: display_name,
          coordinates: [parseFloat(lat), parseFloat(lon)]
        }));
        setShowMap(true);
      }
    } catch (err) {
      console.error('Location search failed:', err);
    }
  };

  const handleMapClick = async (e) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`
      );
      const data = await response.json();
      setFormData(prev => ({
        ...prev,
        residence: data.display_name,
        coordinates: [e.latlng.lat, e.latlng.lng]
      }));
    } catch (err) {
      setFormData(prev => ({
        ...prev,
        residence: `Location at ${e.latlng.lat}, ${e.latlng.lng}`,
        coordinates: [e.latlng.lat, e.latlng.lng]
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSchool) return;
    
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
        coordinates: null
      });
      setLocationSearch('');
      setShowMap(false);
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
                <InputField
                  label="Gender"
                  value={formData.gender}
                  onChange={({ value }) => setFormData({...formData, gender: value})}
                  placeholder="Male/Female/Other"
                  required
                  className="uniform-input"
                />
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
                <div className="location-search">
                  <InputField
                    label="Place of Residence"
                    value={locationSearch}
                    onChange={({ value }) => setLocationSearch(value)}
                    placeholder="Search location on map"
                    required
                    className="uniform-input"
                  />
                  <Button 
                    onClick={handleLocationSearch}
                    primary
                    className="search-button"
                  >
                    Search on Map
                  </Button>
                </div>
                {showMap && (
                  <div className="map-container">
                    <MapContainer
                      center={formData.coordinates || 
                        (selectedSchool?.geometry?.coordinates 
                          ? [selectedSchool.geometry.coordinates[1], selectedSchool.geometry.coordinates[0]] 
                          : [-1.2921, 36.8219])}
                      zoom={13}
                      style={{ height: '400px', width: '100%' }}
                      onClick={handleMapClick}
                    >
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      <SchoolLocation school={selectedSchool} />
                      <StudentLocation location={formData.coordinates} />
                    </MapContainer>
                  </div>
                )}
              </Card>

              <Button 
                type="submit" 
                primary 
                loading={saving}
                disabled={!formData.coordinates || saving}
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