import React, { useEffect } from 'react';
import L from 'leaflet';
import { decode } from 'polyline';
import 'leaflet/dist/leaflet.css';
import './MapContainer.css';

export const MapContainer = ({ 
  schoolLocation, 
  schoolName = 'School', 
  location, 
  placeName = 'Destination', 
  overviewPolyline,
  distance,
  time,
  travelMode
}) => {
  const [map, setMap] = React.useState(null);
  const mapRef = React.useRef(null);

  // Custom marker icons
  const createMarkerIcon = (emoji, color) => {
    return L.divIcon({
      className: 'custom-marker-icon',
      html: `
        <div class="marker-container" style="background-color: ${color}">
          <div class="marker-emoji">${emoji}</div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20], // This matches your marker-container center
      popupAnchor: [0, -20]
    });
  };
  

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const newMap = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView([-15, 35], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(newMap);

    setMap(newMap);

    return () => newMap.remove();
  }, []);

  // Update markers and routes
  useEffect(() => {
    if (!map) return;

    // Clear previous layers
    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    // Add school marker
    if (schoolLocation) {
      const schoolIcon = createMarkerIcon('🏫', '#3388ff');
      const schoolMarker = L.marker([schoolLocation.lat, schoolLocation.lng], {
        icon: schoolIcon,
        title: schoolName
      }).addTo(map);

      schoolMarker.bindPopup(`
        <div class="custom-popup">
          <h3>${schoolName}</h3>
          ${distance && `<p>Distance: ${distance.toFixed(1)} km</p>`}
          ${time && `<p>Travel time: ${time}</p>`}
        </div>
      `);
    }

    // Add destination marker
    if (location) {
      const placeIcon = createMarkerIcon('📍', '#ff4444');
      const placeMarker = L.marker([location.lat, location.lng], {
        icon: placeIcon,
        title: placeName
      }).addTo(map);

      placeMarker.bindPopup(`
        <div class="custom-popup">
          <h3>${placeName}</h3>
          ${distance && `<p>${distance.toFixed(1)} km from school</p>`}
        </div>
      `);
    }

    // Add route polyline
    if (overviewPolyline) {
      try {
        const latLngs = decode(overviewPolyline).map(([lat, lng]) => [lat, lng]);
        L.polyline(latLngs, {
          color: '#3388ff',
          weight: 6,
          opacity: 0.8,
          lineJoin: 'round'
        }).addTo(map);
      } catch (error) {
        console.error('Error decoding polyline:', error);
      }
    }

    // Fit bounds to show both markers
    if (schoolLocation && location) {
      map.fitBounds(L.latLngBounds(
        [schoolLocation.lat, schoolLocation.lng],
        [location.lat, location.lng]
      ), { padding: [100, 100] });
    }
  }, [map, schoolLocation, schoolName, location, placeName, overviewPolyline, distance, time]);

  return (
    <div 
      ref={mapRef} 
      className="leaflet-map-container"
    />
  );
};