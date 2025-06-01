import React, { useState, useEffect, useRef } from 'react';
import { Modal, ModalTitle, ModalContent, ModalActions, Button, InputField } from '@dhis2/ui';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icons
L.Marker.prototype.options.icon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

/**
 * Custom icon for school markers
 */
const SchoolIcon = L.icon({
  iconUrl: 'https://cdn0.iconfinder.com/data/icons/small-n-flat/24/678111-map-marker-512.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

/**
 * LocationPicker
 *
 * A component that provides location selection functionality on a map.
 * Includes search capabilities and handles click events for location selection.
 *
 * @component
 * @param {Object} props
 * @param {Function} props.onLocationSelect - Callback when a location is selected
 * @param {Array<number>} [props.center] - Initial map center coordinates [lat, lng]
 * @param {number} [props.zoom] - Initial map zoom level
 * @param {Function} props.onSearch - Callback for search queries
 * @param {Array<Object>} props.searchResults - Array of search results
 * @param {Object} [props.selectedSchool] - Selected school data with geometry coordinates
 */
const LocationPicker = ({ 
  onLocationSelect, 
  center, 
  zoom,
  onSearch,
  searchResults,
  selectedSchool
}) => {
  const map = useMap();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  
  // Focus search input when map loads
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Center map on school when it loads
  useEffect(() => {
    if (selectedSchool?.geometry?.coordinates) {
      const [lng, lat] = selectedSchool.geometry.coordinates;
      map.flyTo([lat, lng], zoom || 16); // Increased zoom level
    } else if (center) {
      map.flyTo(center, zoom || 16);
    }
  }, [map, center, zoom, selectedSchool]);

  useMapEvents({
    async click(e) {
      try {
        // Reverse geocode to get location name
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`
        );
        const data = await response.json();
        
        const locationData = {
          coordinates: [e.latlng.lat, e.latlng.lng],
          displayName: data.display_name || `Location at ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`
        };
        onLocationSelect(locationData);
      } catch (error) {
        console.error('Reverse geocoding failed:', error);
        // Fallback if reverse geocoding fails
        const locationData = {
          coordinates: [e.latlng.lat, e.latlng.lng],
          displayName: `Location at ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`
        };
        onLocationSelect(locationData);
      }
    }
  });

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  const handleResultClick = (result) => {
    const locationData = {
      coordinates: [parseFloat(result.lat), parseFloat(result.lon)],
      displayName: result.display_name
    };
    onLocationSelect(locationData);
    map.flyTo([parseFloat(result.lat), parseFloat(result.lon)], 16);
  };

  return (
    <div className="map-search-container">
      <InputField
        inputRef={searchInputRef}
        value={searchQuery}
        onChange={handleSearch}
        placeholder="Search for location..."
        className="map-search-input"
      />
      
      {searchResults.length > 0 && (
        <div className="search-results-dropdown">
          {searchResults.map((result, index) => (
            <div 
              key={index}
              className="search-result-item"
              onClick={() => handleResultClick(result)}
            >
              {result.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * LocationMapModal
 *
 * A modal component that displays an interactive map for selecting locations.
 * Includes search functionality and displays markers for schools and selected locations.
 *
 * @component
 * @example
 * return (
 *   <LocationMapModal
 *     isOpen={true}
 *     onClose={() => {}}
 *     center={[-13.966, 33.787]}
 *     zoom={15}
 *     onLocationSelect={(location) => console.log(location)}
 *   />
 * )
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls whether the modal is open
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Array<number>} [props.center] - Initial map center coordinates [lat, lng]
 * @param {number} [props.zoom] - Initial map zoom level
 * @param {Object} [props.selectedSchool] - School data to display as a marker
 * @param {Array<number>} [props.currentLocation] - Current selected location coordinates [lat, lng]
 * @param {Function} props.onLocationSelect - Callback when a location is selected
 */
export const LocationMapModal = ({
  isOpen,
  onClose,
  center,
  zoom,
  selectedSchool,
  currentLocation,
  onLocationSelect
}) => {
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=MW&limit=5`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Location search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal large open={isOpen} onClose={onClose} className="map-modal">
      <ModalTitle>Select Student Location</ModalTitle>
      <ModalContent>
        <div className="map-modal-container">
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '70vh', width: '100%' }} // Increased height
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {/* School Marker */}
            {selectedSchool?.geometry?.coordinates && (
              <Marker 
                position={[
                  selectedSchool.geometry.coordinates[1],
                  selectedSchool.geometry.coordinates[0]
                ]}
                icon={SchoolIcon}
              >
                <Popup className="leaflet-popup">
                  <strong>School Location</strong><br/>
                  {selectedSchool.displayName}
                </Popup>
              </Marker>
            )}
            
            {/* Current Location Marker */}
            {currentLocation && (
              <Marker position={currentLocation}>
                <Popup className="leaflet-popup">
                  <strong>Selected Location</strong>
                </Popup>
              </Marker>
            )}
            
            {/* Search Results Markers */}
            {searchResults.map((result, index) => (
              <Marker
                key={index}
                position={[parseFloat(result.lat), parseFloat(result.lon)]}
                eventHandlers={{
                  click: () => {
                    const locationData = {
                      coordinates: [parseFloat(result.lat), parseFloat(result.lon)],
                      displayName: result.display_name
                    };
                    onLocationSelect(locationData);
                  }
                }}
              >
                <Popup>{result.display_name}</Popup>
              </Marker>
            ))}
            
            <LocationPicker 
              onLocationSelect={onLocationSelect} 
              center={center}
              zoom={zoom}
              onSearch={handleSearch}
              searchResults={searchResults}
              selectedSchool={selectedSchool}
            />
          </MapContainer>
        </div>
      </ModalContent>
      <ModalActions className="modal-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button primary onClick={onClose}>Confirm Location</Button>
      </ModalActions>
    </Modal>
  );
};