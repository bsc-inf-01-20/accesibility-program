import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { decodePolyline, setupLeafletIcons } from '../utils/mapUtils';

export const useMap = () => {
  const routeLayer = useRef(null);
  const markersLayer = useRef(null);

  const initMap = (container, center) => {
    setupLeafletIcons();
    const map = L.map(container, {
      preferCanvas: true, // Better performance for many markers
      zoomControl: false // We'll add it manually if needed
    }).setView([center.lat, center.lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    return { map, markersLayer: markersLayer.current };
  };

  const renderMarkers = (markersLayer, schoolLocation, destinationLocation) => {
    markersLayer.clearLayers();

    if (schoolLocation) {
      L.marker([schoolLocation.lat, schoolLocation.lng], {
        icon: new L.Icon.Default()
      })
      .bindPopup(`<b>School</b><br>Lat: ${schoolLocation.lat.toFixed(6)}<br>Lng: ${schoolLocation.lng.toFixed(6)}`)
      .addTo(markersLayer);
    }

    L.marker([destinationLocation.lat, destinationLocation.lng], {
      icon: new L.Icon.Default()
    })
    .bindPopup(`<b>Destination</b><br>Lat: ${destinationLocation.lat.toFixed(6)}<br>Lng: ${destinationLocation.lng.toFixed(6)}`)
    .addTo(markersLayer);
  };

  const renderRoute = (map, markersLayer, polyline, schoolLocation, destinationLocation) => {
    try {
      // Remove previous route if exists
      if (routeLayer.current) {
        map.removeLayer(routeLayer.current);
      }

      const coordinates = decodePolyline(polyline);
      routeLayer.current = L.polyline(coordinates, {
        color: '#3388ff',
        weight: 5,
        opacity: 0.7,
        lineJoin: 'round'
      }).addTo(map);

      // Create bounds that include both markers and route
      const bounds = routeLayer.current.getBounds();
      if (schoolLocation) {
        bounds.extend([schoolLocation.lat, schoolLocation.lng]);
      }
      bounds.extend([destinationLocation.lat, destinationLocation.lng]);
      
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch (error) {
      console.error('Error rendering route:', error);
    }
  };

  return { initMap, renderMarkers, renderRoute };
};
export default useMap;