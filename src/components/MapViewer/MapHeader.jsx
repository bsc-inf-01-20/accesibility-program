import React from 'react';
import { Button } from '@dhis2/ui';
import './MapHeader.css';

/**
 * MapHeader
 *
 * A header component for displaying route summary information between a school and a nearby place.
 * Shows the school and destination names, distance, time, and a close button.
 *
 * @component
 * @example
 * return (
 *   <MapHeader
 *     school="Chisomo Primary"
 *     place="Nearest Market"
 *     distance={2.7}
 *     time="10 mins"
 *     onClose={() => console.log("Close clicked")}
 *   />
 * )
 *
 * @param {Object} props
 * @param {string} props.school - The name of the school.
 * @param {string} props.place - The name of the nearby place (e.g., market or clinic).
 * @param {number|string} props.distance - Distance between school and place (in kilometers).
 * @param {string} props.time - Estimated travel time (e.g., "10 mins").
 * @param {() => void} props.onClose - Callback fired when the close button is clicked.
 */
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
