import React from 'react';
import { MapHeader } from './MapHeader';
import { MapContainer } from './MapContainer';
import './LeafletMapViewer.css';

export const LeafletMapViewer = ({ result, onClose }) => {
  if (!result) return null;

  console.log('MapViewer received:', { 
    school: result.school,
    place: result.place,
    schoolCoords: result.schoolCoords, 
    schoolLocation: result.schoolLocation,
    placeLocation: result.location,
    polyline: result.overviewPolyline,
    distance: result.distance,
    time: result.time
  });

  // Transform school coordinates to { lat, lng } format
  const getSchoolLocation = () => {
    if (result.schoolLocation) {
      return result.schoolLocation;
    }
    
    if (Array.isArray(result.schoolCoords)) {
      return {
        lat: result.schoolCoords[1],
        lng: result.schoolCoords[0]
      };
    }

    if (result.schoolGeometry?.coordinates) {
      return {
        lat: result.schoolGeometry.coordinates[1],
        lng: result.schoolGeometry.coordinates[0]
      };
    }

    console.error('No valid school coordinates found');
    return null;
  };

  const schoolLocation = getSchoolLocation();

  return (
    <div className="leaflet-popup-container" data-testid="map-container">
      <MapHeader 
        school={result.school} 
        place={result.place} 
        distance={result.distance} 
        time={result.time} 
        onClose={onClose} 
      />
      <div className="map-content-wrapper">
        <MapContainer 
          schoolLocation={schoolLocation}
          schoolName={result.school}
          location={result.location}
          placeName={result.place}
          overviewPolyline={result.overviewPolyline}
          distance={result.distance}
          time={result.time}
          travelMode={result.travelMode}
        />
      </div>
    </div>
  );
};