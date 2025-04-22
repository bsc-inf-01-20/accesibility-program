import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@dhis2/ui';
import './GoogleMapsViewer.css';
import GoogleMapsLoader from './GoogleMapsLoader';

export const GoogleMapsViewer = ({ result, onClose }) => {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const directionsRendererRef = useRef(null);
  const markersRef = useRef([]);

  const createMarkerElement = (letter, color) => {
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${letter}</div>
    `;
    return element;
  };

  useEffect(() => {
    if (!window.google || !result || !mapLoaded) return;

    const initMap = async () => {
      try {
        // Load required libraries
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        const { DirectionsRenderer } = await google.maps.importLibrary("routes");

        // Initialize map
        const map = new Map(mapRef.current, {
          center: result.schoolLocation || result.location,
          zoom: 13,
          mapId: 'YOUR_MAP_ID' // Create in Google Cloud Console
        });

        // Initialize directions renderer
        const directionsRenderer = new DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: false,
          polylineOptions: {
            strokeColor: '#4285F4',
            strokeOpacity: 1.0,
            strokeWeight: 5
          }
        });
        directionsRendererRef.current = directionsRenderer;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.map = null);
        markersRef.current = [];

        // Create markers
        const schoolMarker = new AdvancedMarkerElement({
          map,
          position: result.schoolLocation || {
            lat: result.location.lat - 0.01,
            lng: result.location.lng - 0.01
          },
          title: result.school,
          content: createMarkerElement('S', '#4285F4')
        });

        const placeMarker = new AdvancedMarkerElement({
          map,
          position: result.location,
          title: result.place,
          content: createMarkerElement('P', '#EA4335')
        });

        markersRef.current.push(schoolMarker, placeMarker);

        // Process route data if available
        if (result.rawData?.routes?.length > 0) {
          console.log('Setting directions with data:', result.rawData);
          
          // Validate the directions response
          if (!result.rawData.routes[0].legs[0].steps) {
            throw new Error('Invalid directions data - missing steps');
          }

          // Set directions to renderer
          directionsRenderer.setDirections(result.rawData);

          // Create bounds from the actual route path
          const bounds = new google.maps.LatLngBounds();
          result.rawData.routes[0].legs[0].steps.forEach(step => {
            if (step.start_location) {
              bounds.extend(new google.maps.LatLng(
                step.start_location.lat(),
                step.start_location.lng()
              ));
            }
            if (step.end_location) {
              bounds.extend(new google.maps.LatLng(
                step.end_location.lat(),
                step.end_location.lng()
              ));
            }
          });
          
          // Add padding to the bounds
          map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
        } else {
          console.log('No route data available, showing markers only');
          // Fit bounds to markers
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(schoolMarker.position);
          bounds.extend(placeMarker.position);
          map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
        }

      } catch (error) {
        console.error('Google Maps initialization error:', error);
        setMapError('Failed to display route. Please try again.');
      }
    };

    initMap();

    return () => {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
      markersRef.current.forEach(marker => marker.map = null);
    };
  }, [result, mapLoaded]);

  return (
    <div className="map-viewer-modal">
      <GoogleMapsLoader onLoad={() => setMapLoaded(true)}>
        {mapError && (
          <div className="map-error">
            {mapError}
          </div>
        )}
        <div className="map-viewer-header">
          <div className="route-info">
            <h3>{result.school} → {result.place}</h3>
            <div className="route-meta">
              <span>Distance: {result.distance} km</span>
              <span>Duration: {result.time}</span>
            </div>
          </div>
          <Button onClick={onClose} className="close-button">
            Close
          </Button>
        </div>
        <div ref={mapRef} className="map-container" />
        {result.steps && (
          <div className="route-steps">
            <h4>Route Instructions:</h4>
            <ol>
              {result.steps.map((step, index) => (
                <li key={index}>{step.instructions}</li>
              ))}
            </ol>
          </div>
        )}
      </GoogleMapsLoader>
    </div>
  );
};
export default GoogleMapsViewer;