import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const iconRetinaUrl = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href;
const iconUrl = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
const shadowUrl = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const useLeafletMap = (containerRef, results) => {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !results?.length) return;

    const initMap = () => {
      if (mapRef.current) mapRef.current.remove();

      const result = results[0];
      const [lng, lat] = result.rawData.schoolCoords;
      const map = L.map(containerRef.current).setView([lat, lng], 13);
      mapRef.current = map;

      L.tileLayer(
        'https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZmFyZ28yMTkiLCJhIjoiY205Y25xajJxMHJlbzJpc2M4bjhhdm9hZCJ9.xhoZP4Gr0_3yo6N9EBnD_w',
        { attribution: '&copy; OpenStreetMap contributors' }
      ).addTo(map);

      const { schoolCoords, placeCoords } = result.rawData;
      const schoolLatLng = [schoolCoords[1], schoolCoords[0]];
      const placeLatLng = [placeCoords[1], placeCoords[0]];

      // School marker with custom icon
      const schoolMarker = L.marker(schoolLatLng, {
        icon: L.divIcon({
          className: 'custom-icon school-icon',
          html: '🏫',
          iconSize: [30, 30]
        })
      }).bindPopup(`<b>School:</b> ${result.school}`);

      // Amenity marker with custom icon
      const amenityMarker = L.marker(placeLatLng, {
        icon: L.divIcon({
          className: 'custom-icon place-icon',
          html: result.place.includes('Hospital') ? '🏥' : '🏪',
          iconSize: [30, 30]
        })
      }).bindPopup(`<b>${result.place}</b>`);

      schoolMarker.addTo(map);
      amenityMarker.addTo(map);

      // Add route if available
      if (result.route) {
        L.geoJSON(result.route, {
          style: {
            color: 'blue',
            weight: 5,
            opacity: 0.7,
          }
        }).addTo(map);
      }

      // Fit bounds to show both markers and route
      const bounds = L.latLngBounds([schoolLatLng, placeLatLng]);
      if (result.route) {
        result.route.features.forEach(feature => {
          const coords = feature.geometry.coordinates;
          coords.forEach(coord => {
            bounds.extend([coord[1], coord[0]]);
          });
        });
      }
      map.fitBounds(bounds, { padding: [50, 50] });
    };

    const timer = setTimeout(initMap, 300);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.off();
        mapRef.current.remove();
      }
    };
  }, [results, containerRef.current]);
};

export default useLeafletMap;