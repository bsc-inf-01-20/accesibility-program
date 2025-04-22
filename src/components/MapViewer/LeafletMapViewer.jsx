import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@dhis2/ui';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LeafletMapViewer.css';

const decodePolyline = (encoded) => {
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  
  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    coordinates.push([lat * 1e-5, lng * 1e-5]);
  }
  
  return coordinates;
};

// Marker icon setup
const markerIcon2x = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href;
const markerIcon = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
const markerShadow = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export const LeafletMapViewer = ({ result, onClose }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const routeLayer = useRef(null);
  const markersLayer = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: -50, y: -50 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    // Don't drag if clicking on buttons or the map itself
    if (e.target.closest('.close-button, .leaflet-popup-map, .dhis2-button')) {
      return;
    }
    
    setIsDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (!result) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView(
        [result.schoolLocation?.lat || result.location.lat, 
         result.schoolLocation?.lng || result.location.lng],
        14
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstance.current);
    }

    // Clear previous layers
    if (routeLayer.current) mapInstance.current.removeLayer(routeLayer.current);
    if (markersLayer.current) mapInstance.current.removeLayer(markersLayer.current);

    // Create new layers
    markersLayer.current = L.layerGroup().addTo(mapInstance.current);

    // Add markers
    if (result.schoolLocation) {
      L.marker([result.schoolLocation.lat, result.schoolLocation.lng], {
        icon: L.icon({
          iconUrl: markerIcon,
          iconRetinaUrl: markerIcon2x,
          shadowUrl: markerShadow,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        }),
        title: result.school
      })
      .bindPopup(`<b>${result.school}</b><br>${result.schoolLocation.lat.toFixed(6)}, ${result.schoolLocation.lng.toFixed(6)}`)
      .addTo(markersLayer.current);
    }

    L.marker([result.location.lat, result.location.lng], {
      icon: L.icon({
        iconUrl: markerIcon,
        iconRetinaUrl: markerIcon2x,
        shadowUrl: markerShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      }),
      title: result.place
    })
    .bindPopup(`<b>${result.place}</b><br>${result.location.lat.toFixed(6)}, ${result.location.lng.toFixed(6)}`)
    .addTo(markersLayer.current);

    // Add route
    if (result.overviewPolyline) {
      try {
        const coordinates = decodePolyline(result.overviewPolyline);
        routeLayer.current = L.polyline(coordinates, {
          color: '#4285F4',
          weight: 5,
          opacity: 0.7,
          smoothFactor: 1
        }).addTo(mapInstance.current);

        const bounds = L.latLngBounds([
          ...(result.schoolLocation ? [[result.schoolLocation.lat, result.schoolLocation.lng]] : []),
          [result.location.lat, result.location.lng],
          ...coordinates
        ]);
        mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
      } catch (error) {
        console.error('Error decoding polyline:', error);
        const bounds = L.latLngBounds([
          [result.location.lat, result.location.lng],
          ...(result.schoolLocation ? [[result.schoolLocation.lat, result.schoolLocation.lng]] : [])
        ]);
        mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [result]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div 
      ref={containerRef}
      className="leaflet-popup-container"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="leaflet-popup-header">
        <div className="route-info">
          <h3>{result.school} → {result.place}</h3>
          <div className="route-meta">
            <span className="route-distance">Distance: {result.distance} km</span>
            <span className="route-time">Time: {result.time}</span>
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
      <div className="leaflet-popup-content">
        <div ref={mapRef} className="leaflet-popup-map" />
      </div>
    </div>
  );
};