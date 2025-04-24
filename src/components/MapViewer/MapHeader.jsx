import React from 'react';
import { Button } from '@dhis2/ui';
import './MapHeader.css';

export const MapHeader = ({ school, place, distance, time, onClose }) => (
  <div className="leaflet-popup-header">
    <div className="route-info">
      <h3>{school} → {place}</h3>
      <div className="route-meta">
        <span className="route-distance">
          <span className="icon">📏</span> {distance} km
        </span>
        <span className="route-time">
          <span className="icon">⏱️</span> {time}
        </span>
      </div>
    </div>
    <Button 
      small 
      onClick={onClose} 
      className="close-button"
      aria-label="Close map"
    >
      ×
    </Button>
  </div>
);