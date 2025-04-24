import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { decodePolyline, setupLeafletIcons } from '../../utils/mapUtils';
import './MapContainer.css';

export const MapContainer = ({ schoolLocation, location, overviewPolyline }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef({
    route: null,
    markers: null
  });

  useEffect(() => {
    if (!mapRef.current || !location) return;

    // Initialize map only once
    if (!mapInstance.current) {
      setupLeafletIcons();
      mapInstance.current = L.map(mapRef.current, {
        preferCanvas: true,
      }).setView(
        [location.lat, location.lng],
        14
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(mapInstance.current);

      layersRef.current.markers = L.layerGroup().addTo(mapInstance.current);
    }

    // Clear previous layers
    layersRef.current.markers.clearLayers();
    if (layersRef.current.route) {
      mapInstance.current.removeLayer(layersRef.current.route);
    }

    // Add markers
    if (schoolLocation) {
      L.marker([schoolLocation.lat, schoolLocation.lng])
        .addTo(layersRef.current.markers)
        .bindPopup(`School: ${schoolLocation.lat.toFixed(4)}, ${schoolLocation.lng.toFixed(4)}`);
    }

    L.marker([location.lat, location.lng])
      .addTo(layersRef.current.markers)
      .bindPopup(`Destination: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);

    // Add route if available
    if (overviewPolyline) {
      try {
        const coordinates = decodePolyline(overviewPolyline);
        layersRef.current.route = L.polyline(coordinates, {
          color: '#3388ff',
          weight: 5
        }).addTo(mapInstance.current);

        // Fit bounds to show everything
        const bounds = layersRef.current.route.getBounds();
        if (schoolLocation) bounds.extend([schoolLocation.lat, schoolLocation.lng]);
        bounds.extend([location.lat, location.lng]);
        mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
      } catch (error) {
        console.error('Error rendering route:', error);
      }
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [schoolLocation, location, overviewPolyline]);

  return <div ref={mapRef} className="leaflet-popup-map" />;
};