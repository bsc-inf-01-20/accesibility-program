import React, { useEffect, useRef, useState } from 'react';
import { Button, Modal, ModalTitle, ModalContent, ModalActions } from '@dhis2/ui';
import './MapViewer.css';

export const MapViewer = ({ result, onClose }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load Google Maps API script
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBEQn6cZ10o8NEwd2ImErozWwCWF1miysA&libraries=places,directions`;
      script.async = true;
      script.onerror = () => setError('Failed to load Google Maps');
      document.head.appendChild(script);
      
      script.onload = initializeMap;
      return () => document.head.removeChild(script);
    } else {
      initializeMap();
    }
  }, []);

  const initializeMap = () => {
    if (!window.google || !mapRef.current) return;

    try {
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        zoom: 14,
        center: { lat: -15.395, lng: 35.319 }, // Default center
        mapTypeId: 'roadmap'
      });

      const service = new window.google.maps.DirectionsService();
      const renderer = new window.google.maps.DirectionsRenderer({
        map: mapInstance,
        suppressMarkers: false
      });

      setMap(mapInstance);
      setDirectionsService(service);
      setDirectionsRenderer(renderer);
    } catch (err) {
      setError('Error initializing Google Maps');
    }
  };

  useEffect(() => {
    if (!map || !directionsService || !directionsRenderer || !result) return;

    try {
      const start = result.rawData?.schoolCoords 
        ? { lat: result.rawData.schoolCoords[1], lng: result.rawData.schoolCoords[0] }
        : { lat: -15.395, lng: 35.319 }; // Fallback coordinates

      const end = result.rawData?.placeCoords
        ? { lat: result.rawData.placeCoords[1], lng: result.rawData.placeCoords[0] }
        : { lat: -15.402, lng: 35.320 }; // Fallback coordinates

      directionsService.route({
        origin: start,
        destination: end,
        travelMode: 'WALKING'
      }, (response, status) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(response);
          
          // Center the map on the route
          const bounds = new window.google.maps.LatLngBounds();
          response.routes[0].legs[0].steps.forEach(step => {
            bounds.extend(step.start_location);
            bounds.extend(step.end_location);
          });
          map.fitBounds(bounds);
        } else {
          setError('Could not calculate route: ' + status);
        }
      });
    } catch (err) {
      setError('Error displaying route: ' + err.message);
    }
  }, [map, directionsService, directionsRenderer, result]);

  if (!result) return null;

  return (
    <Modal open large onClose={onClose}>
      <ModalTitle>
        Route from {result.school} to {result.place}
      </ModalTitle>
      <ModalContent>
        {error && (
          <div style={{ color: 'red', padding: '16px' }}>
            {error}
          </div>
        )}
        
        <div 
          ref={mapRef} 
          className="google-map-container"
          style={{ height: '500px', width: '100%' }}
        />
        
        <div className="route-details">
          <div><strong>School:</strong> {result.school}</div>
          <div><strong>Amenity:</strong> {result.place}</div>
          <div><strong>Distance:</strong> {result.distance} km</div>
          <div><strong>Travel time:</strong> {result.time}</div>
        </div>
      </ModalContent>
      <ModalActions>
        <Button onClick={onClose}>Close</Button>
      </ModalActions>
    </Modal>
  );
};