import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';

const iconRetinaUrl = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href;
const iconUrl = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href;
const shadowUrl = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const routeColors = ['blue', 'green', 'purple', 'red', 'orange', 'brown', 'magenta'];

const useLeafletMap = (containerRef, results) => {
  const mapRef = useRef(null);
  const clusterRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !results?.length) return;

    const initMap = () => {
      if (mapRef.current) mapRef.current.remove();
      if (clusterRef.current) clusterRef.current.clearLayers();

      const [lng, lat] = results[0].rawData.schoolCoords;
      const map = L.map(containerRef.current).setView([lat, lng], 13);
      mapRef.current = map;

      L.tileLayer(
        'https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoiZmFyZ28yMTkiLCJhIjoiY205Y25xajJxMHJlbzJpc2M4bjhhdm9hZCJ9.xhoZP4Gr0_3yo6N9EBnD_w',
        { attribution: '&copy; OpenStreetMap contributors' }
      ).addTo(map);

      const clusterGroup = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 40,
        disableClusteringAtZoom: 18
      });
      clusterRef.current = clusterGroup;

      const bounds = L.latLngBounds([]);

      results.forEach((result, i) => {
        const { schoolCoords, placeCoords } = result.rawData;
        const schoolLatLng = [schoolCoords[1], schoolCoords[0]];
        const placeLatLng = [placeCoords[1], placeCoords[0]];

        bounds.extend(schoolLatLng);
        bounds.extend(placeLatLng);

        const schoolMarker = L.marker(schoolLatLng).bindPopup(
          `<b>School:</b> ${result.school}<br/>
           <b>Amenity:</b> ${result.place}<br/>
           <b>Distance:</b> ${result.distance} km<br/>
           <b>Time:</b> ${result.time}`
        );
        const amenityMarker = L.marker(placeLatLng).bindPopup(
          `<b>Amenity:</b> ${result.place}`
        );

        clusterGroup.addLayer(schoolMarker);
        clusterGroup.addLayer(amenityMarker);

        if (result.route) {
          const routeColor = routeColors[i % routeColors.length];
          L.geoJSON(result.route, {
            style: {
              color: routeColor,
              weight: 3,
              opacity: 0.7,
            },
            onEachFeature: (feature, layer) => {
              layer.bindTooltip(`Route (${routeColor})`, { sticky: true });
            }
          }).addTo(map);
        }
      });

      clusterGroup.addTo(map);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
    };

    const timer = setTimeout(initMap, 300);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) mapRef.current.remove();
      if (clusterRef.current) clusterRef.current.clearLayers();
    };
  }, [results, containerRef.current]);
};

export default useLeafletMap;