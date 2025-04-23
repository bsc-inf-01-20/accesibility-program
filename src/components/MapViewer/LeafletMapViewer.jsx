import React from 'react';
import { MapHeader } from './MapHeader';
import { MapContainer } from './MapContainer';
import './LeafletMapViewer.css';

export const LeafletMapViewer = ({ result, onClose }) => {
  if (!result) return null; // Add null check

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
          schoolLocation={result.schoolLocation}
          location={result.location}
          overviewPolyline={result.overviewPolyline}
        />
      </div>
    </div>
  );
};