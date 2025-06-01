import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { decode } from 'polyline';
import 'leaflet/dist/leaflet.css';
import './MapContainer.css';

/**
 * MapContainer
 *
 * Displays a Leaflet map with custom markers for a school and its nearest place (e.g., market or clinic).
 * Also visualizes the route between the two using an encoded polyline.
 *
 * @component
 * @example
 * return (
 *   <MapContainer
 *     schoolLocation={{ lat: -15.394, lng: 35.345 }}
 *     location={{ lat: -15.395, lng: 35.346 }}
 *     schoolName="Chisomo Primary"
 *     placeName="Nearest Market"
 *     overviewPolyline="encodedPolylineHere"
 *     distance={2.7}
 *     time="10 mins"
 *     travelMode="walking"
 *   />
 * )
 *
 * @param {Object} props
 * @param {{ lat: number, lng: number }} props.schoolLocation - Latitude and longitude of the school.
 * @param {string} [props.schoolName="School"] - Name of the school.
 * @param {{ lat: number, lng: number }} props.location - Latitude and longitude of the nearby place.
 * @param {string} [props.placeName="Destination"] - Name of the place (e.g., market or clinic).
 * @param {string} props.overviewPolyline - Encoded Google Directions API polyline string.
 * @param {number} props.distance - Distance in kilometers.
 * @param {string} props.time - Travel time as a string (e.g., "10 mins").
 * @param {string} props.travelMode - Mode of travel (e.g., "walking", "driving").
 */
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
  const [map, setMap] = useState(null);
  const mapRef = useRef(null);

  /**
   * Creates a custom marker icon using an emoji and a background color.
   * @param {string} emoji - Emoji to display.
   * @param {string} color - Background color of the marker.
   * @returns {L.DivIcon}
   */
  const createMarkerIcon = (emoji, color) => {
    return L.divIcon({
      className: 'custom-marker-icon',
      html: `
        <div class="marker-container" style="background-color: ${color}">
          <div class="marker-emoji">${emoji}</div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });
  };

  // Initialize the map
  useEffect(() => {
    if (!mapRef.current) return;

    const newMap = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView([-15, 35], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18
    }).addTo(newMap);

    setMap(newMap);

    return () => newMap.remove();
  }, []);

  // Add markers and polyline when dependencies change
  useEffect(() => {
    if (!map) return;

    // Clear old markers and polylines
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
          ${distance ? `<p>Distance: ${distance.toFixed(1)} km</p>` : ''}
          ${time ? `<p>Travel time: ${time}</p>` : ''}
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
          ${distance ? `<p>${distance.toFixed(1)} km from school</p>` : ''}
        </div>
      `);
    }

    // Add route line
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

    // Fit map to show both points
    if (schoolLocation && location) {
      map.fitBounds(
        L.latLngBounds(
          [schoolLocation.lat, schoolLocation.lng],
          [location.lat, location.lng]
        ),
        { padding: [100, 100] }
      );
    }
  }, [map, schoolLocation, schoolName, location, placeName, overviewPolyline, distance, time]);

  return <div ref={mapRef} className="leaflet-map-container" />;
};
